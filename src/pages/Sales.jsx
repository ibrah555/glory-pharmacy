import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { FiSearch, FiFilter } from 'react-icons/fi';

export default function Sales() {
    const { hasRole } = useAuth();
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [paymentFilter, setPaymentFilter] = useState('');

    const loadSales = () => {
        let url = '/api/reports/sales?';
        if (startDate) url += `start_date=${startDate}&`;
        if (endDate) url += `end_date=${endDate}&`;
        if (paymentFilter) url += `payment_method=${paymentFilter}&`;
        axios.get(url).then(r => { setSales(r.data); setLoading(false); });
    };

    useEffect(() => { loadSales(); }, [startDate, endDate, paymentFilter]);

    const fmt = (n) => Number(n || 0).toLocaleString('en-KE');

    const totalRevenue = sales.reduce((s, sale) => s + sale.total_amount, 0);
    const totalProfit = sales.reduce((s, sale) => s + sale.profit, 0);

    return (
        <>
            <div className="page-header">
                <div><h1>Sales History</h1><p>View all pharmacy sales transactions</p></div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {sales.length} transactions • Revenue: <strong>KES {fmt(totalRevenue)}</strong> {hasRole('super_admin') && <>• Profit: <strong>KES {fmt(totalProfit)}</strong></>}
                </div>
            </div>
            <div className="page-body">
                <div className="filters-bar">
                    <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ maxWidth: 170 }} />
                    <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ maxWidth: 170 }} />
                    <select className="form-select" value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} style={{ maxWidth: 160 }}>
                        <option value="">All Payments</option>
                        <option value="cash">Cash</option>
                        <option value="mpesa">M-Pesa</option>
                        <option value="card">Card</option>
                    </select>
                </div>

                <div className="card">
                    <div className="table-container">
                        {loading ? <div className="loading"><div className="spinner"></div>Loading...</div> : (
                            <table>
                                <thead>
                                    <tr><th>Transaction ID</th><th>Date & Time</th><th>Cashier</th><th>Amount</th>{hasRole('super_admin') && <th>Profit</th>}<th>Payment</th><th>Status</th></tr>
                                </thead>
                                <tbody>
                                    {sales.length === 0 ? (
                                        <tr><td colSpan="7" style={{ textAlign: 'center', padding: 40 }}>No sales found</td></tr>
                                    ) : sales.map(s => (
                                        <tr key={s.id}>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{s.transaction_id}</td>
                                            <td style={{ fontSize: '0.82rem' }}>{new Date(s.created_at).toLocaleString('en-GB')}</td>
                                            <td>{s.cashier_name}</td>
                                            <td style={{ fontWeight: 700 }}>KES {fmt(s.total_amount)}</td>
                                            {hasRole('super_admin') && <td style={{ color: 'var(--success)' }}>KES {fmt(s.profit)}</td>}
                                            <td><span className={`badge ${s.payment_method === 'mpesa' ? 'badge-info' : 'badge-default'}`}>{s.payment_method.toUpperCase()}</span></td>
                                            <td><span className={`badge ${s.status === 'completed' ? 'badge-success' : 'badge-danger'}`}>{s.status}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
