import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { FiPlus, FiEdit, FiAlertTriangle, FiPackage, FiSearch } from 'react-icons/fi';

export default function Inventory() {
    const { hasRole } = useAuth();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('');
    const [categories, setCategories] = useState([]);
    const [filter, setFilter] = useState('all');
    const [showAdd, setShowAdd] = useState(false);
    const [editProduct, setEditProduct] = useState(null);
    const [form, setForm] = useState({
        name: '', generic_name: '', brand_name: '', category: 'Painkillers',
        dosage_form: 'Tablet', strength: '', reorder_level: 10, storage_location: ''
    });

    const loadProducts = () => {
        let url = '/api/inventory/products?';
        if (search) url += `search=${search}&`;
        if (category) url += `category=${category}&`;
        if (filter === 'low_stock') url += 'low_stock=true&';
        if (filter === 'expiring') url += 'expiring=true&';

        axios.get(url).then(r => { setProducts(r.data); setLoading(false); });
    };

    useEffect(() => { loadProducts(); }, [search, category, filter]);
    useEffect(() => {
        axios.get('/api/inventory/categories').then(r => setCategories(r.data));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editProduct) {
                await axios.put(`/api/inventory/products/${editProduct.id}`, form);
                toast.success('Product updated');
            } else {
                await axios.post('/api/inventory/products', form);
                toast.success('Product created');
            }
            setShowAdd(false);
            setEditProduct(null);
            setForm({ name: '', generic_name: '', brand_name: '', category: 'Painkillers', dosage_form: 'Tablet', strength: '', reorder_level: 10, storage_location: '' });
            loadProducts();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed');
        }
    };

    const openEdit = (product) => {
        setEditProduct(product);
        setForm({
            name: product.name, generic_name: product.generic_name || '', brand_name: product.brand_name || '',
            category: product.category, dosage_form: product.dosage_form, strength: product.strength || '',
            reorder_level: product.reorder_level, storage_location: product.storage_location || '',
        });
        setShowAdd(true);
    };

    const getExpiryBadge = (date) => {
        if (!date) return null;
        const d = new Date(date);
        const now = new Date();
        const months = (d - now) / (1000 * 60 * 60 * 24 * 30);
        if (months < 0) return <span className="badge badge-danger">Expired</span>;
        if (months <= 3) return <span className="badge badge-warning">Expiring Soon</span>;
        if (months <= 6) return <span className="badge badge-info">6 months</span>;
        return <span className="badge badge-success">OK</span>;
    };

    const getStockBadge = (stock, reorder) => {
        if (stock <= 0) return <span className="badge badge-danger">Out of Stock</span>;
        if (stock <= reorder) return <span className="badge badge-warning">Low Stock</span>;
        return <span className="badge badge-success">In Stock</span>;
    };

    const fmt = (n) => Number(n || 0).toLocaleString('en-KE');

    return (
        <>
            <div className="page-header">
                <div><h1>Inventory</h1><p>Manage pharmacy products and stock</p></div>
                {hasRole('super_admin', 'store_manager', 'pharmacist') && (
                    <button className="btn btn-primary" onClick={() => { setEditProduct(null); setForm({ name: '', generic_name: '', brand_name: '', category: 'Painkillers', dosage_form: 'Tablet', strength: '', reorder_level: 10, storage_location: '' }); setShowAdd(true); }}>
                        <FiPlus /> Add Product
                    </button>
                )}
            </div>
            <div className="page-body">
                <div className="filters-bar">
                    <div style={{ position: 'relative', flex: 1, maxWidth: 300 }}>
                        <FiSearch style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                        <input className="form-input" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 36 }} />
                    </div>
                    <select className="form-select" value={category} onChange={e => setCategory(e.target.value)} style={{ maxWidth: 180 }}>
                        <option value="">All Categories</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select className="form-select" value={filter} onChange={e => setFilter(e.target.value)} style={{ maxWidth: 180 }}>
                        <option value="all">All Products</option>
                        <option value="low_stock">Low Stock</option>
                        <option value="expiring">Expiring Soon</option>
                    </select>
                </div>

                <div className="card">
                    <div className="table-container">
                        {loading ? <div className="loading"><div className="spinner"></div>Loading...</div> : (
                            <table>
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th>Category</th>
                                        <th>Form / Strength</th>
                                        <th>Stock</th>
                                        <th>Status</th>
                                        <th>Price Range</th>
                                        <th>Expiry</th>
                                        {hasRole('super_admin', 'store_manager') && <th>Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {products.length === 0 ? (
                                        <tr><td colSpan="8" style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>No products found</td></tr>
                                    ) : products.map(p => (
                                        <tr key={p.id}>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{p.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                    {p.generic_name && `${p.generic_name}`} {p.brand_name && `(${p.brand_name})`}
                                                </div>
                                            </td>
                                            <td><span className="badge badge-default">{p.category}</span></td>
                                            <td>{p.dosage_form} {p.strength && `• ${p.strength}`}</td>
                                            <td style={{ fontWeight: 700 }}>{fmt(p.total_stock)}</td>
                                            <td>{getStockBadge(p.total_stock, p.reorder_level)}</td>
                                            <td>KES {fmt(p.min_price)} {p.min_price !== p.max_price ? `- ${fmt(p.max_price)}` : ''}</td>
                                            <td>{getExpiryBadge(p.nearest_expiry)}</td>
                                            {hasRole('super_admin', 'store_manager') && (
                                                <td>
                                                    <button className="btn btn-sm btn-secondary" onClick={() => openEdit(p)}><FiEdit /></button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {/* Add/Edit Product Modal */}
            {showAdd && (
                <div className="modal-overlay" onClick={() => setShowAdd(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
                        <div className="modal-header">
                            <h3>{editProduct ? 'Edit Product' : 'Add New Product'}</h3>
                            <button className="modal-close" onClick={() => setShowAdd(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="grid-2">
                                    <div className="form-group">
                                        <label>Product Name *</label>
                                        <input className="form-input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Generic Name</label>
                                        <input className="form-input" value={form.generic_name} onChange={e => setForm({ ...form, generic_name: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Brand Name</label>
                                        <input className="form-input" value={form.brand_name} onChange={e => setForm({ ...form, brand_name: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Category *</label>
                                        <select className="form-select" required value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                                            {['Painkillers', 'Antibiotics', 'Antimalarials', 'Antidiabetics', 'Antacids', 'Cough & Cold', 'Vitamins', 'Skin Care', 'Eye Care', 'Other'].map(c =>
                                                <option key={c} value={c}>{c}</option>
                                            )}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Dosage Form *</label>
                                        <select className="form-select" required value={form.dosage_form} onChange={e => setForm({ ...form, dosage_form: e.target.value })}>
                                            {['Tablet', 'Syrup', 'Capsule', 'Injection', 'Cream', 'Other'].map(d =>
                                                <option key={d} value={d}>{d}</option>
                                            )}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Strength</label>
                                        <input className="form-input" placeholder="e.g., 500mg" value={form.strength} onChange={e => setForm({ ...form, strength: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Reorder Level</label>
                                        <input className="form-input" type="number" min="0" value={form.reorder_level} onChange={e => setForm({ ...form, reorder_level: parseInt(e.target.value) })} />
                                    </div>
                                    <div className="form-group">
                                        <label>Storage Location</label>
                                        <input className="form-input" placeholder="e.g., Shelf A1" value={form.storage_location} onChange={e => setForm({ ...form, storage_location: e.target.value })} />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editProduct ? 'Update' : 'Add'} Product</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
