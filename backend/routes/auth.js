const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../database');
const { generateToken, authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    try {
        const db = await getDb();
        const [rows] = await db.query('SELECT * FROM users WHERE username = $1 AND is_active = 1', [username]);
        const user = rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        const token = generateToken(user);

        // Log login action
        await db.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)',
            [user.id, user.username, 'LOGIN', `User logged in`]);

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                role: user.role,
            },
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/auth/me — get current user info
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const [rows] = await db.query('SELECT id, username, full_name, role, is_active, created_at FROM users WHERE id = $1', [req.user.id]);
        const user = rows[0];
        if (!user) return res.status(404).json({ error: 'User not found.' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/auth/users — list all users (Super Admin only)
router.get('/users', authenticateToken, authorize('super_admin'), async (req, res) => {
    try {
        const db = await getDb();
        const [users] = await db.query('SELECT id, username, full_name, role, is_active, created_at, updated_at FROM users ORDER BY created_at DESC');
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/auth/users — create new user (Super Admin only)
router.post('/users', authenticateToken, authorize('super_admin'), async (req, res) => {
    const { username, full_name, password, role } = req.body;
    if (!username || !full_name || !password || !role) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    const validRoles = ['super_admin', 'store_manager', 'pharmacist', 'cashier'];
    if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role.' });
    }

    try {
        const db = await getDb();
        const [existing] = await db.query('SELECT id FROM users WHERE username = $1', [username]);
        if (existing.length > 0) {
            return res.status(409).json({ error: 'Username already exists.' });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const [rows] = await db.query(
            'INSERT INTO users (username, full_name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
            [username, full_name, passwordHash, role]
        );

        // Audit log
        await db.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)',
            [req.user.id, req.user.username, 'USER_CREATE', `Created user: ${username} (${role})`]);

        res.status(201).json({ id: rows[0].id, username, full_name, role });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/auth/users/:id — update user (Super Admin only)
router.put('/users/:id', authenticateToken, authorize('super_admin'), async (req, res) => {
    const { full_name, role, is_active, password } = req.body;

    try {
        const db = await getDb();
        const [rows] = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
        const user = rows[0];
        if (!user) return res.status(404).json({ error: 'User not found.' });

        const updates = [];
        const values = [];

        if (full_name !== undefined) { 
            values.push(full_name);
            updates.push(`full_name = $${values.length}`); 
        }
        if (role !== undefined) { 
            values.push(role);
            updates.push(`role = $${values.length}`); 
        }
        if (is_active !== undefined) { 
            values.push(is_active ? 1 : 0);
            updates.push(`is_active = $${values.length}`); 
        }
        if (password) {
            values.push(await bcrypt.hash(password, 10));
            updates.push(`password_hash = $${values.length}`);
        }

        if (updates.length > 0) {
            values.push(req.params.id);
            await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${values.length}`, values);
        }

        // Audit log
        await db.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)',
            [req.user.id, req.user.username, 'USER_UPDATE', `Updated user ID: ${req.params.id}`]);

        res.json({ message: 'User updated successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
