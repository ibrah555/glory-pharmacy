const { getDb } = require('./database');
const bcrypt = require('bcryptjs');

async function checkAdmin() {
    try {
        const db = await getDb();
        const [rows] = await db.query('SELECT * FROM users WHERE username = ?', ['admin']);
        if (rows.length === 0) {
            console.log('Admin user NOT found!');
            // Re-seed admin if missing
            const hashedPassword = await bcrypt.hash('admin123', 10);
            await db.query('INSERT INTO users (username, password_hash, full_name, role, is_active) VALUES (?, ?, ?, ?, ?)',
                ['admin', hashedPassword, 'Super Admin', 'super_admin', 1]);
            console.log('Admin user re-created with password: admin123');
        } else {
            console.log('Admin user found:', rows[0].username, '(Active:', rows[0].is_active, ')');
            const match = await bcrypt.compare('admin123', rows[0].password_hash);
            console.log('Password match test (admin123):', match);
            if (!match || rows[0].is_active !== 1) {
                const hashedPassword = await bcrypt.hash('admin123', 10);
                await db.query('UPDATE users SET password_hash = ?, is_active = 1 WHERE id = ?', [hashedPassword, rows[0].id]);
                console.log('Admin password reset to admin123 and activated.');
            }
        }
        process.exit(0);
    } catch (err) {
        console.error('Error checking admin:', err);
        process.exit(1);
    }
}

checkAdmin();
