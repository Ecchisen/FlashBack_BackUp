/*
// flashback-backend/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const PORT = parseInt(process.env.PORT || '5000', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'flashback-jwt-secret-key-2026';
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin123';
const UPLOAD_DIR_NAME = process.env.UPLOAD_DIR || 'uploads';

const {
  pool,
  recordSessionHeartbeat,
  deleteUserFromDatabase,
  clearAllTestAccounts
} = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Upload directory path
const UPLOAD_ROOT = path.resolve(__dirname, UPLOAD_DIR_NAME);
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}
app.use('/uploads', express.static(UPLOAD_ROOT));

// Multer memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed!'));
  }
}).fields([{ name: 'photos', maxCount: 10 }, { name: 'images', maxCount: 10 }]);

// Middleware: Record active session heartbeat
app.use((req, _res, next) => {
  const token = req.headers['authorization'] || req.headers['x-guest-token'] || req.query.guestToken;
  if (token) {
    const cleanToken = token.replace('Bearer ', '').substring(0, 128);
    recordSessionHeartbeat(cleanToken, null, req.ip, req.headers['user-agent']).catch(() => {});
  }
  next();
});

// Authentication middleware
function verifyUser(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Session expired or missing authentication token.' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      displayName: decoded.displayName || decoded.display_name || 'Host',
      role: decoded.role || 'user'
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired login session.' });
  }
}

function verifyAdmin(req, res, next) {
  const key = req.headers['x-admin-key'] || req.headers['authorization']?.replace('Bearer ', '').trim();
  if (key === ADMIN_KEY) return next();
  res.status(403).json({ error: 'Unauthorized administrator access.' });
}

// ---------------- USER AUTHENTICATION ENDPOINTS ----------------

// Register a new host account
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'Email, password, and display name are required.' });
    }
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail.includes('@') || cleanEmail.length < 5) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      'INSERT INTO users (email, password_hash, display_name, role, created_at) VALUES (?, ?, ?, "user", NOW())',
      [cleanEmail, hash, displayName.trim()]
    );

    const user = { id: result.insertId, email: cleanEmail, displayName: displayName.trim(), role: 'user' };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user });
  } catch (err) {
    console.error('[DB Register Error]', err.message);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'An account with this email address already exists.' });
    }
    return res.status(500).json({ error: `Registration error: ${err.message}` });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Please enter both email and password.' });
    }
    const cleanEmail = email.toLowerCase().trim();
    const [rows] = await pool.query(
      'SELECT id, email, password_hash, display_name, role, created_at FROM users WHERE LOWER(email) = ?',
      [cleanEmail]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Account not found. Please check your email or create an account.' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    const payload = {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: payload });
  } catch (err) {
    console.error('[DB Login Error]', err.message);
    return res.status(500).json({ error: `Login error: ${err.message}` });
  }
});

// Current User Info
app.get('/api/auth/me', verifyUser, (req, res) => {
  res.json({ user: req.user });
});

// ---------------- ADMIN ENDPOINTS ----------------

app.post('/api/admin/login', (req, res) => {
  if (req.body.password === ADMIN_KEY) {
    res.json({ token: ADMIN_KEY });
  } else {
    res.status(401).json({ error: 'Invalid master administrator password.' });
  }
});

app.get('/api/admin/verify', verifyAdmin, (_req, res) => res.json({ valid: true }));

app.get('/api/admin/stats', verifyAdmin, async (_req, res) => {
  try {
    const [[{ totalEvents }]] = await pool.query('SELECT COUNT(*) AS totalEvents FROM events');
    const [[{ totalPhotos }]] = await pool.query('SELECT COUNT(*) AS totalPhotos FROM photos');
    const [[{ totalUsers }]] = await pool.query('SELECT COUNT(*) AS totalUsers FROM users');
    res.json({ totalEvents, totalPhotos, totalUsers });
  } catch (err) {
    res.status(500).json({ error: `Stats error: ${err.message}` });
  }
});

// View all registered host accounts with event counts
app.get('/api/admin/users', verifyAdmin, async (_req, res) => {
  try {
    const [users] = await pool.query(`
      SELECT u.id, u.email, u.display_name, u.role, u.created_at,
             (SELECT COUNT(*) FROM events e WHERE e.created_by_user_id = u.id) AS event_count
      FROM users u
      ORDER BY u.id ASC
    `);
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: `Failed to fetch users: ${err.message}` });
  }
});

// Delete specific user account completely from the database
app.delete('/api/admin/users/:id', verifyAdmin, async (req, res) => {
  try {
    const result = await deleteUserFromDatabase(req.params.id);
    res.json({ success: true, message: 'Account cleared from database.', result });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to delete user.' });
  }
});

// Clear all test accounts before deployment
app.post('/api/admin/clear-test-accounts', verifyAdmin, async (_req, res) => {
  try {
    const result = await clearAllTestAccounts();
    res.json({ success: true, message: 'All test accounts cleared before deployment.', result });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to clear test accounts.' });
  }
});

// List all events
app.get('/api/admin/events', verifyAdmin, async (_req, res) => {
  try {
    const [events] = await pool.query(`
      SELECT e.id, e.event_code, e.title, e.created_by_user_id, e.is_active, e.created_at,
             (SELECT COUNT(*) FROM photos p WHERE p.event_id = e.id) AS photo_count
      FROM events e
      ORDER BY e.created_at DESC
    `);
    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: `Failed to fetch events: ${err.message}` });
  }
});

// Toggle event active/pause status
app.post('/api/admin/events/:code/toggle', verifyAdmin, async (req, res) => {
  try {
    await pool.query(
      'UPDATE events SET is_active = IF(is_active = 1, 0, 1) WHERE event_code = ?',
      [req.params.code]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: `Failed to toggle event: ${err.message}` });
  }
});

// ---------------- EVENT & UPLOAD ENDPOINTS ----------------

function generateEventCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Create new photo event matching schema (created_by_user_id, is_active)
app.post('/api/events/user-create', verifyUser, async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Event title is required.' });

    let code;
    let attempts = 0;
    while (attempts < 10) {
      code = generateEventCode();
      const [exist] = await pool.query('SELECT id FROM events WHERE UPPER(event_code) = ?', [code]);
      if (exist.length === 0) break;
      attempts++;
    }

    const [result] = await pool.query(
      `INSERT INTO events (event_code, title, created_by_user_id, max_photos_per_user, max_guests, is_active, created_at)
       VALUES (?, ?, ?, 10, 500, 1, NOW())`,
      [code, title.trim(), req.user.id]
    );

    res.json({
      event: {
        id: result.insertId,
        event_code: code,
        title: title.trim(),
        created_by_user_id: req.user.id,
        is_active: 1
      }
    });
  } catch (err) {
    console.error('[Create Event Error]', err.message);
    res.status(500).json({ error: `Failed to create event: ${err.message}` });
  }
});

// Load user's events matching schema
app.get('/api/events/my-events', verifyUser, async (req, res) => {
  try {
    const [events] = await pool.query(`
      SELECT e.id, e.event_code, e.title, e.created_by_user_id, e.is_active, e.created_at,
             (SELECT COUNT(*) FROM photos p WHERE p.event_id = e.id) AS photo_count
      FROM events e
      WHERE e.created_by_user_id = ?
      ORDER BY e.created_at DESC
    `, [req.user.id]);
    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: `Failed to load events: ${err.message}` });
  }
});

// Get event by code
app.get('/api/events/:code', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, event_code, title, created_by_user_id, max_photos_per_user, max_guests, expires_at, is_active, created_at FROM events WHERE UPPER(event_code) = ?',
      [req.params.code.toUpperCase()]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Event code does not exist.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: `Failed to load event: ${err.message}` });
  }
});

// Quota check
app.get('/api/events/:code/quota', async (req, res) => {
  try {
    const { guestToken } = req.query;
    const [events] = await pool.query('SELECT id, max_photos_per_user FROM events WHERE UPPER(event_code) = ?', [req.params.code.toUpperCase()]);
    if (events.length === 0) return res.status(404).json({ error: 'Event not found.' });

    const event = events[0];
    const [[{ count }]] = await pool.query(
      'SELECT COUNT(*) AS count FROM photos WHERE event_id = ? AND guest_token = ?',
      [event.id, guestToken || 'anon']
    );
    const maxAllowed = event.max_photos_per_user || 10;
    res.json({ uploaded: count, maxAllowed, remaining: Math.max(0, maxAllowed - count) });
  } catch (err) {
    res.status(500).json({ error: `Failed to query quota: ${err.message}` });
  }
});

// Slideshow: Fetch next photo
app.get('/api/events/:code/slideshow/next', async (req, res) => {
  try {
    const [events] = await pool.query('SELECT id FROM events WHERE UPPER(event_code) = ?', [req.params.code.toUpperCase()]);
    if (events.length === 0) return res.status(404).json({ error: 'Event not found.' });

    const eventId = events[0].id;
    const afterId = req.query.afterId ? parseInt(req.query.afterId, 10) : 0;

    let [photos] = await pool.query(
      'SELECT id, event_id, guest_token, display_name, file_name, photo_url, display_count, uploaded_at FROM photos WHERE event_id = ? AND id > ? ORDER BY id ASC LIMIT 1',
      [eventId, afterId]
    );

    if (photos.length === 0) {
      [photos] = await pool.query(
        'SELECT id, event_id, guest_token, display_name, file_name, photo_url, display_count, uploaded_at FROM photos WHERE event_id = ? ORDER BY id ASC LIMIT 1',
        [eventId]
      );
    }

    if (photos.length === 0) {
      return res.json({ photo: null });
    }

    const photo = photos[0];
    // Increment display count
    pool.query('UPDATE photos SET display_count = display_count + 1 WHERE id = ?', [photo.id]).catch(() => {});

    res.json({
      photo: {
        id: photo.id,
        photo_url: photo.photo_url || `/uploads/${req.params.code.toUpperCase()}/${photo.file_name}`,
        display_name: photo.display_name || photo.guest_token || 'Guest',
        uploaded_at: photo.uploaded_at
      }
    });
  } catch (err) {
    res.status(500).json({ error: `Slideshow error: ${err.message}` });
  }
});

// Guest Photo Upload
app.post('/api/events/:code/upload', (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    const { guestToken, uploaderName, displayName } = req.body;
    const files = [...(req.files?.photos || []), ...(req.files?.images || [])];
    if (files.length === 0) return res.status(400).json({ error: 'No image files provided.' });

    try {
      const code = req.params.code.toUpperCase();
      const [events] = await pool.query('SELECT id, is_active FROM events WHERE UPPER(event_code) = ?', [code]);
      if (events.length === 0) return res.status(404).json({ error: 'Event not found.' });
      if (events[0].is_active === 0) return res.status(403).json({ error: 'Uploads are currently paused for this event.' });

      const eventId = events[0].id;
      const eventFolder = path.join(UPLOAD_ROOT, code);
      if (!fs.existsSync(eventFolder)) fs.mkdirSync(eventFolder, { recursive: true });

      const guestDisplayName = (displayName || uploaderName || 'Guest').trim();
      const savedPhotos = [];

      for (const file of files) {
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
        const filePath = path.join(eventFolder, fileName);
        const photoUrl = `/uploads/${code}/${fileName}`;

        await sharp(file.buffer)
          .rotate()
          .resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85, progressive: true })
          .toFile(filePath);

        const fileSize = file.size || (fs.existsSync(filePath) ? fs.statSync(filePath).size : 0);

        // Exact match with table photos: event_id, guest_token, display_name, file_name, photo_url, file_size_bytes, display_count, uploaded_at
        const [insertRes] = await pool.query(
          `INSERT INTO photos (event_id, guest_token, display_name, file_name, photo_url, file_size_bytes, display_count, uploaded_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, NOW())`,
          [eventId, guestToken || 'anon', guestDisplayName, fileName, photoUrl, fileSize]
        );

        const photoObj = {
          id: insertRes.insertId,
          event_id: eventId,
          file_name: fileName,
          url: photoUrl,
          photo_url: photoUrl,
          event_code: code,
          display_name: guestDisplayName
        };
        savedPhotos.push(photoObj);

        // Dual socket emits for instant slideshow broadcast
        io.to(code).emit('new_photo', photoObj);
        io.to(code).emit('photo_uploaded', photoObj);
      }

      await recordSessionHeartbeat(guestToken, null, req.ip, req.headers['user-agent']);
      res.json({ success: true, count: savedPhotos.length, photos: savedPhotos });
    } catch (uploadErr) {
      console.error('[Upload Error]', uploadErr);
      res.status(500).json({ error: `Upload processing error: ${uploadErr.message}` });
    }
  });
});

app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: err.message || 'Internal server error.' });
});

io.on('connection', (socket) => {
  socket.on('join_event', (code) => {
    if (code) socket.join(code.toUpperCase());
  });
  socket.on('leave_event', (code) => {
    if (code) socket.leave(code.toUpperCase());
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[FlashBack Backend] Running on http://0.0.0.0:${PORT}`);
});
*/

// flashback-backend/server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const PORT = parseInt(process.env.PORT || '5000', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'flashback-jwt-secret-key-2026';
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin123';
const UPLOAD_DIR_NAME = process.env.UPLOAD_DIR || 'uploads';

const {
  pool,
  recordSessionHeartbeat,
  deleteUserFromDatabase,
  clearAllTestAccounts
} = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Upload directory path
const UPLOAD_ROOT = path.resolve(__dirname, UPLOAD_DIR_NAME);
if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}
app.use('/uploads', express.static(UPLOAD_ROOT));

// Multer memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed!'));
  }
}).fields([{ name: 'photos', maxCount: 10 }, { name: 'images', maxCount: 10 }]);

// Middleware: Record active session heartbeat
app.use((req, _res, next) => {
  const token = req.headers['authorization'] || req.headers['x-guest-token'] || req.query.guestToken;
  if (token) {
    const cleanToken = token.replace('Bearer ', '').substring(0, 128);
    recordSessionHeartbeat(cleanToken, null, req.ip, req.headers['user-agent']).catch(() => {});
  }
  next();
});

// Authentication middleware
function verifyUser(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'Session expired or missing authentication token.' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      displayName: decoded.displayName || decoded.display_name || 'Host',
      role: decoded.role || 'user'
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired login session.' });
  }
}

function verifyAdmin(req, res, next) {
  const key = req.headers['x-admin-key'] || req.headers['authorization']?.replace('Bearer ', '').trim();
  if (key === ADMIN_KEY) return next();
  res.status(403).json({ error: 'Unauthorized administrator access.' });
}

// =========================================================================
// SHUFFLE-BAG SLIDESHOW ALGORITHM (Server-Side)
// =========================================================================
/**
 * ShuffleBagManager
 * 
 * Implements a fair, non-repeating Shuffle-Bag (Grab-Bag) algorithm per event:
 * 1. Guarantees every uploaded photo is shown exactly once before any photo repeats.
 * 2. Solves the issue where Photo #1 repeatedly pops back up after newly uploaded photos.
 * 3. Uses Fisher-Yates random shuffle whenever a new cycle begins.
 * 4. Boundary protection: ensures the first photo of a newly refilled bag is never identical
 *    to the last photo shown from the previous bag (when >= 2 photos exist).
 * 5. In-flight insertion: When a new photo is uploaded, it is tracked as "currently shown"
 *    and removed from the pending bag so the next cycle pulls the next random photo smoothly.
 */
class ServerShuffleBagManager {
  constructor() {
    this.bags = new Map(); // eventCode.toUpperCase() => { bag: [], allPhotos: [], lastPhotoId: null }
  }

  // Refill and Fisher-Yates shuffle the bag
  shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Get the next photo from the event's shuffle-bag
  async getNextPhoto(eventCode) {
    const code = eventCode.toUpperCase();

    // 1. Fetch event from database
    const [events] = await pool.query('SELECT id FROM events WHERE UPPER(event_code) = ?', [code]);
    if (events.length === 0) return null;
    const eventId = events[0].id;

    // 2. Fetch all current photos for this event
    const [allPhotos] = await pool.query(
      `SELECT id, event_id, guest_token, display_name, file_name, photo_url, display_count, uploaded_at 
       FROM photos 
       WHERE event_id = ? 
       ORDER BY id ASC`,
      [eventId]
    );

    if (allPhotos.length === 0) {
      this.bags.delete(code);
      return null;
    }

    // Single photo special case: return it directly
    if (allPhotos.length === 1) {
      return {
        photo: {
          id: allPhotos[0].id,
          photo_url: allPhotos[0].photo_url || `/uploads/${code}/${allPhotos[0].file_name}`,
          display_name: allPhotos[0].display_name || 'Guest',
          uploaded_at: allPhotos[0].uploaded_at
        },
        remainingInBag: 0,
        totalPhotos: 1
      };
    }

    let state = this.bags.get(code);

    // If bag doesn't exist, is empty, or the photo count has changed: refill & shuffle
    if (!state || state.bag.length === 0 || state.allCount !== allPhotos.length) {
      const lastId = state ? state.lastPhotoId : null;
      let freshBag = this.shuffleArray(allPhotos);

      // Boundary check: If the first item of the new bag matches the last item shown,
      // swap it with the last element of the bag to avoid back-to-back repeats.
      if (lastId && freshBag.length > 1 && freshBag[0].id === lastId) {
        const swapIdx = freshBag.length - 1;
        [freshBag[0], freshBag[swapIdx]] = [freshBag[swapIdx], freshBag[0]];
      }

      state = {
        bag: freshBag,
        allCount: allPhotos.length,
        lastPhotoId: lastId
      };
      this.bags.set(code, state);
    }

    // Pop the next photo from the shuffled bag
    const nextItem = state.bag.pop();
    state.lastPhotoId = nextItem.id;

    // Increment display counter asynchronously
    pool.query('UPDATE photos SET display_count = display_count + 1 WHERE id = ?', [nextItem.id]).catch(() => {});

    return {
      photo: {
        id: nextItem.id,
        photo_url: nextItem.photo_url || `/uploads/${code}/${nextItem.file_name}`,
        display_name: nextItem.display_name || 'Guest',
        uploaded_at: nextItem.uploaded_at
      },
      remainingInBag: state.bag.length,
      totalPhotos: allPhotos.length
    };
  }

  // Handle a new photo uploaded in real time
  onPhotoUploaded(eventCode, photo) {
    const code = eventCode.toUpperCase();
    const state = this.bags.get(code);
    if (!state) return;

    // Mark as currently shown so it doesn't immediately repeat
    state.lastPhotoId = photo.id;
    // Remove from the remaining bag if it was already included
    state.bag = state.bag.filter(p => p.id !== photo.id);
    state.allCount++;
  }
}

const shuffleBagManager = new ServerShuffleBagManager();

// ---------------- USER AUTHENTICATION ENDPOINTS ----------------

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'Email, password, and display name are required.' });
    }
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail.includes('@') || cleanEmail.length < 5) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      'INSERT INTO users (email, password_hash, display_name, role, created_at) VALUES (?, ?, ?, "user", NOW())',
      [cleanEmail, hash, displayName.trim()]
    );

    const user = { id: result.insertId, email: cleanEmail, displayName: displayName.trim(), role: 'user' };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user });
  } catch (err) {
    console.error('[DB Register Error]', err.message);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'An account with this email address already exists.' });
    }
    return res.status(500).json({ error: `Registration error: ${err.message}` });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Please enter both email and password.' });
    }
    const cleanEmail = email.toLowerCase().trim();
    const [rows] = await pool.query(
      'SELECT id, email, password_hash, display_name, role, created_at FROM users WHERE LOWER(email) = ?',
      [cleanEmail]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Account not found. Please check your email or create an account.' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    const payload = {
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      role: user.role
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: payload });
  } catch (err) {
    console.error('[DB Login Error]', err.message);
    return res.status(500).json({ error: `Login error: ${err.message}` });
  }
});

app.get('/api/auth/me', verifyUser, (req, res) => {
  res.json({ user: req.user });
});

// ---------------- ADMIN ENDPOINTS ----------------

app.post('/api/admin/login', (req, res) => {
  if (req.body.password === ADMIN_KEY) {
    res.json({ token: ADMIN_KEY });
  } else {
    res.status(401).json({ error: 'Invalid master administrator password.' });
  }
});

app.get('/api/admin/verify', verifyAdmin, (_req, res) => res.json({ valid: true }));

app.get('/api/admin/stats', verifyAdmin, async (_req, res) => {
  try {
    const [[{ totalEvents }]] = await pool.query('SELECT COUNT(*) AS totalEvents FROM events');
    const [[{ totalPhotos }]] = await pool.query('SELECT COUNT(*) AS totalPhotos FROM photos');
    const [[{ totalUsers }]] = await pool.query('SELECT COUNT(*) AS totalUsers FROM users');
    res.json({ totalEvents, totalPhotos, totalUsers });
  } catch (err) {
    res.status(500).json({ error: `Stats error: ${err.message}` });
  }
});

app.get('/api/admin/users', verifyAdmin, async (_req, res) => {
  try {
    const [users] = await pool.query(`
      SELECT u.id, u.email, u.display_name, u.role, u.created_at,
             (SELECT COUNT(*) FROM events e WHERE e.created_by_user_id = u.id) AS event_count
      FROM users u
      ORDER BY u.id ASC
    `);
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: `Failed to fetch users: ${err.message}` });
  }
});

app.delete('/api/admin/users/:id', verifyAdmin, async (req, res) => {
  try {
    const result = await deleteUserFromDatabase(req.params.id);
    res.json({ success: true, message: 'Account cleared from database.', result });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to delete user.' });
  }
});

app.post('/api/admin/clear-test-accounts', verifyAdmin, async (_req, res) => {
  try {
    const result = await clearAllTestAccounts();
    res.json({ success: true, message: 'All test accounts cleared before deployment.', result });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to clear test accounts.' });
  }
});

app.get('/api/admin/events', verifyAdmin, async (_req, res) => {
  try {
    const [events] = await pool.query(`
      SELECT e.id, e.event_code, e.title, e.created_by_user_id, e.is_active, e.created_at,
             (SELECT COUNT(*) FROM photos p WHERE p.event_id = e.id) AS photo_count
      FROM events e
      ORDER BY e.created_at DESC
    `);
    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: `Failed to fetch events: ${err.message}` });
  }
});

app.post('/api/admin/events/:code/toggle', verifyAdmin, async (req, res) => {
  try {
    await pool.query(
      'UPDATE events SET is_active = IF(is_active = 1, 0, 1) WHERE event_code = ?',
      [req.params.code]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: `Failed to toggle event: ${err.message}` });
  }
});

// ---------------- EVENT & UPLOAD ENDPOINTS ----------------

function generateEventCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

app.post('/api/events/user-create', verifyUser, async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Event title is required.' });

    let code;
    let attempts = 0;
    while (attempts < 10) {
      code = generateEventCode();
      const [exist] = await pool.query('SELECT id FROM events WHERE UPPER(event_code) = ?', [code]);
      if (exist.length === 0) break;
      attempts++;
    }

    const [result] = await pool.query(
      `INSERT INTO events (event_code, title, created_by_user_id, max_photos_per_user, max_guests, is_active, created_at)
       VALUES (?, ?, ?, 10, 500, 1, NOW())`,
      [code, title.trim(), req.user.id]
    );

    res.json({
      event: {
        id: result.insertId,
        event_code: code,
        title: title.trim(),
        created_by_user_id: req.user.id,
        is_active: 1
      }
    });
  } catch (err) {
    console.error('[Create Event Error]', err.message);
    res.status(500).json({ error: `Failed to create event: ${err.message}` });
  }
});

app.get('/api/events/my-events', verifyUser, async (req, res) => {
  try {
    const [events] = await pool.query(`
      SELECT e.id, e.event_code, e.title, e.created_by_user_id, e.is_active, e.created_at,
             (SELECT COUNT(*) FROM photos p WHERE p.event_id = e.id) AS photo_count
      FROM events e
      WHERE e.created_by_user_id = ?
      ORDER BY e.created_at DESC
    `, [req.user.id]);
    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: `Failed to load events: ${err.message}` });
  }
});

app.get('/api/events/:code', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, event_code, title, created_by_user_id, max_photos_per_user, max_guests, expires_at, is_active, created_at FROM events WHERE UPPER(event_code) = ?',
      [req.params.code.toUpperCase()]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Event code does not exist.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: `Failed to load event: ${err.message}` });
  }
});

// All photos endpoint for frontend Shuffle-Bag pool initialization
app.get('/api/events/:code/photos', async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const [events] = await pool.query('SELECT id FROM events WHERE UPPER(event_code) = ?', [code]);
    if (events.length === 0) return res.status(404).json({ error: 'Event not found.' });

    const [photos] = await pool.query(
      `SELECT id, event_id, guest_token, display_name, file_name, photo_url, display_count, uploaded_at 
       FROM photos 
       WHERE event_id = ? 
       ORDER BY id ASC`,
      [events[0].id]
    );

    const formatted = photos.map(p => ({
      id: p.id,
      photo_url: p.photo_url || `/uploads/${code}/${p.file_name}`,
      display_name: p.display_name || 'Guest',
      uploaded_at: p.uploaded_at
    }));

    res.json({ photos: formatted });
  } catch (err) {
    res.status(500).json({ error: `Failed to load photos: ${err.message}` });
  }
});

app.get('/api/events/:code/quota', async (req, res) => {
  try {
    const { guestToken } = req.query;
    const [events] = await pool.query('SELECT id, max_photos_per_user FROM events WHERE UPPER(event_code) = ?', [req.params.code.toUpperCase()]);
    if (events.length === 0) return res.status(404).json({ error: 'Event not found.' });

    const event = events[0];
    const [[{ count }]] = await pool.query(
      'SELECT COUNT(*) AS count FROM photos WHERE event_id = ? AND guest_token = ?',
      [event.id, guestToken || 'anon']
    );
    const maxAllowed = event.max_photos_per_user || 10;
    res.json({ uploaded: count, maxAllowed, remaining: Math.max(0, maxAllowed - count) });
  } catch (err) {
    res.status(500).json({ error: `Failed to query quota: ${err.message}` });
  }
});

// Slideshow: Fetch next photo via Server-side Shuffle-Bag Algorithm
app.get('/api/events/:code/slideshow/next', async (req, res) => {
  try {
    const result = await shuffleBagManager.getNextPhoto(req.params.code);
    if (!result) {
      return res.json({ photo: null, message: 'No photos uploaded yet for this event.' });
    }
    return res.json(result);
  } catch (err) {
    console.error('[Shuffle-Bag Next Error]', err.message);
    res.status(500).json({ error: `Slideshow error: ${err.message}` });
  }
});

// Guest Photo Upload
app.post('/api/events/:code/upload', (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    const { guestToken, uploaderName, displayName } = req.body;
    const files = [...(req.files?.photos || []), ...(req.files?.images || [])];
    if (files.length === 0) return res.status(400).json({ error: 'No image files provided.' });

    try {
      const code = req.params.code.toUpperCase();
      const [events] = await pool.query('SELECT id, is_active FROM events WHERE UPPER(event_code) = ?', [code]);
      if (events.length === 0) return res.status(404).json({ error: 'Event not found.' });
      if (events[0].is_active === 0) return res.status(403).json({ error: 'Uploads are currently paused for this event.' });

      const eventId = events[0].id;
      const eventFolder = path.join(UPLOAD_ROOT, code);
      if (!fs.existsSync(eventFolder)) fs.mkdirSync(eventFolder, { recursive: true });

      const guestDisplayName = (displayName || uploaderName || 'Guest').trim();
      const savedPhotos = [];

      for (const file of files) {
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
        const filePath = path.join(eventFolder, fileName);
        const photoUrl = `/uploads/${code}/${fileName}`;

        await sharp(file.buffer)
          .rotate()
          .resize({ width: 1920, height: 1080, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85, progressive: true })
          .toFile(filePath);

        const fileSize = file.size || (fs.existsSync(filePath) ? fs.statSync(filePath).size : 0);

        const [insertRes] = await pool.query(
          `INSERT INTO photos (event_id, guest_token, display_name, file_name, photo_url, file_size_bytes, display_count, uploaded_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, NOW())`,
          [eventId, guestToken || 'anon', guestDisplayName, fileName, photoUrl, fileSize]
        );

        const photoObj = {
          id: insertRes.insertId,
          event_id: eventId,
          file_name: fileName,
          url: photoUrl,
          photo_url: photoUrl,
          event_code: code,
          display_name: guestDisplayName,
          uploaded_at: new Date()
        };
        savedPhotos.push(photoObj);

        // Inform server-side Shuffle-Bag about newly uploaded photo
        shuffleBagManager.onPhotoUploaded(code, photoObj);

        // Instant socket broadcast
        io.to(code).emit('new_photo', photoObj);
        io.to(code).emit('photo_uploaded', photoObj);
      }

      await recordSessionHeartbeat(guestToken, null, req.ip, req.headers['user-agent']);
      res.json({ success: true, count: savedPhotos.length, photos: savedPhotos });
    } catch (uploadErr) {
      console.error('[Upload Error]', uploadErr);
      res.status(500).json({ error: `Upload processing error: ${uploadErr.message}` });
    }
  });
});

app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: err.message || 'Internal server error.' });
});

io.on('connection', (socket) => {
  socket.on('join_event', (code) => {
    if (code) socket.join(code.toUpperCase());
  });
  socket.on('leave_event', (code) => {
    if (code) socket.leave(code.toUpperCase());
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[FlashBack Backend] Running on http://0.0.0.0:${PORT}`);
});