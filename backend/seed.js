const bcrypt = require('bcryptjs');
const { getDb } = require('./database');

function seed() {
    const db = getDb();

    // Check if admin already exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    if (existing) {
        console.log('✅ Super Admin already exists. Skipping seed.');
        return;
    }

    const passwordHash = bcrypt.hashSync('admin123', 10);

    db.prepare(`
    INSERT INTO users (username, full_name, password_hash, role)
    VALUES (?, ?, ?, ?)
  `).run('admin', 'Super Administrator', passwordHash, 'super_admin');

    console.log('✅ Default Super Admin created:');
    console.log('   Username: admin');
    console.log('   Password: admin123');

    // Seed some sample suppliers
    const supplierInsert = db.prepare(`
    INSERT INTO suppliers (name, contact_person, phone, email, address)
    VALUES (?, ?, ?, ?, ?)
  `);

    const suppliers = [
        ['Kenya Medical Supplies', 'James Mwangi', '+254712345678', 'james@kms.co.ke', 'Nairobi, Kenya'],
        ['PharmAccess Kenya', 'Sarah Wanjiku', '+254723456789', 'sarah@pharmaccess.ke', 'Mombasa, Kenya'],
        ['MediPharma Distributors', 'Peter Ochieng', '+254734567890', 'peter@medipharma.ke', 'Kisumu, Kenya'],
    ];

    const insertSuppliers = db.transaction(() => {
        for (const s of suppliers) {
            supplierInsert.run(...s);
        }
    });
    insertSuppliers();
    console.log('✅ Sample suppliers created.');

    // Seed some sample products and batches
    const productInsert = db.prepare(`
    INSERT INTO products (name, generic_name, brand_name, category, dosage_form, strength, reorder_level, storage_location)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

    const batchInsert = db.prepare(`
    INSERT INTO batches (product_id, batch_number, expiry_date, cost_price, selling_price, quantity_received, quantity_remaining, supplier_id, received_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

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

    const insertProducts = db.transaction(() => {
        for (const p of sampleProducts) {
            const result = productInsert.run(...p);
            const productId = result.lastInsertRowid;

            // Create 2 batches per product with different expiry dates
            batchInsert.run(productId, `B2026-${String(productId).padStart(3, '0')}A`, '2027-06-30', p[0] === 'Paracetamol' ? 5 : 30 + Math.floor(Math.random() * 50), p[0] === 'Paracetamol' ? 10 : 50 + Math.floor(Math.random() * 100), 200, 200, 1, 1);
            batchInsert.run(productId, `B2025-${String(productId).padStart(3, '0')}B`, '2026-09-30', p[0] === 'Paracetamol' ? 4 : 25 + Math.floor(Math.random() * 40), p[0] === 'Paracetamol' ? 10 : 45 + Math.floor(Math.random() * 90), 150, 150, 2, 1);
        }
    });
    insertProducts();
    console.log('✅ Sample products and batches created.');

    // Log the seed action
    db.prepare(`
    INSERT INTO audit_logs (user_id, username, action, details)
    VALUES (?, ?, ?, ?)
  `).run(1, 'admin', 'SYSTEM_SEED', 'Database seeded with default data');

    console.log('\n🏥 Glory Pharmacy System seeded successfully!');
}

seed();
