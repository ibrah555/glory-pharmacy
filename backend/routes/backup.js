const express = require('express');
const path = require('path');
const fs = require('fs');
const { authenticateToken, authorize } = require('../middleware/auth');
const { backupDatabase, DB_PATH } = require('../database');
const { getDb } = require('../database');

const router = express.Router();

// POST /api/backup — create a backup
router.post('/', authenticateToken, authorize('super_admin'), (req, res) => {
    const { target_path } = req.body;
    const backupDir = target_path || path.join(__dirname, '..', 'backups');

    try {
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const backupFile = backupDatabase(backupDir);

        const db = getDb();
        db.prepare('INSERT INTO audit_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)')
            .run(req.user.id, req.user.username, 'BACKUP', `Database backed up to: ${backupFile}`);

        res.json({ message: 'Backup created successfully.', path: backupFile });
    } catch (err) {
        res.status(500).json({ error: 'Backup failed: ' + err.message });
    }
});

// GET /api/backup/list — list existing backups
router.get('/list', authenticateToken, authorize('super_admin'), (req, res) => {
    const backupDir = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(backupDir)) {
        return res.json([]);
    }

    const files = fs.readdirSync(backupDir)
        .filter(f => f.endsWith('.db'))
        .map(f => {
            const stat = fs.statSync(path.join(backupDir, f));
            return { name: f, size: stat.size, created: stat.mtime };
        })
        .sort((a, b) => new Date(b.created) - new Date(a.created));

    res.json(files);
});

// GET /api/settings — get system settings
router.get('/settings', authenticateToken, authorize('super_admin'), (req, res) => {
    const db = getDb();
    const settings = {};
    db.prepare('SELECT key, value FROM settings').all().forEach(s => {
        settings[s.key] = s.value;
    });
    res.json(settings);
});

// PUT /api/settings — update system settings
router.put('/settings', authenticateToken, authorize('super_admin'), (req, res) => {
    const db = getDb();
    const updates = req.body;

    const updateSetting = db.prepare("INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now','localtime'))");

    const updateAll = db.transaction(() => {
        for (const [key, value] of Object.entries(updates)) {
            updateSetting.run(key, value);
        }
    });
    updateAll();

    db.prepare('INSERT INTO audit_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)')
        .run(req.user.id, req.user.username, 'SETTINGS_UPDATE', `Updated settings: ${Object.keys(updates).join(', ')}`);

    res.json({ message: 'Settings updated.' });
});

module.exports = router;
