const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// ===== DATABASE =====
const db = new Database('viraldhamka.db');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    lulu_url TEXT NOT NULL,
    embed_url TEXT NOT NULL,
    description TEXT DEFAULT '',
    views INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`);

// Default admin password
try {
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_pass', '123456')").run();
} catch(e) {}

// ===== API ROUTES =====

// Get all videos (Public)
app.get('/api/videos', (req, res) => {
  try {
    const videos = db.prepare('SELECT * FROM videos ORDER BY created_at DESC').all();
    res.json({ success: true, videos });
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get single video + increment views
app.get('/api/videos/:id', (req, res) => {
  try {
    const video = db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
    if (!video) return res.status(404).json({ success: false, error: 'Video not found' });
    db.prepare('UPDATE videos SET views = views + 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true, video });
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Add video (Admin)
app.post('/api/videos', (req, res) => {
  try {
    const { title, luluUrl, description } = req.body;
    if (!title || !luluUrl) {
      return res.status(400).json({ success: false, error: 'Title and URL required' });
    }
    let embedUrl = luluUrl;
    if (luluUrl.includes('luluvid.com/') && !luluUrl.includes('/e/')) {
      embedUrl = luluUrl.replace('luluvid.com/', 'luluvid.com/e/');
    }
    const result = db.prepare(
      'INSERT INTO videos (title, lulu_url, embed_url, description) VALUES (?, ?, ?, ?)'
    ).run(title, luluUrl, embedUrl, description || '');
    res.json({ success: true, id: result.lastInsertRowid, message: 'Video added!' });
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete video (Admin)
app.delete('/api/videos/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM videos WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Video deleted!' });
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin login
app.post('/api/admin/login', (req, res) => {
  try {
    const { password } = req.body;
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'admin_pass'").get();
    if (password === setting.value) {
      res.json({ success: true, token: 'admin-token-123' });
    } else {
      res.status(401).json({ success: false, error: 'Wrong password' });
    }
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get stats (Admin)
app.get('/api/admin/stats', (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM videos').get();
    const today = db.prepare("SELECT COUNT(*) as count FROM videos WHERE DATE(created_at) = DATE('now')").get();
    const totalViews = db.prepare('SELECT SUM(views) as total FROM videos').get();
    res.json({
      success: true,
      stats: {
        total: total.count,
        today: today.count,
        views: totalViews.total || 0
      }
    });
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== PAGES =====
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// ===== START =====
app.listen(PORT, () => {
  console.log('🚀 Viraldhamka Server Running!');
  console.log('👥 Website: http://localhost:' + PORT);
  console.log('🔐 Admin: http://localhost:' + PORT + '/admin');
});
