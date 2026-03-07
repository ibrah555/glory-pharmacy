const express = require('express');
const { getDb } = require('../database');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/inventory/products — list all products with stock info
router.get('/products', authenticateToken, (req, res) => {
    const db = getDb();
    const { category, search, low_stock, expiring } = req.query;

    let query = `
    SELECT p.*,
      COALESCE(SUM(b.quantity_remaining), 0) as total_stock,
      MIN(b.selling_price) as min_price,
      MAX(b.selling_price) as max_price,
      MIN(CASE WHEN b.quantity_remaining > 0 THEN b.expiry_date END) as nearest_expiry
    FROM products p
    LEFT JOIN batches b ON p.id = b.product_id
    WHERE p.is_active = 1
  `;
    const params = [];

    if (category) {
        query += ' AND p.category = ?';
        params.push(category);
    }
    if (search) {
        query += ' AND (p.name LIKE ? OR p.generic_name LIKE ? OR p.brand_name LIKE ?)';
        const s = `%${search}%`;
        params.push(s, s, s);
    }

    query += ' GROUP BY p.id';

    if (low_stock === 'true') {
        query += ' HAVING total_stock <= p.reorder_level';
    }
    if (expiring === 'true') {
        query += ` HAVING nearest_expiry <= date('now', '+3 months')`;
    }

    query += ' ORDER BY p.name';

    const products = db.prepare(query).all(...params);
    res.json(products);
});

// GET /api/inventory/products/:id — get product details with batches
router.get('/products/:id', authenticateToken, (req, res) => {
    const db = getDb();
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    const batches = db.prepare(`
    SELECT b.*, s.name as supplier_name
    FROM batches b
    LEFT JOIN suppliers s ON b.supplier_id = s.id
    WHERE b.product_id = ?
    ORDER BY b.expiry_date ASC
  `).all(req.params.id);

    res.json({ ...product, batches });
});

// POST /api/inventory/products — create product
router.post('/products', authenticateToken, authorize('super_admin', 'store_manager', 'pharmacist'), (req, res) => {
    const { name, generic_name, brand_name, category, dosage_form, strength, reorder_level, storage_location } = req.body;

    if (!name || !category || !dosage_form) {
        return res.status(400).json({ error: 'Name, category, and dosage form are required.' });
    }

    const db = getDb();
    const result = db.prepare(`
    INSERT INTO products (name, generic_name, brand_name, category, dosage_form, strength, reorder_level, storage_location)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, generic_name || null, brand_name || null, category, dosage_form, strength || null, reorder_level || 10, storage_location || null);

    // Audit log
    db.prepare('INSERT INTO audit_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)')
        .run(req.user.id, req.user.username, 'PRODUCT_CREATE', `Created product: ${name}`);

    res.status(201).json({ id: result.lastInsertRowid, message: 'Product created.' });
});

// PUT /api/inventory/products/:id — update product
router.put('/products/:id', authenticateToken, authorize('super_admin', 'store_manager', 'pharmacist'), (req, res) => {
    const { name, generic_name, brand_name, category, dosage_form, strength, reorder_level, storage_location } = req.body;
    const db = getDb();

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found.' });

    db.prepare(`
    UPDATE products SET name = ?, generic_name = ?, brand_name = ?, category = ?, dosage_form = ?,
    strength = ?, reorder_level = ?, storage_location = ?, updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(
        name || product.name, generic_name ?? product.generic_name, brand_name ?? product.brand_name,
        category || product.category, dosage_form || product.dosage_form, strength ?? product.strength,
        reorder_level ?? product.reorder_level, storage_location ?? product.storage_location, req.params.id
    );

    db.prepare('INSERT INTO audit_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)')
        .run(req.user.id, req.user.username, 'PRODUCT_UPDATE', `Updated product ID: ${req.params.id}`);

    res.json({ message: 'Product updated.' });
});

// GET /api/inventory/categories — list all categories
router.get('/categories', authenticateToken, (req, res) => {
    const db = getDb();
    const categories = db.prepare('SELECT DISTINCT category FROM products WHERE is_active = 1 ORDER BY category').all();
    res.json(categories.map(c => c.category));
});

// GET /api/inventory/batches/:productId — get batches for product
router.get('/batches/:productId', authenticateToken, (req, res) => {
    const db = getDb();
    const batches = db.prepare(`
    SELECT b.*, s.name as supplier_name
    FROM batches b
    LEFT JOIN suppliers s ON b.supplier_id = s.id
    WHERE b.product_id = ?
    ORDER BY b.expiry_date ASC
  `).all(req.params.productId);
    res.json(batches);
});

// POST /api/inventory/stock-adjustment — record stock adjustment
router.post('/stock-adjustment', authenticateToken, authorize('super_admin', 'store_manager', 'pharmacist'), (req, res) => {
    const { product_id, batch_id, type, quantity, reason } = req.body;

    if (!product_id || !type || !quantity) {
        return res.status(400).json({ error: 'Product ID, type, and quantity are required.' });
    }

    const db = getDb();

    if (batch_id) {
        const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batch_id);
        if (!batch) return res.status(404).json({ error: 'Batch not found.' });

        const newRemaining = batch.quantity_remaining - quantity;
        if (newRemaining < 0) return res.status(400).json({ error: 'Insufficient stock in batch.' });

        if (type === 'damaged') {
            db.prepare('UPDATE batches SET quantity_damaged = quantity_damaged + ?, quantity_remaining = ? WHERE id = ?')
                .run(quantity, newRemaining, batch_id);
        } else {
            db.prepare('UPDATE batches SET quantity_remaining = ? WHERE id = ?')
                .run(newRemaining, batch_id);
        }
    }

    db.prepare('INSERT INTO stock_adjustments (product_id, batch_id, user_id, type, quantity, reason) VALUES (?, ?, ?, ?, ?, ?)')
        .run(product_id, batch_id || null, req.user.id, type, quantity, reason || null);

    db.prepare('INSERT INTO audit_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)')
        .run(req.user.id, req.user.username, 'STOCK_ADJUSTMENT', `${type}: ${quantity} units of product ${product_id}`);

    res.json({ message: 'Stock adjustment recorded.' });
});

// GET /api/inventory/expiry-alerts — drugs near expiry or expired
router.get('/expiry-alerts', authenticateToken, (req, res) => {
    const db = getDb();

    const expired = db.prepare(`
    SELECT b.*, p.name as product_name, p.category
    FROM batches b JOIN products p ON b.product_id = p.id
    WHERE b.expiry_date < date('now') AND b.quantity_remaining > 0
    ORDER BY b.expiry_date
  `).all();

    const expiring3months = db.prepare(`
    SELECT b.*, p.name as product_name, p.category
    FROM batches b JOIN products p ON b.product_id = p.id
    WHERE b.expiry_date >= date('now') AND b.expiry_date <= date('now', '+3 months') AND b.quantity_remaining > 0
    ORDER BY b.expiry_date
  `).all();

    const expiring6months = db.prepare(`
    SELECT b.*, p.name as product_name, p.category
    FROM batches b JOIN products p ON b.product_id = p.id
    WHERE b.expiry_date > date('now', '+3 months') AND b.expiry_date <= date('now', '+6 months') AND b.quantity_remaining > 0
    ORDER BY b.expiry_date
  `).all();

    res.json({ expired, expiring3months, expiring6months });
});

// GET /api/inventory/low-stock — drugs below reorder level
router.get('/low-stock', authenticateToken, (req, res) => {
    const db = getDb();
    const products = db.prepare(`
    SELECT p.*, COALESCE(SUM(b.quantity_remaining), 0) as total_stock
    FROM products p
    LEFT JOIN batches b ON p.id = b.product_id
    WHERE p.is_active = 1
    GROUP BY p.id
    HAVING total_stock <= p.reorder_level
    ORDER BY total_stock ASC
  `).all();
    res.json(products);
});

// GET /api/inventory/reorder-suggestions — smart reorder suggestions
router.get('/reorder-suggestions', authenticateToken, (req, res) => {
    const db = getDb();
    const suggestions = db.prepare(`
    SELECT p.id, p.name, p.category, p.reorder_level,
      COALESCE(SUM(b.quantity_remaining), 0) as current_stock,
      COALESCE((
        SELECT SUM(si.quantity)
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE si.product_id = p.id
        AND s.created_at >= date('now', '-30 days')
        AND s.status = 'completed'
      ), 0) as sold_last_30_days
    FROM products p
    LEFT JOIN batches b ON p.id = b.product_id AND b.quantity_remaining > 0
    WHERE p.is_active = 1
    GROUP BY p.id
    HAVING current_stock <= p.reorder_level * 2
    ORDER BY current_stock ASC
  `).all();

    const result = suggestions.map(s => {
        const avgDailySales = s.sold_last_30_days / 30;
        const daysRemaining = avgDailySales > 0 ? Math.floor(s.current_stock / avgDailySales) : 999;
        return {
            ...s,
            avg_daily_sales: Math.round(avgDailySales * 10) / 10,
            days_remaining: daysRemaining,
            urgency: daysRemaining <= 3 ? 'critical' : daysRemaining <= 7 ? 'high' : daysRemaining <= 14 ? 'medium' : 'low',
        };
    });

    res.json(result);
});

module.exports = router;
