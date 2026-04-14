const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
// ✅ FIX 1: Destructure pool + correct path (both files at root)
const { pool } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_bongo_key_change_me_later';

// POST /api/auth/register
router.post('/register', async (req, res) => {
    const { username, phone, password } = req.body;
    if (!username || !phone || !password) {
        return res.status(400).json({ error: 'Please provide all required fields.' });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (username, phone, password_hash) VALUES ($1, $2, $3) RETURNING id',
            [username, phone, hashedPassword]
        );
        const newUser = result.rows[0];
        const token = jwt.sign({ id: newUser.id, username, role: 'player' }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ message: 'Account created successfully!', token, user: { id: newUser.id, username, role: 'player' } });
    } catch (err) {
        console.error(err);
        if (err.code === '23505') {
            return res.status(400).json({ error: 'Username or phone number already in use.' });
        }
        res.status(500).json({ error: 'Failed to register user.' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Please provide username and password.' });
    }
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (!user) {
            return res.status(400).json({ error: 'Invalid username or password.' });
        }
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(400).json({ error: 'Invalid username or password.' });
        }
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ message: 'Login successful!', token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during login.' });
    }
});

// ✅ FIX 2: Export authenticate middleware for protected routes
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.id;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

// ✅ Export BOTH router AND middleware
module.exports = router;
module.exports.authenticate = authenticate;
