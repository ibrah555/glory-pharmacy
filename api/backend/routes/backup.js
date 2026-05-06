const express = require('express');
const path = require('path');
const fs = require('fs');
const { authenticateToken, authorize } = require('../middleware/auth');
const { getDb } = require('../database');

const router = express.Router();

// POST /api/backup — create a backup (Placeholder for MySQL)
router.post('/', authenticateToken, authorize('super_admin'), async (req, res) => {
    res.status(501).json({ error: 'Database backup via API is currently disabled for MySQL migration. Please use mysqldump.' });
});

// GET /api/backup/list — list existing backups
router.get('/list', authenticateToken, authorize('super_admin'), async (req, res) => {
    try {
        const backupDir = path.join(__dirname, '..', 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }
        const files = fs.readdirSync(backupDir)
            .filter(f => f.endsWith('.sql'))
            .map(f => {
                const stats = fs.statSync(path.join(backupDir, f));
                return { name: f, size: stats.size, created: stats.mtime };
            });
        res.json(files);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/settings — get system settings
router.get('/settings', authenticateToken, authorize('super_admin'), async (req, res) => {
    try {
        const db = await getDb();
        const settings = {};
        const [rows] = await db.query('SELECT setting_key, setting_value FROM settings');
        rows.forEach(s => {
            settings[s.setting_key] = s.setting_value;
        });
        res.json(settings);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/settings — update system settings
router.put('/settings', authenticateToken, authorize('super_admin'), async (req, res) => {
    const updates = req.body;

    try {
        const db = await getDb();
        const conn = await db.getConnection();

        try {
            await conn.beginTransaction();

            for (const [key, value] of Object.entries(updates)) {
                await conn.query(`
          INSERT INTO settings (setting_key, setting_value, updated_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
          ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP
        `, [key, value]);
            }

            await conn.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)',
                [req.user.id, req.user.username, 'SETTINGS_UPDATE', `Updated settings: ${Object.keys(updates).join(', ')}`]);

            await conn.commit();
            res.json({ message: 'Settings updated.' });
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

