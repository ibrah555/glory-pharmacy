const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const MpesaService = require('../utils/mpesa');

const router = express.Router();

// POST /api/pos/sale — process a sale
router.post('/sale', authenticateToken, async (req, res) => {
    const { items, payment_method, mpesa_phone } = req.body;

    if (!items || !items.length || !payment_method) {
        return res.status(400).json({ error: 'Items and payment method are required.' });
    }

    const db = await getDb();
    const transactionId = 'TXN-' + uuidv4().split('-')[0].toUpperCase();
    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();

        let totalAmount = 0;
        let totalCost = 0;
        const saleItems = [];

        for (const item of items) {
            const { product_id, quantity } = item;
            let remainingQty = quantity;

            // Get available batches sorted by expiry (FIFO)
            const [batches] = await conn.query(`
        SELECT b.* FROM batches b
        WHERE b.product_id = ? AND b.quantity_remaining > 0
        AND b.expiry_date >= CURDATE()
        ORDER BY b.expiry_date ASC
      `, [product_id]);

            if (!batches.length) {
                throw new Error(`Product ID ${product_id} has no available stock.`);
            }

            const totalAvailable = batches.reduce((sum, b) => sum + b.quantity_remaining, 0);
            if (totalAvailable < quantity) {
                throw new Error(`Insufficient stock for product ID ${product_id}. Available: ${totalAvailable}, Requested: ${quantity}`);
            }

            // Allocate from batches using FIFO
            for (const batch of batches) {
                if (remainingQty <= 0) break;

                const allocatedQty = Math.min(remainingQty, batch.quantity_remaining);
                const subtotal = allocatedQty * batch.selling_price;
                const costTotal = allocatedQty * batch.cost_price;

                totalAmount += subtotal;
                totalCost += costTotal;

                saleItems.push({
                    product_id,
                    batch_id: batch.id,
                    quantity: allocatedQty,
                    unit_price: batch.selling_price,
                    cost_price: batch.cost_price,
                    subtotal,
                });

                // Update batch
                await conn.query(`
          UPDATE batches SET quantity_sold = quantity_sold + ?, quantity_remaining = quantity_remaining - ?
          WHERE id = ?
        `, [allocatedQty, allocatedQty, batch.id]);

                remainingQty -= allocatedQty;
            }
        }

        const profit = totalAmount - totalCost;

        // Create sale record
        const [saleResult] = await conn.query(`
      INSERT INTO sales (transaction_id, user_id, total_amount, total_cost, profit, payment_method, mpesa_phone, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'completed')
    `, [transactionId, req.user.id, totalAmount, totalCost, profit, payment_method, mpesa_phone || null]);

        const saleId = saleResult.insertId;

        // Create sale items
        for (const si of saleItems) {
            await conn.query(`
        INSERT INTO sale_items (sale_id, product_id, batch_id, quantity, unit_price, cost_price, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [saleId, si.product_id, si.batch_id, si.quantity, si.unit_price, si.cost_price, si.subtotal]);
        }

        // Audit log
        await conn.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)',
            [req.user.id, req.user.username, 'SALE', `Sale ${transactionId}: KES ${totalAmount.toFixed(2)}, Method: ${payment_method}`]);

        await conn.commit();

        res.status(201).json({
            sale_id: saleId,
            transaction_id: transactionId,
            total_amount: totalAmount,
            total_cost: totalCost,
            profit,
            payment_method,
            items: saleItems,
            cashier: req.user.full_name,
            date: new Date().toISOString(),
        });
    } catch (err) {
        await conn.rollback();
        res.status(400).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// POST /api/pos/mpesa-stk — initiate M-Pesa STK Push
router.post('/mpesa-stk', authenticateToken, async (req, res) => {
    const { phone, amount } = req.body;
    if (!phone || !amount) {
        return res.status(400).json({ error: 'Phone number and amount are required.' });
    }

    try {
        const db = await getDb();
        const settings = {};
        const [rows] = await db.query('SELECT setting_key, setting_value FROM settings WHERE setting_key LIKE ?', ['mpesa_%']);
        rows.forEach(s => {
            settings[s.setting_key] = s.setting_value;
        });

        const mpesa = new MpesaService({
            consumerKey: settings.mpesa_consumer_key,
            consumerSecret: settings.mpesa_consumer_secret,
            shortcode: settings.mpesa_shortcode,
            passkey: settings.mpesa_passkey,
            environment: settings.mpesa_environment || 'sandbox',
        });

        let result;
        if (!settings.mpesa_consumer_key || settings.mpesa_environment === 'sandbox') {
            // Use simulation mode
            result = mpesa.simulateStkPush(phone, amount);
        } else {
            result = await mpesa.stkPush(phone, amount, 'GloryPharmacy', 'Pharmacy Payment');
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pos/cancel-sale — cancel a sale
router.post('/cancel-sale', authenticateToken, async (req, res) => {
    const { sale_id, reason } = req.body;
    if (!sale_id) return res.status(400).json({ error: 'Sale ID is required.' });

    const db = await getDb();
    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();

        const [saleRows] = await conn.query('SELECT * FROM sales WHERE id = ?', [sale_id]);
        const sale = saleRows[0];

        if (!sale) throw new Error('Sale not found.');
        if (sale.status === 'cancelled') throw new Error('Sale already cancelled.');

        // Restore stock
        const [saleItems] = await conn.query('SELECT * FROM sale_items WHERE sale_id = ?', [sale_id]);
        for (const item of saleItems) {
            await conn.query('UPDATE batches SET quantity_sold = quantity_sold - ?, quantity_remaining = quantity_remaining + ? WHERE id = ?',
                [item.quantity, item.quantity, item.batch_id]);
        }

        await conn.query("UPDATE sales SET status = 'cancelled' WHERE id = ?", [sale_id]);

        await conn.query('INSERT INTO audit_logs (user_id, username, action, details) VALUES (?, ?, ?, ?)',
            [req.user.id, req.user.username, 'SALE_CANCEL', `Cancelled sale ${sale.transaction_id}. Reason: ${reason || 'N/A'}`]);

        await conn.commit();
        res.json({ message: 'Sale cancelled. Stock restored.' });
    } catch (err) {
        await conn.rollback();
        res.status(400).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// GET /api/pos/search — search products for POS
router.get('/search', authenticateToken, async (req, res) => {
    const { q } = req.query;
    if (!q) return res.json([]);

    try {
        const db = await getDb();
        const [products] = await db.query(`
      SELECT p.id, p.name, p.generic_name, p.brand_name, p.category, p.dosage_form, p.strength,
        COALESCE(SUM(CASE WHEN b.expiry_date >= CURDATE() THEN b.quantity_remaining ELSE 0 END), 0) as available_stock,
        MIN(CASE WHEN b.quantity_remaining > 0 AND b.expiry_date >= CURDATE() THEN b.selling_price END) as price
      FROM products p
      LEFT JOIN batches b ON p.id = b.product_id
      WHERE p.is_active = 1 AND (p.name LIKE ? OR p.generic_name LIKE ? OR p.brand_name LIKE ?)
      GROUP BY p.id
      HAVING available_stock > 0
      ORDER BY p.name
      LIMIT 20
    `, [`%${q}%`, `%${q}%`, `%${q}%`]);

        res.json(products);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/pos/receipt/:saleId — get receipt data
router.get('/receipt/:saleId', authenticateToken, async (req, res) => {
    try {
        const db = await getDb();
        const [saleRows] = await db.query(`
      SELECT s.*, u.full_name as cashier_name
      FROM sales s JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `, [req.params.saleId]);
        const sale = saleRows[0];

        if (!sale) return res.status(404).json({ error: 'Sale not found.' });

        const [items] = await db.query(`
      SELECT si.*, p.name as product_name, p.dosage_form, p.strength
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `, [req.params.saleId]);

        const [settingsRows] = await db.query("SELECT setting_value FROM settings WHERE setting_key = 'pharmacy_name'");
        const pharmacyName = settingsRows[0]?.setting_value || 'Glory Pharmacy';

        const [locRows] = await db.query("SELECT setting_value FROM settings WHERE setting_key = 'pharmacy_location'");
        const pharmacyLocation = locRows[0]?.setting_value || '';

        res.json({
            ...sale,
            items,
            pharmacy_name: pharmacyName,
            pharmacy_location: pharmacyLocation,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


module.exports = router;
