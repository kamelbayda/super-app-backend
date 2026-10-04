// Single-page licence admin UI served at /admin (Arabic, works on phones and tablets).
// The admin key is typed by the owner and kept in sessionStorage only.
export const ADMIN_PAGE = /* html */ `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>BeeCash – إدارة تراخيص البرنامج</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 512 512%22%3E %3Crect width=%22512%22 height=%22512%22 rx=%22112%22 fill=%22%23FFC21A%22/%3E %3Cg stroke=%22%231E1B16%22 stroke-width=%2216%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22%3E %3Cellipse cx=%22206%22 cy=%22178%22 rx=%2262%22 ry=%2292%22 transform=%22rotate(-24 206 178)%22 fill=%22%23fff%22/%3E %3Cellipse cx=%22300%22 cy=%22170%22 rx=%2256%22 ry=%2284%22 transform=%22rotate(22 300 170)%22 fill=%22%23fff%22/%3E %3Cpath d=%22M118 238 C 100 196 92 168 70 150%22 fill=%22none%22/%3E %3Cpath d=%22M140 228 C 140 186 150 158 140 130%22 fill=%22none%22/%3E %3C/g%3E %3Ccircle cx=%2270%22 cy=%22150%22 r=%2214%22 fill=%22%231E1B16%22/%3E %3Ccircle cx=%22140%22 cy=%22130%22 r=%2214%22 fill=%22%231E1B16%22/%3E %3Cpath d=%22M398 318 L 462 334 L 398 352 Z%22 fill=%22%231E1B16%22/%3E %3Cdefs%3E%3CclipPath id=%22b%22%3E%3Cellipse cx=%22262%22 cy=%22320%22 rx=%22150%22 ry=%22112%22/%3E%3C/clipPath%3E%3C/defs%3E %3Cellipse cx=%22262%22 cy=%22320%22 rx=%22150%22 ry=%22112%22 fill=%22%231E1B16%22/%3E %3Cg clip-path=%22url(%23b)%22 fill=%22%23FFC21A%22%3E %3Crect x=%22214%22 y=%22200%22 width=%2234%22 height=%22240%22/%3E %3Crect x=%22292%22 y=%22200%22 width=%2234%22 height=%22240%22/%3E %3Crect x=%22364%22 y=%22200%22 width=%2226%22 height=%22240%22/%3E %3C/g%3E %3Ccircle cx=%22136%22 cy=%22300%22 r=%2270%22 fill=%22%231E1B16%22/%3E %3Ccircle cx=%22114%22 cy=%22286%22 r=%2216%22 fill=%22%23fff%22/%3E %3Ccircle cx=%22110%22 cy=%22284%22 r=%227%22 fill=%22%231E1B16%22/%3E %3Cpath d=%22M96 332 Q 114 346 134 336%22 stroke=%22%23FFC21A%22 stroke-width=%229%22 fill=%22none%22 stroke-linecap=%22round%22/%3E %3C/svg%3E">
<style>
  :root { --bg:#f6f7f9; --card:#fff; --text:#1c2430; --muted:#667085; --line:#e4e7ec; --accent:#1D9E75; --danger:#d92d20; --warn:#b54708; }
  @media (prefers-color-scheme: dark) { :root { --bg:#12151a; --card:#1b2028; --text:#e7eaee; --muted:#98a2b3; --line:#2c333d; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:15px/1.5 system-ui, -apple-system, "Segoe UI", Tahoma, sans-serif; }
  main { max-width: 900px; margin: 0 auto; padding: 16px; }
  h1 { font-size: 20px; margin: 8px 0 16px; }
  h2 { font-size: 16px; margin: 0 0 10px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:16px; margin-bottom:14px; }
  label { display:block; font-size:13px; color:var(--muted); margin-bottom:4px; }
  input, select { width:100%; padding:10px; border:1px solid var(--line); border-radius:8px; background:transparent; color:var(--text); font:inherit; }
  .row { display:flex; gap:10px; flex-wrap:wrap; }
  .row > * { flex:1 1 160px; }
  button { padding:10px 14px; border:0; border-radius:8px; background:var(--accent); color:#fff; font:inherit; font-weight:600; cursor:pointer; }
  button.secondary { background:transparent; color:var(--text); border:1px solid var(--line); }
  button.danger { background:transparent; color:var(--danger); border:1px solid var(--danger); }
  button:disabled { opacity:.5; cursor:wait; }
  .mono { font-family: ui-monospace, Menlo, Consolas, monospace; direction:ltr; unicode-bidi:embed; }
  .muted { color:var(--muted); font-size:13px; }
  .pill { display:inline-block; padding:1px 8px; border-radius:99px; font-size:12px; border:1px solid var(--line); }
  .pill.active { color:var(--accent); border-color:var(--accent); }
  .pill.revoked { color:var(--danger); border-color:var(--danger); }
  .pill.expired { color:var(--warn); border-color:var(--warn); }
  .lic { border-top:1px solid var(--line); padding:12px 0; display:flex; flex-wrap:wrap; gap:8px; align-items:center; justify-content:space-between; }
  .lic:first-child { border-top:0; }
  .lic .actions { display:flex; gap:6px; flex-wrap:wrap; }
  .lic .actions button { padding:6px 10px; font-size:13px; }
  .keybox { word-break:break-all; background:var(--bg); border:1px solid var(--line); border-radius:8px; padding:10px; font-size:12px; }
  #msg { position:sticky; top:0; z-index:5; }
  .note { padding:10px 12px; border-radius:8px; margin-bottom:12px; }
  .note.ok { background:#1D9E7522; } .note.err { background:#d92d2022; }
  .hidden { display:none; }
</style>
</head>
<body>
<main>
  <h1><svg width="34" height="34" style="vertical-align:middle;margin-inline-end:8px" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"> <rect width="512" height="512" rx="112" fill="#FFC21A"/> <g stroke="#1E1B16" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"> <ellipse cx="206" cy="178" rx="62" ry="92" transform="rotate(-24 206 178)" fill="#fff"/> <ellipse cx="300" cy="170" rx="56" ry="84" transform="rotate(22 300 170)" fill="#fff"/> <path d="M118 238 C 100 196 92 168 70 150" fill="none"/> <path d="M140 228 C 140 186 150 158 140 130" fill="none"/> </g> <circle cx="70" cy="150" r="14" fill="#1E1B16"/> <circle cx="140" cy="130" r="14" fill="#1E1B16"/> <path d="M398 318 L 462 334 L 398 352 Z" fill="#1E1B16"/> <defs><clipPath id="b"><ellipse cx="262" cy="320" rx="150" ry="112"/></clipPath></defs> <ellipse cx="262" cy="320" rx="150" ry="112" fill="#1E1B16"/> <g clip-path="url(#b)" fill="#FFC21A"> <rect x="214" y="200" width="34" height="240"/> <rect x="292" y="200" width="34" height="240"/> <rect x="364" y="200" width="26" height="240"/> </g> <circle cx="136" cy="300" r="70" fill="#1E1B16"/> <circle cx="114" cy="286" r="16" fill="#fff"/> <circle cx="110" cy="284" r="7" fill="#1E1B16"/> <path d="M96 332 Q 114 346 134 336" stroke="#FFC21A" stroke-width="9" fill="none" stroke-linecap="round"/> </svg><span dir="ltr"><b style="color:#B98600">Bee</b>Cash</span> · إدارة تراخيص البرنامج</h1>
  <div id="msg"></div>

  <section class="card" id="login">
    <h2>الدخول</h2>
    <label for="adminKey">مفتاح الإدارة (ADMIN_API_KEY)</label>
    <div class="row">
      <input id="adminKey" type="password" autocomplete="current-password">
      <button id="loginBtn" style="flex:0 0 auto">دخول</button>
    </div>
  </section>

  <div id="app" class="hidden">
    <section class="card">
      <h2>مفتاح التحقق العام (للبرنامج)</h2>
      <p class="muted">هذا المفتاح عام وآمن. ضعه في ملف <span class="mono">.env</span> تبع البرنامج قبل البناء باسم <span class="mono">VITE_LICENSE_PUBLIC_KEY</span>، ومع رابط هذه الصفحة (بدون /admin) باسم <span class="mono">VITE_LICENSE_SERVER_URL</span>.</p>
      <div class="keybox mono" id="publicKey">…</div>
      <div class="row" style="margin-top:10px">
        <button class="secondary" id="copyEnv">نسخ إعدادات البرنامج (<span dir="ltr">.env</span>)</button>
      </div>
    </section>

    <section class="card">
      <h2>إنشاء مفتاح لزبون</h2>
      <div class="row">
        <div><label for="note">اسم المحل / ملاحظة</label><input id="note" placeholder="مثلاً: سوبرماركت البركة"></div>
        <div style="flex:0 1 140px"><label for="plan">النوع</label>
          <select id="plan"><option value="year">سنوي</option><option value="life">مدى الحياة</option></select></div>
        <div style="flex:0 1 110px"><label for="maxDevices">عدد الأجهزة</label><input id="maxDevices" type="number" min="1" max="20" value="1"></div>
        <div style="flex:0 1 90px"><label for="count">عدد المفاتيح</label><input id="count" type="number" min="1" max="100" value="1"></div>
      </div>
      <div class="row" style="margin-top:10px"><button id="createBtn">إنشاء</button></div>
      <div id="created"></div>
    </section>

    <section class="card">
      <div class="row" style="align-items:end">
        <div><label for="q">بحث (مفتاح، محل، ملاحظة)</label><input id="q" type="search"></div>
        <button class="secondary" id="refreshBtn" style="flex:0 0 auto">تحديث</button>
      </div>
      <p class="muted" id="count-label"></p>
      <div id="list"></div>
    </section>
  </div>
</main>
<script>
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
let adminKey = '';
try { adminKey = sessionStorage.getItem('adminKey') || ''; } catch {}

function show(text, ok = true) {
  $('msg').innerHTML = '<div class="note ' + (ok ? 'ok' : 'err') + '">' + esc(text) + '</div>';
  clearTimeout(show.t); show.t = setTimeout(() => ($('msg').innerHTML = ''), 5000);
}
async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { 'content-type': 'application/json', 'x-admin-key': adminKey, ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
const ERR = { unauthorized: 'مفتاح الإدارة غير صحيح', admin_key_not_set: 'ما في ADMIN_API_KEY على السيرفر بعد. زيده من Settings ← Variables and Secrets واعمل Deploy', invalid_key: 'المفتاح غير موجود', bad_plan: 'نوع غير صالح' };
const errMsg = (e) => ERR[e.message] || ('خطأ: ' + e.message);
const date = (s) => s ? new Date(s).toLocaleDateString('ar-LB') : '—';

function statusOf(l) {
  if (l.status === 'revoked') return ['revoked', 'ملغى'];
  if (l.expiresAt && new Date(l.expiresAt) < new Date()) return ['expired', 'منتهي'];
  if (!l.activatedAt) return ['', 'غير مفعّل بعد'];
  return ['active', 'فعّال'];
}

function render(list) {
  $('count-label').textContent = list.length + ' مفتاح';
  $('list').innerHTML = list.map((l) => {
    const [cls, label] = statusOf(l);
    return '<div class="lic"><div>' +
      '<div class="mono"><b>' + esc(l.key) + '</b></div>' +
      '<div class="muted">' + (l.plan === 'life' ? 'مدى الحياة' : 'سنوي') + ' · <span class="pill ' + cls + '">' + label + '</span>' +
      (l.shopName ? ' · ' + esc(l.shopName) : '') + (l.note ? ' · ' + esc(l.note) : '') + '</div>' +
      '<div class="muted">' + (l.activatedAt ? 'تفعيل: ' + date(l.activatedAt) : '') + (l.expiresAt ? ' · ينتهي: ' + date(l.expiresAt) : '') +
      ' · أجهزة: <b>' + (l.devices || 0) + '/' + (l.maxDevices || 1) + '</b></div></div>' +
      '<div class="actions">' +
      '<button class="secondary" data-copy="' + esc(l.key) + '">نسخ</button>' +
      (l.status !== 'revoked' ? '<button class="secondary" data-devices="' + esc(l.key) + '" data-max="' + (l.maxDevices || 1) + '">عدد الأجهزة</button>' : '') +
      (l.devices && l.status !== 'revoked' ? '<button class="secondary" data-reset="' + esc(l.key) + '">نقل لأجهزة جديدة</button>' : '') +
      (l.status !== 'revoked' ? '<button class="danger" data-revoke="' + esc(l.key) + '">إلغاء</button>' : '') +
      '</div></div>';
  }).join('') || '<p class="muted">لا يوجد مفاتيح بعد.</p>';
}

async function load() {
  const q = $('q').value.trim();
  const { licenses } = await api('/api/admin/licenses' + (q ? '?q=' + encodeURIComponent(q) : ''));
  render(licenses);
}

async function enter() {
  adminKey = $('adminKey').value.trim() || adminKey;
  try {
    await load();
    try { sessionStorage.setItem('adminKey', adminKey); } catch {}
    $('login').classList.add('hidden'); $('app').classList.remove('hidden');
    const { publicKey } = await (await fetch('/api/licenses/public-key')).json();
    $('publicKey').textContent = publicKey;
  } catch (e) { show(errMsg(e), false); }
}

$('loginBtn').onclick = enter;
$('adminKey').onkeydown = (e) => { if (e.key === 'Enter') enter(); };
$('refreshBtn').onclick = () => load().catch((e) => show(errMsg(e), false));
$('q').oninput = () => { clearTimeout(load.t); load.t = setTimeout(() => load().catch(() => {}), 300); };
$('copyEnv').onclick = async () => {
  const text = 'VITE_LICENSE_SERVER_URL=' + location.origin + '\\nVITE_LICENSE_PUBLIC_KEY=' + $('publicKey').textContent;
  await navigator.clipboard.writeText(text); show('تم النسخ');
};
$('createBtn').onclick = async () => {
  const btn = $('createBtn'); btn.disabled = true;
  try {
    const { licenses } = await api('/api/admin/licenses', { method: 'POST', body: JSON.stringify({ plan: $('plan').value, note: $('note').value, count: Number($('count').value) || 1, maxDevices: Number($('maxDevices').value) || 1 }) });
    $('created').innerHTML = '<p class="muted" style="margin-top:12px">المفاتيح الجديدة (انسخ وابعت للزبون):</p>' +
      licenses.map((l) => '<div class="lic"><span class="mono"><b>' + esc(l.key) + '</b></span><button class="secondary" data-copy="' + esc(l.key) + '">نسخ</button></div>').join('');
    show('تم إنشاء ' + licenses.length + ' مفتاح');
    load();
  } catch (e) { show(errMsg(e), false); } finally { btn.disabled = false; }
};
document.addEventListener('click', async (e) => {
  const t = e.target;
  if (t.dataset.copy) { await navigator.clipboard.writeText(t.dataset.copy); show('تم نسخ المفتاح'); }
  if (t.dataset.revoke && confirm('إلغاء المفتاح ' + t.dataset.revoke + '؟ البرنامج عند الزبون سيتوقف عند أول اتصال بالإنترنت.')) {
    try { await api('/api/admin/licenses/' + encodeURIComponent(t.dataset.revoke) + '/revoke', { method: 'POST' }); show('تم الإلغاء'); load(); }
    catch (err) { show(errMsg(err), false); }
  }
  if (t.dataset.devices) {
    const n = prompt('كم جهاز مسموح للمفتاح ' + t.dataset.devices + '؟ (1 - 20)', t.dataset.max);
    if (n !== null) {
      try { await api('/api/admin/licenses/' + encodeURIComponent(t.dataset.devices) + '/devices', { method: 'POST', body: JSON.stringify({ maxDevices: Number(n) || 1 }) }); show('تم تغيير عدد الأجهزة'); load(); }
      catch (err) { show(errMsg(err), false); }
    }
  }
  if (t.dataset.reset && confirm('فك ارتباط ' + t.dataset.reset + ' بكل الأجهزة الحالية حتى ينفعّل على أجهزة جديدة؟ (مدة الاشتراك لا تتغير)')) {
    try { await api('/api/admin/licenses/' + encodeURIComponent(t.dataset.reset) + '/reset-device', { method: 'POST' }); show('يمكن الآن تفعيل المفتاح على الأجهزة الجديدة'); load(); }
    catch (err) { show(errMsg(err), false); }
  }
});
if (adminKey) enter();
</script>
</body>
</html>`;
