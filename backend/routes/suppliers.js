const express = require('express');
const { getDb } = require('../database');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/suppliers — list all suppliers
router.get('/', authenticateToken, (req, res) => {
    const db = getDb();
    const suppliers = db.prepare('SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name').all();
    res.json(suppliers);
});

// GET /api/suppliers/:id
router.get('/:id', authenticateToken, (req, res) => {
    const db = getDb();
    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found.' });

    // Get deliveries
    const deliveries = db.prepare(`
    SELECT b.*, p.name as product_name
    FROM batches b
    JOIN products p ON b.product_id = p.id
    WHERE b.supplier_id = ?
    ORDER BY b.created_at DESC
    LIMIT 50
  `).all(req.params.id);

    res.json({ ...supplier, deliveries });
});

// POST /api/suppliers
router.post('/', authenticateToken, authorize('super_admin', 'store_manager'), (req, res) => {
    const { name, contact_person, phone, email, address } = req.body;
    if (!name) return res.status(400).json({ error: 'Supplier name is required.' });

    const db = getDb();
    const result = db.prepare(
        'INSERT INTO suppliers (name, contact_person, phone, email, address) VALUES (?, ?, ?, ?, ?)'
    ).run(name, contact_person || null, phone || null, email || null, address || null);

    db.prepare('INSERT INTO audit_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)')
        .run(req.user.id, req.user.username, 'SUPPLIER_CREATE', `Created supplier: ${name}`);

    res.status(201).json({ id: result.lastInsertRowid, message: 'Supplier created.' });
});

// PUT /api/suppliers/:id
router.put('/:id', authenticateToken, authorize('super_admin', 'store_manager'), (req, res) => {
    const { name, contact_person, phone, email, address } = req.body;
    const db = getDb();

    const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
    if (!supplier) return res.status(404).json({ error: 'Supplier not found.' });

    db.prepare(`
    UPDATE suppliers SET name = ?, contact_person = ?, phone = ?, email = ?, address = ?
    WHERE id = ?
  `).run(name || supplier.name, contact_person ?? supplier.contact_person, phone ?? supplier.phone,
        email ?? supplier.email, address ?? supplier.address, req.params.id);

    db.prepare('INSERT INTO audit_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)')
        .run(req.user.id, req.user.username, 'SUPPLIER_UPDATE', `Updated supplier ID: ${req.params.id}`);

    res.json({ message: 'Supplier updated.' });
});

// POST /api/suppliers/restock — record a new delivery / restock
router.post('/restock', authenticateToken, authorize('super_admin', 'store_manager', 'pharmacist'), (req, res) => {
    const { product_id, batch_number, expiry_date, cost_price, selling_price, quantity, supplier_id } = req.body;

    if (!product_id || !batch_number || !expiry_date || !cost_price || !selling_price || !quantity) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    const db = getDb();
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    const result = db.prepare(`
    INSERT INTO batches (product_id, batch_number, expiry_date, cost_price, selling_price, quantity_received, quantity_remaining, supplier_id, received_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(product_id, batch_number, expiry_date, cost_price, selling_price, quantity, quantity, supplier_id || null, req.user.id);

    db.prepare('INSERT INTO audit_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)')
        .run(req.user.id, req.user.username, 'RESTOCK', `Restocked ${quantity} units of ${product.name} (Batch: ${batch_number})`);

    res.status(201).json({ id: result.lastInsertRowid, message: 'Stock restocked successfully.' });
});

module.exports = router;
