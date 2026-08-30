const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'mariadb-server',
  user: process.env.DB_USER || 'flashback_user',
  password: process.env.DB_PASS || 'FlashBackPass123!',
  database: process.env.DB_NAME || 'flashback_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test connection on startup without crashing the process
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Connected to MariaDB successfully!');
    connection.release();
  } catch (err) {
    console.error('Database connection failed:', err.message);
  }
})();

module.exports = pool;