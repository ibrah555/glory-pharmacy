const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.MYSQLHOST || process.env.DB_HOST || '127.0.0.1',
  user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'glory_pharmacy',
  port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: (process.env.MYSQL_URL || process.env.DB_SSL === 'true') ? {
    rejectUnauthorized: false
  } : null
});

async function getDb() {
  return pool;
}

async function initializeDatabase() {
  const db = await getDb();

  // Create tables using MySQL syntax
  await db.query(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(255) UNIQUE NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('super_admin','store_manager','pharmacist','cashier') NOT NULL,
      is_active TINYINT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

  await db.query(`
    -- Products table
    CREATE TABLE IF NOT EXISTS products (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      generic_name VARCHAR(255),
      brand_name VARCHAR(255),
      category VARCHAR(255) NOT NULL,
      dosage_form ENUM('Tablet','Syrup','Capsule','Injection','Cream','Other') NOT NULL,
      strength VARCHAR(255),
      reorder_level INT DEFAULT 10,
      storage_location VARCHAR(255),
      is_active TINYINT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

  await db.query(`
    -- Suppliers table
    CREATE TABLE IF NOT EXISTS suppliers (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      contact_person VARCHAR(255),
      phone VARCHAR(50),
      email VARCHAR(255),
      address TEXT,
      is_active TINYINT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

  await db.query(`
    -- Batches table
    CREATE TABLE IF NOT EXISTS batches (
      id INT PRIMARY KEY AUTO_INCREMENT,
      product_id INT NOT NULL,
      batch_number VARCHAR(255) NOT NULL,
      expiry_date DATE NOT NULL,
      cost_price DECIMAL(10,2) NOT NULL,
      selling_price DECIMAL(10,2) NOT NULL,
      quantity_received INT NOT NULL,
      quantity_sold INT DEFAULT 0,
      quantity_damaged INT DEFAULT 0,
      quantity_remaining INT NOT NULL,
      supplier_id INT,
      received_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (received_by) REFERENCES users(id)
    )`);

  await db.query(`
    -- Sales table
    CREATE TABLE IF NOT EXISTS sales (
      id INT PRIMARY KEY AUTO_INCREMENT,
      transaction_id VARCHAR(50) UNIQUE NOT NULL,
      user_id INT NOT NULL,
      total_amount DECIMAL(10,2) NOT NULL,
      total_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
      profit DECIMAL(10,2) NOT NULL DEFAULT 0,
      payment_method ENUM('cash','mpesa','card') NOT NULL,
      mpesa_phone VARCHAR(20),
      mpesa_receipt VARCHAR(50),
      status ENUM('completed','cancelled','pending') DEFAULT 'completed',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

  await db.query(`
    -- Sale items table
    CREATE TABLE IF NOT EXISTS sale_items (
      id INT PRIMARY KEY AUTO_INCREMENT,
      sale_id INT NOT NULL,
      product_id INT NOT NULL,
      batch_id INT NOT NULL,
      quantity INT NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL,
      cost_price DECIMAL(10,2) NOT NULL,
      subtotal DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    )`);

  await db.query(`
    -- Stock adjustments table
    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id INT PRIMARY KEY AUTO_INCREMENT,
      product_id INT NOT NULL,
      batch_id INT,
      user_id INT NOT NULL,
      type ENUM('damaged','expired','adjustment','return') NOT NULL,
      quantity INT NOT NULL,
      reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

  await db.query(`
    -- Audit logs table
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT,
      username VARCHAR(255),
      action VARCHAR(255) NOT NULL,
      details TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

  await db.query(`
    -- System settings table
    CREATE TABLE IF NOT EXISTS settings (
      setting_key VARCHAR(255) PRIMARY KEY,
      setting_value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

  // Insert default settings
  const defaultSettings = [
    ['pharmacy_name', 'Glory Pharmacy'],
    ['pharmacy_location', 'Hola, Tana River County, Kenya'],
    ['pharmacy_phone', ''],
    ['pharmacy_email', ''],
    ['mpesa_consumer_key', ''],
    ['mpesa_consumer_secret', ''],
    ['mpesa_shortcode', ''],
    ['mpesa_passkey', ''],
    ['mpesa_environment', 'sandbox'],
    ['backup_path', ''],
    ['expiry_alert_months', '3'],
  ];

  for (const [key, value] of defaultSettings) {
    await db.query('INSERT IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)', [key, value]);
  }
}

module.exports = { getDb, initializeDatabase };

