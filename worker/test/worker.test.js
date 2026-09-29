// Runs the Worker locally (wrangler dev + local D1) and exercises the licence API.
//   cd worker && npm test
import test from 'node:test';
import assert from 'node:assert';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import crypto from 'node:crypto';

const PORT = 8799;
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN = 'test-admin-key';
const persist = mkdtempSync(join(tmpdir(), 'pos-licensing-'));
const wrangler = join(process.cwd(), 'node_modules', '.bin', 'wrangler');

let proc;
test.before(async () => {
  proc = spawn(wrangler, ['dev', '--local', '--port', String(PORT), '--persist-to', persist, '--var', `ADMIN_API_KEY:${ADMIN} `], { stdio: 'pipe' });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${BASE}/api/health`)).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('wrangler dev did not start');
});
test.after(() => { proc?.kill(); rmSync(persist, { recursive: true, force: true }); });

const sql = (command) =>
  execFileSync(wrangler, ['d1', 'execute', 'pos-licensing', '--local', '--persist-to', persist, '--command', command], { stdio: 'pipe' });
const post = async (path, body, headers = {}) => {
  const res = await fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body || {}) });
  return { status: res.status, body: await res.json() };
};
const admin = { 'x-admin-key': ADMIN };
let publicPem;
const verify = (token) => {
  const [body, sig] = token.split('.');
  const ok = crypto.verify('sha256', Buffer.from(body), { key: publicPem, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url'));
  return ok ? JSON.parse(Buffer.from(body, 'base64url').toString()) : null;
};

test('licence API on Workers', async (t) => {
  const { publicKey } = await (await fetch(`${BASE}/api/licenses/public-key`)).json();
  publicPem = crypto.createPublicKey({ key: Buffer.from(publicKey, 'base64'), format: 'der', type: 'spki' });

  await t.test('public key is stable across requests', async () => {
    const again = await (await fetch(`${BASE}/api/licenses/public-key`)).json();
    assert.equal(again.publicKey, publicKey);
  });

  await t.test('admin endpoints require the admin key', async () => {
    assert.equal((await post('/api/admin/licenses', { plan: 'year' })).status, 401);
    assert.equal((await post('/api/admin/licenses', { plan: 'year' }, { 'x-admin-key': 'nope' })).status, 401);
  });

  await t.test('admin key tolerates surrounding whitespace', async () => {
    assert.equal((await post('/api/admin/licenses', { plan: 'year', count: 1, note: 'ws' }, { 'x-admin-key': `  ${ADMIN} ` })).status, 201);
  });

  const created = (await post('/api/admin/licenses', { plan: 'year', note: 'Al Amin', count: 2 }, admin)).body.licenses;
  const [yearKey, spareKey] = created.map((l) => l.key);
  const lifeKey = (await post('/api/admin/licenses', { plan: 'life' }, admin)).body.licenses[0].key;

  await t.test('keys are random and well formed', () => {
    assert.match(yearKey, /^POS-[A-Z2-9]{5}-[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    assert.notEqual(yearKey, spareKey);
  });

  await t.test('unknown key is rejected', async () => {
    assert.equal((await post('/api/licenses/activate', { key: 'POS-AAAAA-BBBBB-CCCCC', deviceId: 'd1' })).body.error, 'invalid_key');
  });

  let token;
  await t.test('activation binds the device and returns a verifiable token', async () => {
    const r = await post('/api/licenses/activate', { key: yearKey.toLowerCase(), deviceId: 'dev-1', shopName: 'Al Amin' });
    assert.equal(r.status, 200);
    token = r.body.token;
    const p = verify(token);
    assert.ok(p, 'signature verifies with the published public key');
    assert.equal(p.key, yearKey);
    assert.equal(p.deviceId, 'dev-1');
    const days = (p.expiresAt - Date.now()) / 86400000;
    assert.ok(days > 364 && days <= 365, `expires in ~365 days (${days})`);
  });

  await t.test('a tampered token fails verification', () => {
    const [body, sig] = token.split('.');
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    p.expiresAt += 10 * 365 * 86400000;
    assert.equal(verify(Buffer.from(JSON.stringify(p)).toString('base64url') + '.' + sig), null);
  });

  await t.test('another device is refused', async () => {
    assert.equal((await post('/api/licenses/activate', { key: yearKey, deviceId: 'dev-2' })).body.error, 'device_mismatch');
  });

  await t.test('refresh only for the bound device and never activates', async () => {
    assert.equal((await post('/api/licenses/refresh', { key: yearKey, deviceId: 'dev-1' })).status, 200);
    assert.equal((await post('/api/licenses/refresh', { key: yearKey, deviceId: 'dev-2' })).status, 409);
    assert.equal((await post('/api/licenses/refresh', { key: spareKey, deviceId: 'dev-1' })).status, 404);
  });

  await t.test('reset-device moves the key without extending it', async () => {
    const before = verify((await post('/api/licenses/refresh', { key: yearKey, deviceId: 'dev-1' })).body.token).expiresAt;
    assert.equal((await post(`/api/admin/licenses/${yearKey}/reset-device`, {}, admin)).status, 200);
    const r = await post('/api/licenses/activate', { key: yearKey, deviceId: 'dev-2' });
    assert.equal(r.status, 200);
    assert.equal(verify(r.body.token).expiresAt, before);
  });

  await t.test('lifetime keys have no expiry', async () => {
    const r = await post('/api/licenses/activate', { key: lifeKey, deviceId: 'dev-3' });
    assert.equal(verify(r.body.token).expiresAt, null);
  });

  await t.test('revoked keys stop working', async () => {
    await post(`/api/admin/licenses/${lifeKey}/revoke`, {}, admin);
    assert.equal((await post('/api/licenses/refresh', { key: lifeKey, deviceId: 'dev-3' })).body.error, 'revoked');
  });

  await t.test('expired keys are reported as expired', async () => {
    sql(`UPDATE licenses SET expires_at = ${Date.now() - 86400000} WHERE key = '${yearKey}'`);
    assert.equal((await post('/api/licenses/refresh', { key: yearKey, deviceId: 'dev-2' })).body.error, 'expired');
  });

  await t.test('admin list and search', async () => {
    const body = await (await fetch(`${BASE}/api/admin/licenses?q=Al%20Amin`, { headers: admin })).json();
    assert.equal(body.licenses.length, 2);
  });

  await t.test('admin page is served', async () => {
    const html = await (await fetch(`${BASE}/admin`)).text();
    assert.match(html, /إدارة تراخيص/);
  });
});
