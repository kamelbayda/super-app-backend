// Receipts API tests. Needs a throwaway database:
//   TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5433/superapp_test npm test
const test = require('node:test');
const assert = require('node:assert');
const { Pool } = require('pg');
const { createApp } = require('../app');
const { ensureReceiptSchema } = require('../receipts/schema');

const DB = process.env.TEST_DATABASE_URL;
const KEY = 'test-receipts-key';
const SIG = 'data:image/png;base64,iVBORw0KGgo=';

test('receipts API', { skip: !DB && 'TEST_DATABASE_URL not set' }, async (t) => {
  const pool = new Pool({ connectionString: DB });
  await pool.query('DROP TABLE IF EXISTS receipts');
  await ensureReceiptSchema(pool);
  const server = createApp({ pool, redis: null, receiptsApiKey: KEY }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { server.close(); await pool.end(); });

  const call = async (method, path, body, key = KEY) => {
    const headers = { 'content-type': 'application/json' };
    if (key) headers['x-receipts-key'] = key;
    const res = await fetch(base + '/api/receipts' + path, { method, headers, body: body && JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  };
  const receipt = {
    no: '1', org: 'مدرسة القلمون للصبيان', city: 'القلمون', date: '2026-01-29', currency: 'LBP',
    payee: 'أحمد محمد', reason: 'راتب شهري', adminName: '',
    rows: [{ y: '2025', m: 11, a: 32000000, d: '2026-01-29', f: '2025-12-01', t: '2025-12-31' }],
    total: 1, // ignored: the server recomputes it
    adminSig: SIG, empSig: SIG, logo: SIG, font: 'naskh',
  };

  await t.test('requires the receipts key', async () => {
    assert.equal((await call('GET', '/', null, null)).status, 401);
    assert.equal((await call('GET', '/', null, 'wrong')).status, 401);
  });

  await t.test('is disabled when no key is configured', async () => {
    const off = createApp({ pool, redis: null }).listen(0);
    try {
      const res = await fetch(`http://127.0.0.1:${off.address().port}/api/receipts`, { headers: { 'x-receipts-key': '' } });
      assert.equal(res.status, 503);
    } finally { off.close(); }
  });

  await t.test('creates a receipt and recomputes the total', async () => {
    const r = await call('PUT', '/r1', receipt);
    assert.equal(r.status, 201);
    assert.equal(r.body.receipt.total, 32000000);
    assert.equal(r.body.receipt.payee, 'أحمد محمد');
  });

  await t.test('lists summaries without signatures, newest first', async () => {
    await call('PUT', '/r2', { ...receipt, no: '2', payee: 'خالد', rows: [{ y: '2026', m: 0, a: 1500000, d: '2026-02-01' }] });
    const r = await call('GET', '/');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.receipts.map((x) => x.id), ['r2', 'r1']);
    assert.equal(r.body.receipts[0].adminSig, undefined);
    assert.equal(r.body.receipts[0].logo, undefined);
    assert.equal(r.body.receipts[1].reason, 'راتب شهري');
  });

  await t.test('returns the full receipt with signatures', async () => {
    const r = await call('GET', '/r1');
    assert.equal(r.status, 200);
    assert.equal(r.body.receipt.empSig, SIG);
    assert.equal(r.body.receipt.logo, SIG);
    assert.equal(r.body.receipt.font, 'naskh');
    assert.equal(r.body.receipt.rows[0].f, '2025-12-01');
    assert.equal(r.body.receipt.rows[0].t, '2025-12-31');
    assert.equal(r.body.receipt.org, 'مدرسة القلمون للصبيان');
  });

  await t.test('updates an existing receipt in place', async () => {
    const r = await call('PUT', '/r1', { ...receipt, payee: 'أحمد علي' });
    assert.equal(r.status, 200);
    const list = await call('GET', '/');
    assert.equal(list.body.receipts.length, 2);
    assert.equal(list.body.receipts[0].payee, 'أحمد علي');
  });

  await t.test('accepts receipts larger than the app-wide JSON limit', async () => {
    const big = 'data:image/png;base64,' + 'A'.repeat(300000);
    const r = await call('PUT', '/r3', { ...receipt, adminSig: big, empSig: big });
    assert.equal(r.status, 201);
  });

  await t.test('rejects bad input', async () => {
    assert.equal((await call('PUT', '/r4', { ...receipt, rows: [] })).status, 400);
    assert.equal((await call('PUT', '/r4', { ...receipt, rows: [{ y: '2025', m: 1, a: 0 }] })).status, 400);
    assert.equal((await call('PUT', '/bad%20id', receipt)).status, 400);
    assert.equal((await call('GET', '/missing')).status, 404);
  });

  await t.test('deletes a receipt', async () => {
    assert.equal((await call('DELETE', '/r2')).status, 200);
    assert.equal((await call('DELETE', '/r2')).status, 404);
    assert.equal((await call('GET', '/r2')).status, 404);
  });
});
