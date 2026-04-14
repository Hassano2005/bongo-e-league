// server.js - With Authentication Integrated
const express = require('express');
const cors = require('cors');

// ✅ Import DB (with dbReady)
const { pool, dbReady } = require('./db');

// ✅ Import auth router (auth.js is at ROOT, not in routes/)
const authRouter = require('./auth');

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

// ✅ Mount auth routes
app.use('/api/auth', authRouter);

// 🔜 Add more routes later:
// const usersRouter = require('./routes/users');
// app.use('/api/users', usersRouter);
// ... existing imports and app setup ...

// ✅ Mount auth routes
app.use('/api/auth', authRouter);

// ============================================
// ✅ ADD THESE NEW ENDPOINTS BELOW
// ============================================

// GET /api/users/profile - Returns current user data
app.get('/api/users/profile', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, role, created_at, 
              COALESCE(wins, 0) as wins,
              COALESCE(goals, 0) as goals,
              COALESCE(points, 0) as points,
              COALESCE(earned, 0) as earned
       FROM users WHERE id = $1`,
      [req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    // Fetch joined tournaments
    const tours = await pool.query(
      `SELECT t.id, t.name, t.status FROM tournaments t
       JOIN participants p ON p.tournament_id = t.id
       WHERE p.user_id = $1 AND t.status IN ('upcoming', 'live')`,
      [req.userId]
    );
    res.json({ user: result.rows[0], joined_tournaments: tours.rows });
  } catch (err) {
    console.error('Profile fetch error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/users/profile - Update user profile
app.put('/api/users/profile', authenticate, async (req, res) => {
  try {
    const { username, location } = req.body;
    const result = await pool.query(
      'UPDATE users SET username = $1 WHERE id = $2 RETURNING id, username, role',
      [username, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: result.rows[0], message: 'Profile updated' });
  } catch (err) {
    console.error('Profile update error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tournaments - Create tournament (admin only)
app.post('/api/tournaments', authenticate, async (req, res) => {
  try {
    // Check admin role
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
      `INSERT INTO tournaments (name, entry_fee, prize_pool, status) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, parseInt(entry_fee), parseInt(prize_pool) || 0, status]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create tournament error:', err.message);
    res.status(500).json({ error: 'Failed to create tournament' });
  }
});

// GET /api/tournaments - List all tournaments
app.get('/api/tournaments', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.*, COUNT(p.id) as joined_count 
       FROM tournaments t 
       LEFT JOIN participants p ON p.tournament_id = t.id 
       GROUP BY t.id 
       ORDER BY t.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('List tournaments error:', err.message);
    res.status(500).json({ error: 'Failed to load tournaments' });
  }
});

// ✅ Import authenticate middleware from auth.js
const { authenticate } = require('./auth');

// 🔜 Add more routes later...

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
