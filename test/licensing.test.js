// Licensing API tests. Needs a throwaway database:
//   TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5433/superapp_test npm test
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { Pool } = require('pg');
const { createApp } = require('../app');
const { ensureLicenseSchema } = require('../licensing/schema');
const { verifyLicense } = require('../licensing/crypto');

const DB = process.env.TEST_DATABASE_URL;
const ADMIN = 'test-admin-key';
const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const publicPem = publicKey.export({ type: 'spki', format: 'pem' });

test('licensing API', { skip: !DB && 'TEST_DATABASE_URL not set' }, async (t) => {
  const pool = new Pool({ connectionString: DB });
  await pool.query('DROP TABLE IF EXISTS licenses');
  await ensureLicenseSchema(pool);
  const server = createApp({ pool, redis: null, licensePrivateKey: privatePem, adminApiKey: ADMIN }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { server.close(); await pool.end(); });

  const post = async (path, body, headers = {}) => {
    const res = await fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body || {}) });
    return { status: res.status, body: await res.json() };
  };
  const admin = { 'x-admin-key': ADMIN };

  await t.test('admin endpoints require the admin key', async () => {
    assert.equal((await post('/api/admin/licenses', { plan: 'year' })).status, 401);
    assert.equal((await post('/api/admin/licenses', { plan: 'year' }, { 'x-admin-key': 'wrong' })).status, 401);
  });

  const { body: created } = await post('/api/admin/licenses', { plan: 'year', note: 'Al Amin', count: 2 }, admin);
  const [yearKey, spareKey] = created.licenses.map((l) => l.key);
  const { body: lifeCreated } = await post('/api/admin/licenses', { plan: 'life' }, admin);
  const lifeKey = lifeCreated.licenses[0].key;

  await t.test('creates random keys in the expected format', () => {
    assert.match(yearKey, /^POS-[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    assert.notEqual(yearKey, spareKey);
  });

  await t.test('unknown key is rejected', async () => {
    const r = await post('/api/licenses/activate', { key: 'POS-AAAAA-BBBBB-CCCCC', deviceId: 'dev-1' });
    assert.equal(r.status, 404);
    assert.equal(r.body.error, 'invalid_key');
  });

  let token;
  await t.test('activation binds the device and returns a signed token', async () => {
    const r = await post('/api/licenses/activate', { key: yearKey.toLowerCase(), deviceId: 'dev-1', shopName: 'Al Amin' });
    assert.equal(r.status, 200);
    token = r.body.token;
    const payload = verifyLicense(token, publicPem);
    assert.ok(payload, 'signature verifies');
    assert.equal(payload.key, yearKey);
    assert.equal(payload.deviceId, 'dev-1');
    const days = (payload.expiresAt - Date.now()) / 86400000;
    assert.ok(days > 364 && days <= 365, `annual key expires in ~365 days (got ${days})`);
  });

  await t.test('a tampered token fails verification', () => {
    const [body, sig] = token.split('.');
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    payload.expiresAt = Date.now() + 100 * 365 * 86400000;
    const forged = Buffer.from(JSON.stringify(payload)).toString('base64url') + '.' + sig;
    assert.equal(verifyLicense(forged, publicPem), null);
  });

  await t.test('the same key cannot be used on another device', async () => {
    const r = await post('/api/licenses/activate', { key: yearKey, deviceId: 'dev-2' });
    assert.equal(r.status, 409);
    assert.equal(r.body.error, 'device_mismatch');
  });

  await t.test('refresh works for the bound device only', async () => {
    assert.equal((await post('/api/licenses/refresh', { key: yearKey, deviceId: 'dev-1' })).status, 200);
    assert.equal((await post('/api/licenses/refresh', { key: yearKey, deviceId: 'dev-2' })).status, 409);
    assert.equal((await post('/api/licenses/refresh', { key: spareKey, deviceId: 'dev-1' })).status, 404, 'refresh never activates');
  });

  await t.test('reset-device moves the key without extending it', async () => {
    const before = (await pool.query('SELECT expires_at FROM licenses WHERE key = $1', [yearKey])).rows[0].expires_at;
    assert.equal((await post(`/api/admin/licenses/${yearKey}/reset-device`, {}, admin)).status, 200);
    const r = await post('/api/licenses/activate', { key: yearKey, deviceId: 'dev-2' });
    assert.equal(r.status, 200);
    const after = (await pool.query('SELECT expires_at FROM licenses WHERE key = $1', [yearKey])).rows[0].expires_at;
    assert.equal(after.getTime(), before.getTime());
  });

  await t.test('lifetime keys have no expiry', async () => {
    const r = await post('/api/licenses/activate', { key: lifeKey, deviceId: 'dev-3' });
    assert.equal(r.status, 200);
    assert.equal(verifyLicense(r.body.token, publicPem).expiresAt, null);
  });

  await t.test('revoked keys stop working', async () => {
    await post(`/api/admin/licenses/${lifeKey}/revoke`, {}, admin);
    const r = await post('/api/licenses/refresh', { key: lifeKey, deviceId: 'dev-3' });
    assert.equal(r.status, 403);
    assert.equal(r.body.error, 'revoked');
  });

  await t.test('expired keys are reported as expired', async () => {
    await pool.query(`UPDATE licenses SET expires_at = now() - interval '1 day' WHERE key = $1`, [yearKey]);
    const r = await post('/api/licenses/refresh', { key: yearKey, deviceId: 'dev-2' });
    assert.equal(r.status, 410);
    assert.equal(r.body.error, 'expired');
  });

  await t.test('admin list and search', async () => {
    const res = await fetch(`${base}/api/admin/licenses?q=Al%20Amin`, { headers: admin });
    const body = await res.json();
    assert.equal(body.licenses.length, 2);
  });
});
