const crypto = require('crypto');

// Crockford-style alphabet: no 0/O, 1/I/L, U to avoid misreading keys over the phone
const KEY_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

/** Random licence key like POS-7KQ2M-X9D4T-HB3WN (75 bits of entropy). */
function generateLicenseKey() {
  const groups = [];
  for (let g = 0; g < 3; g++) {
    let s = '';
    const bytes = crypto.randomBytes(5);
    for (const b of bytes) s += KEY_ALPHABET[b % KEY_ALPHABET.length];
    groups.push(s);
  }
  return `POS-${groups.join('-')}`;
}

function normalizeKey(key) {
  return String(key || '').trim().toUpperCase();
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

/**
 * Signs a licence payload with the ECDSA P-256 private key.
 * Token format: base64url(JSON payload) + "." + base64url(raw r||s signature),
 * which the POS verifies offline with WebCrypto (ECDSA / SHA-256).
 */
function signLicense(payload, privateKeyPem) {
  const body = b64url(JSON.stringify(payload));
  const signature = crypto.sign('sha256', Buffer.from(body), {
    key: privateKeyPem,
    dsaEncoding: 'ieee-p1363',
  });
  return `${body}.${b64url(signature)}`;
}

function verifyLicense(token, publicKeyPem) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const ok = crypto.verify('sha256', Buffer.from(body), { key: publicKeyPem, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url'));
  if (!ok) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

/** Constant-time string comparison for the admin API key. */
function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

module.exports = { generateLicenseKey, normalizeKey, signLicense, verifyLicense, safeEqual };
