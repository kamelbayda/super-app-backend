/**
 * POS licence server on Cloudflare Workers + D1 (free tier, always on).
 *
 * Same API as the Express version (../licensing), so the POS app and
 * scripts/licenses.js work unchanged:
 *   POST /api/licenses/activate   { key, deviceId, shopName, email? }
 *   POST /api/licenses/refresh    { key, deviceId }
 *   GET  /api/licenses/public-key -> base64 SPKI for VITE_LICENSE_PUBLIC_KEY
 *   /api/admin/licenses...        (header x-admin-key = ADMIN_API_KEY secret)
 *   GET  /admin                   browser admin page (works from a phone/tablet)
 *
 * Subscriptions (self-service sign-up, approved by the admin):
 *   GET  /api/plans               business types, periods, prices and payment instructions
 *   POST /api/requests            { businessType, period, shopName, ownerName, email, phone, note } -> { id, secret }
 *   GET  /api/requests/:id?secret=  status; once approved it carries the licence key
 *   /api/admin/requests...        list, approve (creates the key), reject
 *   GET/POST /api/admin/plans     prices and payment instructions shown to customers
 *
 * The ECDSA P-256 signing key pair is generated on first use and stored in D1,
 * so no key needs to be created or pasted by hand.
 *
 * Each key may carry the customer's email (set by the admin, or the shop owner's email
 * sent on the first activation) so keys are easy to recognise and search.
 *
 * A key may be used on several computers of the same shop (max_devices, default 1).
 * The devices are kept in license_devices; licenses.device_id remains the first one.
 *
 * A key belongs to ONE shop: the app sends its shop id (shared by the shop's computers through
 * cloud sync, different for every shop, even several shops on one browser). The first shop
 * that uses the key owns it; another shop gets 'other_shop'. reset-device frees it.
 */
import { ADMIN_PAGE } from './admin-page.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_MS = 365 * DAY_MS;
// Subscription periods. The licences table only allows plan 'year' | 'life', so a monthly
// key is stored as plan 'year' with period 'month'; the period decides the expiry.
const PERIODS = { month: 30 * DAY_MS, year: YEAR_MS, life: null };
const BUSINESS_TYPES = ['supermarket', 'phones'];
const periodOf = (row) => row.period || row.plan;
const DEFAULT_PLANS = {
  currency: '$',
  prices: { supermarket: { month: null, year: null, life: null }, phones: { month: null, year: null, life: null } },
  paymentInfo: '',
};
const KEY_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
const ECDSA = { name: 'ECDSA', namedCurve: 'P-256' };
const SIGN = { name: 'ECDSA', hash: 'SHA-256' };

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, x-admin-key',
};
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...CORS } });
const fail = (status, error) => json({ ok: false, error }, status);

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const utf8 = (s) => new TextEncoder().encode(s);

// ---------- schema & signing key (prepared once per isolate) ----------
let ready = null;
function prepare(env) {
  if (!ready) {
    ready = (async () => {
      await env.DB.batch([
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS licenses (
          key TEXT PRIMARY KEY,
          plan TEXT NOT NULL CHECK (plan IN ('year','life')),
          note TEXT,
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
          device_id TEXT,
          shop_name TEXT,
          created_at INTEGER NOT NULL,
          activated_at INTEGER,
          expires_at INTEGER,
          last_seen_at INTEGER
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS config (k TEXT PRIMARY KEY, v TEXT NOT NULL)`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS subscription_requests (
          id TEXT PRIMARY KEY,
          secret TEXT NOT NULL,
          business_type TEXT NOT NULL,
          period TEXT NOT NULL,
          shop_name TEXT,
          owner_name TEXT,
          email TEXT,
          phone TEXT,
          note TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          license_key TEXT,
          created_at INTEGER NOT NULL,
          decided_at INTEGER
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS license_devices (
          key TEXT NOT NULL,
          device_id TEXT NOT NULL,
          first_seen_at INTEGER NOT NULL,
          last_seen_at INTEGER,
          PRIMARY KEY (key, device_id)
        )`),
      ]);
      await migrate(env);
      return loadSigningKey(env);
    })().catch((err) => { ready = null; throw err; });
  }
  return ready;
}

// Adds columns to databases created by older versions and copies the bound devices
async function migrate(env) {
  const { results } = await env.DB.prepare(`PRAGMA table_info(licenses)`).all();
  if (!results.some((c) => c.name === 'max_devices')) {
    await env.DB.prepare(`ALTER TABLE licenses ADD COLUMN max_devices INTEGER NOT NULL DEFAULT 1`).run()
      .catch(() => {}); // another isolate may have added it first
  }
  if (!results.some((c) => c.name === 'email')) {
    await env.DB.prepare(`ALTER TABLE licenses ADD COLUMN email TEXT`).run().catch(() => {});
  }
  if (!results.some((c) => c.name === 'period')) {
    await env.DB.prepare(`ALTER TABLE licenses ADD COLUMN period TEXT`).run().catch(() => {});
  }
  if (!results.some((c) => c.name === 'business_type')) {
    await env.DB.prepare(`ALTER TABLE licenses ADD COLUMN business_type TEXT`).run().catch(() => {});
  }
  if (!results.some((c) => c.name === 'shop_uid')) {
    await env.DB.prepare(`ALTER TABLE licenses ADD COLUMN shop_uid TEXT`).run().catch(() => {});
  }
  // What each device reports about itself, shown in the admin device list
  const { results: devCols } = await env.DB.prepare(`PRAGMA table_info(license_devices)`).all();
  if (!devCols.some((c) => c.name === 'label')) {
    await env.DB.prepare(`ALTER TABLE license_devices ADD COLUMN label TEXT`).run().catch(() => {});
  }
  if (!devCols.some((c) => c.name === 'shop_name')) {
    await env.DB.prepare(`ALTER TABLE license_devices ADD COLUMN shop_name TEXT`).run().catch(() => {});
  }
  await env.DB.prepare(
    `INSERT OR IGNORE INTO license_devices (key, device_id, first_seen_at, last_seen_at)
     SELECT key, device_id, COALESCE(activated_at, created_at), last_seen_at FROM licenses WHERE device_id IS NOT NULL`
  ).run();
}

async function loadSigningKey(env) {
  const read = async () => {
    const { results } = await env.DB.prepare(`SELECT k, v FROM config WHERE k IN ('signing_private_jwk','signing_public_spki')`).all();
    return Object.fromEntries(results.map((r) => [r.k, r.v]));
  };
  let cfg = await read();
  if (!cfg.signing_private_jwk) {
    const pair = await crypto.subtle.generateKey(ECDSA, true, ['sign', 'verify']);
    const jwk = JSON.stringify(await crypto.subtle.exportKey('jwk', pair.privateKey));
    const spki = b64(await crypto.subtle.exportKey('spki', pair.publicKey));
    // INSERT OR IGNORE: if another instance won the race, keep its key and re-read
    await env.DB.batch([
      env.DB.prepare(`INSERT OR IGNORE INTO config (k, v) VALUES ('signing_private_jwk', ?)`).bind(jwk),
      env.DB.prepare(`INSERT OR IGNORE INTO config (k, v) VALUES ('signing_public_spki', ?)`).bind(spki),
    ]);
    cfg = await read();
  }
  const privateKey = await crypto.subtle.importKey('jwk', JSON.parse(cfg.signing_private_jwk), ECDSA, false, ['sign']);
  return { privateKey, publicSpki: cfg.signing_public_spki };
}

async function signLicense(payload, privateKey) {
  const body = b64url(utf8(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign(SIGN, privateKey, utf8(body));
  return `${body}.${b64url(sig)}`;
}

// ---------- helpers ----------
function generateLicenseKey() {
  const groups = [];
  for (let g = 0; g < 3; g++) {
    const bytes = crypto.getRandomValues(new Uint8Array(5));
    groups.push([...bytes].map((b) => KEY_ALPHABET[b % KEY_ALPHABET.length]).join(''));
  }
  return `POS-${groups.join('-')}`;
}
/** Inserts a new key (retrying on the unlikely key collision). */
async function createLicense(env, { period, businessType, note, email, maxDevices }) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await env.DB.prepare(
      `INSERT OR IGNORE INTO licenses (key, plan, period, business_type, note, email, created_at, max_devices)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
    ).bind(generateLicenseKey(), period === 'life' ? 'life' : 'year', period, businessType, note, email, Date.now(), maxDevices).first();
    if (row) return row;
  }
  return null;
}

const clampDevices = (n) => Math.min(Math.max(parseInt(n || 1, 10) || 1, 1), 20);
const normalizeKey = (k) => String(k || '').trim().toUpperCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Lowercased email, '' when empty, or null when it is not a valid address. */
function cleanEmail(value) {
  const e = String(value || '').trim().toLowerCase();
  if (!e) return '';
  return e.length <= 200 && EMAIL_RE.test(e) ? e : null;
}
const iso = (ms) => (ms == null ? null : new Date(ms).toISOString());
const toPublic = (r) => ({
  key: r.key, plan: r.plan, period: periodOf(r), businessType: r.business_type || 'supermarket',
  status: r.status, note: r.note, email: r.email ?? null, deviceId: r.device_id, shopName: r.shop_name,
  maxDevices: r.max_devices ?? 1, devices: r.device_count ?? (r.device_id ? 1 : 0),
  createdAt: iso(r.created_at), activatedAt: iso(r.activated_at), expiresAt: iso(r.expires_at), lastSeenAt: iso(r.last_seen_at),
});

function safeEqual(a, b) {
  const x = utf8(String(a || '')), y = utf8(String(b || ''));
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// Best-effort per-instance rate limit for the public endpoints (keys have 75 bits of entropy anyway)
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now - e.start > 10 * 60 * 1000) { hits.set(ip, { start: now, count: 1 }); return false; }
  e.count += 1;
  return e.count > 30;
}

// ---------- public licence endpoints ----------
async function checkLicense(request, env, { bind }) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (rateLimited(ip)) return fail(429, 'rate_limited');
  const body = await request.json().catch(() => ({}));
  const key = normalizeKey(body.key);
  const deviceId = String(body.deviceId || '').trim();
  const shopName = String(body.shopName || '').trim().slice(0, 200) || null;
  const ownerEmail = cleanEmail(body.email) || null;
  const shopUid = String(body.shopUid || '').trim().slice(0, 100) || null;
  const deviceLabel = String(body.deviceLabel || '').trim().slice(0, 120) || null;
  if (!key || !deviceId || deviceId.length > 100) return fail(400, 'bad_request');

  const { privateKey } = await prepare(env);
  const get = () => env.DB.prepare(`SELECT *, (SELECT COUNT(*) FROM license_devices d WHERE d.key = licenses.key) AS device_count
    FROM licenses WHERE key = ?`).bind(key).first();
  let row = await get();
  if (!row) return fail(404, 'invalid_key');
  if (row.status === 'revoked') return fail(403, 'revoked');
  // One key, one shop
  if (row.shop_uid && shopUid && row.shop_uid !== shopUid) return fail(409, 'other_shop');
  const now = Date.now();

  const known = await env.DB.prepare('SELECT 1 FROM license_devices WHERE key = ? AND device_id = ?').bind(key, deviceId).first();
  if (!known) {
    if (!bind) return fail(row.device_count ? 409 : 404, row.device_count ? 'device_mismatch' : 'invalid_key');
    // Add this computer if the key still has a free device slot (checked in the same statement)
    const added = await env.DB.prepare(
      `INSERT OR IGNORE INTO license_devices (key, device_id, first_seen_at, last_seen_at)
       SELECT ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM license_devices WHERE key = ?) < ?`
    ).bind(key, deviceId, now, now, key, row.max_devices ?? 1).run();
    if (!added.meta?.changes) return fail(409, 'device_mismatch');
    // The subscription clock starts on the very first activation only, so adding or moving
    // computers (reset-device) does not extend it.
    const span = PERIODS[periodOf(row)];
    const expires = span ? now + span : null;
    await env.DB.prepare(
      `UPDATE licenses SET device_id = COALESCE(device_id, ?), shop_name = COALESCE(?, shop_name), email = COALESCE(email, ?), last_seen_at = ?,
         expires_at = CASE WHEN activated_at IS NULL THEN ? ELSE expires_at END,
         activated_at = COALESCE(activated_at, ?)
       WHERE key = ?`
    ).bind(deviceId, shopName, ownerEmail, now, expires, now, key).run();
  } else {
    await env.DB.batch([
      env.DB.prepare(`UPDATE licenses SET last_seen_at = ?, shop_name = COALESCE(?, shop_name) WHERE key = ?`).bind(now, shopName, key),
      env.DB.prepare(`UPDATE license_devices SET last_seen_at = ? WHERE key = ? AND device_id = ?`).bind(now, key, deviceId),
    ]);
  }
  if (deviceLabel || shopName) {
    await env.DB.prepare(`UPDATE license_devices SET label = COALESCE(?, label), shop_name = COALESCE(?, shop_name) WHERE key = ? AND device_id = ?`)
      .bind(deviceLabel, shopName, key, deviceId).run();
  }
  // The first shop to use the key owns it (also claims keys activated before shops were tracked)
  if (shopUid && !row.shop_uid) {
    await env.DB.prepare(`UPDATE licenses SET shop_uid = ? WHERE key = ? AND shop_uid IS NULL`).bind(shopUid, key).run();
  }
  row = await get();
  if (row.shop_uid && shopUid && row.shop_uid !== shopUid) return fail(409, 'other_shop');
  if (row.expires_at && row.expires_at < now) return fail(410, 'expired');

  const token = await signLicense(
    { v: 1, key: row.key, deviceId, shop: row.shop_name, plan: row.plan, period: periodOf(row),
      businessType: row.business_type || 'supermarket', issuedAt: now, expiresAt: row.expires_at ?? null },
    privateKey
  );
  return json({ ok: true, token, license: toPublic(row) });
}

// ---------- subscriptions ----------
async function readPlans(env) {
  const row = await env.DB.prepare(`SELECT v FROM config WHERE k = 'plans'`).first();
  const saved = row ? JSON.parse(row.v) : {};
  const plans = JSON.parse(JSON.stringify(DEFAULT_PLANS));
  for (const type of BUSINESS_TYPES) Object.assign(plans.prices[type], saved.prices?.[type] || {});
  if (saved.paymentInfo) plans.paymentInfo = saved.paymentInfo;
  if (saved.currency) plans.currency = saved.currency;
  return plans;
}

const requestPublic = (r) => ({
  id: r.id, businessType: r.business_type, period: r.period, shopName: r.shop_name, ownerName: r.owner_name,
  email: r.email, phone: r.phone, note: r.note, status: r.status, licenseKey: r.license_key,
  createdAt: iso(r.created_at), decidedAt: iso(r.decided_at),
});

const randomId = (bytes) => b64url(crypto.getRandomValues(new Uint8Array(bytes)));

async function createRequest(request, env) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (rateLimited(ip)) return fail(429, 'rate_limited');
  const body = await request.json().catch(() => ({}));
  const businessType = String(body.businessType || '');
  const period = String(body.period || '');
  const text = (v, n) => String(v || '').trim().slice(0, n) || null;
  const email = cleanEmail(body.email);
  const phone = text(body.phone, 40);
  if (!BUSINESS_TYPES.includes(businessType) || !(period in PERIODS)) return fail(400, 'bad_request');
  if (!email) return fail(400, 'bad_email');
  if (!phone) return fail(400, 'bad_phone');
  await prepare(env);
  const id = randomId(9);
  const secret = randomId(18);
  await env.DB.prepare(
    `INSERT INTO subscription_requests (id, secret, business_type, period, shop_name, owner_name, email, phone, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, secret, businessType, period, text(body.shopName, 200), text(body.ownerName, 120), email, phone, text(body.note, 500), Date.now()).run();
  return json({ ok: true, id, secret }, 201);
}

async function requestStatus(env, id, secret) {
  await prepare(env);
  const r = await env.DB.prepare(`SELECT * FROM subscription_requests WHERE id = ?`).bind(id).first();
  if (!r || !safeEqual(secret, r.secret)) return fail(404, 'not_found');
  return json({ ok: true, status: r.status, period: r.period, businessType: r.business_type, licenseKey: r.status === 'approved' ? r.license_key : null });
}

// ---------- admin endpoints ----------
async function admin(request, env, path) {
  // Trim both sides: a secret pasted into the dashboard often carries a stray space or newline.
  const expected = String(env.ADMIN_API_KEY || '').trim();
  if (!expected) return fail(503, 'admin_key_not_set');
  if (!safeEqual((request.headers.get('x-admin-key') || '').trim(), expected)) return fail(401, 'unauthorized');
  await prepare(env);
  const url = new URL(request.url);

  if (path === '/api/admin/licenses' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    // `period` (month | year | life) is the new way; `plan` (year | life) is still accepted
    const period = body.period || body.plan;
    if (!(period in PERIODS)) return fail(400, 'bad_plan');
    const businessType = body.businessType || 'supermarket';
    if (!BUSINESS_TYPES.includes(businessType)) return fail(400, 'bad_business_type');
    const count = Math.min(Math.max(parseInt(body.count || 1, 10) || 1, 1), 100);
    const note = body.note ? String(body.note).slice(0, 500) : null;
    const email = cleanEmail(body.email);
    if (email === null) return fail(400, 'bad_email');
    const maxDevices = clampDevices(body.maxDevices);
    const created = [];
    for (let i = 0; i < count; i++) {
      const row = await createLicense(env, { period, businessType, note, email: email || null, maxDevices });
      if (row) created.push(toPublic(row));
    }
    return json({ ok: true, licenses: created }, 201);
  }

  if (path === '/api/admin/licenses' && request.method === 'GET') {
    const where = [], params = [];
    if (url.searchParams.get('status')) { where.push('status = ?'); params.push(url.searchParams.get('status')); }
    const q = url.searchParams.get('q');
    if (q) {
      where.push('(key LIKE ? OR shop_name LIKE ? OR note LIKE ? OR email LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q.toLowerCase()}%`);
    }
    const { results } = await env.DB.prepare(
      `SELECT *, (SELECT COUNT(*) FROM license_devices d WHERE d.key = licenses.key) AS device_count
       FROM licenses ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT 500`
    ).bind(...params).all();
    return json({ ok: true, licenses: results.map(toPublic) });
  }

  if (path === '/api/admin/plans' && request.method === 'GET') return json({ ok: true, plans: await readPlans(env) });
  if (path === '/api/admin/plans' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const plans = await readPlans(env);
    for (const type of BUSINESS_TYPES) {
      for (const period of Object.keys(PERIODS)) {
        const v = body.prices?.[type]?.[period];
        if (v !== undefined) plans.prices[type][period] = v === null || v === '' ? null : Math.max(0, Number(v) || 0);
      }
    }
    if (typeof body.paymentInfo === 'string') plans.paymentInfo = body.paymentInfo.slice(0, 1000);
    if (typeof body.currency === 'string' && body.currency.trim()) plans.currency = body.currency.trim().slice(0, 5);
    await env.DB.prepare(`INSERT INTO config (k, v) VALUES ('plans', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`).bind(JSON.stringify(plans)).run();
    return json({ ok: true, plans });
  }
  if (path === '/api/admin/requests' && request.method === 'GET') {
    const status = url.searchParams.get('status');
    const { results } = await env.DB.prepare(
      `SELECT * FROM subscription_requests ${status ? 'WHERE status = ?' : ''} ORDER BY created_at DESC LIMIT 300`
    ).bind(...(status ? [status] : [])).all();
    return json({ ok: true, requests: results.map(requestPublic) });
  }
  const rq = path.match(/^\/api\/admin\/requests\/([^/]+)\/(approve|reject)$/);
  if (rq && request.method === 'POST') {
    const req = await env.DB.prepare(`SELECT * FROM subscription_requests WHERE id = ?`).bind(rq[1]).first();
    if (!req) return fail(404, 'not_found');
    if (req.status !== 'pending') return fail(409, 'already_decided');
    const now = Date.now();
    if (rq[2] === 'reject') {
      await env.DB.prepare(`UPDATE subscription_requests SET status = 'rejected', decided_at = ? WHERE id = ?`).bind(now, req.id).run();
      return json({ ok: true });
    }
    const body = await request.json().catch(() => ({}));
    const lic = await createLicense(env, {
      period: req.period, businessType: req.business_type,
      note: [req.shop_name, req.owner_name, req.phone].filter(Boolean).join(' · ').slice(0, 500) || null,
      email: req.email, maxDevices: clampDevices(body.maxDevices),
    });
    if (!lic) return fail(500, 'server_error');
    await env.DB.prepare(`UPDATE subscription_requests SET status = 'approved', license_key = ?, decided_at = ? WHERE id = ?`)
      .bind(lic.key, now, req.id).run();
    return json({ ok: true, license: toPublic(lic) });
  }

  // Deletes a key for good (keys nobody wants any more); an app still using it stops on its next check
  const del = path.match(/^\/api\/admin\/licenses\/([^/]+)\/delete$/);
  if (del && request.method === 'POST') {
    const key = normalizeKey(decodeURIComponent(del[1]));
    const row = await env.DB.prepare(`DELETE FROM licenses WHERE key = ? RETURNING key`).bind(key).first();
    if (!row) return fail(404, 'invalid_key');
    await env.DB.prepare(`DELETE FROM license_devices WHERE key = ?`).bind(key).run();
    return json({ ok: true, deleted: key });
  }

  // The devices of a key, and removing one of them (that device stops on its next check)
  const devList = path.match(/^\/api\/admin\/licenses\/([^/]+)\/devices$/);
  if (devList && request.method === 'GET') {
    const key = normalizeKey(decodeURIComponent(devList[1]));
    const { results } = await env.DB.prepare(
      `SELECT device_id, label, shop_name, first_seen_at, last_seen_at FROM license_devices WHERE key = ? ORDER BY first_seen_at`
    ).bind(key).all();
    return json({ ok: true, devices: results.map((d) => ({
      deviceId: d.device_id, label: d.label ?? null, shopName: d.shop_name ?? null,
      firstSeenAt: d.first_seen_at ? new Date(d.first_seen_at).toISOString() : null,
      lastSeenAt: d.last_seen_at ? new Date(d.last_seen_at).toISOString() : null,
    })) });
  }
  const devRemove = path.match(/^\/api\/admin\/licenses\/([^/]+)\/devices\/([^/]+)\/remove$/);
  if (devRemove && request.method === 'POST') {
    const key = normalizeKey(decodeURIComponent(devRemove[1]));
    const deviceId = decodeURIComponent(devRemove[2]);
    const gone = await env.DB.prepare(`DELETE FROM license_devices WHERE key = ? AND device_id = ? RETURNING device_id`).bind(key, deviceId).first();
    if (!gone) return fail(404, 'device_not_found');
    // keep licenses.device_id pointing at a device that is still there; free the shop when none is left
    await env.DB.prepare(
      `UPDATE licenses SET
         device_id = (SELECT device_id FROM license_devices d WHERE d.key = licenses.key ORDER BY first_seen_at LIMIT 1),
         shop_uid = CASE WHEN EXISTS (SELECT 1 FROM license_devices d WHERE d.key = licenses.key) THEN shop_uid ELSE NULL END
       WHERE key = ?`
    ).bind(key).run();
    const row = await env.DB.prepare(`SELECT *, (SELECT COUNT(*) FROM license_devices d WHERE d.key = licenses.key) AS device_count
      FROM licenses WHERE key = ?`).bind(key).first();
    return json({ ok: true, license: toPublic(row) });
  }

  const m = path.match(/^\/api\/admin\/licenses\/([^/]+)\/(revoke|reset-device|devices|email)$/);
  if (m && request.method === 'POST') {
    const key = normalizeKey(decodeURIComponent(m[1]));
    let row;
    if (m[2] === 'revoke') {
      row = await env.DB.prepare(`UPDATE licenses SET status = 'revoked' WHERE key = ? RETURNING *`).bind(key).first();
    } else if (m[2] === 'reset-device') {
      // Frees every computer of this key; the expiry date does not change
      row = await env.DB.prepare(`UPDATE licenses SET device_id = NULL, shop_uid = NULL WHERE key = ? RETURNING *`).bind(key).first();
      if (row) await env.DB.prepare(`DELETE FROM license_devices WHERE key = ?`).bind(key).run();
      if (row) row.device_count = 0;
    } else if (m[2] === 'email') {
      const email = cleanEmail((await request.json().catch(() => ({}))).email);
      if (email === null) return fail(400, 'bad_email');
      row = await env.DB.prepare(`UPDATE licenses SET email = ? WHERE key = ? RETURNING *,
        (SELECT COUNT(*) FROM license_devices d WHERE d.key = licenses.key) AS device_count`).bind(email || null, key).first();
    } else {
      const body = await request.json().catch(() => ({}));
      row = await env.DB.prepare(`UPDATE licenses SET max_devices = ? WHERE key = ? RETURNING *,
        (SELECT COUNT(*) FROM license_devices d WHERE d.key = licenses.key) AS device_count`).bind(clampDevices(body.maxDevices), key).first();
    }
    if (!row) return fail(404, 'invalid_key');
    return json({ ok: true, license: toPublic(row) });
  }
  return fail(404, 'not_found');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      if (path === '/api/health') {
        await prepare(env);
        return json({ status: 'success', message: 'POS licence server is running', time: new Date().toISOString() });
      }
      if (path === '/api/licenses/activate' && request.method === 'POST') return await checkLicense(request, env, { bind: true });
      if (path === '/api/licenses/refresh' && request.method === 'POST') return await checkLicense(request, env, { bind: false });
      if (path === '/api/licenses/public-key' && request.method === 'GET') {
        const { publicSpki } = await prepare(env);
        return json({ ok: true, publicKey: publicSpki });
      }
      if (path === '/api/plans' && request.method === 'GET') {
        await prepare(env);
        return json({ ok: true, businessTypes: BUSINESS_TYPES, periods: Object.keys(PERIODS), plans: await readPlans(env) });
      }
      if (path === '/api/requests' && request.method === 'POST') return await createRequest(request, env);
      const reqStatus = path.match(/^\/api\/requests\/([A-Za-z0-9_-]+)$/);
      if (reqStatus && request.method === 'GET') return await requestStatus(env, reqStatus[1], url.searchParams.get('secret') || '');
      if (path.startsWith('/api/admin/')) return await admin(request, env, path);
      if (path === '/admin' || path === '/') {
        return new Response(ADMIN_PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } });
      }
      return fail(404, 'not_found');
    } catch (err) {
      console.error('licence server error', err);
      return fail(500, 'server_error');
    }
  },
};
