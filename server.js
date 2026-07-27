const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const Redis = require('ioredis');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.json());

// الاتصال بقاعدة البيانات PostgreSQL (مع دعم PostGIS)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// الاتصال بـ Redis
const redis = new Redis(process.env.REDIS_URL);

// نقطة اختبار للسيرفر
app.get('/api/health', async (req, res) => {
  try {
    const dbCheck = await pool.query('SELECT NOW()');
    res.json({
      status: 'success',
      message: 'Super App Backend is running live!',
      database_time: dbCheck.rows[0].now,
      redis_status: redis.status
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
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
server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});