require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const multer = require('multer');

const pool = require('./backend/db');
const authRoutes = require('./backend/routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_bongo_key_change_me_later';

// Configure Multer for screenshots
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname)));
app.use('/uploads', express.static(uploadDir));

// API Routes
app.use('/api/auth', authRoutes);

// Authentication Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
        req.user = user;
        next();
    });
};

// --- PAYMENT APIs --- //

app.post('/api/payments/submit', authenticateToken, async (req, res) => {
    const { tournament_id, phone_number, amount } = req.body;
    try {
        await pool.query(
            'INSERT INTO payments (user_id, tournament_id, phone_number, amount) VALUES ($1, $2, $3, $4)',
            [req.user.id, tournament_id, phone_number, amount]
        );
        res.status(200).json({ message: 'Payment submitted for verification' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to submit payment' });
    }
});

app.get('/api/admin/payments', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*, u.username, t.name as tournament_name 
            FROM payments p
            JOIN users u ON p.user_id = u.id
            JOIN tournaments t ON p.tournament_id = t.id
            WHERE p.status = 'pending'
            ORDER BY p.created_at ASC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
});

app.post('/api/admin/payments/:id/approve', authenticateToken, async (req, res) => {
    const paymentId = req.params.id;
    try {
        const { rows } = await pool.query('SELECT * FROM payments WHERE id = $1', [paymentId]);
        const payment = rows[0];
        if (!payment) return res.status(404).json({ error: 'Payment not found' });

        await pool.query('UPDATE payments SET status = $1 WHERE id = $2', ['approved', paymentId]);
        await pool.query('INSERT INTO participants (user_id, tournament_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [payment.user_id, payment.tournament_id]);

        res.status(200).json({ message: 'Payment approved and player added to tournament' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to approve payment' });
    }
});

app.post('/api/admin/payments/:id/reject', authenticateToken, async (req, res) => {
    try {
        await pool.query('UPDATE payments SET status = $1 WHERE id = $2', ['rejected', req.params.id]);
        res.status(200).json({ message: 'Payment rejected' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to reject payment' });
    }
});

// --- VERIFICATION APIs --- //

app.post('/api/matches/verify', authenticateToken, upload.single('screenshot'), async (req, res) => {
    const { tournament_id, opponent_id, my_score, opponent_score } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Screenshot is required' });

    const screenshot_url = '/uploads/' + req.file.filename;
    try {
        await pool.query(
            `INSERT INTO match_verifications 
            (tournament_id, submitted_by, opponent_id, my_score, opponent_score, screenshot_url) 
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [tournament_id, req.user.id, opponent_id, my_score, opponent_score, screenshot_url]
        );
        res.status(200).json({ message: 'Match result submitted for verification' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to submit match result' });
    }
});

app.get('/api/admin/verifications', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT m.*, 
                   u1.username as submitter_name, 
                   u2.username as opponent_name,
                   t.name as tournament_name
            FROM match_verifications m
            JOIN users u1 ON m.submitted_by = u1.id
            JOIN users u2 ON m.opponent_id = u2.id
            JOIN tournaments t ON m.tournament_id = t.id
            WHERE m.status = 'pending'
            ORDER BY m.created_at ASC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch verifications' });
    }
});

app.post('/api/admin/verifications/:id/approve', authenticateToken, async (req, res) => {
    const verificationId = req.params.id;
    try {
        const { rows } = await pool.query('SELECT * FROM match_verifications WHERE id = $1', [verificationId]);
        const v = rows[0];
        if (!v) return res.status(404).json({ error: 'Verification not found' });

        await pool.query('UPDATE match_verifications SET status = $1 WHERE id = $2', ['approved', verificationId]);
        await pool.query(
            `INSERT INTO matches (tournament_id, player1_id, player2_id, score1, score2, status) 
             VALUES ($1, $2, $3, $4, $5, 'completed')`,
            [v.tournament_id, v.submitted_by, v.opponent_id, v.my_score, v.opponent_score]
        );
        res.status(200).json({ message: 'Result approved and match recorded' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to approve verification' });
    }
});

app.post('/api/admin/verifications/:id/reject', authenticateToken, async (req, res) => {
    try {
        await pool.query('UPDATE match_verifications SET status = $1 WHERE id = $2', ['rejected', req.params.id]);
        res.status(200).json({ message: 'Result rejected' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to reject verification' });
    }
});

app.get('/api/tournaments/:id/opponents', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.username
            FROM participants p
            JOIN users u ON p.user_id = u.id
            WHERE p.tournament_id = $1 AND u.id != $2
        `, [req.params.id, req.user.id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch opponents' });
    }
});

// Tournaments API
app.get('/api/tournaments', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    let userId = null;
    if (token) {
        try { userId = jwt.verify(token, JWT_SECRET).id; } catch(e) {}
    }

    try {
        const result = await pool.query(`
            SELECT t.*, 
                   COUNT(p.id) as joined_count,
                   MAX(CASE WHEN p.user_id = $1 THEN 1 ELSE 0 END) as has_joined
            FROM tournaments t 
            LEFT JOIN participants p ON t.id = p.tournament_id 
            GROUP BY t.id 
            ORDER BY t.created_at DESC
        `, [userId]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch tournaments' });
    }
});

// Tournament Details API
app.get('/api/tournaments/:id/details', async (req, res) => {
    const { id } = req.params;
    try {
        const tResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [id]);
        const tournament = tResult.rows[0];
        if (!tournament) return res.status(404).json({ error: 'Tournament not found' });

        const pResult = await pool.query(`
            SELECT u.id, u.username, p.status, p.joined_at, p.placement
            FROM participants p
            JOIN users u ON p.user_id = u.id
            WHERE p.tournament_id = $1
            ORDER BY p.joined_at ASC
        `, [id]);
        res.json({ tournament, players: pResult.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch details' });
    }
});

app.delete('/api/tournaments/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM matches WHERE tournament_id = $1', [id]);
        await pool.query('DELETE FROM participants WHERE tournament_id = $1', [id]);
        const result = await pool.query('DELETE FROM tournaments WHERE id = $1', [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Tournament not found' });
        res.status(200).json({ message: 'Tournament securely wiped from system.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete tournament due to database conflict.' });
    }
});

app.post('/api/tournaments/:id/join', authenticateToken, async (req, res) => {
    const { id: tournamentId } = req.params;
    const userId = req.user.id;

    try {
        const tResult = await pool.query('SELECT * FROM tournaments WHERE id = $1', [tournamentId]);
        if (!tResult.rows[0]) return res.status(404).json({ error: 'Tournament not found' });

        await pool.query('INSERT INTO participants (user_id, tournament_id) VALUES ($1, $2)', [userId, tournamentId]);
        res.status(200).json({ message: 'Successfully joined the tournament!' });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(400).json({ error: 'You have already joined this tournament.' });
        }
        console.error(err);
        res.status(500).json({ error: 'Failed to join tournament' });
    }
});

app.post('/api/tournaments', authenticateToken, async (req, res) => {
    const { name, entry_fee, prize_pool, status } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO tournaments (name, entry_fee, prize_pool, status) VALUES ($1, $2, $3, $4) RETURNING id',
            [name, entry_fee, prize_pool, status || 'upcoming']
        );
        res.status(201).json({ message: 'Tournament created successfully!', id: result.rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create tournament' });
    }
});

// Admin Stats API
app.get('/api/admin/stats', authenticateToken, async (req, res) => {
    try {
        const [users, tourneys, poolRow] = await Promise.all([
            pool.query('SELECT COUNT(*) as count FROM users'),
            pool.query('SELECT COUNT(*) as count FROM tournaments'),
            pool.query(`SELECT SUM(prize_pool) as totalDistributed FROM tournaments WHERE status='completed'`)
        ]);
        res.json({
            totalPlayers: parseInt(users.rows[0].count),
            totalTournaments: parseInt(tourneys.rows[0].count),
            paidOut: poolRow.rows[0].totaldistributed || 0,
            pendingActions: 0
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Admin Players API
app.get('/api/admin/players', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.username, u.phone, u.created_at, COUNT(p.id) as tournaments_joined
            FROM users u
            LEFT JOIN participants p ON u.id = p.user_id
            WHERE u.role = 'player'
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch players' });
    }
});

app.delete('/api/admin/players/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM matches WHERE player1_id = $1 OR player2_id = $1', [id]);
        await pool.query('DELETE FROM participants WHERE user_id = $1', [id]);
        await pool.query('DELETE FROM payments WHERE user_id = $1', [id]);
        await pool.query('DELETE FROM match_verifications WHERE submitted_by = $1 OR opponent_id = $1', [id]);
        const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
        res.status(200).json({ message: 'User securely removed from the system.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete user.' });
    }
});

// Global Public Stats API
app.get('/api/stats', async (req, res) => {
    try {
        const [uRow, tRow, mRow, poolRow] = await Promise.all([
            pool.query('SELECT COUNT(*) as count FROM users'),
            pool.query('SELECT COUNT(*) as count FROM tournaments'),
            pool.query(`SELECT COUNT(*) as count FROM matches WHERE status='completed'`),
            pool.query(`SELECT SUM(prize_pool) as totalDistributed FROM tournaments WHERE status='completed'`)
        ]);
        res.json({
            activePlayers: parseInt(uRow.rows[0].count),
            tournaments: parseInt(tRow.rows[0].count),
            matchesPlayed: parseInt(mRow.rows[0].count),
            tzsDistributed: poolRow.rows[0].totaldistributed || 0
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Profile API
app.get('/api/users/profile', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    try {
        const uResult = await pool.query(
            'SELECT id, username, phone, role, created_at FROM users WHERE id = $1', [userId]
        );
        const user = uResult.rows[0];
        if (!user) return res.status(404).json({ error: 'User not found' });

        const tResult = await pool.query(`
            SELECT t.id, t.name, t.status, t.prize_pool, p.joined_at, p.status as participant_status
            FROM participants p
            JOIN tournaments t ON p.tournament_id = t.id
            WHERE p.user_id = $1
            ORDER BY p.joined_at DESC
        `, [userId]);

        res.json({ user, joined_tournaments: tResult.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

// Leaderboard API
app.get('/api/leaderboard', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.username, 
                   COUNT(p.id) as podiums,
                   SUM(CASE 
                       WHEN p.placement = 1 THEN 100 
                       WHEN p.placement = 2 THEN 50 
                       WHEN p.placement = 3 THEN 25 
                       ELSE 0 END) as points
            FROM users u
            JOIN participants p ON u.id = p.user_id
            WHERE p.placement IN (1, 2, 3)
            GROUP BY u.id
            ORDER BY points DESC, podiums DESC
            LIMIT 10
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// Records API
app.get('/api/leaderboard/records', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.username, 
                   MAX(CASE WHEN m.player1_id = u.id THEN m.score1 ELSE m.score2 END) as max_goals,
                   m.match_date
            FROM matches m
            JOIN users u ON u.id IN (m.player1_id, m.player2_id)
            WHERE m.status = 'completed' AND (m.score1 > 0 OR m.score2 > 0)
            GROUP BY u.username, m.match_date
            ORDER BY max_goals DESC
            LIMIT 5
        `);
        res.json({ topScorers: result.rows || [] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch records' });
    }
});

// Fallback to home.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`🚀 Bongo eLeague Server running on port ${PORT}`);
    console.log(`👉 Access the site at: http://localhost:${PORT}`);
    console.log(`=========================================`);
});
