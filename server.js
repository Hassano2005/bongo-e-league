// 1. IMPORTS
const express = require('express');
const cors = require('cors');
const { pool, dbReady } = require('./db'); // ✅ Correct path

// 2. INIT EXPRESS APP
const app = express(); // ✅ This line MUST exist!
app.use(cors());
app.use(express.json());

// 3. YOUR ROUTES
app.get('/', (req, res) => res.send('🎮 Bongo eLeague API'));
app.use('/api/users', require('./routes/users')); // example
// ... other routes ...

// 4. WAIT FOR DB, THEN START SERVER
dbReady.then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Bongo eLeague Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('💥 Failed to start server:', err);
  process.exit(1);
});
