import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Line, Bar, Pie, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { FiDollarSign, FiShoppingCart, FiPackage, FiAlertTriangle, FiTrendingUp, FiActivity } from 'react-icons/fi';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

export default function Dashboard() {
    const { hasRole } = useAuth();
    const [data, setData] = useState(null);
    const [trend, setTrend] = useState([]);
    const [topProducts, setTopProducts] = useState([]);
    const [categorySales, setCategorySales] = useState([]);
    const [insights, setInsights] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Load main dashboard metrics
        axios.get('/api/reports/dashboard').then(res => {
            setData(res.data);
            setLoading(false);
        }).catch(() => setLoading(false));

        // Load other data independently
        axios.get('/api/reports/sales-trend?days=30').then(res => setTrend(res.data));
        axios.get('/api/reports/top-products?limit=8').then(res => setTopProducts(res.data));
        axios.get('/api/reports/category-sales').then(res => setCategorySales(res.data));
        axios.get('/api/reports/smart-insights').then(res => setInsights(res.data));
    }, []);

    if (loading) return <div className="loading"><div className="spinner"></div>Loading dashboard metrics...</div>;
    // Show empty state only if primary metrics fail
    if (!data) return <div className="empty-state"><h3>Welcome to Glory Pharmacy Management</h3><p>Could not load live metrics. Please check your connection.</p></div>;

    const trendData = {
        labels: (trend || []).map(d => new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })),
        datasets: [
            {
                label: 'Revenue (KES)',
                data: (trend || []).map(d => d.revenue),
                borderColor: '#1B5E20',
                backgroundColor: 'rgba(27,94,32,0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 3,
            },
            ...(hasRole('super_admin') ? [{
                label: 'Profit (KES)',
                data: trend.map(d => d.profit),
                borderColor: '#1565C0',
                backgroundColor: 'rgba(21,101,192,0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 3,
            }] : [])
        ],
    };

    const topData = {
        labels: (topProducts || []).map(p => p.name),
        datasets: [{
            label: 'Units Sold',
            data: (topProducts || []).map(p => p.total_qty),
            backgroundColor: ['#1B5E20', '#2E7D32', '#388E3C', '#43A047', '#4CAF50', '#66BB6A', '#81C784', '#A5D6A7'],
            borderRadius: 6,
        }],
    };

    const categoryData = {
        labels: (categorySales || []).map(c => c.category),
        datasets: [{
            data: (categorySales || []).map(c => c.total_revenue),
            backgroundColor: ['#1B5E20', '#1565C0', '#F57F17', '#C62828', '#6A1B9A', '#00695C', '#E65100', '#37474F'],
            borderWidth: 0,
        }],
    };

    const fmt = (n) => Number(n || 0).toLocaleString('en-KE');

    return (
        <>
            <div className="page-header">
                <div>
                    <h1>Dashboard</h1>
                    <p>Welcome back! Here's your pharmacy overview.</p>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            <div className="page-body">
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon green"><FiDollarSign /></div>
                        <div className="stat-info">
                            <h4>Today's Revenue</h4>
                            <div className="value">KES {fmt(data.today.revenue)}</div>
                            <div className="sub">{hasRole('super_admin') && <>Profit: KES {fmt(data.today.profit)} • </>}{data.today.count} transactions</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon blue"><FiTrendingUp /></div>
                        <div className="stat-info">
                            <h4>This Month</h4>
                            <div className="value">KES {fmt(data.month.revenue)}</div>
                            {hasRole('super_admin') && <div className="sub">Profit: KES {fmt(data.month.profit)}</div>}
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon green"><FiPackage /></div>
                        <div className="stat-info">
                            <h4>Inventory Value</h4>
                            <div className="value">KES {fmt(data.inventory.retail_value)}</div>
                            <div className="sub">{data.inventory.total_products} products in stock</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon orange"><FiAlertTriangle /></div>
                        <div className="stat-info">
                            <h4>Alerts</h4>
                            <div className="value">{data.low_stock_count + data.expiring_count + data.expired_count}</div>
                            <div className="sub">{data.low_stock_count} low stock • {data.expiring_count} expiring • {data.expired_count} expired</div>
                        </div>
                    </div>
                </div>

                {insights.length > 0 && (
                    <div className="card mb-24">
                        <div className="card-header"><h3>💡 Smart Insights</h3></div>
                        <div className="card-body">
                            {insights.slice(0, 5).map((ins, i) => (
                                <div key={i} className={`alert-card ${ins.severity === 'critical' ? 'danger' : ins.severity === 'warning' ? 'warning' : 'info'}`}>
                                    <span>{ins.icon}</span> {ins.message}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="grid-2 mb-24">
                    <div className="card">
                        <div className="card-header"><h3>📈 Sales Trend (30 Days)</h3></div>
                        <div className="card-body">
                            <div className="chart-container">
                                <Line data={trendData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { beginAtZero: true } } }} />
                            </div>
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-header"><h3>🏆 Top Selling Medicines</h3></div>
                        <div className="card-body">
                            <div className="chart-container">
                                <Bar data={topData} options={{ responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } } }} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid-2">
                    <div className="card">
                        <div className="card-header"><h3>📊 Sales by Category</h3></div>
                        <div className="card-body">
                            <div className="chart-container" style={{ height: 260 }}>
                                <Doughnut data={categoryData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }} />
                            </div>
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-header"><h3>🕐 Recent Sales</h3></div>
                        <div className="card-body" style={{ maxHeight: 300, overflowY: 'auto' }}>
                            {(!data.recent_sales || data.recent_sales.length === 0) ? (
                                <div className="empty-state"><p>No sales yet</p></div>
                            ) : (
                                <table>
                                    <thead><tr><th>ID</th><th>Amount</th><th>Cashier</th><th>Time</th></tr></thead>
                                    <tbody>
                                        {Array.isArray(data.recent_sales) && data.recent_sales.map(s => (
                                            <tr key={s.id}>
                                                <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{s.transaction_id}</td>
                                                <td style={{ fontWeight: 700 }}>KES {fmt(s.total_amount)}</td>
                                                <td>{s.cashier_name}</td>
                                                <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                                    {new Date(s.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
