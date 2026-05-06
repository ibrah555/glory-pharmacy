const express = require('express');
const { getDb } = require('../database');
const { authenticateToken, authorize } = require('../middleware/auth');
const { exportToExcel, exportToPDF, exportToCSV } = require('../utils/export');

const router = express.Router();

// GET /api/reports/dashboard — main dashboard metrics
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();

    const [
      [todayRows],
      [weekRows],
      [monthRows],
      [inventoryValueRows],
      [lowStockRows],
      [expiringRows],
      [expiredRows],
      [totalProductsRows],
      [recentSales]
    ] = await Promise.all([
      db.query(`
        SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue, COALESCE(SUM(profit), 0) as profit
        FROM sales WHERE DATE(created_at) = CURDATE() AND status = 'completed'
      `),
      db.query(`
        SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue, COALESCE(SUM(profit), 0) as profit
        FROM sales WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND status = 'completed'
      `),
      db.query(`
        SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue, COALESCE(SUM(profit), 0) as profit
        FROM sales WHERE created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND status = 'completed'
      `),
      db.query(`
        SELECT COALESCE(SUM(b.quantity_remaining * b.selling_price), 0) as retail_value,
               COALESCE(SUM(b.quantity_remaining * b.cost_price), 0) as cost_value
        FROM batches b WHERE b.quantity_remaining > 0
      `),
      db.query(`
        SELECT COUNT(*) as count FROM (
          SELECT p.id FROM products p
          LEFT JOIN batches b ON p.id = b.product_id
          WHERE p.is_active = 1
          GROUP BY p.id, p.reorder_level
          HAVING COALESCE(SUM(b.quantity_remaining), 0) <= p.reorder_level
        ) as t
      `),
      db.query(`
        SELECT COUNT(*) as count FROM batches
        WHERE expiry_date <= DATE_ADD(CURDATE(), INTERVAL 3 MONTH) AND quantity_remaining > 0
      `),
      db.query(`
        SELECT COUNT(*) as count FROM batches
        WHERE expiry_date < CURDATE() AND quantity_remaining > 0
      `),
      db.query('SELECT COUNT(*) as count FROM products WHERE is_active = 1'),
      db.query(`
        SELECT s.*, u.full_name as cashier_name
        FROM sales s JOIN users u ON s.user_id = u.id
        WHERE s.status = 'completed'
        ORDER BY s.created_at DESC LIMIT 10
      `)
    ]);

    const today = todayRows[0];
    const week = weekRows[0];
    const month = monthRows[0];
    const inventoryValue = inventoryValueRows[0];
    const lowStockCount = lowStockRows[0];
    const expiringCount = expiringRows[0];
    const expiredCount = expiredRows[0];
    const totalProducts = totalProductsRows[0];

    res.json({
      today: { ...today },
      week: { ...week },
      month: { ...month },
      inventory: { ...inventoryValue, total_products: totalProducts.count },
      low_stock_count: lowStockCount.count,
      expiring_count: expiringCount.count,
      expired_count: expiredCount.count,
      recent_sales: recentSales,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/sales-trend — daily sales for the last 30 days
router.get('/sales-trend', authenticateToken, async (req, res) => {
  const { days = 30 } = req.query;
  try {
    const db = await getDb();
    const [data] = await db.query(`
      SELECT DATE(created_at) as date, COUNT(*) as transactions,
        SUM(total_amount) as revenue, SUM(profit) as profit
      FROM sales
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND status = 'completed'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [parseInt(days)]);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/top-products — top selling products
router.get('/top-products', authenticateToken, async (req, res) => {
  const { limit = 10, days = 30 } = req.query;
  try {
    const db = await getDb();
    const [data] = await db.query(`
      SELECT p.name, p.category, SUM(si.quantity) as total_qty, SUM(si.subtotal) as total_revenue
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND s.status = 'completed'
      GROUP BY p.id, p.name, p.category
      ORDER BY total_qty DESC
      LIMIT ?
    `, [parseInt(days), parseInt(limit)]);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/category-sales — sales by category
router.get('/category-sales', authenticateToken, async (req, res) => {
  const { days = 30 } = req.query;
  try {
    const db = await getDb();
    const [data] = await db.query(`
      SELECT p.category, SUM(si.quantity) as total_qty, SUM(si.subtotal) as total_revenue
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      JOIN sales s ON si.sale_id = s.id
      WHERE s.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND s.status = 'completed'
      GROUP BY p.category
      ORDER BY total_revenue DESC
    `, [parseInt(days)]);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/monthly-revenue — monthly revenue for past year
router.get('/monthly-revenue', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const [data] = await db.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') as month,
        SUM(total_amount) as revenue, SUM(profit) as profit, COUNT(*) as transactions
      FROM sales
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH) AND status = 'completed'
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month ASC
    `);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/sales — detailed sales report with filters
router.get('/sales', authenticateToken, async (req, res) => {
  const { start_date, end_date, product_id, category, user_id, payment_method } = req.query;

  try {
    const db = await getDb();
    let query = `
      SELECT s.*, u.full_name as cashier_name
      FROM sales s JOIN users u ON s.user_id = u.id
      WHERE s.status = 'completed'
    `;
    const params = [];

    if (start_date) { query += ' AND DATE(s.created_at) >= ?'; params.push(start_date); }
    if (end_date) { query += ' AND DATE(s.created_at) <= ?'; params.push(end_date); }
    if (user_id) { query += ' AND s.user_id = ?'; params.push(user_id); }
    if (payment_method) { query += ' AND s.payment_method = ?'; params.push(payment_method); }

    if (product_id || category) {
      query += ` AND s.id IN (SELECT DISTINCT si.sale_id FROM sale_items si JOIN products p ON si.product_id = p.id WHERE 1=1`;
      if (product_id) { query += ' AND si.product_id = ?'; params.push(product_id); }
      if (category) { query += ' AND p.category = ?'; params.push(category); }
      query += ')';
    }

    query += ' ORDER BY s.created_at DESC LIMIT 500';

    const [sales] = await db.query(query, params);
    res.json(sales);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/smart-insights — AI-like stock intelligence
router.get('/smart-insights', authenticateToken, async (req, res) => {
  try {
    const db = await getDb();
    const insights = [];

    // Fast movers: products with >25% increase in sales (Recent 15d vs Prev 15d)
    const [fastMovers] = await db.query(`
      SELECT p.name, 
             COALESCE(recent.qty, 0) as recent_sales, 
             COALESCE(prev.qty, 0) as prev_sales
      FROM products p
      LEFT JOIN (
        SELECT si.product_id, SUM(si.quantity) as qty 
        FROM sale_items si JOIN sales s ON si.sale_id = s.id 
        WHERE s.created_at >= DATE_SUB(CURDATE(), INTERVAL 15 DAY) AND s.status='completed'
        GROUP BY si.product_id
      ) as recent ON p.id = recent.product_id
      LEFT JOIN (
        SELECT si.product_id, SUM(si.quantity) as qty 
        FROM sale_items si JOIN sales s ON si.sale_id = s.id 
        WHERE s.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) 
        AND s.created_at < DATE_SUB(CURDATE(), INTERVAL 15 DAY) AND s.status='completed'
        GROUP BY si.product_id
      ) as prev ON p.id = prev.product_id
      WHERE p.is_active = 1
      AND COALESCE(recent.qty, 0) > 0 
      AND COALESCE(prev.qty, 0) > 0 
      AND (COALESCE(recent.qty, 0) / COALESCE(prev.qty, 0)) > 1.25
    `);

    for (const fm of fastMovers) {
      const increase = Math.round(((fm.recent_sales / fm.prev_sales) - 1) * 100);
      insights.push({
        type: 'fast_mover',
        icon: '📈',
        message: `${fm.name} sales increased by ${increase}% in the last 15 days.`,
        severity: 'info',
      });
    }

    // Dead stock: not sold in 30 days
    const [deadStock] = await db.query(`
      SELECT p.name, COALESCE(SUM(b.quantity_remaining), 0) as stock
      FROM products p
      LEFT JOIN batches b ON p.id = b.product_id
      LEFT JOIN (
        SELECT DISTINCT si.product_id FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE s.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND s.status = 'completed'
      ) as recent_sales ON p.id = recent_sales.product_id
      WHERE p.is_active = 1 AND recent_sales.product_id IS NULL
      GROUP BY p.id, p.name
      HAVING stock > 0
    `);

    for (const ds of deadStock) {
      insights.push({
        type: 'dead_stock',
        icon: '⚠️',
        message: `${ds.name} has not sold in the last 30 days (${ds.stock} units in stock).`,
        severity: 'warning',
      });
    }

    // Suspicious activity checks
    const [suspiciousCancels] = await db.query(`
      SELECT u.full_name, COUNT(*) as cancel_count
      FROM audit_logs a JOIN users u ON a.user_id = u.id
      WHERE a.action = 'SALE_CANCEL' AND a.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
      GROUP BY a.user_id
      HAVING cancel_count >= 5
    `);

    for (const sc of suspiciousCancels) {
      insights.push({
        type: 'suspicious',
        icon: '🚨',
        message: `${sc.full_name} cancelled ${sc.cancel_count} transactions today.`,
        severity: 'critical',
      });
    }

    const [suspiciousAdjustments] = await db.query(`
      SELECT u.full_name, COUNT(*) as adj_count
      FROM stock_adjustments sa JOIN users u ON sa.user_id = u.id
      WHERE sa.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 DAY)
      GROUP BY sa.user_id
      HAVING adj_count >= 10
    `);

    for (const sa of suspiciousAdjustments) {
      insights.push({
        type: 'suspicious',
        icon: '🚨',
        message: `${sa.full_name} made ${sa.adj_count} stock adjustments today.`,
        severity: 'critical',
      });
    }

    res.json(insights);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/export/:type — export report data
router.get('/export/:type', authenticateToken, authorize('super_admin', 'store_manager'), async (req, res) => {
  const { type } = req.params;
  const { report, ...filters } = req.query;

  try {
    const db = await getDb();
    let data, columns, title;

    switch (report) {
      case 'sales':
        title = 'Sales Report';
        columns = [
          { header: 'Transaction ID', key: 'transaction_id', width: 20 },
          { header: 'Date', key: 'created_at', width: 20 },
          { header: 'Cashier', key: 'cashier_name', width: 20 },
          { header: 'Amount (KES)', key: 'total_amount', width: 15 },
          { header: 'Profit (KES)', key: 'profit', width: 15 },
          { header: 'Payment', key: 'payment_method', width: 12 },
        ];
        [data] = await db.query(`
          SELECT s.transaction_id, s.created_at, u.full_name as cashier_name,
            s.total_amount, s.profit, s.payment_method
          FROM sales s JOIN users u ON s.user_id = u.id
          WHERE s.status = 'completed'
          ORDER BY s.created_at DESC LIMIT 1000
        `);
        break;

      case 'inventory':
        title = 'Inventory Report';
        columns = [
          { header: 'Product', key: 'name', width: 25 },
          { header: 'Category', key: 'category', width: 15 },
          { header: 'Stock', key: 'total_stock', width: 10 },
          { header: 'Reorder Level', key: 'reorder_level', width: 15 },
          { header: 'Nearest Expiry', key: 'nearest_expiry', width: 15 },
        ];
        [data] = await db.query(`
          SELECT p.name, p.category, p.reorder_level,
            COALESCE(SUM(b.quantity_remaining), 0) as total_stock,
            MIN(CASE WHEN b.quantity_remaining > 0 THEN b.expiry_date END) as nearest_expiry
          FROM products p LEFT JOIN batches b ON p.id = b.product_id
          WHERE p.is_active = 1
          GROUP BY p.id, p.name, p.category, p.reorder_level 
          ORDER BY p.name
        `);
        break;

      case 'financial':
        title = 'Financial Report';
        columns = [
          { header: 'Month', key: 'month', width: 15 },
          { header: 'Revenue (KES)', key: 'revenue', width: 18 },
          { header: 'Cost (KES)', key: 'cost', width: 18 },
          { header: 'Profit (KES)', key: 'profit', width: 18 },
          { header: 'Transactions', key: 'transactions', width: 15 },
        ];
        [data] = await db.query(`
          SELECT DATE_FORMAT(created_at, '%Y-%m') as month,
            SUM(total_amount) as revenue, SUM(total_cost) as cost,
            SUM(profit) as profit, COUNT(*) as transactions
          FROM sales WHERE status = 'completed'
          GROUP BY DATE_FORMAT(created_at, '%Y-%m') ORDER BY month DESC
        `);
        break;

      default:
        return res.status(400).json({ error: 'Invalid report type.' });
    }

    switch (type) {
      case 'pdf': {
        const buffer = exportToPDF(data, columns, title);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${report}_report.pdf`);
        res.send(buffer);
        break;
      }
      case 'excel': {
        const buffer = await exportToExcel(data, columns, title);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${report}_report.xlsx`);
        res.send(Buffer.from(buffer));
        break;
      }
      case 'csv': {
        const csv = exportToCSV(data, columns);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=${report}_report.csv`);
        res.send(csv);
        break;
      }
      default:
        res.status(400).json({ error: 'Unsupported export type. Use pdf, excel, or csv.' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Export failed: ' + err.message });
  }
});


module.exports = router;
