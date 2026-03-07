const bcrypt = require('bcryptjs');
const { getDb } = require('./database');

async function seed() {
  try {
    const db = await getDb();

    // Check if admin already exists
    const [rows] = await db.query('SELECT id FROM users WHERE username = ?', ['admin']);
    if (rows.length > 0) {
      console.log('✅ Super Admin already exists. Skipping seed.');
      return;
    }

    const passwordHash = await bcrypt.hash('admin123', 10);

    await db.query(`
      INSERT INTO users (username, full_name, password_hash, role)
      VALUES (?, ?, ?, ?)
    `, ['admin', 'Super Administrator', passwordHash, 'super_admin']);

    console.log('✅ Default Super Admin created:');
    console.log('   Username: admin');
    console.log('   Password: admin123');

    // Seed some sample suppliers
    const suppliers = [
      ['Kenya Medical Supplies', 'James Mwangi', '+254712345678', 'james@kms.co.ke', 'Nairobi, Kenya'],
      ['PharmAccess Kenya', 'Sarah Wanjiku', '+254723456789', 'sarah@pharmaccess.ke', 'Mombasa, Kenya'],
      ['MediPharma Distributors', 'Peter Ochieng', '+254734567890', 'peter@medipharma.ke', 'Kisumu, Kenya'],
    ];

    for (const s of suppliers) {
      await db.query(`
        INSERT INTO suppliers (name, contact_person, phone, email, address)
        VALUES (?, ?, ?, ?, ?)
      `, s);
    }
    console.log('✅ Sample suppliers created.');

    // Seed some sample products and batches
    const sampleProducts = [
      ['Paracetamol', 'Paracetamol', 'Hedex', 'Painkillers', 'Tablet', '500mg', 50, 'Shelf A1'],
      ['Amoxicillin', 'Amoxicillin', 'Amoxil', 'Antibiotics', 'Capsule', '500mg', 30, 'Shelf A2'],
      ['Ibuprofen', 'Ibuprofen', 'Brufen', 'Painkillers', 'Tablet', '400mg', 40, 'Shelf A1'],
      ['Metformin', 'Metformin', 'Glucophage', 'Antidiabetics', 'Tablet', '500mg', 20, 'Shelf B1'],
      ['Cough Syrup', 'Dextromethorphan', 'Benylin', 'Cough & Cold', 'Syrup', '15mg/5ml', 15, 'Shelf C1'],
      ['Ciprofloxacin', 'Ciprofloxacin', 'Cipro', 'Antibiotics', 'Tablet', '500mg', 25, 'Shelf A2'],
      ['Omeprazole', 'Omeprazole', 'Losec', 'Antacids', 'Capsule', '20mg', 20, 'Shelf B2'],
      ['Artemether/Lumefantrine', 'AL', 'Coartem', 'Antimalarials', 'Tablet', '20/120mg', 30, 'Shelf A3'],
      ['Diclofenac Gel', 'Diclofenac', 'Voltaren', 'Painkillers', 'Cream', '1%', 10, 'Shelf D1'],
      ['Vitamin C', 'Ascorbic Acid', 'Cevit', 'Vitamins', 'Tablet', '1000mg', 20, 'Shelf C2'],
    ];

    for (const p of sampleProducts) {
      const [result] = await db.query(`
        INSERT INTO products (name, generic_name, brand_name, category, dosage_form, strength, reorder_level, storage_location)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, p);
      const productId = result.insertId;

      // Create 2 batches per product with different expiry dates
      await db.query(`
        INSERT INTO batches (product_id, batch_number, expiry_date, cost_price, selling_price, quantity_received, quantity_remaining, supplier_id, received_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [productId, `B2026-${String(productId).padStart(3, '0')}A`, '2027-06-30', p[0] === 'Paracetamol' ? 5 : 30 + Math.floor(Math.random() * 50), p[0] === 'Paracetamol' ? 10 : 50 + Math.floor(Math.random() * 100), 200, 200, 1, 1]);

      await db.query(`
        INSERT INTO batches (product_id, batch_number, expiry_date, cost_price, selling_price, quantity_received, quantity_remaining, supplier_id, received_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [productId, `B2025-${String(productId).padStart(3, '0')}B`, '2026-09-30', p[0] === 'Paracetamol' ? 4 : 25 + Math.floor(Math.random() * 40), p[0] === 'Paracetamol' ? 10 : 45 + Math.floor(Math.random() * 90), 150, 150, 2, 1]);
    }
    console.log('✅ Sample products and batches created.');

    // Log the seed action
    await db.query(`
      INSERT INTO audit_logs (user_id, username, action, details)
      VALUES (?, ?, ?, ?)
    `, [1, 'admin', 'SYSTEM_SEED', 'Database seeded with default data']);

    console.log('\n🏥 Glory Pharmacy System seeded successfully!');
  } catch (err) {
    console.error('❌ Seeding failed:', err);
  }
}

seed();

