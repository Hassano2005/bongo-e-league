// server.js - With Authentication Integrated
const express = require('express');
const cors = require('cors');
// In server.js
const authRouter = require('./auth'); // ✅ No /routes/ prefix
const app = express();
app.use(cors());
app.use(express.json());

// ✅ Basic health check routes
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

// ✅ NEW: Mount auth routes
const authRouter = require('./routes/auth'); // ✅ Import auth router
app.use('/api/auth', authRouter);            // ✅ Routes: /api/auth/register, /api/auth/login

// 🔜 Add more routes later:
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
