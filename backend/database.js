const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'glory_pharmacy.db');

let db;

function getDb() {
    if (!db) {
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');
        initializeDatabase();
    }
    return db;
}

function initializeDatabase() {
    db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('super_admin','store_manager','pharmacist','cashier')),
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- Products table
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      generic_name TEXT,
      brand_name TEXT,
      category TEXT NOT NULL,
      dosage_form TEXT NOT NULL CHECK(dosage_form IN ('Tablet','Syrup','Capsule','Injection','Cream','Other')),
      strength TEXT,
      reorder_level INTEGER DEFAULT 10,
      storage_location TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- Suppliers table
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_person TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- Batches table (tracks stock by batch + expiry)
    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      batch_number TEXT NOT NULL,
      expiry_date TEXT NOT NULL,
      cost_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      quantity_received INTEGER NOT NULL,
      quantity_sold INTEGER DEFAULT 0,
      quantity_damaged INTEGER DEFAULT 0,
      quantity_remaining INTEGER NOT NULL,
      supplier_id INTEGER,
      received_by INTEGER,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (received_by) REFERENCES users(id)
    );

    -- Sales table
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      total_amount REAL NOT NULL,
      total_cost REAL NOT NULL DEFAULT 0,
      profit REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL CHECK(payment_method IN ('cash','mpesa','card')),
      mpesa_phone TEXT,
      mpesa_receipt TEXT,
      status TEXT DEFAULT 'completed' CHECK(status IN ('completed','cancelled','pending')),
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Sale items table
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      batch_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      cost_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id),
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );

    -- Stock adjustments table
    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      batch_id INTEGER,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('damaged','expired','adjustment','return')),
      quantity INTEGER NOT NULL,
      reason TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (batch_id) REFERENCES batches(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Audit logs table
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      action TEXT NOT NULL,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- System settings table
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_batches_product ON batches(product_id);
    CREATE INDEX IF NOT EXISTS idx_batches_expiry ON batches(expiry_date);
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at);
    CREATE INDEX IF NOT EXISTS idx_sales_user ON sales(user_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(created_at);
  `);

    // Insert default settings if not present
    const settingsInsert = db.prepare(
        'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
    );
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
    const insertMany = db.transaction(() => {
        for (const [key, value] of defaultSettings) {
            settingsInsert.run(key, value);
        }
    });
    insertMany();
}

function backupDatabase(targetPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(targetPath, `glory_pharmacy_backup_${timestamp}.db`);
    fs.copyFileSync(DB_PATH, backupFile);
    return backupFile;
}

module.exports = { getDb, backupDatabase, DB_PATH };
