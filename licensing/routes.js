const express = require('express');
const { generateLicenseKey, normalizeKey, signLicense, safeEqual } = require('./crypto');

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// Error codes are stable strings the POS maps to its own (Arabic/English) messages.
const fail = (res, status, code) => res.status(status).json({ ok: false, error: code });

// Express 4 does not catch rejected promises from async handlers
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((err) => {
  console.error('licensing admin error', err);
  if (!res.headersSent) fail(res, 500, 'server_error');
});

/** Tiny fixed-window rate limiter (per IP) for the public activation endpoints. */
function rateLimit({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || 'unknown';
    const entry = hits.get(ip);
    if (!entry || now - entry.start > windowMs) {
      hits.set(ip, { start: now, count: 1 });
      return next();
    }
    entry.count += 1;
    if (entry.count > max) return fail(res, 429, 'rate_limited');
    next();
  };
}

function toPublic(row) {
  return {
    key: row.key,
    plan: row.plan,
    status: row.status,
    note: row.note,
    deviceId: row.device_id,
    shopName: row.shop_name,
    createdAt: row.created_at,
    activatedAt: row.activated_at,
    expiresAt: row.expires_at,
    lastSeenAt: row.last_seen_at,
  };
}

function issueToken(row, privateKeyPem) {
  return signLicense(
    {
      v: 1,
      key: row.key,
      deviceId: row.device_id,
      shop: row.shop_name,
      plan: row.plan,
      issuedAt: Date.now(),
      expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : null,
    },
    privateKeyPem
  );
}

/**
 * Public endpoints used by the POS:
 *   POST /activate { key, deviceId, shopName } -> { ok, token, license }
 *   POST /refresh  { key, deviceId }           -> { ok, token, license } (re-checks revocation/expiry)
 */
function createLicenseRouter({ pool, privateKeyPem }) {
  const router = express.Router();
  router.use(rateLimit({ windowMs: 10 * 60 * 1000, max: 30 }));

  async function check(req, res, { bind }) {
    const key = normalizeKey(req.body && req.body.key);
    const deviceId = String((req.body && req.body.deviceId) || '').trim();
    const shopName = String((req.body && req.body.shopName) || '').trim().slice(0, 200);
    if (!key || !deviceId || deviceId.length > 100) return fail(res, 400, 'bad_request');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query('SELECT * FROM licenses WHERE key = $1 FOR UPDATE', [key]);
      let row = rows[0];
      if (!row) { await client.query('ROLLBACK'); return fail(res, 404, 'invalid_key'); }
      if (row.status === 'revoked') { await client.query('ROLLBACK'); return fail(res, 403, 'revoked'); }

      if (!row.device_id) {
        if (!bind) { await client.query('ROLLBACK'); return fail(res, 404, 'invalid_key'); }
        // Bind to this device. The subscription clock starts on the very first activation only,
        // so moving a key to a new computer (reset-device) does not extend it.
        const now = new Date();
        const expires = row.plan === 'year' ? new Date(now.getTime() + YEAR_MS) : null;
        ({ rows: [row] } = await client.query(
          `UPDATE licenses SET device_id = $2, shop_name = COALESCE($3, shop_name), last_seen_at = $4,
             activated_at = COALESCE(activated_at, $4),
             expires_at = CASE WHEN activated_at IS NULL THEN $5 ELSE expires_at END
           WHERE key = $1 RETURNING *`,
          [key, deviceId, shopName || null, now, expires]
        ));
      } else if (row.device_id !== deviceId) {
        await client.query('ROLLBACK');
        return fail(res, 409, 'device_mismatch');
      } else {
        ({ rows: [row] } = await client.query(
          `UPDATE licenses SET last_seen_at = now(), shop_name = COALESCE($2, shop_name) WHERE key = $1 RETURNING *`,
          [key, shopName || null]
        ));
      }

      if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
        await client.query('COMMIT');
        return fail(res, 410, 'expired');
      }
      await client.query('COMMIT');
      return res.json({ ok: true, token: issueToken(row, privateKeyPem), license: toPublic(row) });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('licence check failed', err);
      return fail(res, 500, 'server_error');
    } finally {
      client.release();
    }
  }

  router.post('/activate', (req, res) => check(req, res, { bind: true }));
  router.post('/refresh', (req, res) => check(req, res, { bind: false }));
  return router;
}

/**
 * Admin endpoints (header "x-admin-key: <ADMIN_API_KEY>"):
 *   POST /             { plan: 'year'|'life', note?, count? } -> create keys
 *   GET  /             ?status=&q=                           -> list keys
 *   POST /:key/revoke                                        -> stop a key (takes effect on the POS's next online check)
 *   POST /:key/reset-device                                  -> allow the key to be activated on a new computer
 */
function createAdminRouter({ pool, adminApiKey }) {
  const router = express.Router();
  router.use((req, res, next) => {
    if (!adminApiKey || !safeEqual(req.get('x-admin-key'), adminApiKey)) return fail(res, 401, 'unauthorized');
    next();
  });

  router.post('/', wrap(async (req, res) => {
    const plan = req.body && req.body.plan;
    const count = Math.min(Math.max(parseInt((req.body && req.body.count) || 1, 10) || 1, 1), 100);
    const note = req.body && req.body.note ? String(req.body.note).slice(0, 500) : null;
    if (plan !== 'year' && plan !== 'life') return fail(res, 400, 'bad_plan');
    const created = [];
    for (let i = 0; i < count; i++) {
      const { rows } = await pool.query(
        'INSERT INTO licenses (key, plan, note) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING *',
        [generateLicenseKey(), plan, note]
      );
      if (rows[0]) created.push(toPublic(rows[0]));
    }
    res.status(201).json({ ok: true, licenses: created });
  }));

  router.get('/', wrap(async (req, res) => {
    const params = [];
    const where = [];
    if (req.query.status) { params.push(req.query.status); where.push(`status = $${params.length}`); }
    if (req.query.q) {
      params.push(`%${req.query.q}%`);
      where.push(`(key ILIKE $${params.length} OR shop_name ILIKE $${params.length} OR note ILIKE $${params.length})`);
    }
    const { rows } = await pool.query(
      `SELECT * FROM licenses ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT 500`,
      params
    );
    res.json({ ok: true, licenses: rows.map(toPublic) });
  }));

  const update = (sql) => wrap(async (req, res) => {
    const { rows } = await pool.query(sql, [normalizeKey(req.params.key)]);
    if (!rows[0]) return fail(res, 404, 'invalid_key');
    res.json({ ok: true, license: toPublic(rows[0]) });
  });
  router.post('/:key/revoke', update(`UPDATE licenses SET status = 'revoked' WHERE key = $1 RETURNING *`));
  router.post('/:key/reset-device', update(`UPDATE licenses SET device_id = NULL WHERE key = $1 RETURNING *`));

  return router;
}

module.exports = { createLicenseRouter, createAdminRouter };
