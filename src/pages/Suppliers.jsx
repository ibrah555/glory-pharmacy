import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit, FiPhone, FiMail } from 'react-icons/fi';

export default function Suppliers() {
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [editSupplier, setEditSupplier] = useState(null);
    const [form, setForm] = useState({ name: '', contact_person: '', phone: '', email: '', address: '' });

    const loadSuppliers = () => {
        axios.get('/api/suppliers').then(r => { setSuppliers(r.data); setLoading(false); });
    };

    useEffect(() => { loadSuppliers(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editSupplier) {
                await axios.put(`/api/suppliers/${editSupplier.id}`, form);
                toast.success('Supplier updated');
            } else {
                await axios.post('/api/suppliers', form);
                toast.success('Supplier added');
            }
            setShowAdd(false);
            setEditSupplier(null);
            setForm({ name: '', contact_person: '', phone: '', email: '', address: '' });
            loadSuppliers();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed');
        }
    };

    const openEdit = (s) => {
        setEditSupplier(s);
        setForm({ name: s.name, contact_person: s.contact_person || '', phone: s.phone || '', email: s.email || '', address: s.address || '' });
        setShowAdd(true);
    };

    return (
        <>
            <div className="page-header">
                <div><h1>Suppliers</h1><p>Manage pharmacy suppliers</p></div>
                <button className="btn btn-primary" onClick={() => { setEditSupplier(null); setForm({ name: '', contact_person: '', phone: '', email: '', address: '' }); setShowAdd(true); }}>
                    <FiPlus /> Add Supplier
                </button>
            </div>
            <div className="page-body">
                <div className="card">
                    <div className="table-container">
                        {loading ? <div className="loading"><div className="spinner"></div>Loading...</div> : (
                            <table>
                                <thead><tr><th>Name</th><th>Contact Person</th><th>Phone</th><th>Email</th><th>Address</th><th>Actions</th></tr></thead>
                                <tbody>
                                    {suppliers.length === 0 ? (
                                        <tr><td colSpan="6" style={{ textAlign: 'center', padding: 40 }}>No suppliers</td></tr>
                                    ) : suppliers.map(s => (
                                        <tr key={s.id}>
                                            <td style={{ fontWeight: 600 }}>{s.name}</td>
                                            <td>{s.contact_person || '—'}</td>
                                            <td>{s.phone ? <span><FiPhone style={{ fontSize: 12 }} /> {s.phone}</span> : '—'}</td>
                                            <td>{s.email ? <span><FiMail style={{ fontSize: 12 }} /> {s.email}</span> : '—'}</td>
                                            <td>{s.address || '—'}</td>
                                            <td><button className="btn btn-sm btn-secondary" onClick={() => openEdit(s)}><FiEdit /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>

            {showAdd && (
                <div className="modal-overlay" onClick={() => setShowAdd(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{editSupplier ? 'Edit' : 'Add'} Supplier</h3>
                            <button className="modal-close" onClick={() => setShowAdd(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group"><label>Supplier Name *</label><input className="form-input" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                                <div className="grid-2">
                                    <div className="form-group"><label>Contact Person</label><input className="form-input" value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} /></div>
                                    <div className="form-group"><label>Phone</label><input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                                </div>
                                <div className="form-group"><label>Email</label><input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                                <div className="form-group"><label>Address</label><textarea className="form-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}></textarea></div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editSupplier ? 'Update' : 'Add'} Supplier</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
