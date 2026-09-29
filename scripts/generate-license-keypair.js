// Generates the ECDSA P-256 key pair used to sign POS licences.
//   node scripts/generate-license-keypair.js
// Put LICENSE_PRIVATE_KEY in the server environment (Railway variables) and never commit it.
// Put VITE_LICENSE_PUBLIC_KEY in the POS build environment (.env) — it is safe to ship.
const crypto = require('crypto');

const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const publicSpki = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');

console.log('# Server (super-app-backend) — keep secret:');
console.log(`LICENSE_PRIVATE_KEY="${privatePem.trim().replace(/\n/g, '\\n')}"`);
console.log('');
console.log('# POS (.env) — public, safe to ship in the app:');
console.log(`VITE_LICENSE_PUBLIC_KEY="${publicSpki}"`);
