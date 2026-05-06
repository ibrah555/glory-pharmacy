const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: {
    rejectUnauthorized: false
  }
});

async function getDb() {
  // Wrapper to simulate mysql2's [rows] return pattern
  return {
    query: async (text, params) => {
      const res = await pool.query(text, params);
      return [res.rows, res.fields];
    },
    getConnection: async () => {
      const client = await pool.connect();
      return {
        query: async (text, params) => {
          const res = await client.query(text, params);
          return [res.rows, res.fields];
        },
        beginTransaction: () => client.query('BEGIN'),
        commit: () => client.query('COMMIT'),
        rollback: () => client.query('ROLLBACK'),
        release: () => client.release()
      };
    }
  };
}

async function initializeDatabase() {
  const db = await getDb();

  // Create helper for ON UPDATE CURRENT_TIMESTAMP in PostgreSQL
  await db.query(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ language 'plpgsql';
  `);

  // Users table
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) UNIQUE NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) CHECK (role IN ('super_admin','store_manager','pharmacist','cashier')) NOT NULL,
      is_active SMALLINT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

  // Products table
  await db.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      generic_name VARCHAR(255),
      brand_name VARCHAR(255),
      category VARCHAR(255) NOT NULL,
      dosage_form VARCHAR(50) CHECK (dosage_form IN ('Tablet','Syrup','Capsule','Injection','Cream','Other')) NOT NULL,
      strength VARCHAR(255),
      reorder_level INT DEFAULT 10,
      storage_location VARCHAR(255),
      is_active SMALLINT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

  // Suppliers table
  await db.query(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      contact_person VARCHAR(255),
      phone VARCHAR(50),
      email VARCHAR(255),
      address TEXT,
      is_active SMALLINT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

  // Batches table
  await db.query(`
    CREATE TABLE IF NOT EXISTS batches (
      id SERIAL PRIMARY KEY,
      product_id INT NOT NULL REFERENCES products(id),
      batch_number VARCHAR(255) NOT NULL,
      expiry_date DATE NOT NULL,
      cost_price DECIMAL(10,2) NOT NULL,
      selling_price DECIMAL(10,2) NOT NULL,
      quantity_received INT NOT NULL,
      quantity_sold INT DEFAULT 0,
      quantity_damaged INT DEFAULT 0,
      quantity_remaining INT NOT NULL,
      supplier_id INT REFERENCES suppliers(id),
      received_by INT REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

  // Sales table
  await db.query(`
    CREATE TABLE IF NOT EXISTS sales (
      id SERIAL PRIMARY KEY,
      transaction_id VARCHAR(50) UNIQUE NOT NULL,
      user_id INT NOT NULL REFERENCES users(id),
      total_amount DECIMAL(10,2) NOT NULL,
      total_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
      profit DECIMAL(10,2) NOT NULL DEFAULT 0,
      payment_method VARCHAR(20) CHECK (payment_method IN ('cash','mpesa','card')) NOT NULL,
      mpesa_phone VARCHAR(20),
      mpesa_receipt VARCHAR(50),
      status VARCHAR(20) CHECK (status IN ('completed','cancelled','pending')) DEFAULT 'completed',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

  // Sale items table
  await db.query(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id SERIAL PRIMARY KEY,
      sale_id INT NOT NULL REFERENCES sales(id),
      product_id INT NOT NULL REFERENCES products(id),
      batch_id INT NOT NULL REFERENCES batches(id),
      quantity INT NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL,
      cost_price DECIMAL(10,2) NOT NULL,
      subtotal DECIMAL(10,2) NOT NULL
    )`);

  // Stock adjustments table
  await db.query(`
    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id SERIAL PRIMARY KEY,
      product_id INT NOT NULL REFERENCES products(id),
      batch_id INT REFERENCES batches(id),
      user_id INT NOT NULL REFERENCES users(id),
      type VARCHAR(20) CHECK (type IN ('damaged','expired','adjustment','return')) NOT NULL,
      quantity INT NOT NULL,
      reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

  // Audit logs table
  await db.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id),
      username VARCHAR(255),
      action VARCHAR(255) NOT NULL,
      details TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

  // System settings table
  await db.query(`
    CREATE TABLE IF NOT EXISTS settings (
      setting_key VARCHAR(255) PRIMARY KEY,
      setting_value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

  // Add triggers for updated_at
  const tablesWithUpdatedAt = ['users', 'products', 'settings'];
  for (const table of tablesWithUpdatedAt) {
    await db.query(`DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table}`);
    await db.query(`
      CREATE TRIGGER update_${table}_updated_at
      BEFORE UPDATE ON ${table}
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `);
  }

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
    await db.query(`
      INSERT INTO settings (setting_key, setting_value)
      VALUES ($1, $2)
      ON CONFLICT (setting_key) DO NOTHING
    `, [key, value]);
  }
}

module.exports = { getDb, initializeDatabase };
