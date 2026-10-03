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

The ECDSA P-256 signing key pair is created on first use and kept in D1. Licences are
`base64url(JSON) + "." + base64url(r||s)`, the same format as the Express version.

## Development

```bash
npm install
npm run dev     # wrangler dev --local, with a local D1
npm test        # starts wrangler dev and runs the licence API tests
```
