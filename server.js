// ... rest of your server code ...

// ✅ CORRECT: require from root since db.js is at root level
const { pool, dbReady } = require('./db');

// Wait for DB before starting server
dbReady.then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Bongo eLeague Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('💥 Failed to start server:', err);
  process.exit(1);
});
