/**
 * POS licence server on Cloudflare Workers + D1 (free tier, always on).
 *
 * Same API as the Express version (../licensing), so the POS app and
 * scripts/licenses.js work unchanged:
 *   POST /api/licenses/activate   { key, deviceId, shopName }
 *   POST /api/licenses/refresh    { key, deviceId }
 *   GET  /api/licenses/public-key -> base64 SPKI for VITE_LICENSE_PUBLIC_KEY
 *   /api/admin/licenses...        (header x-admin-key = ADMIN_API_KEY secret)
 *   GET  /admin                   browser admin page (works from a phone/tablet)
 *
 * The ECDSA P-256 signing key pair is generated on first use and stored in D1,
 * so no key needs to be created or pasted by hand.
 */
import { ADMIN_PAGE } from './admin-page.js';

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
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
      ]);
      return loadSigningKey(env);
    })().catch((err) => { ready = null; throw err; });
  }
  return ready;
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
const normalizeKey = (k) => String(k || '').trim().toUpperCase();
const iso = (ms) => (ms == null ? null : new Date(ms).toISOString());
const toPublic = (r) => ({
  key: r.key, plan: r.plan, status: r.status, note: r.note, deviceId: r.device_id, shopName: r.shop_name,
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
  if (!key || !deviceId || deviceId.length > 100) return fail(400, 'bad_request');

  const { privateKey } = await prepare(env);
  const get = () => env.DB.prepare('SELECT * FROM licenses WHERE key = ?').bind(key).first();
  let row = await get();
  if (!row) return fail(404, 'invalid_key');
  if (row.status === 'revoked') return fail(403, 'revoked');
  const now = Date.now();

  if (!row.device_id) {
    if (!bind) return fail(404, 'invalid_key');
    // Bind to this device. The subscription clock starts on the very first activation only,
    // so moving a key to a new computer (reset-device) does not extend it.
    const expires = row.plan === 'year' ? now + YEAR_MS : null;
    await env.DB.prepare(
      `UPDATE licenses SET device_id = ?, shop_name = COALESCE(?, shop_name), last_seen_at = ?,
         expires_at = CASE WHEN activated_at IS NULL THEN ? ELSE expires_at END,
         activated_at = COALESCE(activated_at, ?)
       WHERE key = ? AND device_id IS NULL`
    ).bind(deviceId, shopName, now, expires, now, key).run();
    row = await get();
  } else {
    await env.DB.prepare(`UPDATE licenses SET last_seen_at = ?, shop_name = COALESCE(?, shop_name) WHERE key = ?`)
      .bind(now, shopName, key).run();
    row = await get();
  }
  if (row.device_id !== deviceId) return fail(409, 'device_mismatch');
  if (row.expires_at && row.expires_at < now) return fail(410, 'expired');

  const token = await signLicense(
    { v: 1, key: row.key, deviceId: row.device_id, shop: row.shop_name, plan: row.plan, issuedAt: now, expiresAt: row.expires_at ?? null },
    privateKey
  );
  return json({ ok: true, token, license: toPublic(row) });
}

// ---------- admin endpoints ----------
async function admin(request, env, path) {
  if (!env.ADMIN_API_KEY || !safeEqual(request.headers.get('x-admin-key'), env.ADMIN_API_KEY)) return fail(401, 'unauthorized');
  await prepare(env);
  const url = new URL(request.url);

  if (path === '/api/admin/licenses' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    if (body.plan !== 'year' && body.plan !== 'life') return fail(400, 'bad_plan');
    const count = Math.min(Math.max(parseInt(body.count || 1, 10) || 1, 1), 100);
    const note = body.note ? String(body.note).slice(0, 500) : null;
    const created = [];
    for (let i = 0; i < count; i++) {
      const row = await env.DB.prepare(`INSERT OR IGNORE INTO licenses (key, plan, note, created_at) VALUES (?, ?, ?, ?) RETURNING *`)
        .bind(generateLicenseKey(), body.plan, note, Date.now()).first();
      if (row) created.push(toPublic(row));
    }
    return json({ ok: true, licenses: created }, 201);
  }

  if (path === '/api/admin/licenses' && request.method === 'GET') {
    const where = [], params = [];
    if (url.searchParams.get('status')) { where.push('status = ?'); params.push(url.searchParams.get('status')); }
    const q = url.searchParams.get('q');
    if (q) { where.push('(key LIKE ? OR shop_name LIKE ? OR note LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
    const { results } = await env.DB.prepare(
      `SELECT * FROM licenses ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC LIMIT 500`
    ).bind(...params).all();
    return json({ ok: true, licenses: results.map(toPublic) });
  }

  const m = path.match(/^\/api\/admin\/licenses\/([^/]+)\/(revoke|reset-device)$/);
  if (m && request.method === 'POST') {
    const key = normalizeKey(decodeURIComponent(m[1]));
    const sql = m[2] === 'revoke'
      ? `UPDATE licenses SET status = 'revoked' WHERE key = ? RETURNING *`
      : `UPDATE licenses SET device_id = NULL WHERE key = ? RETURNING *`;
    const row = await env.DB.prepare(sql).bind(key).first();
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
