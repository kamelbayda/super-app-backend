const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const Redis = require('ioredis');
require('dotenv').config();

const { createApp } = require('./app');
const { ensureLicenseSchema } = require('./licensing/schema');

// الاتصال بقاعدة البيانات PostgreSQL (مع دعم PostGIS)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// الاتصال بـ Redis (اختياري)
const redis = process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : null;

// PEM keys are often pasted into env vars with literal "\n"
const licensePrivateKey = (process.env.LICENSE_PRIVATE_KEY || '').replace(/\\n/g, '\n') || null;

const app = createApp({ pool, redis, licensePrivateKey, adminApiKey: process.env.ADMIN_API_KEY });
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// إدارة الاتصالات اللحظية عبر Socket.io
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('join_room', (room) => {
    socket.join(room);
    console.log(`User joined room: ${room}`);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;

ensureLicenseSchema(pool)
  .catch((err) => console.error('Could not prepare licensing tables:', err.message))
  .finally(() => {
    server.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });
  });
