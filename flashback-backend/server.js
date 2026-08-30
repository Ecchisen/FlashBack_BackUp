const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Base upload directory from .env
const UPLOAD_BASE = process.env.UPLOAD_DIR || './uploads';

// --- MULTER STORAGE CONFIGURATION ---
// Configures Multer to store uploaded files into event-specific folders
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const { eventCode } = req.body;
    if (!eventCode) {
      return cb(new Error('Event code is required'), null);
    }

    // Target folder
    const eventFolder = path.join(UPLOAD_BASE, 'events', eventCode);

    try {
      // Create folder on disk if it doesn't exist yet
      if (!fs.existsSync(eventFolder)) {
        fs.mkdirSync(eventFolder, { recursive: true });
      }
      cb(null, eventFolder);
    } catch (err) {
      cb(err, null);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-random.ext (e.g., 1724330000000-83921.jpg)
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `photo-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max file size per image
  fileFilter: (req, file, cb) => {
    // Only accept image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});


// --- API ROUTES ---

// 1. Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'FlashBack Backend is running' });
});


// 2. Create a new event (Admin)
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


// 3. Get event info by code (Used when guest scans QR code)
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


// 4. Upload photo route (Guest)
app.post('/api/photos/upload', async (req, res) => {
  // Accepts up to 10 photos using the field name 'photos'
  upload.array('photos', 10)(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image files uploaded.' });
    }

    const { eventCode, guestToken } = req.body;

    if (!eventCode || !guestToken) {
      // Clean up uploaded files if metadata is missing
      req.files.forEach(file => fs.existsSync(file.path) && fs.unlinkSync(file.path));
      return res.status(400).json({ error: 'Missing eventCode or guestToken.' });
    }

    try {
      // Step A: Find the event
      const [events] = await db.query(
        'SELECT id, max_photos_per_user, is_active FROM events WHERE event_code = ?',
        [eventCode]
      );

      if (events.length === 0 || !events[0].is_active) {
        req.files.forEach(file => fs.existsSync(file.path) && fs.unlinkSync(file.path));
        return res.status(400).json({ error: 'Event is inactive or does not exist.' });
      }

      const event = events[0];

      // Step B: Check guest upload count
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

      // Step C: Save photo metadata into MariaDB for each file
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
// --- START SERVER ---
const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`FlashBack Server running on http://0.0.0.0:${PORT}`);
});

// Get all events for Admin view
app.get('/api/admin/events', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM events ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('Database Error:', error);
    res.status(500).json({ error: 'Failed to fetch events list.' });
  }
});

// Toggle event active state
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

// DELETE /api/admin/events/:id
app.delete('/api/admin/events/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // 1. Delete associated photos from DB first (avoids FK constraint errors)
    await db.query('DELETE FROM photos WHERE event_id = ?', [id]);

    // 2. Delete the event using primary key 'id'
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