const express = require('express');
const { getDb } = require('../database');
const { authenticateToken, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/inventory/products — list all products with stock info
router.get('/products', authenticateToken, async (req, res) => {
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
        query += ` HAVING nearest_expiry <= DATE_ADD(CURDATE(), INTERVAL 3 MONTH)`;
    }

    query += ' ORDER BY p.name';

    try {
        const db = await getDb();
        const [products] = await db.query(query, params);
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/inventory/products/:id — get product details with batches
router.get('/products/:id', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const [productRows] = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
        const product = productRows[0];
        if (!product) return res.status(404).json({ error: 'Product not found.' });

        const [batches] = await db.query(`
      SELECT b.*, s.name as supplier_name
      FROM batches b
      LEFT JOIN suppliers s ON b.supplier_id = s.id
      WHERE b.product_id = ?
      ORDER BY b.expiry_date ASC
    `, [req.params.id]);

        res.json({ ...product, batches });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/inventory/products — create product
router.post('/products', authenticateToken, authorize('super_admin', 'store_manager', 'pharmacist'), async (req, res) => {
    const { name, generic_name, brand_name, category, dosage_form, strength, reorder_level, storage_location } = req.body;

    if (!name || !category || !dosage_form) {
        return res.status(400).json({ error: 'Name, category, and dosage form are required.' });
    }

    try {
        const db = await getDb();
        const [result] = await db.query(`
      INSERT INTO products (name, generic_name, brand_name, category, dosage_form, strength, reorder_level, storage_location)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [name, generic_name || null, brand_name || null, category, dosage_form, strength || null, reorder_level || 10, storage_location || null]);

        // Audit log
        await db.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)',
            [req.user.id, req.user.username, 'PRODUCT_CREATE', `Created product: ${name}`]);

        res.status(201).json({ id: result.insertId, message: 'Product created.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/inventory/products/:id — update product
router.put('/products/:id', authenticateToken, authorize('super_admin', 'store_manager', 'pharmacist'), async (req, res) => {
    const { name, generic_name, brand_name, category, dosage_form, strength, reorder_level, storage_location } = req.body;

    try {
        const db = await getDb();
        const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
        const product = rows[0];
        if (!product) return res.status(404).json({ error: 'Product not found.' });

        await db.query(`
      UPDATE products SET name = ?, generic_name = ?, brand_name = ?, category = ?, dosage_form = ?,
      strength = ?, reorder_level = ?, storage_location = ?
      WHERE id = ?
    `, [
            name || product.name, generic_name ?? product.generic_name, brand_name ?? product.brand_name,
            category || product.category, dosage_form || product.dosage_form, strength ?? product.strength,
            reorder_level ?? product.reorder_level, storage_location ?? product.storage_location, req.params.id
        ]);

        await db.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)',
            [req.user.id, req.user.username, 'PRODUCT_UPDATE', `Updated product ID: ${req.params.id}`]);

        res.json({ message: 'Product updated.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/inventory/categories — list all categories
router.get('/categories', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const [categories] = await db.query('SELECT DISTINCT category FROM products WHERE is_active = 1 ORDER BY category');
        res.json(categories.map(c => c.category));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/inventory/batches/:productId — get batches for product
router.get('/batches/:productId', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const [batches] = await db.query(`
      SELECT b.*, s.name as supplier_name
      FROM batches b
      LEFT JOIN suppliers s ON b.supplier_id = s.id
      WHERE b.product_id = ?
      ORDER BY b.expiry_date ASC
    `, [req.params.productId]);
        res.json(batches);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/inventory/stock-adjustment — record stock adjustment
router.post('/stock-adjustment', authenticateToken, authorize('super_admin', 'store_manager', 'pharmacist'), async (req, res) => {
    const { product_id, batch_id, type, quantity, reason } = req.body;

    if (!product_id || !type || !quantity) {
        return res.status(400).json({ error: 'Product ID, type, and quantity are required.' });
    }

    try {
        const db = await getDb();

        if (batch_id) {
            const [batchRows] = await db.query('SELECT * FROM batches WHERE id = ?', [batch_id]);
            const batch = batchRows[0];
            if (!batch) return res.status(404).json({ error: 'Batch not found.' });

            const newRemaining = batch.quantity_remaining - quantity;
            if (newRemaining < 0) return res.status(400).json({ error: 'Insufficient stock in batch.' });

            if (type === 'damaged') {
                await db.query('UPDATE batches SET quantity_damaged = quantity_damaged + ?, quantity_remaining = ? WHERE id = ?',
                    [quantity, newRemaining, batch_id]);
            } else {
                await db.query('UPDATE batches SET quantity_remaining = ? WHERE id = ?',
                    [newRemaining, batch_id]);
            }
        }

        await db.query('INSERT INTO stock_adjustments (product_id, batch_id, user_id, type, quantity, reason) VALUES (?, ?, ?, ?, ?, ?)',
            [product_id, batch_id || null, req.user.id, type, quantity, reason || null]);

        await db.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)',
            [req.user.id, req.user.username, 'STOCK_ADJUSTMENT', `${type}: ${quantity} units of product ${product_id}`]);

        res.json({ message: 'Stock adjustment recorded.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/inventory/expiry-alerts — drugs near expiry or expired
router.get('/expiry-alerts', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();

        const [expired] = await db.query(`
      SELECT b.*, p.name as product_name, p.category
      FROM batches b JOIN products p ON b.product_id = p.id
      WHERE b.expiry_date < CURDATE() AND b.quantity_remaining > 0
      ORDER BY b.expiry_date
    `);

        const [expiring3months] = await db.query(`
      SELECT b.*, p.name as product_name, p.category
      FROM batches b JOIN products p ON b.product_id = p.id
      WHERE b.expiry_date >= CURDATE() AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 3 MONTH) AND b.quantity_remaining > 0
      ORDER BY b.expiry_date
    `);

        const [expiring6months] = await db.query(`
      SELECT b.*, p.name as product_name, p.category
      FROM batches b JOIN products p ON b.product_id = p.id
      WHERE b.expiry_date > DATE_ADD(CURDATE(), INTERVAL 3 MONTH) AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL 6 MONTH) AND b.quantity_remaining > 0
      ORDER BY b.expiry_date
    `);

        res.json({ expired, expiring3months, expiring6months });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/inventory/low-stock — drugs below reorder level
router.get('/low-stock', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const [products] = await db.query(`
      SELECT p.*, COALESCE(SUM(b.quantity_remaining), 0) as total_stock
      FROM products p
      LEFT JOIN batches b ON p.id = b.product_id
      WHERE p.is_active = 1
      GROUP BY p.id
      HAVING total_stock <= p.reorder_level
      ORDER BY total_stock ASC
    `);
        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/inventory/reorder-suggestions — smart reorder suggestions
router.get('/reorder-suggestions', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const [suggestions] = await db.query(`
      SELECT p.id, p.name, p.category, p.reorder_level,
        COALESCE(SUM(b.quantity_remaining), 0) as current_stock,
        COALESCE((
          SELECT SUM(si.quantity)
          FROM sale_items si
          JOIN sales s ON si.sale_id = s.id
          WHERE si.product_id = p.id
          AND s.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
          AND s.status = 'completed'
        ), 0) as sold_last_30_days
      FROM products p
      LEFT JOIN batches b ON p.id = b.product_id AND b.quantity_remaining > 0
      WHERE p.is_active = 1
      GROUP BY p.id
      HAVING current_stock <= p.reorder_level * 2
      ORDER BY current_stock ASC
    `);

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
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


module.exports = router;
