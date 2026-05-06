const express = require('express');
const { getDb } = require('../database');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/suppliers — list all suppliers
router.get('/', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const [suppliers] = await db.query('SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name');
        res.json(suppliers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/suppliers/:id
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const [rows] = await db.query('SELECT * FROM suppliers WHERE id = $1', [req.params.id]);
        const supplier = rows[0];
        if (!supplier) return res.status(404).json({ error: 'Supplier not found.' });

        // Get deliveries
        const [deliveries] = await db.query(`
      SELECT b.*, p.name as product_name
      FROM batches b
      JOIN products p ON b.product_id = p.id
      WHERE b.supplier_id = $1
      ORDER BY b.created_at DESC
      LIMIT 50
    `, [req.params.id]);

        res.json({ ...supplier, deliveries });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/suppliers
router.post('/', authenticateToken, authorize('super_admin', 'store_manager'), async (req, res) => {
    const { name, contact_person, phone, email, address } = req.body;
    if (!name) return res.status(400).json({ error: 'Supplier name is required.' });

    try {
        const db = await getDb();
        const [rows] = await db.query(
            'INSERT INTO suppliers (name, contact_person, phone, email, address) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [name, contact_person || null, phone || null, email || null, address || null]
        );

        await db.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)',
            [req.user.id, req.user.username, 'SUPPLIER_CREATE', `Created supplier: ${name}`]);

        res.status(201).json({ id: rows[0].id, message: 'Supplier created.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/suppliers/:id
router.put('/:id', authenticateToken, authorize('super_admin', 'store_manager'), async (req, res) => {
    const { name, contact_person, phone, email, address } = req.body;

    try {
        const db = await getDb();
        const [rows] = await db.query('SELECT * FROM suppliers WHERE id = $1', [req.params.id]);
        const supplier = rows[0];
        if (!supplier) return res.status(404).json({ error: 'Supplier not found.' });

        await db.query(`
      UPDATE suppliers SET name = $1, contact_person = $2, phone = $3, email = $4, address = $5
      WHERE id = $6
    `, [name || supplier.name, contact_person ?? supplier.contact_person, phone ?? supplier.phone,
        email ?? supplier.email, address ?? supplier.address, req.params.id]);

        await db.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)',
            [req.user.id, req.user.username, 'SUPPLIER_UPDATE', `Updated supplier ID: ${req.params.id}`]);

        res.json({ message: 'Supplier updated.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/suppliers/restock — record a new delivery / restock
router.post('/restock', authenticateToken, authorize('super_admin', 'store_manager', 'pharmacist'), async (req, res) => {
    const { product_id, batch_number, expiry_date, cost_price, selling_price, quantity, supplier_id } = req.body;

    if (!product_id || !batch_number || !expiry_date || !cost_price || !selling_price || !quantity) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    try {
        const db = await getDb();
        const [productRows] = await db.query('SELECT * FROM products WHERE id = $1', [product_id]);
        const product = productRows[0];
        if (!product) return res.status(404).json({ error: 'Product not found.' });

        const [rows] = await db.query(`
      INSERT INTO batches (product_id, batch_number, expiry_date, cost_price, selling_price, quantity_received, quantity_remaining, supplier_id, received_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `, [product_id, batch_number, expiry_date, cost_price, selling_price, quantity, quantity, supplier_id || null, req.user.id]);

        await db.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES ($1, $2, $3, $4)',
            [req.user.id, req.user.username, 'RESTOCK', `Restocked ${quantity} units of ${product.name} (Batch: ${batch_number})`]);

        res.status(201).json({ id: rows[0].id, message: 'Stock restocked successfully.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
