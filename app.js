const path = require('path');
const express = require('express');
const cors = require('cors');
const { createLicenseRouter, createAdminRouter } = require('./licensing/routes');
const { createReceiptsRouter } = require('./receipts/routes');

/**
 * Builds the Express app. Kept separate from server.js so tests can run it
 * against a throwaway database.
 */
function createApp({ pool, redis, licensePrivateKey, adminApiKey, receiptsApiKey }) {
  const app = express();
  app.set('trust proxy', 1); // Railway sits behind a proxy; needed for per-IP rate limiting
  app.use(cors());
  // Mounted before the app-wide JSON parser: receipts carry signature images and need a larger limit
  app.use('/api/receipts', createReceiptsRouter({ pool, apiKey: receiptsApiKey }));
  app.use(express.json({ limit: '100kb' }));

  // صفحة إنشاء إيصالات القبض
  app.use('/receipt', express.static(path.join(__dirname, 'public', 'receipt')));

  // نقطة اختبار للسيرفر
  app.get('/api/health', async (req, res) => {
    try {
      const dbCheck = await pool.query('SELECT NOW()');
      res.json({
        status: 'success',
        message: 'Super App Backend is running live!',
        database_time: dbCheck.rows[0].now,
        redis_status: redis ? redis.status : 'disabled',
      });
    } catch (err) {
      res.status(500).json({ status: 'error', error: err.message });
    }
  });

  // POS licensing
  if (licensePrivateKey) {
    app.use('/api/licenses', createLicenseRouter({ pool, privateKeyPem: licensePrivateKey }));
  } else {
    console.warn('LICENSE_PRIVATE_KEY is not set: /api/licenses is disabled');
  }
  app.use('/api/admin/licenses', createAdminRouter({ pool, adminApiKey }));

  return app;
}

module.exports = { createApp };
