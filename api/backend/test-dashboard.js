const axios = require('axios');

async function test() {
    try {
        const loginRes = await axios.post('http://localhost:5001/api/auth/login', {
            username: 'admin',
            password: 'admin123'
        });
        const token = loginRes.data.token;
        console.log('Login successful');

        const config = { headers: { Authorization: `Bearer ${token}` } };

        // Test the dashboard endpoints that the UI tests
        const endpoints = [
            '/api/reports/dashboard',
            '/api/reports/sales-trend?days=30',
            '/api/reports/top-products?limit=8',
            '/api/reports/category-sales',
            '/api/reports/smart-insights'
        ];

        for (const ep of endpoints) {
            try {
                const res = await axios.get(`http://localhost:5001${ep}`, config);
                console.log(`[OK] ${ep}`);
            } catch (err) {
                console.error(`[ERROR] ${ep}:`, err.response ? err.response.data : err.message);
            }
        }
    } catch (err) {
        console.error('Failed to run test:', err.response ? err.response.data : err.message);
    }
}

test();
