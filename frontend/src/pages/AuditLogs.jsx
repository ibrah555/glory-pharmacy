import { useState, useEffect } from 'react';
import axios from 'axios';
import { FiSearch, FiFilter } from 'react-icons/fi';

export default function AuditLogs() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actions, setActions] = useState([]);
    const [actionFilter, setActionFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [suspicious, setSuspicious] = useState(null);

    useEffect(() => {
        axios.get('/api/audit/actions').then(r => setActions(r.data));
        axios.get('/api/audit/suspicious').then(r => setSuspicious(r.data));
    }, []);

    useEffect(() => {
        let url = '/api/audit?limit=200';
        if (actionFilter) url += `&action=${actionFilter}`;
        if (startDate) url += `&start_date=${startDate}`;
        if (endDate) url += `&end_date=${endDate}`;
        axios.get(url).then(r => { setLogs(r.data); setLoading(false); });
    }, [actionFilter, startDate, endDate]);

    const getActionBadge = (action) => {
        if (action.includes('LOGIN')) return 'badge-info';
        if (action.includes('SALE')) return 'badge-success';
        if (action.includes('CANCEL')) return 'badge-danger';
        if (action.includes('STOCK') || action.includes('RESTOCK')) return 'badge-warning';
        return 'badge-default';
    };

    return (
        <>
            <div className="page-header">
                <div><h1>Audit Logs</h1><p>Track all system activities</p></div>
            </div>
            <div className="page-body">
                {suspicious && (suspicious.cancellations.length > 0 || suspicious.adjustments.length > 0) && (
                    <div className="card mb-24">
                        <div className="card-header"><h3>🚨 Suspicious Activity (Last 7 days)</h3></div>
                        <div className="card-body">
                            {suspicious.cancellations.map((c, i) => (
                                <div key={i} className="alert-card danger">
                                    <strong>{c.full_name}</strong> ({c.username}) cancelled <strong>{c.count}</strong> transactions this week
                                </div>
                            ))}
                            {suspicious.adjustments.map((a, i) => (
                                <div key={i} className="alert-card warning">
                                    <strong>{a.full_name}</strong> ({a.username}) made <strong>{a.count}</strong> stock adjustments this week
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="filters-bar">
                    <select className="form-select" value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={{ maxWidth: 200 }}>
                        <option value="">All Actions</option>
                        {actions.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ maxWidth: 170 }} />
                    <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ maxWidth: 170 }} />
                </div>

                <div className="card">
                    <div className="table-container">
                        {loading ? <div className="loading"><div className="spinner"></div>Loading...</div> : (
                            <table>
                                <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
                                <tbody>
                                    {logs.length === 0 ? (
                                        <tr><td colSpan="4" style={{ textAlign: 'center', padding: 40 }}>No audit logs found</td></tr>
                                    ) : logs.map(log => (
                                        <tr key={log.id}>
                                            <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString('en-GB')}</td>
                                            <td>{log.user_full_name || log.username || 'System'}</td>
                                            <td><span className={`badge ${getActionBadge(log.action)}`}>{log.action}</span></td>
                                            <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: 400 }}>{log.details}</td>
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
