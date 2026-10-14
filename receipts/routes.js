const express = require('express');
const { safeEqual } = require('../licensing/crypto');

const fail = (res, status, code) => res.status(status).json({ ok: false, error: code });

// Express 4 does not catch rejected promises from async handlers
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((err) => {
  console.error('receipts error', err);
  if (!res.headersSent) fail(res, 500, 'server_error');
});

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCIES = ['LBP', 'USD'];
const FONTS = ['kufi', 'naskh', 'sans'];

const str = (v, max) => (v == null ? '' : String(v)).trim().slice(0, max);

// The list view never needs the signature and logo images, which make up most of a receipt's size.
function toSummary(row) {
  const d = row.data || {};
  return {
    id: row.id,
    no: row.receipt_no,
    payee: row.payee,
    reason: d.reason || '',
    date: d.date || '',
    currency: row.currency,
    total: Number(row.total),
    rows: Array.isArray(d.rows) ? d.rows : [],
    createdAt: row.created_at,
    savedAt: row.updated_at,
  };
}

function toFull(row) {
  return { ...row.data, ...toSummary(row) };
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
  const image = (v) => (typeof v === 'string' && v.startsWith('data:image/') && v.length < 600000 ? v : null);
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

/**
 * Receipt archive (header "x-receipts-key: <RECEIPTS_API_KEY>"):
 *   GET    /       -> { receipts: [summary] }  newest first, no signatures
 *   GET    /:id    -> { receipt }               full receipt with signatures
 *   PUT    /:id    receipt fields              -> create or replace
 *   DELETE /:id
 */
function createReceiptsRouter({ pool, apiKey }) {
  const router = express.Router();
  // Signatures are images, so these bodies are larger than the app-wide JSON limit
  router.use(express.json({ limit: '2mb' }));
  router.use((req, res, next) => {
    if (!apiKey) return fail(res, 503, 'not_configured');
    if (!safeEqual(req.get('x-receipts-key'), apiKey)) return fail(res, 401, 'unauthorized');
    next();
  });
  router.param('id', (req, res, next, id) => (ID_RE.test(id) ? next() : fail(res, 400, 'bad_id')));

  router.get('/', wrap(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT id, receipt_no, payee, total, currency, updated_at, created_at,
              data - 'adminSig' - 'empSig' - 'logo' AS data
         FROM receipts ORDER BY updated_at DESC LIMIT 1000`
    );
    res.json({ ok: true, receipts: rows.map(toSummary) });
  }));

  router.get('/:id', wrap(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM receipts WHERE id = $1', [req.params.id]);
    if (!rows[0]) return fail(res, 404, 'not_found');
    res.json({ ok: true, receipt: toFull(rows[0]) });
  }));

  router.put('/:id', wrap(async (req, res) => {
    const r = clean(req.body);
    if (!r) return fail(res, 400, 'bad_receipt');
    const { rows } = await pool.query(
      `INSERT INTO receipts (id, receipt_no, payee, receipt_date, total, currency, data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         receipt_no = EXCLUDED.receipt_no, payee = EXCLUDED.payee, receipt_date = EXCLUDED.receipt_date,
         total = EXCLUDED.total, currency = EXCLUDED.currency, data = EXCLUDED.data, updated_at = now()
       RETURNING *, (xmax = 0) AS inserted`,
      [req.params.id, r.no, r.payee, r.date || null, r.total, r.currency, r]
    );
    res.status(rows[0].inserted ? 201 : 200).json({ ok: true, receipt: toSummary(rows[0]) });
  }));

  router.delete('/:id', wrap(async (req, res) => {
    const { rowCount } = await pool.query('DELETE FROM receipts WHERE id = $1', [req.params.id]);
    if (!rowCount) return fail(res, 404, 'not_found');
    res.json({ ok: true });
  }));

  return router;
}

module.exports = { createReceiptsRouter };
