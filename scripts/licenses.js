// Small admin CLI for POS licence keys (talks to the running server).
//
//   SERVER_URL=https://your-app.up.railway.app ADMIN_API_KEY=... node scripts/licenses.js <command>
//
// Commands:
//   create year [note] [count]   create annual key(s), e.g.  create year "Supermarket Al Amin"
//   create life [note] [count]   create lifetime key(s)
//   list [search]                list keys (optionally filter by key / shop / note)
//   revoke <KEY>                 stop a key (the POS drops to trial on its next online check)
//   reset-device <KEY>           let the key be activated on a different computer
require('dotenv').config();

const base = (process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '');
const adminKey = process.env.ADMIN_API_KEY;

async function call(method, path, body) {
  const res = await fetch(`${base}/api/admin/licenses${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-admin-key': adminKey || '' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${data.error || res.statusText}`);
  return data;
}

const fmt = (l) => [
  l.key.padEnd(22),
  l.plan.padEnd(5),
  l.status.padEnd(8),
  (l.shopName || '-').padEnd(24),
  l.expiresAt ? `expires ${l.expiresAt.slice(0, 10)}` : (l.activatedAt ? 'no expiry' : 'not activated'),
  l.note ? `  # ${l.note}` : '',
].join('  ');

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (!adminKey) throw new Error('ADMIN_API_KEY is not set');
  if (cmd === 'create') {
    const [plan, note, count] = args;
    const { licenses } = await call('POST', '/', { plan, note, count: Number(count) || 1 });
    licenses.forEach((l) => console.log(fmt(l)));
  } else if (cmd === 'list') {
    const { licenses } = await call('GET', args[0] ? `/?q=${encodeURIComponent(args[0])}` : '/');
    licenses.forEach((l) => console.log(fmt(l)));
    console.log(`${licenses.length} key(s)`);
  } else if (cmd === 'revoke' || cmd === 'reset-device') {
    if (!args[0]) throw new Error('missing key');
    const { license } = await call('POST', `/${encodeURIComponent(args[0])}/${cmd}`);
    console.log(fmt(license));
  } else {
    console.log('usage: node scripts/licenses.js create year|life [note] [count] | list [search] | revoke KEY | reset-device KEY');
    process.exitCode = 1;
  }
}

main().catch((err) => { console.error('Error:', err.message); process.exitCode = 1; });
