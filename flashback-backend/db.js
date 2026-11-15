// flashback-backend/db.js
const mysql = require('mysql2/promise');
require('dotenv').config();

// Direct connection pool initialized strictly from your .env file
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

// Test connection on startup
pool.getConnection()
  .then((conn) => {
    console.log(`[DB] Connected to database: ${process.env.DB_NAME} on ${process.env.DB_HOST}`);
    conn.release();
  })
  .catch((err) => {
    console.error('[DB ERROR] Database connection error:', err.message);
  });

// Record guest / user session heartbeat in table: active_sessions
const recordSessionHeartbeat = async (token, userId, ipAddress, userAgent) => {
  try {
    await pool.query(
      `INSERT INTO active_sessions (token, user_id, ip_address, user_agent, last_seen)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE last_seen = NOW(), ip_address = VALUES(ip_address), user_agent = VALUES(user_agent)`,
      [token, userId || null, ipAddress || '0.0.0.0', (userAgent || '').substring(0, 500)]
    );
  } catch (err) {
    console.warn('[DB Heartbeat]', err.message);
  }
};

// Permanently delete a user account and cascade clean related events and photos
const deleteUserFromDatabase = async (userId) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Get all events created by this user
    const [events] = await conn.query(
      'SELECT id FROM events WHERE created_by_user_id = ?',
      [userId]
    );

    // 2. Delete photos belonging to those events
    if (events.length > 0) {
      const eventIds = events.map(e => e.id);
      await conn.query(
        `DELETE FROM photos WHERE event_id IN (${eventIds.map(() => '?').join(',')})`,
        eventIds
      );
    }

    // 3. Delete events created by this user
    await conn.query(
      'DELETE FROM events WHERE created_by_user_id = ?',
      [userId]
    );

    // 4. Delete active sessions for this user
    await conn.query(
      'DELETE FROM active_sessions WHERE user_id = ?',
      [userId]
    );

    // 5. Delete user from users table
    const [result] = await conn.query(
      'DELETE FROM users WHERE id = ?',
      [userId]
    );

    await conn.commit();
    return { success: true, affectedRows: result.affectedRows };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// Clear all test accounts (non-admin users) before production deployment
const clearAllTestAccounts = async () => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [testUsers] = await conn.query(
      "SELECT id FROM users WHERE role != 'admin'"
    );

    for (const u of testUsers) {
      const [events] = await conn.query(
        'SELECT id FROM events WHERE created_by_user_id = ?',
        [u.id]
      );

      if (events.length > 0) {
        const eventIds = events.map(e => e.id);
        await conn.query(
          `DELETE FROM photos WHERE event_id IN (${eventIds.map(() => '?').join(',')})`,
          eventIds
        );
      }

      await conn.query('DELETE FROM events WHERE created_by_user_id = ?', [u.id]);
      await conn.query('DELETE FROM active_sessions WHERE user_id = ?', [u.id]);
      await conn.query('DELETE FROM users WHERE id = ?', [u.id]);
    }

    await conn.commit();
    return { success: true, count: testUsers.length };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

module.exports = {
  pool,
  recordSessionHeartbeat,
  deleteUserFromDatabase,
  clearAllTestAccounts
};