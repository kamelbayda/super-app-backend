# super-app-backend

Express + PostgreSQL (+ optional Redis / Socket.io) backend, deployed on Railway.

## Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, LICENSE_PRIVATE_KEY, ADMIN_API_KEY
npm start
```

The `licenses` table is created automatically on start.

## POS licensing

> **Recommended: deploy the Cloudflare Worker in [`worker/`](worker/README.md).** It is free,
> never sleeps, needs no terminal, and has a browser admin page at `/admin`. The Express
> implementation below has the same API and remains an option if you run this service on
> Railway or similar.

The POS app no longer contains activation keys or a key generator. Keys live here:

- Each key is random (`POS-XXXXX-XXXXX-XXXXX`), is either **year** (365 days from first
  activation) or **life**, and binds to the first computer that activates it.
- On activation the server returns a licence **signed with ECDSA P-256**. The POS verifies it
  offline with the public key, so it keeps working without internet. When online it refreshes
  the licence, so a revoked or expired key stops working on the next check.

### One-time setup

```bash
npm run generate-license-keys
```

- `LICENSE_PRIVATE_KEY` → Railway variables of this service (secret, never commit).
- `VITE_LICENSE_PUBLIC_KEY` → the POS `.env` (public, it is built into the app).
- Also set `ADMIN_API_KEY` in Railway to a long random string.

### Managing keys

```bash
export SERVER_URL=https://<your-service>.up.railway.app ADMIN_API_KEY=<secret>

npm run licenses -- create year "سوبرماركت البركة"   # annual key for a customer
npm run licenses -- create life "Ali shop" 3          # three lifetime keys
npm run licenses -- list                               # all keys (or: list <search>)
npm run licenses -- revoke POS-XXXXX-XXXXX-XXXXX       # stop a key
npm run licenses -- reset-device POS-XXXXX-XXXXX-XXXXX # customer changed computer
```

### API

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `POST /api/licenses/activate` `{ key, deviceId, shopName }` | public (rate limited) | first activation / re-activation on the bound device |
| `POST /api/licenses/refresh` `{ key, deviceId }` | public (rate limited) | periodic re-check, returns a fresh licence |
| `POST /api/admin/licenses` `{ plan, note?, count? }` | `x-admin-key` | create keys |
| `GET /api/admin/licenses?q=&status=` | `x-admin-key` | list keys |
| `POST /api/admin/licenses/:key/revoke` | `x-admin-key` | revoke |
| `POST /api/admin/licenses/:key/reset-device` | `x-admin-key` | unbind from the current computer (expiry is not extended) |

Errors are `{ ok: false, error: "invalid_key" | "revoked" | "expired" | "device_mismatch" | "rate_limited" | ... }`.

## Tests

```bash
TEST_DATABASE_URL=postgres://postgres@localhost:5432/superapp_test npm test
```

The test drops and recreates the `licenses` table, so point it at a throwaway database.
