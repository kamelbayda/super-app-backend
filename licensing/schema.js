// Creates the licensing tables if they do not exist yet (safe to run on every start).
async function ensureLicenseSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS licenses (
      key            TEXT PRIMARY KEY,
      plan           TEXT NOT NULL CHECK (plan IN ('year', 'life')),
      note           TEXT,
      status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
      device_id      TEXT,
      shop_name      TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
      activated_at   TIMESTAMPTZ,
      expires_at     TIMESTAMPTZ,
      last_seen_at   TIMESTAMPTZ
    );
  `);
}

module.exports = { ensureLicenseSchema };
