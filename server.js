// server.js - Minimal working version for Render
const express = require('express');
const cors = require('cors');
const { pool, dbReady } = require('./db'); // ✅ db.js is at root

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Basic health check route (so the app responds)
app.get('/', (req, res) => {
  res.json({ 
    status: '🎮 Bongo eLeague API is running!',
    database: 'connected',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// 🔜 TODO: Add routes later when files are ready
// const usersRouter = require('./routes/users');
// app.use('/api/users', usersRouter);

// ✅ Wait for DB, then start server
dbReady.then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Bongo eLeague Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('💥 Failed to start server:', err);
  process.exit(1);
});
