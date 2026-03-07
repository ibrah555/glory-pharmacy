const express = require('express');
const { getDb } = require('../database');
const { authenticateToken, authorize } = require('../middleware/auth');
const { exportToExcel, exportToPDF, exportToCSV } = require('../utils/export');

const router = express.Router();

// GET /api/reports/dashboard — main dashboard metrics
router.get('/dashboard', authenticateToken, (req, res) => {
  const db = getDb();

  const today = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue, COALESCE(SUM(profit), 0) as profit
    FROM sales WHERE date(created_at) = date('now','localtime') AND status = 'completed'
  `).get();

  const week = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue, COALESCE(SUM(profit), 0) as profit
    FROM sales WHERE created_at >= date('now','localtime','-7 days') AND status = 'completed'
  `).get();

  const month = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue, COALESCE(SUM(profit), 0) as profit
    FROM sales WHERE created_at >= date('now','localtime','start of month') AND status = 'completed'
  `).get();

  const inventoryValue = db.prepare(`
    SELECT COALESCE(SUM(b.quantity_remaining * b.selling_price), 0) as retail_value,
           COALESCE(SUM(b.quantity_remaining * b.cost_price), 0) as cost_value
    FROM batches b WHERE b.quantity_remaining > 0
  `).get();

  const lowStockCount = db.prepare(`
    SELECT COUNT(*) as count FROM (
      SELECT p.id FROM products p
      LEFT JOIN batches b ON p.id = b.product_id
      WHERE p.is_active = 1
      GROUP BY p.id
      HAVING COALESCE(SUM(b.quantity_remaining), 0) <= p.reorder_level
    )
  `).get();

  const expiringCount = db.prepare(`
    SELECT COUNT(*) as count FROM batches
    WHERE expiry_date <= date('now', '+3 months') AND quantity_remaining > 0
  `).get();

  const expiredCount = db.prepare(`
    SELECT COUNT(*) as count FROM batches
    WHERE expiry_date < date('now') AND quantity_remaining > 0
  `).get();

  const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 1').get();

  const recentSales = db.prepare(`
    SELECT s.*, u.full_name as cashier_name
    FROM sales s JOIN users u ON s.user_id = u.id
    WHERE s.status = 'completed'
    ORDER BY s.created_at DESC LIMIT 10
  `).all();

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
});

// GET /api/reports/sales-trend — daily sales for the last 30 days
router.get('/sales-trend', authenticateToken, (req, res) => {
  const { days = 30 } = req.query;
  const db = getDb();
  const data = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as transactions,
      SUM(total_amount) as revenue, SUM(profit) as profit
    FROM sales
    WHERE created_at >= date('now','localtime', '-${parseInt(days)} days') AND status = 'completed'
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all();
  res.json(data);
});

// GET /api/reports/top-products — top selling products
router.get('/top-products', authenticateToken, (req, res) => {
  const { limit = 10, days = 30 } = req.query;
  const db = getDb();
  const data = db.prepare(`
    SELECT p.name, p.category, SUM(si.quantity) as total_qty, SUM(si.subtotal) as total_revenue
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    JOIN sales s ON si.sale_id = s.id
    WHERE s.created_at >= date('now','localtime', '-${parseInt(days)} days') AND s.status = 'completed'
    GROUP BY p.id
    ORDER BY total_qty DESC
    LIMIT ?
  `).all(parseInt(limit));
  res.json(data);
});

// GET /api/reports/category-sales — sales by category
router.get('/category-sales', authenticateToken, (req, res) => {
  const { days = 30 } = req.query;
  const db = getDb();
  const data = db.prepare(`
    SELECT p.category, SUM(si.quantity) as total_qty, SUM(si.subtotal) as total_revenue
    FROM sale_items si
    JOIN products p ON si.product_id = p.id
    JOIN sales s ON si.sale_id = s.id
    WHERE s.created_at >= date('now','localtime', '-${parseInt(days)} days') AND s.status = 'completed'
    GROUP BY p.category
    ORDER BY total_revenue DESC
  `).all();
  res.json(data);
});

// GET /api/reports/monthly-revenue — monthly revenue for past year
router.get('/monthly-revenue', authenticateToken, (req, res) => {
  const db = getDb();
  const data = db.prepare(`
    SELECT strftime('%Y-%m', created_at) as month,
      SUM(total_amount) as revenue, SUM(profit) as profit, COUNT(*) as transactions
    FROM sales
    WHERE created_at >= date('now','localtime', '-12 months') AND status = 'completed'
    GROUP BY strftime('%Y-%m', created_at)
    ORDER BY month ASC
  `).all();
  res.json(data);
});

// GET /api/reports/sales — detailed sales report with filters
router.get('/sales', authenticateToken, (req, res) => {
  const { start_date, end_date, product_id, category, user_id, payment_method } = req.query;
  const db = getDb();

  let query = `
    SELECT s.*, u.full_name as cashier_name
    FROM sales s JOIN users u ON s.user_id = u.id
    WHERE s.status = 'completed'
  `;
  const params = [];

  if (start_date) { query += ' AND date(s.created_at) >= ?'; params.push(start_date); }
  if (end_date) { query += ' AND date(s.created_at) <= ?'; params.push(end_date); }
  if (user_id) { query += ' AND s.user_id = ?'; params.push(user_id); }
  if (payment_method) { query += ' AND s.payment_method = ?'; params.push(payment_method); }

  if (product_id || category) {
    query += ` AND s.id IN (SELECT DISTINCT si.sale_id FROM sale_items si JOIN products p ON si.product_id = p.id WHERE 1=1`;
    if (product_id) { query += ' AND si.product_id = ?'; params.push(product_id); }
    if (category) { query += ' AND p.category = ?'; params.push(category); }
    query += ')';
  }

  query += ' ORDER BY s.created_at DESC LIMIT 500';

  const sales = db.prepare(query).all(...params);
  res.json(sales);
});

// GET /api/reports/smart-insights — AI-like stock intelligence
router.get('/smart-insights', authenticateToken, (req, res) => {
  const db = getDb();
  const insights = [];

  // Fast movers: products with >50% increase in sales
  const fastMovers = db.prepare(`
    SELECT * FROM (
      SELECT p.name,
        COALESCE((SELECT SUM(si.quantity) FROM sale_items si JOIN sales s ON si.sale_id = s.id
          WHERE si.product_id = p.id AND s.created_at >= date('now','-15 days') AND s.status='completed'), 0) as recent_sales,
        COALESCE((SELECT SUM(si.quantity) FROM sale_items si JOIN sales s ON si.sale_id = s.id
          WHERE si.product_id = p.id AND s.created_at >= date('now','-30 days') AND s.created_at < date('now','-15 days') AND s.status='completed'), 0) as prev_sales
      FROM products p WHERE p.is_active = 1
    )
    WHERE recent_sales > 0 AND prev_sales > 0 AND (recent_sales * 1.0 / prev_sales) > 1.25
  `).all();

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
  const deadStock = db.prepare(`
    SELECT p.name, COALESCE(SUM(b.quantity_remaining), 0) as stock
    FROM products p
    LEFT JOIN batches b ON p.id = b.product_id
    WHERE p.is_active = 1
    AND p.id NOT IN (
      SELECT DISTINCT si.product_id FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.created_at >= date('now','-30 days') AND s.status = 'completed'
    )
    GROUP BY p.id
    HAVING stock > 0
  `).all();

  for (const ds of deadStock) {
    insights.push({
      type: 'dead_stock',
      icon: '⚠️',
      message: `${ds.name} has not sold in the last 30 days (${ds.stock} units in stock).`,
      severity: 'warning',
    });
  }

  // Suspicious activity checks
  const suspiciousCancels = db.prepare(`
    SELECT u.full_name, COUNT(*) as cancel_count
    FROM audit_logs a JOIN users u ON a.user_id = u.id
    WHERE a.action = 'SALE_CANCEL' AND a.created_at >= date('now','-1 day')
    GROUP BY a.user_id
    HAVING cancel_count >= 5
  `).all();

  for (const sc of suspiciousCancels) {
    insights.push({
      type: 'suspicious',
      icon: '🚨',
      message: `${sc.full_name} cancelled ${sc.cancel_count} transactions today.`,
      severity: 'critical',
    });
  }

  const suspiciousAdjustments = db.prepare(`
    SELECT u.full_name, COUNT(*) as adj_count
    FROM stock_adjustments sa JOIN users u ON sa.user_id = u.id
    WHERE sa.created_at >= date('now','-1 day')
    GROUP BY sa.user_id
    HAVING adj_count >= 10
  `).all();

  for (const sa of suspiciousAdjustments) {
    insights.push({
      type: 'suspicious',
      icon: '🚨',
      message: `${sa.full_name} made ${sa.adj_count} stock adjustments today.`,
      severity: 'critical',
    });
  }

  res.json(insights);
});

// GET /api/reports/export/:type — export report data
router.get('/export/:type', authenticateToken, authorize('super_admin', 'store_manager'), async (req, res) => {
  const { type } = req.params;
  const { report, ...filters } = req.query;
  const db = getDb();

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
      data = db.prepare(`
        SELECT s.transaction_id, s.created_at, u.full_name as cashier_name,
          s.total_amount, s.profit, s.payment_method
        FROM sales s JOIN users u ON s.user_id = u.id
        WHERE s.status = 'completed'
        ORDER BY s.created_at DESC LIMIT 1000
      `).all();
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
      data = db.prepare(`
        SELECT p.name, p.category, p.reorder_level,
          COALESCE(SUM(b.quantity_remaining), 0) as total_stock,
          MIN(CASE WHEN b.quantity_remaining > 0 THEN b.expiry_date END) as nearest_expiry
        FROM products p LEFT JOIN batches b ON p.id = b.product_id
        WHERE p.is_active = 1
        GROUP BY p.id ORDER BY p.name
      `).all();
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
      data = db.prepare(`
        SELECT strftime('%Y-%m', created_at) as month,
          SUM(total_amount) as revenue, SUM(total_cost) as cost,
          SUM(profit) as profit, COUNT(*) as transactions
        FROM sales WHERE status = 'completed'
        GROUP BY strftime('%Y-%m', created_at) ORDER BY month DESC
      `).all();
      break;

    default:
      return res.status(400).json({ error: 'Invalid report type.' });
  }

  try {
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
