const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const db = require('./db');

// --- STARTUP SECURITY CHECK ---
if (!process.env.ADMIN_KEY) {
  console.error('FATAL ERROR: ADMIN_PASSWORD environment variable is not defined!');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Base upload directory from .env
const UPLOAD_BASE = process.env.UPLOAD_DIR || './uploads';

// --- MULTER STORAGE CONFIGURATION ---
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const { eventCode } = req.body;
    if (!eventCode) {
      return cb(new Error('Event code is required'), null);
    }

    const eventFolder = path.join(UPLOAD_BASE, 'events', eventCode);

    try {
      if (!fs.existsSync(eventFolder)) {
        fs.mkdirSync(eventFolder, { recursive: true });
      }
      cb(null, eventFolder);
    } catch (err) {
      cb(err, null);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `photo-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 50 * 1024 * 1024,
    fieldSize: 50 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('YO! Only image files are allowed!'), false);
    }
  }
});

// --- API ROUTES ---

// 1. Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'All Good!' });
});

// 2. Admin Login Verification
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;

  if (password === process.env.ADMIN_KEY) {
    return res.json({ success: true, token: 'authenticated' });
  }

  return res.status(401).json({ error: 'Invalid password' });
});

// 3. Create a new event (Admin)
app.post('/api/events/create', async (req, res) => {
  const { eventCode, title, maxPhotos } = req.body;

  if (!eventCode || !title) {
    return res.status(400).json({ error: 'Event code and title are required.' });
  }

  try {
    const limit = maxPhotos || 25;
    const [result] = await db.query(
      'INSERT INTO events (event_code, title, max_photos_per_user) VALUES (?, ?, ?)',
      [eventCode, title, limit]
    );

    res.status(201).json({
      message: 'Event created successfully!',
      eventId: result.insertId,
      eventCode
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'An event with this code already exists.' });
    }
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to create event.' });
  }
});

// 4. Get event info by code
app.get('/api/events/:code', async (req, res) => {
  const { code } = req.params;

  try {
    const [rows] = await db.query(
      'SELECT id, event_code, title, max_photos_per_user, is_active FROM events WHERE event_code = ?',
      [code]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to fetch event details.' });
  }
});

// 5. Upload photo route (Guest)
app.post('/api/photos/upload', async (req, res) => {
  upload.array('photos', 10)(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image files uploaded.' });
    }

    const { eventCode, guestToken } = req.body;

    if (!eventCode || !guestToken) {
      req.files.forEach(file => fs.existsSync(file.path) && fs.unlinkSync(file.path));
      return res.status(400).json({ error: 'Missing eventCode or guestToken.' });
    }

    try {
      const [events] = await db.query(
        'SELECT id, max_photos_per_user, is_active FROM events WHERE event_code = ?',
        [eventCode]
      );

      if (events.length === 0 || !events[0].is_active) {
        req.files.forEach(file => fs.existsSync(file.path) && fs.unlinkSync(file.path));
        return res.status(400).json({ error: 'Event is inactive or does not exist.' });
      }

      const event = events[0];

      const [userPhotos] = await db.query(
        'SELECT COUNT(*) as count FROM photos WHERE event_id = ? AND guest_token = ?',
        [event.id, guestToken]
      );

      const uploadedCount = userPhotos[0].count;
      const remainingQuota = event.max_photos_per_user - uploadedCount;

      if (req.files.length > remainingQuota) {
        req.files.forEach(file => fs.existsSync(file.path) && fs.unlinkSync(file.path));
        return res.status(403).json({
          error: `Quota exceeded! You can only upload ${remainingQuota} more photo(s).`
        });
      }

      for (const file of req.files) {
        await db.query(
          'INSERT INTO photos (event_id, guest_token, file_name, original_name, file_size_bytes) VALUES (?, ?, ?, ?, ?)',
          [event.id, guestToken, file.filename, file.originalname, file.size]
        );
      }

      res.status(200).json({
        message: 'Photos uploaded successfully!',
        remainingUploads: remainingQuota - req.files.length
      });

    } catch (error) {
      if (req.files) {
        req.files.forEach(file => fs.existsSync(file.path) && fs.unlinkSync(file.path));
      }
      console.error('Upload Error:', error);
      res.status(500).json({ error: 'Failed to save upload.' });
    }
  });
});

// 6. Get all events for Admin view
app.get('/api/admin/events', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM events ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to fetch events list.' });
  }
});

// 7. Toggle event active state
app.patch('/api/admin/events/:id/toggle', async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;
  try {
    await db.query('UPDATE events SET is_active = ? WHERE id = ?', [is_active, id]);
    res.json({ message: 'Event status updated successfully.' });
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to update event status.' });
  }
});

// 8. Delete event
app.delete('/api/admin/events/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM photos WHERE event_id = ?', [id]);
    const [result] = await db.query('DELETE FROM events WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ success: true, message: 'Event deleted successfully' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// --- START SERVER ---
const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FlashBack Server running on http://0.0.0.0:${PORT}`);
});