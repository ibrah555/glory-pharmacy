import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { FiDownload } from 'react-icons/fi';

export default function Reports() {
    const { hasRole } = useAuth();
    const [tab, setTab] = useState('sales');
    const [monthly, setMonthly] = useState([]);
    const [topProducts, setTopProducts] = useState([]);
    const [categorySales, setCategorySales] = useState([]);
    const [expiryAlerts, setExpiryAlerts] = useState(null);
    const [lowStock, setLowStock] = useState([]);

    useEffect(() => {
        axios.get('/api/reports/monthly-revenue').then(r => setMonthly(r.data));
        axios.get('/api/reports/top-products?limit=10&days=365').then(r => setTopProducts(r.data));
        axios.get('/api/reports/category-sales?days=365').then(r => setCategorySales(r.data));
        axios.get('/api/inventory/expiry-alerts').then(r => setExpiryAlerts(r.data));
        axios.get('/api/inventory/low-stock').then(r => setLowStock(r.data));
    }, []);

    const exportReport = (type, report) => {
        window.open(`/api/reports/export/${type}?report=${report}`, '_blank');
    };

    const fmt = (n) => Number(n || 0).toLocaleString('en-KE');

    const monthlyData = {
        labels: monthly.map(m => m.month),
        datasets: [
            {
                label: 'Revenue (KES)',
                data: monthly.map(m => m.revenue),
                borderColor: '#1B5E20',
                backgroundColor: 'rgba(27,94,32,0.1)',
                fill: true,
                tension: 0.4,
            },
            ...(hasRole('super_admin') ? [{
                label: 'Profit (KES)',
                data: monthly.map(m => m.profit),
                borderColor: '#1565C0',
                backgroundColor: 'rgba(21,101,192,0.1)',
                fill: true,
                tension: 0.4,
            }] : [])
        ],
    };

    return (
        <>
            <div className="page-header">
                <div><h1>Reports &amp; Analytics</h1><p>Comprehensive pharmacy business reports</p></div>
                <div className="btn-group">
                    <button className="btn btn-sm btn-secondary" onClick={() => exportReport('pdf', tab)}>
                        <FiDownload /> PDF
                    </button>
                    <button className="btn btn-sm btn-secondary" onClick={() => exportReport('excel', tab)}>
                        <FiDownload /> Excel
                    </button>
                    <button className="btn btn-sm btn-secondary" onClick={() => exportReport('csv', tab)}>
                        <FiDownload /> CSV
                    </button>
                </div>
            </div>
            <div className="page-body">
                <div className="tabs">
                    {['sales', 'inventory', 'financial'].map(t => (
                        <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                            {t === 'sales' ? '📊 Sales' : t === 'inventory' ? '📦 Inventory' : '💰 Financial'}
                        </button>
                    ))}
                </div>

                {tab === 'sales' && (
                    <div>
                        <div className="grid-2 mb-24">
                            <div className="card">
                                <div className="card-header"><h3>🏆 Top Selling Products (Year)</h3></div>
                                <div className="card-body"><div className="chart-container"><Bar data={{
                                    labels: topProducts.map(p => p.name),
                                    datasets: [{ label: 'Units Sold', data: topProducts.map(p => p.total_qty), backgroundColor: '#2E7D32', borderRadius: 6 }]
                                }} options={{ responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } } }} /></div></div>
                            </div>
                            <div className="card">
                                <div className="card-header"><h3>📊 Sales by Category</h3></div>
                                <div className="card-body"><div className="chart-container"><Pie data={{
                                    labels: categorySales.map(c => c.category),
                                    datasets: [{ data: categorySales.map(c => c.total_revenue), backgroundColor: ['#1B5E20', '#1565C0', '#F57F17', '#C62828', '#6A1B9A', '#00695C', '#E65100', '#37474F'] }]
                                }} options={{ responsive: true, maintainAspectRatio: false }} /></div></div>
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'inventory' && (
                    <div>
                        {expiryAlerts && (
                            <div className="grid-3 mb-24">
                                <div className="card">
                                    <div className="card-header"><h3 style={{ color: 'var(--danger)' }}>❌ Expired ({expiryAlerts.expired.length})</h3></div>
                                    <div className="card-body" style={{ maxHeight: 300, overflowY: 'auto' }}>
                                        {expiryAlerts.expired.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>No expired drugs</p> :
                                            expiryAlerts.expired.map(b => (
                                                <div key={b.id} className="alert-card danger" style={{ marginBottom: 6 }}>
                                                    <div><strong>{b.product_name}</strong> • Batch: {b.batch_number} • Qty: {b.quantity_remaining} • Expired: {b.expiry_date}</div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                                <div className="card">
                                    <div className="card-header"><h3 style={{ color: 'var(--warning)' }}>⚠️ Expiring 3 months ({expiryAlerts.expiring3months.length})</h3></div>
                                    <div className="card-body" style={{ maxHeight: 300, overflowY: 'auto' }}>
                                        {expiryAlerts.expiring3months.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>None</p> :
                                            expiryAlerts.expiring3months.map(b => (
                                                <div key={b.id} className="alert-card warning" style={{ marginBottom: 6 }}>
                                                    <div><strong>{b.product_name}</strong> • Batch: {b.batch_number} • Qty: {b.quantity_remaining} • Expiry: {b.expiry_date}</div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                                <div className="card">
                                    <div className="card-header"><h3 style={{ color: 'var(--info)' }}>ℹ️ Expiring 6 months ({expiryAlerts.expiring6months.length})</h3></div>
                                    <div className="card-body" style={{ maxHeight: 300, overflowY: 'auto' }}>
                                        {expiryAlerts.expiring6months.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>None</p> :
                                            expiryAlerts.expiring6months.map(b => (
                                                <div key={b.id} className="alert-card info" style={{ marginBottom: 6 }}>
                                                    <div><strong>{b.product_name}</strong> • Batch: {b.batch_number} • Qty: {b.quantity_remaining} • Expiry: {b.expiry_date}</div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="card">
                            <div className="card-header"><h3>📦 Low Stock Items ({lowStock.length})</h3></div>
                            <div className="table-container">
                                <table>
                                    <thead><tr><th>Product</th><th>Category</th><th>Current Stock</th><th>Reorder Level</th><th>Status</th></tr></thead>
                                    <tbody>
                                        {lowStock.length === 0 ? <tr><td colSpan="5" style={{ textAlign: 'center', padding: 30 }}>All products well stocked</td></tr> :
                                            lowStock.map(p => (
                                                <tr key={p.id}>
                                                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                                                    <td><span className="badge badge-default">{p.category}</span></td>
                                                    <td style={{ fontWeight: 700, color: 'var(--danger)' }}>{p.total_stock}</td>
                                                    <td>{p.reorder_level}</td>
                                                    <td><span className="badge badge-danger">Low Stock</span></td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'financial' && (
                    <div>
                        <div className="card mb-24">
                            <div className="card-header"><h3>💰 Monthly Revenue &amp; Profit</h3></div>
                            <div className="card-body"><div className="chart-container" style={{ height: 350 }}>
                                <Line data={monthlyData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }} />
                            </div></div>
                        </div>

                        <div className="card">
                            <div className="card-header"><h3>📅 Monthly Breakdown</h3></div>
                            <div className="table-container">
                                <table>
                                    <thead><tr><th>Month</th><th>Revenue</th>{hasRole('super_admin') && <><th>Profit</th><th>Margin</th></>}<th>Transactions</th></tr></thead>
                                    <tbody>
                                        {monthly.map(m => (
                                            <tr key={m.month}>
                                                <td style={{ fontWeight: 600 }}>{m.month}</td>
                                                <td>KES {fmt(m.revenue)}</td>
                                                {hasRole('super_admin') && (
                                                    <>
                                                        <td style={{ color: 'var(--success)' }}>KES {fmt(m.profit)}</td>
                                                        <td>{m.revenue ? Math.round((m.profit / m.revenue) * 100) : 0}%</td>
                                                    </>
                                                )}
                                                <td>{m.transactions}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
