// Creates the receipts table if it does not exist yet (safe to run on every start).
async function ensureReceiptSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS receipts (
      id           TEXT PRIMARY KEY,
      receipt_no   TEXT,
      payee        TEXT,
      receipt_date DATE,
      total        NUMERIC(18, 2) NOT NULL DEFAULT 0,
      currency     TEXT NOT NULL DEFAULT 'LBP',
      data         JSONB NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

module.exports = { ensureReceiptSchema };
