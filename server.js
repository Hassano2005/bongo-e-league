// server.js - FIXED
const express = require('express');
const cors = require('cors');
const { pool, dbReady } = require('./db');
const authRouter = require('./auth');
// ✅ Only import authenticate ONCE
const { authenticate } = require('./auth'); 

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Health checks
app.get('/', (req, res) => {
  res.json({ status: '🎮 Bongo eLeague API is running!', database: 'connected', timestamp: new Date().toISOString() });
});
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ✅ Auth routes
app.use('/api/auth', authRouter);

// ✅ POST /api/tournaments - Create tournament (admin only)
app.post('/api/tournaments', authenticate, async (req, res) => {
  try {
    // Check if user is admin
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [req.userId]);
    if (userResult.rows[0]?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }

  const { name, entry_fee, prize_pool, status = 'upcoming' } = req.body;
  if (!name || !entry_fee) {
    return res.status(400).json({ error: 'Name and entry fee are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO tournaments (name, entry_fee, prize_pool, status) VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, parseInt(entry_fee), parseInt(prize_pool) || 0, status]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create tournament error:', err.message);
    res.status(500).json({ error: 'Failed to create tournament' });
  }
});

// ✅ GET /api/tournaments
app.get('/api/tournaments', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, COUNT(p.id) as joined_count FROM tournaments t LEFT JOIN participants p ON p.tournament_id = t.id GROUP BY t.id ORDER BY t.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List tournaments error:', err.message);
    res.status(500).json({ error: 'Failed to load tournaments' });
  }
});

// ✅ GET /api/users/profile
app.get('/api/users/profile', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, role, created_at, COALESCE(wins, 0) as wins, COALESCE(goals, 0) as goals, COALESCE(points, 0) as points, COALESCE(earned, 0) as earned FROM users WHERE id = $1`,
      [req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const tours = await pool.query(
      `SELECT t.id, t.name, t.status FROM tournaments t JOIN participants p ON p.tournament_id = t.id WHERE p.user_id = $1 AND t.status IN ('upcoming', 'live')`,
      [req.userId]
    );
    res.json({ user: result.rows[0], joined_tournaments: tours.rows });
  } catch (err) {
    console.error('Profile fetch error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ Start server
dbReady.then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Bongo eLeague Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('💥 Failed to start server:', err);
  process.exit(1);
});
