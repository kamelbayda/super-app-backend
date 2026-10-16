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
  .btnlink { display:inline-block; padding:6px 10px; font-size:13px; border-radius:10px; text-decoration:none; border:1px solid var(--line); color:inherit; }
  .devs { width:100%; }
  .devs:empty { display:none; }
  .dev { display:flex; flex-wrap:wrap; gap:8px; align-items:center; justify-content:space-between; background:rgba(127,127,127,.08); border-radius:10px; padding:8px 10px; margin-top:6px; }
  .dev button { padding:5px 10px; font-size:12px; }
  .keybox { word-break:break-all; background:var(--bg); border:1px solid var(--line); border-radius:8px; padding:10px; font-size:12px; }
  #msg { position:sticky; top:0; z-index:5; }
  .note { padding:10px 12px; border-radius:8px; margin-bottom:12px; }
  .note.ok { background:#1D9E7522; } .note.err { background:#d92d2022; }
  .hidden { display:none; }
  .email { font-weight:700; font-size:15px; text-align:right; unicode-bidi:plaintext; }
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
    <section class="card" id="requestsCard">
      <h2>📥 طلبات الاشتراك <span class="pill" id="pendingCount"></span></h2>
      <p class="muted">الزبون بيختار نوع المحل والاشتراك من البرنامج وبيبعت طلب. بعد ما يدفع، كبس <b>موافقة</b> وبيتفعّل البرنامج عندو لحالو.</p>
      <div class="row" style="margin-bottom:8px">
        <select id="reqFilter" style="flex:0 1 200px"><option value="pending">بانتظار الموافقة</option><option value="">كل الطلبات</option><option value="approved">الموافق عليها</option><option value="rejected">المرفوضة</option></select>
      </div>
      <div id="requests"></div>
    </section>

    <section class="card" id="trialsCard">
      <h2>🧪 مين عم يجرّب البرنامج <span class="pill" id="trialCount"></span></h2>
      <p class="muted">كل جهاز بيفتح البرنامج بيبيّن هون: المحل، نوعه، صاحب المحل وإيميلو، الجهاز، وكم فاتورة عمل من التجربة. بتتحدّث كل ما يفتح البرنامج.</p>
      <div class="row" style="margin-bottom:8px">
        <select id="trialFilter" style="flex:0 1 200px"><option value="trial">بالتجربة بس</option><option value="">الكل</option><option value="licensed">المشتركين</option></select>
        <input id="trialQ" placeholder="بحث: محل، إيميل، اسم، تلفون" style="flex:1 1 200px">
      </div>
      <div class="row" style="margin-bottom:8px">
        <button class="secondary" id="msgAllBtn">💬 رسالة لكل يلي عم يجرّبوا</button>
        <button class="secondary" id="sentToggle">📨 الرسائل المرسلة</button>
      </div>
      <div id="composer" class="hidden" style="border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:10px">
        <div style="margin-bottom:6px"><b>رسالة إلى: <span id="msgTarget"></span></b></div>
        <div class="row" style="margin-bottom:6px;gap:6px;flex-wrap:wrap" id="msgTemplates"></div>
        <textarea id="msgText" rows="4" style="width:100%;box-sizing:border-box" placeholder="اكتب رسالتك..."></textarea>
        <p class="muted" style="margin:4px 0 8px">بتطلع عند الزبون جوّا البرنامج مع زر "⭐ اشترك الآن". فيك تكتب <b>{name}</b> لاسم صاحب المحل، <b>{shop}</b> لاسم المحل، <b>{left}</b> لعدد الفواتير الباقية من التجربة.</p>
        <label style="display:flex;gap:8px;align-items:center;margin:0 0 8px;font-weight:700"><input type="checkbox" id="msgEmail" style="width:auto"> 📧 ابعتها كمان عالإيميل <span class="muted" dir="ltr">(sales@beecash.app)</span></label>
        <input id="msgSubject" class="hidden" placeholder="عنوان الإيميل، مثلاً: عرض خاص لـ {shop}" style="margin-bottom:8px">
        <div class="row" style="gap:6px"><button id="msgSend">إرسال</button><button class="secondary" id="msgCancel">إلغاء</button></div>
      </div>
      <div id="sentList" class="hidden" style="margin-bottom:10px"></div>
      <div id="trials"></div>
    </section>

    <section class="card" id="mailCard">
      <h2>📧 الإيميلات</h2>
      <div id="mailStatus" class="muted">…</div>
      <p class="muted">الترويج ورسائل التجربة بتطلع من <b dir="ltr">sales@beecash.app</b>، مفاتيح التفعيل من <b dir="ltr">info@beecash.app</b>، والردود على الأعطال من <b dir="ltr">support@beecash.app</b>.</p>
      <div class="row">
        <div><label for="mailTo">إلى</label><input id="mailTo" type="email" dir="ltr" placeholder="name@email.com" autocapitalize="none"></div>
        <div style="flex:0 1 220px"><label for="mailFrom">من</label>
          <select id="mailFrom"><option value="support">🛠️ support@ (الأعطال والدعم)</option><option value="info">ℹ️ info@ (معلومات ومفاتيح)</option><option value="sales">📣 sales@ (عروض وترويج)</option></select></div>
      </div>
      <label for="mailSubject" style="margin-top:8px">العنوان</label><input id="mailSubject" placeholder="مثلاً: بخصوص المشكلة في الطباعة">
      <label for="mailText" style="margin-top:8px">الرسالة</label>
      <textarea id="mailText" rows="5" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;background:transparent;color:var(--text);font:inherit;box-sizing:border-box"></textarea>
      <div class="row" style="margin-top:10px"><button id="mailSend">إرسال الإيميل</button><button class="secondary" id="mailLogToggle">📨 الإيميلات المرسلة</button></div>
      <div id="mailLog" class="hidden" style="margin-top:10px"></div>
    </section>

    <section class="card">
      <h2>💲 الأسعار وطريقة الدفع</h2>
      <p class="muted">هيدي الأسعار بتطلع للزبون وقت يختار الاشتراك. خلّي الخانة فاضية إذا بدك يكتب "حسب الاتفاق".</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><th></th><th>شهري</th><th>سنوي</th><th>مدى الحياة</th></tr>
        <tr><td>🛒 سوبرماركت</td><td><input id="p-supermarket-month" type="number" min="0"></td><td><input id="p-supermarket-year" type="number" min="0"></td><td><input id="p-supermarket-life" type="number" min="0"></td></tr>
        <tr><td>📱 محل تلفونات</td><td><input id="p-phones-month" type="number" min="0"></td><td><input id="p-phones-year" type="number" min="0"></td><td><input id="p-phones-life" type="number" min="0"></td></tr>
      </table>
      <label for="paymentInfo" style="margin-top:10px">طريقة الدفع (بتطلع للزبون بعد ما يبعت الطلب)</label>
      <textarea id="paymentInfo" rows="3" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;background:transparent;color:var(--text);font:inherit" placeholder="مثلاً: حوّل المبلغ على Whish رقم 03 123 456 أو OMT باسم ..."></textarea>
      <div class="row" style="margin-top:10px"><button id="savePlansBtn">حفظ الأسعار</button></div>
    </section>

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
        <div><label for="email">إيميل الزبون</label><input id="email" type="email" dir="ltr" placeholder="name@email.com" autocapitalize="none"></div>
        <div><label for="note">اسم المحل / ملاحظة</label><input id="note" placeholder="مثلاً: سوبرماركت البركة"></div>
        <div style="flex:0 1 140px"><label for="plan">النوع</label>
          <select id="plan"><option value="month">شهري</option><option value="year" selected>سنوي</option><option value="life">مدى الحياة</option></select></div>
        <div style="flex:0 1 160px"><label for="bizType">نوع المحل</label>
          <select id="bizType"><option value="supermarket">🛒 سوبرماركت</option><option value="phones">📱 محل تلفونات</option></select></div>
        <div style="flex:0 1 110px"><label for="maxDevices">عدد الأجهزة</label><input id="maxDevices" type="number" min="1" max="20" value="1"></div>
        <div style="flex:0 1 90px"><label for="count">عدد المفاتيح</label><input id="count" type="number" min="1" max="100" value="1"></div>
      </div>
      <div class="row" style="margin-top:10px"><button id="createBtn">إنشاء</button></div>
      <div id="created"></div>
    </section>

    <section class="card">
      <div class="row" style="align-items:end">
        <div><label for="q">بحث (إيميل، مفتاح، محل، ملاحظة)</label><input id="q" type="search"></div>
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
const ERR = { unauthorized: 'مفتاح الإدارة غير صحيح', admin_key_not_set: 'ما في ADMIN_API_KEY على السيرفر بعد. زيده من Settings ← Variables and Secrets واعمل Deploy', invalid_key: 'المفتاح غير موجود', bad_plan: 'نوع غير صالح', bad_email: 'الإيميل مش مكتوب صح', already_decided: 'هالطلب انعملو قرار من قبل', device_not_found: 'هالجهاز مش مرتبط بالمفتاح', mail_not_configured: 'الإيميلات مش مفعّلة بعد: حط RESEND_API_KEY بـ Cloudflare', mail_failed: 'ما قدرنا نوصل لخدمة الإيميل، جرّب كمان شوي', validation_error: 'Resend رفض الإيميل: تأكّد إنو الدومين beecash.app صار Verified بـ Resend', no_email: 'ما في إيميل مسجّل', bad_request: 'في خانة ناقصة' };
const mailError = (code) => ERR[code] || code;
const PERIOD = { month: 'شهري', year: 'سنوي', life: 'مدى الحياة' };
const BIZ = { supermarket: '🛒 سوبرماركت', phones: '📱 محل تلفونات' };
const errMsg = (e) => ERR[e.message] || ('خطأ: ' + e.message);
const date = (s) => s ? new Date(s).toLocaleDateString('ar-LB') : '—';

const ago = (s) => {
  if (!s) return '—';
  const m = Math.round((Date.now() - new Date(s).getTime()) / 60000);
  if (m < 2) return 'هلّق';
  if (m < 60) return 'من ' + m + ' دقيقة';
  if (m < 1440) return 'من ' + Math.round(m / 60) + ' ساعة';
  return 'من ' + Math.round(m / 1440) + ' يوم';
};
async function showDevices(key) {
  const box = $('devs-' + key);
  if (!box) return;
  const { devices } = await api('/api/admin/licenses/' + encodeURIComponent(key) + '/devices');
  box.innerHTML = devices.map((d, i) =>
    '<div class="dev"><div>' +
      '<div><b>' + (i + 1) + '. ' + esc(d.label || 'جهاز') + '</b>' + (d.shopName ? ' · 🏪 ' + esc(d.shopName) : '') + '</div>' +
      '<div class="muted">أول تفعيل: ' + date(d.firstSeenAt) + ' · آخر اتصال: ' + ago(d.lastSeenAt) + ' · <span class="mono" dir="ltr">' + esc(d.deviceId.slice(0, 8)) + '</span></div>' +
    '</div><button class="danger" data-remove-device="' + esc(d.deviceId) + '" data-key="' + esc(key) + '" data-label="' + esc(d.label || 'جهاز') + '">إلغاء هالجهاز</button></div>'
  ).join('') || '<div class="muted">ما في أجهزة.</div>';
}

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
      (l.email ? '<div class="email" dir="ltr">📧 ' + esc(l.email) + '</div>' : '<div class="muted">📧 بلا إيميل</div>') +
      '<div class="mono"><b>' + esc(l.key) + '</b></div>' +
      '<div class="muted">' + (BIZ[l.businessType] || '') + ' · ' + (PERIOD[l.period] || PERIOD[l.plan] || '') + ' · <span class="pill ' + cls + '">' + label + '</span>' +
      (l.shopName ? ' · ' + esc(l.shopName) : '') + (l.note ? ' · ' + esc(l.note) : '') + '</div>' +
      '<div class="muted">' + (l.activatedAt ? 'تفعيل: ' + date(l.activatedAt) : '') + (l.expiresAt ? ' · ينتهي: ' + date(l.expiresAt) : '') +
      ' · أجهزة: <b>' + (l.devices || 0) + '/' + (l.maxDevices || 1) + '</b></div></div>' +
      '<div class="actions">' +
      '<button class="secondary" data-copy="' + esc(l.key) + '">نسخ</button>' +
      (l.devices ? '<button class="secondary" data-show-devices="' + esc(l.key) + '">💻 الأجهزة (' + l.devices + ')</button>' : '') +
      (l.email && l.status !== 'revoked' ? '<button class="secondary" data-send-key="' + esc(l.key) + '" data-to="' + esc(l.email) + '">📧 ابعت المفتاح بالإيميل</button>' : '') +
      '<button class="secondary" data-email="' + esc(l.key) + '" data-current=""' + esc(l.email || '') + '">' + (l.email ? 'تعديل الإيميل' : 'إضافة إيميل') + '</button>' +
      (l.status !== 'revoked' ? '<button class="secondary" data-devices="' + esc(l.key) + '" data-max="' + (l.maxDevices || 1) + '">عدد الأجهزة</button>' : '') +
      (l.devices && l.status !== 'revoked' ? '<button class="secondary" data-reset="' + esc(l.key) + '">نقل لأجهزة جديدة</button>' : '') +
      (l.status !== 'revoked' ? '<button class="danger" data-revoke="' + esc(l.key) + '">إلغاء</button>' : '') +
      '<button class="danger" data-delete="' + esc(l.key) + '" data-active="' + (l.status !== 'revoked' && l.devices ? '1' : '') + '">🗑️ حذف</button>' +
      '</div><div class="devs" id="devs-' + esc(l.key) + '"></div></div>';
  }).join('') || '<p class="muted">لا يوجد مفاتيح بعد.</p>';
}

async function load() {
  const q = $('q').value.trim();
  const { licenses } = await api('/api/admin/licenses' + (q ? '?q=' + encodeURIComponent(q) : ''));
  render(licenses);
}

function renderRequests(list) {
  $('requests').innerHTML = list.map((r) => {
    const st = r.status === 'pending' ? ['', 'بانتظار الموافقة'] : r.status === 'approved' ? ['active', 'موافق'] : ['revoked', 'مرفوض'];
    return '<div class="lic"><div>' +
      '<div class="email" dir="ltr">📧 ' + esc(r.email) + '</div>' +
      '<div><b>' + esc(r.shopName || '—') + '</b> · ' + esc(r.ownerName || '') + ' · <span dir="ltr">' + esc(r.phone || '') + '</span></div>' +
      '<div class="muted">' + (BIZ[r.businessType] || r.businessType) + ' · ' + (PERIOD[r.period] || r.period) + ' · <span class="pill ' + st[0] + '">' + st[1] + '</span> · ' + date(r.createdAt) + '</div>' +
      (r.note ? '<div class="muted">📝 ' + esc(r.note) + '</div>' : '') +
      (r.licenseKey ? '<div class="mono">' + esc(r.licenseKey) + '</div>' : '') +
      '</div><div class="actions">' +
      (r.status === 'pending' ? '<button data-approve="' + esc(r.id) + '">موافقة ✅</button><button class="danger" data-reject="' + esc(r.id) + '">رفض</button>' : '') +
      (r.licenseKey ? '<button class="secondary" data-copy="' + esc(r.licenseKey) + '">نسخ المفتاح</button>' : '') +
      '</div></div>';
  }).join('') || '<p class="muted">ما في طلبات هون.</p>';
}
async function loadRequests() {
  const f = $('reqFilter').value;
  const { requests } = await api('/api/admin/requests' + (f ? '?status=' + f : ''));
  renderRequests(requests);
  const pending = (await api('/api/admin/requests?status=pending')).requests.length;
  $('pendingCount').textContent = pending ? pending + ' جديد' : '';
}
async function loadPlans() {
  const { plans } = await api('/api/admin/plans');
  for (const t of ['supermarket', 'phones']) for (const p of ['month', 'year', 'life']) {
    const v = plans.prices[t][p]; $('p-' + t + '-' + p).value = v == null ? '' : v;
  }
  $('paymentInfo').value = plans.paymentInfo || '';
}

const MSG_TEMPLATES = [
  // [button, message, email subject]
  ['👋 ترحيب', 'أهلاً وسهلاً {name} 👋 شكراً لتجربتك BeeCash في {shop}. نحن هنا لمساعدتك في أي وقت إذا احتجت إلى أي دعم في التشغيل. وعندما تكون جاهزاً، يتيح لك الاشتراك استخدام البرنامج بلا حدود 🚀', 'أهلاً بك في BeeCash يا {name} 👋'],
  ['⏳ اقتراب نهاية التجربة', 'مرحباً {name} 🙌 لم يتبقَّ لك سوى {left} فواتير في الفترة التجريبية المجانية. اشترك الآن لتبقى فواتيرك ومخزونك وحساباتك تعمل دون أي انقطاع في متجرك ✅', 'بقي لك {left} فواتير فقط في التجربة المجانية ⏳'],
  ['🎁 عرض خاص', 'عرض خاص لك يا {name} 🎁 عند الاشتراك خلال هذا الأسبوع تحصل على خصم خاص على اشتراك {shop}. اضغط على "اشترك الآن" وأرسل طلبك 🐝', 'عرض خاص لـ {shop} لفترة محدودة 🎁'],
  ['☁️ مزايا الاشتراك', 'مع اشتراك BeeCash يا {name} تحصل على: فواتير غير محدودة، ومزامنة بين عدة أجهزة، ونسخ احتياطي على السحابة، وتحديثات مستمرة. لا تدع تجربة {shop} تتوقف هنا 💪', 'ما الذي ينتظرك مع اشتراك BeeCash يا {name}؟'],
];
let msgTo = null;
function openComposer(deviceId, label) {
  msgTo = deviceId;
  $('msgTarget').textContent = label;
  $('msgTemplates').innerHTML = MSG_TEMPLATES.map((t, i) => '<button class="secondary" data-template="' + i + '">' + esc(t[0]) + '</button>').join('');
  $('composer').classList.remove('hidden');
  $('msgText').focus();
  $('composer').scrollIntoView({ behavior: 'smooth', block: 'center' });
}
async function loadSent() {
  const { messages } = await api('/api/admin/trials/messages');
  $('sentList').innerHTML = messages.map((m) =>
    '<div class="dev"><div><div>' + esc(m.text) + '</div><div class="muted">' +
      (m.deviceId === '*' ? '👥 لكل يلي عم يجرّبوا' : '🏪 ' + esc(m.shopName || 'جهاز')) + ' · ' + ago(m.createdAt) +
      ' · ' + (m.reads ? '✓ انقرأت (' + m.reads + ')' : '⏳ بعدها ما انقرأت') + '</div>' +
      (m.emailed || m.emailFailed
        ? '<div class="muted">📧 ' + (m.emailed ? 'انبعتت بالإيميل لـ ' + m.emailed + (m.emailed === 1 ? ' شخص' : ' أشخاص') : '') +
          (m.emailFailed ? (m.emailed ? ' · ' : '') + '<span style="color:#d92d20">ما انبعتت لـ ' + m.emailFailed + '</span>' : '') +
          (m.emailSubject ? ' · «' + esc(m.emailSubject) + '»' : '') + '</div>'
        : '<div class="muted">📱 جوّا البرنامج بس</div>') +
      '</div>' +
    '<button class="danger" data-del-msg="' + esc(m.id) + '">🗑️</button></div>'
  ).join('') || '<p class="muted">ما بعتّ رسائل بعد.</p>';
}

const FLAG = (c) => c && c.length === 2 ? String.fromCodePoint(...[...c.toUpperCase()].map((x) => 127397 + x.charCodeAt(0))) : '';
async function loadTrials() {
  const f = $('trialFilter').value; const q = $('trialQ').value.trim();
  const qs = [f ? 'status=' + f : '', q ? 'q=' + encodeURIComponent(q) : ''].filter(Boolean).join('&');
  const { trials } = await api('/api/admin/trials' + (qs ? '?' + qs : ''));
  $('trialCount').textContent = trials.length;
  $('trials').innerHTML = trials.map((t) => {
    const fresh = Date.now() - new Date(t.lastSeenAt).getTime() < 24 * 3600 * 1000;
    const wa = t.ownerPhone ? 'https://wa.me/' + (t.ownerPhone.replace(/\D/g, '').replace(/^0/, '961').replace(/^(?!961)/, '961')) : '';
    return '<div class="lic"><div>' +
      '<div><b>' + (BIZ[t.businessType] || '🏪') + ' ' + esc(t.shopName || 'محل بلا اسم') + '</b> ' +
        (t.licenseKey ? '<span class="pill active">مشترك</span>' : '<span class="pill">تجربة · ' + (t.invoicesUsed || 0) + '/15 فاتورة</span>') +
        (fresh ? ' <span class="pill active">نشط اليوم</span>' : '') + '</div>' +
      '<div class="muted">' + (t.ownerName ? '👤 ' + esc(t.ownerName) + ' · ' : '') + (t.ownerEmail ? '<span dir="ltr">📧 ' + esc(t.ownerEmail) + '</span> · ' : '') +
        (t.ownerPhone ? '<span dir="ltr">📞 ' + esc(t.ownerPhone) + '</span> · ' : '') + '💻 ' + esc(t.deviceLabel || 'جهاز') + (t.country ? ' · ' + FLAG(t.country) + ' ' + esc(t.country) : '') + '</div>' +
      (t.messagesSent ? '<div class="muted">💬 ' + t.messagesSent + ' رسالة · ' + (t.messagesRead >= t.messagesSent ? '✓ قراهن كلّن' : '✓ قرا ' + t.messagesRead) + ' · آخر رسالة ' + ago(t.lastMessageAt) + '</div>' : '') +
      '<div class="muted">أول مرّة: ' + date(t.firstSeenAt) + ' · آخر مرّة: ' + ago(t.lastSeenAt) + (t.licenseKey ? ' · <span class="mono">' + esc(t.licenseKey) + '</span>' : '') + '</div>' +
      '</div><div class="actions">' +
        (!t.licenseKey ? '<button class="secondary" data-msg-device="' + esc(t.deviceId) + '" data-msg-label="' + esc(t.shopName || 'جهاز') + '">💬 رسالة</button>' : '') +
        (t.ownerEmail ? '<button class="secondary" data-copy="' + esc(t.ownerEmail) + '">نسخ الإيميل</button>' : '') +
        (wa ? '<a class="secondary btnlink" href="' + esc(wa) + '" target="_blank" rel="noopener">واتساب</a>' : '') +
        '<button class="danger" data-del-trial="' + esc(t.deviceId) + '">🗑️</button>' +
      '</div></div>';
  }).join('') || '<p class="muted">ما في حدا بعد.</p>';
}

const MAIL_KIND = { trial: '📣 رسالة تجربة', key: '🔑 مفتاح تفعيل', free: '✉️ إيميل' };
async function loadMailLog() {
  const { emails } = await api('/api/admin/mail/log');
  $('mailLog').innerHTML = emails.map((e) =>
    '<div class="dev"><div><div><b>' + esc(e.subject || '—') + '</b></div>' +
    '<div class="muted">' + (MAIL_KIND[e.kind] || e.kind) + ' · إلى <span dir="ltr">' + esc(e.to) + '</span> · من <span dir="ltr">' + esc(e.from) + '</span> · ' + ago(e.createdAt) + '</div></div>' +
    (e.status === 'sent' ? '<span class="pill active">انبعت ✓</span>' : '<span class="pill revoked" title="' + esc(mailError(e.error)) + '">ما انبعت</span>') + '</div>'
  ).join('') || '<p class="muted">ما انبعت ولا إيميل بعد.</p>';
}
let mailReady = false;
async function loadMail() {
  const m = await api('/api/admin/mail');
  mailReady = m.configured;
  $('mailStatus').innerHTML = m.configured
    ? '<span class="pill active">شغّال ✓</span> الإيميلات عم تنبعت.'
    : '<span class="pill revoked">مش مفعّل</span> لازم تحط السر <b class="mono">RESEND_API_KEY</b> بـ Cloudflare (Worker ← Settings ← Variables and Secrets).';
}

async function enter() {
  adminKey = $('adminKey').value.trim() || adminKey;
  try {
    await load();
    try { sessionStorage.setItem('adminKey', adminKey); } catch {}
    $('login').classList.add('hidden'); $('app').classList.remove('hidden');
    const { publicKey } = await (await fetch('/api/licenses/public-key')).json();
    $('publicKey').textContent = publicKey;
    await Promise.all([loadRequests(), loadPlans(), loadTrials(), loadMail()]);
  } catch (e) { show(errMsg(e), false); }
}
$('reqFilter').onchange = () => loadRequests().catch((e) => show(errMsg(e), false));
$('msgAllBtn').onclick = () => openComposer('*', '👥 كل الأجهزة يلي بعدها بالتجربة');
$('msgCancel').onclick = () => { $('composer').classList.add('hidden'); $('msgText').value = ''; };
$('mailLogToggle').onclick = async () => {
  const box = $('mailLog');
  if (!box.classList.contains('hidden')) { box.classList.add('hidden'); return; }
  try { await loadMailLog(); box.classList.remove('hidden'); } catch (e) { show(errMsg(e), false); }
};
$('msgEmail').onchange = () => $('msgSubject').classList.toggle('hidden', !$('msgEmail').checked);
$('mailSend').onclick = async () => {
  const body = { to: $('mailTo').value.trim(), from: $('mailFrom').value, subject: $('mailSubject').value.trim(), text: $('mailText').value.trim() };
  if (!body.to || !body.subject || !body.text) return show('عبّي الإيميل والعنوان والرسالة', false);
  const btn = $('mailSend'); btn.disabled = true;
  try {
    const r = await api('/api/admin/mail', { method: 'POST', body: JSON.stringify(body) });
    show('انبعت الإيميل من ' + r.from);
    $('mailSubject').value = ''; $('mailText').value = '';
    if (!$('mailLog').classList.contains('hidden')) loadMailLog();
  } catch (e) { show(errMsg(e), false); } finally { btn.disabled = false; }
};
$('sentToggle').onclick = async () => {
  const box = $('sentList');
  if (!box.classList.contains('hidden')) { box.classList.add('hidden'); return; }
  try { await loadSent(); box.classList.remove('hidden'); } catch (e) { show(errMsg(e), false); }
};
$('msgSend').onclick = async () => {
  const text = $('msgText').value.trim();
  if (!text || !msgTo) return show('اكتب الرسالة أوّل', false);
  try {
    const email = $('msgEmail').checked;
    const r = await api('/api/admin/trials/messages', { method: 'POST', body: JSON.stringify({ deviceId: msgTo, text, email, subject: $('msgSubject').value.trim() }) });
    let note = msgTo === '*' ? 'انبعتت لكل يلي عم يجرّبوا. بتطلع عندن أول ما يفتحوا البرنامج' : 'انبعتت. بتطلع عندو أول ما يفتح البرنامج';
    if (email) note += r.emailTargets ? ' · 📧 انبعت ' + r.emailed + ' من ' + r.emailTargets + ' إيميل' + (r.emailError ? ' (' + mailError(r.emailError) + ')' : '') : ' · 📧 ما في إيميل مسجّل';
    show(note, !email || !r.emailError);
    $('composer').classList.add('hidden'); $('msgText').value = ''; $('msgSubject').value = '';
    loadTrials(); if (!$('sentList').classList.contains('hidden')) loadSent();
  } catch (e) { show(errMsg(e), false); }
};
$('trialFilter').onchange = () => loadTrials().catch((e) => show(errMsg(e), false));
$('trialQ').oninput = () => { clearTimeout(loadTrials.t); loadTrials.t = setTimeout(() => loadTrials().catch(() => {}), 300); };
$('savePlansBtn').onclick = async () => {
  const prices = { supermarket: {}, phones: {} };
  for (const t of ['supermarket', 'phones']) for (const p of ['month', 'year', 'life']) {
    const v = $('p-' + t + '-' + p).value.trim(); prices[t][p] = v === '' ? null : Number(v);
  }
  try { await api('/api/admin/plans', { method: 'POST', body: JSON.stringify({ prices, paymentInfo: $('paymentInfo').value }) }); show('انحفظت الأسعار'); }
  catch (e) { show(errMsg(e), false); }
};

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
    const { licenses } = await api('/api/admin/licenses', { method: 'POST', body: JSON.stringify({ period: $('plan').value, businessType: $('bizType').value, email: $('email').value, note: $('note').value, count: Number($('count').value) || 1, maxDevices: Number($('maxDevices').value) || 1 }) });
    $('created').innerHTML = '<p class="muted" style="margin-top:12px">المفاتيح الجديدة (انسخ وابعت للزبون):</p>' +
      licenses.map((l) => '<div class="lic"><span><span class="mono"><b>' + esc(l.key) + '</b></span>' + (l.email ? ' <span class="muted" dir="ltr">' + esc(l.email) + '</span>' : '') + '</span><button class="secondary" data-copy="' + esc(l.key) + '">نسخ</button></div>').join('');
    show('تم إنشاء ' + licenses.length + ' مفتاح');
    $('email').value = ''; $('note').value = '';
    load();
  } catch (e) { show(errMsg(e), false); } finally { btn.disabled = false; }
};
document.addEventListener('click', async (e) => {
  const t = e.target;
  if (t.dataset.approve) {
    const n = prompt('كم جهاز مسموح لهالزبون؟ (1 - 20)', '1');
    if (n !== null) {
      try { const r = await api('/api/admin/requests/' + encodeURIComponent(t.dataset.approve) + '/approve', { method: 'POST', body: JSON.stringify({ maxDevices: Number(n) || 1 }) }); const license = r.license; show('تمت الموافقة. المفتاح ' + license.key + ' رح يتفعّل عند الزبون لحالو' + (r.emailed ? ' · 📧 وانبعتلو بالإيميل' : r.emailError === 'mail_not_configured' ? '' : ' · ما انبعت الإيميل (' + mailError(r.emailError) + ')')); loadRequests(); load(); }
      catch (err) { show(errMsg(err), false); }
    }
  }
  if (t.dataset.reject && confirm('رفض هالطلب؟')) {
    try { await api('/api/admin/requests/' + encodeURIComponent(t.dataset.reject) + '/reject', { method: 'POST' }); show('انرفض الطلب'); loadRequests(); }
    catch (err) { show(errMsg(err), false); }
  }
  if (t.dataset.copy) { await navigator.clipboard.writeText(t.dataset.copy); show('تم نسخ المفتاح'); }
  if (t.dataset.delete) {
    const k = t.dataset.delete;
    const warn = t.dataset.active
      ? 'تنبيه: المفتاح ' + k + ' مفعّل عند زبون، والبرنامج عنده بيوقف أول ما يتصل بالإنترنت.\\n\\nحذفه نهائياً؟ ما فيك ترجّعه.'
      : 'حذف المفتاح ' + k + ' نهائياً من اللائحة؟ ما فيك ترجّعه.';
    if (confirm(warn)) {
      try { await api('/api/admin/licenses/' + encodeURIComponent(k) + '/delete', { method: 'POST' }); show('انحذف المفتاح'); load(); }
      catch (err) { show(errMsg(err), false); }
    }
  }
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
  if (t.dataset.email) {
    const v = prompt('إيميل الزبون للمفتاح ' + t.dataset.email + ' (فاضي لمسحه):', t.dataset.current || '');
    if (v !== null) {
      try { await api('/api/admin/licenses/' + encodeURIComponent(t.dataset.email) + '/email', { method: 'POST', body: JSON.stringify({ email: v }) }); show('تم حفظ الإيميل'); load(); }
      catch (err) { show(errMsg(err), false); }
    }
  }
  if (t.dataset.sendKey && confirm('ابعت المفتاح ' + t.dataset.sendKey + ' بالإيميل لـ ' + t.dataset.to + '؟ (من info@beecash.app)')) {
    try { await api('/api/admin/licenses/' + encodeURIComponent(t.dataset.sendKey) + '/send-email', { method: 'POST' }); show('📧 انبعت المفتاح لـ ' + t.dataset.to); }
    catch (err) { show(errMsg(err), false); }
  }
  if (t.dataset.msgDevice) openComposer(t.dataset.msgDevice, '🏪 ' + t.dataset.msgLabel);
  if (t.dataset.template !== undefined && MSG_TEMPLATES[t.dataset.template]) {
    const [, text, subject] = MSG_TEMPLATES[t.dataset.template];
    $('msgText').value = text;
    $('msgSubject').value = subject; // still editable
  }
  if (t.dataset.delMsg && confirm('حذف هالرسالة؟ إذا بعدها ما انقرأت ما رح تطلع عند الزبون.')) {
    try { await api('/api/admin/trials/messages/' + encodeURIComponent(t.dataset.delMsg) + '/delete', { method: 'POST' }); loadSent(); loadTrials(); }
    catch (err) { show(errMsg(err), false); }
  }
  if (t.dataset.delTrial && confirm('شيل هالجهاز من لائحة التجربة؟ (إذا رجع فتح البرنامج بيرجع يبيّن)')) {
    try { await api('/api/admin/trials/' + encodeURIComponent(t.dataset.delTrial) + '/delete', { method: 'POST' }); loadTrials(); }
    catch (err) { show(errMsg(err), false); }
  }
  if (t.dataset.showDevices) {
    const box = $('devs-' + t.dataset.showDevices);
    if (box && box.innerHTML) box.innerHTML = '';
    else { try { await showDevices(t.dataset.showDevices); } catch (err) { show(errMsg(err), false); } }
  }
  if (t.dataset.removeDevice && confirm('إلغاء الجهاز "' + t.dataset.label + '" من المفتاح ' + t.dataset.key + '؟ البرنامج عليه بيوقف أول ما يتصل بالإنترنت، وبيفضى مكانو لجهاز تاني.')) {
    try {
      await api('/api/admin/licenses/' + encodeURIComponent(t.dataset.key) + '/devices/' + encodeURIComponent(t.dataset.removeDevice) + '/remove', { method: 'POST' });
      show('انلغى الجهاز');
      const k = t.dataset.key;
      await load();
      try { await showDevices(k); } catch {}
    } catch (err) { show(errMsg(err), false); }
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
