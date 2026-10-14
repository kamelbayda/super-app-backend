// Receipts (إيصال قبض): the page at /receipt and its archive at /api/receipts, kept in D1.
// Same API as the Express version (../receipts/routes.js), so the page works on either server.
// The archive password is RECEIPTS_API_KEY, or ADMIN_API_KEY when that is not set.
import RECEIPT_PAGE from '../../public/receipt/index.html';

export { RECEIPT_PAGE };

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const fail = (status, error) => json({ ok: false, error }, status);

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCIES = ['LBP', 'USD'];
const FONTS = ['kufi', 'naskh', 'sans'];
// D1 rows top out near 2 MB; signatures and the logo are small PNGs in practice
const MAX_IMAGE = 500000;
const MAX_BODY = 1800000;

const str = (v, max) => (v == null ? '' : String(v)).trim().slice(0, max);
const image = (v) => (typeof v === 'string' && v.startsWith('data:image/') && v.length < MAX_IMAGE ? v : null);

function safeEqual(a, b) {
  const x = new TextEncoder().encode(String(a || '')), y = new TextEncoder().encode(String(b || ''));
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/** Validates the page's receipt and recomputes the total so the list can't drift from the rows. */
function clean(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (!Array.isArray(body.rows) || body.rows.length > 60) return null;
  const rows = body.rows.map((r) => ({
    y: str(r && r.y, 8),
    m: Math.min(Math.max(parseInt(r && r.m, 10) || 0, 0), 11),
    a: Math.max(Number(r && r.a) || 0, 0),
    d: DATE_RE.test(r && r.d) ? r.d : '',
    // Optional period the payment covers (من / إلى)
    f: DATE_RE.test(r && r.f) ? r.f : '',
    t: DATE_RE.test(r && r.t) ? r.t : '',
  }));
  const total = Math.round(rows.reduce((s, r) => s + r.a, 0) * 100) / 100;
  if (!(total > 0) || total >= 1e16) return null;
  return {
    no: str(body.no, 40),
    org: str(body.org, 200),
    city: str(body.city, 100),
    date: DATE_RE.test(body.date) ? body.date : '',
    currency: CURRENCIES.includes(body.currency) ? body.currency : 'LBP',
    payee: str(body.payee, 200),
    reason: str(body.reason, 300),
    adminName: str(body.adminName, 200),
    rows,
    total,
    adminSig: image(body.adminSig),
    empSig: image(body.empSig),
    logo: image(body.logo),
    font: FONTS.includes(body.font) ? body.font : 'kufi',
  };
}

const iso = (ms) => (ms ? new Date(ms).toISOString() : null);
function toSummary(row) {
  const d = typeof row.data === 'string' ? JSON.parse(row.data) : row.data || {};
  return {
    id: row.id, no: row.receipt_no, payee: row.payee, reason: d.reason || '', date: d.date || '',
    currency: row.currency, total: Number(row.total), rows: Array.isArray(d.rows) ? d.rows : [],
    createdAt: iso(row.created_at), savedAt: iso(row.updated_at),
  };
}
const toFull = (row) => ({ ...JSON.parse(row.data), ...toSummary(row) });

let ready = null;
function prepare(env) {
  if (!ready) {
    ready = env.DB.prepare(`CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      receipt_no TEXT,
      payee TEXT,
      receipt_date TEXT,
      total REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'LBP',
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`).run().catch((err) => { ready = null; throw err; });
  }
  return ready;
}

/**
 *   GET    /api/receipts       -> { receipts: [summary] }  newest first, no images
 *   GET    /api/receipts/:id   -> { receipt }               full receipt with images
 *   PUT    /api/receipts/:id   receipt fields              -> create or replace
 *   DELETE /api/receipts/:id
 */
export async function receipts(request, env, path) {
  // Trim both sides: a secret pasted into the dashboard often carries a stray space or newline.
  const expected = String(env.RECEIPTS_API_KEY || env.ADMIN_API_KEY || '').trim();
  if (!expected) return fail(503, 'not_configured');
  if (!safeEqual((request.headers.get('x-receipts-key') || '').trim(), expected)) return fail(401, 'unauthorized');
  await prepare(env);

  if (path === '/api/receipts' && request.method === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT id, receipt_no, payee, total, currency, created_at, updated_at,
              json_remove(data, '$.adminSig', '$.empSig', '$.logo') AS data
         FROM receipts ORDER BY updated_at DESC LIMIT 1000`
    ).all();
    return json({ ok: true, receipts: results.map(toSummary) });
  }

  const m = path.match(/^\/api\/receipts\/([^/]+)$/);
  if (!m) return fail(404, 'not_found');
  const id = decodeURIComponent(m[1]);
  if (!ID_RE.test(id)) return fail(400, 'bad_id');

  if (request.method === 'GET') {
    const row = await env.DB.prepare('SELECT * FROM receipts WHERE id = ?').bind(id).first();
    return row ? json({ ok: true, receipt: toFull(row) }) : fail(404, 'not_found');
  }
  if (request.method === 'PUT') {
    const text = await request.text();
    if (text.length > MAX_BODY) return fail(413, 'too_large');
    let body = null;
    try { body = JSON.parse(text); } catch {}
    const r = clean(body);
    if (!r) return fail(400, 'bad_receipt');
    const now = Date.now();
    const existed = await env.DB.prepare('SELECT 1 FROM receipts WHERE id = ?').bind(id).first();
    await env.DB.prepare(
      `INSERT INTO receipts (id, receipt_no, payee, receipt_date, total, currency, data, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET
         receipt_no = excluded.receipt_no, payee = excluded.payee, receipt_date = excluded.receipt_date,
         total = excluded.total, currency = excluded.currency, data = excluded.data, updated_at = excluded.updated_at`
    ).bind(id, r.no, r.payee, r.date || null, r.total, r.currency, JSON.stringify(r), now, now).run();
    const row = await env.DB.prepare('SELECT * FROM receipts WHERE id = ?').bind(id).first();
    return json({ ok: true, receipt: toSummary(row) }, existed ? 200 : 201);
  }
  if (request.method === 'DELETE') {
    const res = await env.DB.prepare('DELETE FROM receipts WHERE id = ?').bind(id).run();
    return res.meta && res.meta.changes ? json({ ok: true }) : fail(404, 'not_found');
  }
  return fail(405, 'method_not_allowed');
}
