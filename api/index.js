const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { getDb, initializeDatabase } = require('./database');

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

// Debug route to see files on Vercel
app.get('/api/debug-files', (req, res) => {
    const getFiles = (dir) => {
        const results = [];
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            file = path.join(dir, file);
            const stat = fs.statSync(file);
            if (stat && stat.isDirectory()) {
                results.push({ name: file, type: 'dir' });
            } else {
                results.push({ name: file, type: 'file', size: stat.size });
            }
        });
        return results;
    };
    try {
        const rootFiles = getFiles(path.join(__dirname, '..'));
        res.json({ root: rootFiles, dirname: __dirname });
    } catch (err) {
        res.json({ error: err.message, dirname: __dirname });
    }
});

// Serve frontend static files in production (only if NOT on Vercel)
if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
    const frontendPath = path.join(__dirname, '..', 'frontend', 'dist');
    app.use(express.static(frontendPath));
    
    // Catch-all: serve index.html for client-side routing
    app.get('*', (req, res) => {
        res.sendFile(path.join(frontendPath, 'index.html'));
    });
}

// Error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Initialize database and start server
async function startServer() {
    try {
        await initializeDatabase();
        console.log('📦 Database initialized and tables verified.');

        if (!process.env.VERCEL) {
            app.listen(PORT, () => {
                console.log(`\n🏥 Glory Pharmacy Management System`);
                console.log(`🌐 Server running on http://localhost:${PORT}`);
                console.log(`📊 API available at http://localhost:${PORT}/api\n`);
            });
        }
    } catch (err) {
        console.error('❌ Failed to initialize database:', err);
        process.exit(1);
    }
}

startServer();

module.exports = app;

