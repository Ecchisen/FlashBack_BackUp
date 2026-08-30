const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test connection on startup without crashing the process
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Connected to MariaDB!');
    connection.release();
  } catch (err) {
    console.error('Database connection failed:', err.message);
  }
})();

module.exports = pool;