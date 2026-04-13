const { Pool } = require('pg');

// Render injects DATABASE_URL automatically when you link a Postgres service
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize all tables on startup
(async () => {
    let client;
    try {
        client = await pool.connect();
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                phone TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'player',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS tournaments (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                status TEXT DEFAULT 'upcoming',
                entry_fee INTEGER DEFAULT 0,
                prize_pool INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS participants (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
                status TEXT DEFAULT 'registered',
                placement INTEGER DEFAULT 0,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, tournament_id)
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS matches (
                id SERIAL PRIMARY KEY,
                tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
                player1_id INTEGER NOT NULL REFERENCES users(id),
                player2_id INTEGER NOT NULL REFERENCES users(id),
                score1 INTEGER DEFAULT 0,
                score2 INTEGER DEFAULT 0,
                status TEXT DEFAULT 'scheduled',
                match_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS payments (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
                phone_number TEXT NOT NULL,
                amount INTEGER DEFAULT 0,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await client.query(`
            CREATE TABLE IF NOT EXISTS match_verifications (
                id SERIAL PRIMARY KEY,
                tournament_id INTEGER NOT NULL REFERENCES tournaments(id),
                submitted_by INTEGER NOT NULL REFERENCES users(id),
                opponent_id INTEGER NOT NULL REFERENCES users(id),
                my_score INTEGER NOT NULL,
                opponent_score INTEGER NOT NULL,
                screenshot_url TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('✅ PostgreSQL connected & all tables ready.');
    } catch (err) {
        console.error('❌ Database initialization error:', err.message);
    } finally {
        if (client) client.release();
    }
})();

module.exports = pool;
