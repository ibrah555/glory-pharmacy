const express = require('express');
const { getDb } = require('../database');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/audit — get audit logs
router.get('/', authenticateToken, authorize('super_admin'), (req, res) => {
    const { start_date, end_date, user_id, action, limit = 100 } = req.query;
    const db = getDb();

    let query = `
    SELECT a.*, u.full_name as user_full_name
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE 1=1
  `;
    const params = [];

    if (start_date) { query += ' AND date(a.created_at) >= ?'; params.push(start_date); }
    if (end_date) { query += ' AND date(a.created_at) <= ?'; params.push(end_date); }
    if (user_id) { query += ' AND a.user_id = ?'; params.push(user_id); }
    if (action) { query += ' AND a.action = ?'; params.push(action); }

    query += ' ORDER BY a.created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const logs = db.prepare(query).all(...params);
    res.json(logs);
});

// GET /api/audit/actions — list distinct action types
router.get('/actions', authenticateToken, authorize('super_admin'), (req, res) => {
    const db = getDb();
    const actions = db.prepare('SELECT DISTINCT action FROM audit_logs ORDER BY action').all();
    res.json(actions.map(a => a.action));
});

// GET /api/audit/suspicious — suspicious activity report
router.get('/suspicious', authenticateToken, authorize('super_admin'), (req, res) => {
    const db = getDb();

    const cancellations = db.prepare(`
    SELECT u.full_name, u.username, COUNT(*) as count
    FROM audit_logs a JOIN users u ON a.user_id = u.id
    WHERE a.action = 'SALE_CANCEL' AND a.created_at >= date('now','-7 days')
    GROUP BY a.user_id
    ORDER BY count DESC
  `).all();

    const adjustments = db.prepare(`
    SELECT u.full_name, u.username, COUNT(*) as count
    FROM stock_adjustments sa JOIN users u ON sa.user_id = u.id
    WHERE sa.created_at >= date('now','-7 days')
    GROUP BY sa.user_id
    ORDER BY count DESC
  `).all();

    res.json({ cancellations, adjustments });
});

module.exports = router;
