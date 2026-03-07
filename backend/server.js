const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./database');

const authRoutes = require('./routes/auth');
const inventoryRoutes = require('./routes/inventory');
const supplierRoutes = require('./routes/suppliers');
const posRoutes = require('./routes/pos');
const reportRoutes = require('./routes/reports');
const auditRoutes = require('./routes/audit');
const backupRoutes = require('./routes/backup');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/backup', backupRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', name: 'Glory Pharmacy Management System', version: '1.0.0' });
});

// Error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start server
async function startServer() {
    try {
        await getDb();
        console.log('📦 Database initialized.');

        app.listen(PORT, () => {
            console.log(`\n🏥 Glory Pharmacy Management System`);
            console.log(`🌐 Server running on http://localhost:${PORT}`);
            console.log(`📊 API available at http://localhost:${PORT}/api\n`);
        });
    } catch (err) {
        console.error('❌ Failed to initialize database:', err);
        process.exit(1);
    }
}

startServer();

module.exports = app;

