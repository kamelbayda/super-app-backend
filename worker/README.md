# pos-licensing (Cloudflare Worker)

Licence server for the POS app, on **Cloudflare Workers + D1**. It runs on the free plan:
100,000 requests a day, 5 GB of D1, and it never sleeps. Everything is done from the
browser, so no terminal is needed.

It has the same API as the Express version in `../licensing`, so the POS app and
`../scripts/licenses.js` work with either one.

## النشر (مرة وحدة، من المتصفح)

1. **حساب Cloudflare:** اعمل حساب مجاني على https://dash.cloudflare.com.
2. **ربط الريبو:**
   - روح على **Workers & Pages ← Create application ← Import a repository**.
   - اربط GitHub واختار `kamelbayda/super-app-backend`.
   - **Project name:** `pos-licensing` (لازم يطابق `name` بـ `wrangler.toml`).
   - **Root directory / Path:** `worker`
   - كبس **Save and Deploy**. قاعدة D1 بتنعمل لحالها بأول نشر.
3. **مفتاح الإدارة** (لوحة Cloudflare الجديدة ما فيها Secret بالـ Bindings، فالـ build بيحطه):
   - **Settings ← Builds ← Variables and secrets ← Add:** النوع **Secret**، الاسم `ADMIN_API_KEY`،
     والقيمة كلمة سر طويلة بتختارها إنت (اكتبها بإيدك).
   - **Settings ← Builds ← Deploy command:**
     `npx wrangler deploy && printf '%s' "$ADMIN_API_KEY" | npx wrangler secret put ADMIN_API_KEY`
   - **Deployments ← ⋯ ← Retry build.** لتغيير الكلمة بعدين: غيّرها بنفس المحل وأعد الـ build.
4. **فتح صفحة الإدارة:** `https://pos-licensing.<اسم-حسابك>.workers.dev/admin`
   - فوت بمفتاح الإدارة.
   - كبس **نسخ إعدادات البرنامج (.env)**، وحطهن بملف `.env` تبع الـ POS قبل ما تعمل build.

كل ما ينعمل merge على `main`، Cloudflare بيعيد النشر لحاله.

## صفحة إيصالات القبض

نفس الـ Worker بينشر صفحة الإيصالات على:
**`https://pos-licensing.<اسم-حسابك>.workers.dev/receipt`**

- بتشتغل لأي حدا معو الرابط، من الكمبيوتر أو التلفون أو الـ iPad، بلا أي حساب.
- **أرشيف الإيصالات** محفوظ بقاعدة D1 تبع الـ Worker، ومحمي بكلمة سر:
  - إذا ما عملت شي، كلمة سر الأرشيف هي نفسها **مفتاح الإدارة** `ADMIN_API_KEY`.
  - إذا بدك كلمة سر لحالها للموظفين (حتى ما ياخدوا مفتاح الإدارة)، زيد Secret اسمو `RECEIPTS_API_KEY`
    بنفس المحل اللي حطّيت فيه `ADMIN_API_KEY`، وزيد على الـ Deploy command:
    ` && printf '%s' "$RECEIPTS_API_KEY" | npx wrangler secret put RECEIPTS_API_KEY`
- الطباعة بتطلع على ورقة A4 وحدة فيها النسخة الأصلية والنسخة (COPY).

## الإيميلات (Resend)

السيرفر بيبعت إيميلات عن طريق [Resend](https://resend.com) (مجاني لحد 3000 إيميل بالشهر، 100 باليوم):

| النوع | من |
|---|---|
| رسائل التجربة والعروض (خيار "ابعتها كمان عالإيميل") | `sales@beecash.app` |
| مفتاح التفعيل (أوتوماتيك عند الموافقة على طلب، أو زر "ابعت المفتاح بالإيميل") | `info@beecash.app` |
| إيميل حر من صفحة الإدارة (الأعطال والدعم، أو أي عنوان من التلاتة) | `support@beecash.app` |

التشغيل:
1. بـ Resend: **Domains ← Add Domain ← `beecash.app`**، وكبس **Auto configure** مع Cloudflare لحد ما يصير **Verified**.
2. **API Keys ← Create API Key** (Sending access).
3. بـ Cloudflare: Worker **`pos-licensing` ← Settings ← Variables and Secrets ← Add**: النوع **Secret**، الاسم `RESEND_API_KEY`، والقيمة المفتاح.
   (إذا ما في هالخيار، حطّو متل `ADMIN_API_KEY` بالـ Builds وزيد على الـ Deploy command:
   ` && printf '%s' "$RESEND_API_KEY" | npx wrangler secret put RESEND_API_KEY`)

بلا هالمفتاح كل شي بيضل شغّال، بس ما بينبعت إيميلات، وصفحة الإدارة بتقلّك "مش مفعّل".
الردود على الإيميلات بتوصل على Google Workspace لأنو الـ MX ضلّ عند غوغل.

## الاستعمال اليومي
من صفحة `/admin` (بتشتغل على الموبايل والـ iPad):
- **إنشاء مفتاح:** سنوي أو مدى الحياة لزبون.
- **نسخ المفتاح** وبعته للزبون.
- **إلغاء مفتاح:** البرنامج عند الزبون بيوقف عند أول اتصال بالإنترنت.
- **عدد الأجهزة:** المفتاح الواحد بيشتغل على عدة أجهزة لنفس المحل (مثلاً كاشير + تابلت المدير). بتحدد العدد وقت تعمل المفتاح، أو بتغيّره بعدين من زر **عدد الأجهزة**.
- **نقل لأجهزة جديدة:** إذا الزبون غيّر الكمبيوتر. بيفك المفتاح عن كل أجهزته، ومدة الاشتراك ما بتتغيّر.

## Endpoints

| Method & path | Auth |
| --- | --- |
| `POST /api/licenses/activate` `{ key, deviceId, shopName }` | public (rate limited) |
| `POST /api/licenses/refresh` `{ key, deviceId }` | public (rate limited) |
| `GET /api/licenses/public-key` | public, gives the value for `VITE_LICENSE_PUBLIC_KEY` |
| `GET/POST /api/admin/licenses` (`{ plan, note?, count?, maxDevices? }`), `POST /api/admin/licenses/:key/revoke`, `POST /api/admin/licenses/:key/reset-device`, `POST /api/admin/licenses/:key/devices` `{ maxDevices }` | `x-admin-key` |
| `GET /admin` | admin page (asks for the key) |
| `GET /receipt` | receipt maker (public page) |
| `GET /api/receipts`, `GET/PUT/DELETE /api/receipts/:id` | `x-receipts-key` (`RECEIPTS_API_KEY`, or `ADMIN_API_KEY` when unset) |

The ECDSA P-256 signing key pair is created on first use and kept in D1. Licences are
`base64url(JSON) + "." + base64url(r||s)`, the same format as the Express version.

## Development

```bash
npm install
npm run dev     # wrangler dev --local, with a local D1
npm test        # starts wrangler dev and runs the licence API tests
```
