const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../database');
const { generateToken, authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);

    if (!user) {
        return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
        return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = generateToken(user);

    // Log login action
    db.prepare('INSERT INTO audit_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)')
        .run(user.id, user.username, 'LOGIN', `User logged in`);

    res.json({
        token,
        user: {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            role: user.role,
        },
    });
});

// GET /api/auth/me — get current user info
router.get('/me', authenticateToken, (req, res) => {
    const db = getDb();
    const user = db.prepare('SELECT id, username, full_name, role, is_active, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json(user);
});

// GET /api/auth/users — list all users (Super Admin only)
router.get('/users', authenticateToken, authorize('super_admin'), (req, res) => {
    const db = getDb();
    const users = db.prepare('SELECT id, username, full_name, role, is_active, created_at, updated_at FROM users ORDER BY created_at DESC').all();
    res.json(users);
});

// POST /api/auth/users — create new user (Super Admin only)
router.post('/users', authenticateToken, authorize('super_admin'), (req, res) => {
    const { username, full_name, password, role } = req.body;
    if (!username || !full_name || !password || !role) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    const validRoles = ['super_admin', 'store_manager', 'pharmacist', 'cashier'];
    if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role.' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
        return res.status(409).json({ error: 'Username already exists.' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
        'INSERT INTO users (username, full_name, password_hash, role) VALUES (?, ?, ?, ?)'
    ).run(username, full_name, passwordHash, role);

    // Audit log
    db.prepare('INSERT INTO audit_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)')
        .run(req.user.id, req.user.username, 'USER_CREATE', `Created user: ${username} (${role})`);

    res.status(201).json({ id: result.lastInsertRowid, username, full_name, role });
});

// PUT /api/auth/users/:id — update user (Super Admin only)
router.put('/users/:id', authenticateToken, authorize('super_admin'), (req, res) => {
    const { full_name, role, is_active, password } = req.body;
    const db = getDb();

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const updates = [];
    const values = [];

    if (full_name !== undefined) { updates.push('full_name = ?'); values.push(full_name); }
    if (role !== undefined) { updates.push('role = ?'); values.push(role); }
    if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active ? 1 : 0); }
    if (password) {
        updates.push('password_hash = ?');
        values.push(bcrypt.hashSync(password, 10));
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update.' });

    updates.push("updated_at = datetime('now','localtime')");
    values.push(req.params.id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    // Audit log
    db.prepare('INSERT INTO audit_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)')
        .run(req.user.id, req.user.username, 'USER_UPDATE', `Updated user ID: ${req.params.id}`);

    res.json({ message: 'User updated successfully.' });
});

module.exports = router;
