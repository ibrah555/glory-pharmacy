import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FiPackage, FiRefreshCw } from 'react-icons/fi';

export default function Restocking() {
    const [products, setProducts] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showRestock, setShowRestock] = useState(false);
    const [form, setForm] = useState({
        product_id: '', batch_number: '', expiry_date: '', cost_price: '', selling_price: '', quantity: '', supplier_id: ''
    });

    useEffect(() => {
        Promise.all([
            axios.get('/api/inventory/products'),
            axios.get('/api/suppliers'),
            axios.get('/api/inventory/reorder-suggestions'),
        ]).then(([p, s, sg]) => {
            setProducts(p.data);
            setSuppliers(s.data);
            setSuggestions(sg.data);
            setLoading(false);
        });
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/suppliers/restock', {
                ...form,
                cost_price: parseFloat(form.cost_price),
                selling_price: parseFloat(form.selling_price),
                quantity: parseInt(form.quantity),
                supplier_id: form.supplier_id || null,
            });
            toast.success('Stock restocked successfully!');
            setShowRestock(false);
            setForm({ product_id: '', batch_number: '', expiry_date: '', cost_price: '', selling_price: '', quantity: '', supplier_id: '' });
            // Reload suggestions
            const sg = await axios.get('/api/inventory/reorder-suggestions');
            setSuggestions(sg.data);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Restocking failed');
        }
    };

    const fmt = (n) => Number(n || 0).toLocaleString('en-KE');

    const getUrgencyBadge = (urgency) => {
        const map = { critical: 'badge-danger', high: 'badge-warning', medium: 'badge-info', low: 'badge-default' };
        return <span className={`badge ${map[urgency] || 'badge-default'}`}>{urgency}</span>;
    };

    const prefillRestock = (product_id) => {
        setForm({ ...form, product_id: String(product_id) });
        setShowRestock(true);
    };

    if (loading) return <div className="loading"><div className="spinner"></div>Loading...</div>;

    return (
        <>
            <div className="page-header">
                <div><h1>Restocking</h1><p>Manage stock deliveries and reorder suggestions</p></div>
                <button className="btn btn-primary" onClick={() => setShowRestock(true)}>
                    <FiRefreshCw /> Record New Delivery
                </button>
            </div>
            <div className="page-body">
                {suggestions.length > 0 && (
                    <div className="card mb-24">
                        <div className="card-header"><h3>⚠️ Reorder Suggestions</h3></div>
                        <div className="table-container">
                            <table>
                                <thead><tr><th>Product</th><th>Category</th><th>Current Stock</th><th>Reorder Level</th><th>Avg Daily Sales</th><th>Days Left</th><th>Urgency</th><th></th></tr></thead>
                                <tbody>
                                    {suggestions.map(s => (
                                        <tr key={s.id}>
                                            <td style={{ fontWeight: 600 }}>{s.name}</td>
                                            <td><span className="badge badge-default">{s.category}</span></td>
                                            <td style={{ fontWeight: 700, color: s.current_stock <= s.reorder_level ? 'var(--danger)' : 'inherit' }}>{s.current_stock}</td>
                                            <td>{s.reorder_level}</td>
                                            <td>{s.avg_daily_sales}</td>
                                            <td style={{ fontWeight: 600 }}>{s.days_remaining === 999 ? '∞' : s.days_remaining} days</td>
                                            <td>{getUrgencyBadge(s.urgency)}</td>
                                            <td><button className="btn btn-sm btn-primary" onClick={() => prefillRestock(s.id)}>Restock</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {suggestions.length === 0 && (
                    <div className="card mb-24">
                        <div className="card-body">
                            <div className="alert-card success">✅ All products are well stocked. No immediate reorder needed.</div>
                        </div>
                    </div>
                )}
            </div>

            {showRestock && (
                <div className="modal-overlay" onClick={() => setShowRestock(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
                        <div className="modal-header">
                            <h3>Record New Stock Delivery</h3>
                            <button className="modal-close" onClick={() => setShowRestock(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label>Product *</label>
                                    <select className="form-select" required value={form.product_id} onChange={e => setForm({ ...form, product_id: e.target.value })}>
                                        <option value="">Select product</option>
                                        {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.dosage_form})</option>)}
                                    </select>
                                </div>
                                <div className="grid-2">
                                    <div className="form-group"><label>Batch Number *</label><input className="form-input" required placeholder="e.g., B2026-001" value={form.batch_number} onChange={e => setForm({ ...form, batch_number: e.target.value })} /></div>
                                    <div className="form-group"><label>Expiry Date *</label><input className="form-input" type="date" required value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} /></div>
                                    <div className="form-group"><label>Cost Price (KES) *</label><input className="form-input" type="number" step="0.01" required value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} /></div>
                                    <div className="form-group"><label>Selling Price (KES) *</label><input className="form-input" type="number" step="0.01" required value={form.selling_price} onChange={e => setForm({ ...form, selling_price: e.target.value })} /></div>
                                    <div className="form-group"><label>Quantity *</label><input className="form-input" type="number" min="1" required value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></div>
                                    <div className="form-group">
                                        <label>Supplier</label>
                                        <select className="form-select" value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value })}>
                                            <option value="">Select supplier</option>
                                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowRestock(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Record Delivery</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
