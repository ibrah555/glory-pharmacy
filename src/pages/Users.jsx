import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit, FiUserCheck, FiUserX } from 'react-icons/fi';

export default function Users() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [editUser, setEditUser] = useState(null);
    const [form, setForm] = useState({ username: '', full_name: '', password: '', role: 'cashier' });

    const loadUsers = () => {
        axios.get('/api/auth/users').then(r => { setUsers(r.data); setLoading(false); });
    };

    useEffect(() => { loadUsers(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editUser) {
                const updateData = { full_name: form.full_name, role: form.role };
                if (form.password) updateData.password = form.password;
                await axios.put(`/api/auth/users/${editUser.id}`, updateData);
                toast.success('User updated');
            } else {
                await axios.post('/api/auth/users', form);
                toast.success('User created');
            }
            setShowAdd(false);
            setEditUser(null);
            setForm({ username: '', full_name: '', password: '', role: 'cashier' });
            loadUsers();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed');
        }
    };

    const toggleActive = async (user) => {
        try {
            await axios.put(`/api/auth/users/${user.id}`, { is_active: !user.is_active });
            toast.success(`User ${user.is_active ? 'deactivated' : 'activated'}`);
            loadUsers();
        } catch (err) {
            toast.error('Failed to update user');
        }
    };

    const openEdit = (u) => {
        setEditUser(u);
        setForm({ username: u.username, full_name: u.full_name, password: '', role: u.role });
        setShowAdd(true);
    };

    const roleColors = {
        super_admin: 'badge-danger',
        store_manager: 'badge-info',
        pharmacist: 'badge-success',
        cashier: 'badge-warning',
    };

    return (
        <>
            <div className="page-header">
                <div><h1>User Management</h1><p>Manage system users and roles</p></div>
                <button className="btn btn-primary" onClick={() => { setEditUser(null); setForm({ username: '', full_name: '', password: '', role: 'cashier' }); setShowAdd(true); }}>
                    <FiPlus /> Create User
                </button>
            </div>
            <div className="page-body">
                <div className="card">
                    <div className="table-container">
                        {loading ? <div className="loading"><div className="spinner"></div>Loading...</div> : (
                            <table>
                                <thead><tr><th>Username</th><th>Full Name</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id} style={{ opacity: u.is_active ? 1 : 0.5 }}>
                                            <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{u.username}</td>
                                            <td>{u.full_name}</td>
                                            <td><span className={`badge ${roleColors[u.role]}`}>{u.role.replace('_', ' ')}</span></td>
                                            <td><span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                                            <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                                            <td>
                                                <div className="btn-group">
                                                    <button className="btn btn-sm btn-secondary" onClick={() => openEdit(u)}><FiEdit /></button>
                                                    <button className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}`} onClick={() => toggleActive(u)}>
                                                        {u.is_active ? <FiUserX /> : <FiUserCheck />}
                                                    </button>
                                                </div>
                                            </td>
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
                            <h3>{editUser ? 'Edit User' : 'Create New User'}</h3>
                            <button className="modal-close" onClick={() => setShowAdd(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                {!editUser && (
                                    <div className="form-group">
                                        <label>Username *</label>
                                        <input className="form-input" required value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
                                    </div>
                                )}
                                <div className="form-group">
                                    <label>Full Name *</label>
                                    <input className="form-input" required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>{editUser ? 'New Password (leave blank to keep current)' : 'Password *'}</label>
                                    <input className="form-input" type="password" required={!editUser} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label>Role *</label>
                                    <select className="form-select" required value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                                        <option value="cashier">Cashier</option>
                                        <option value="pharmacist">Pharmacist</option>
                                        <option value="store_manager">Store Manager</option>
                                        <option value="super_admin">Super Admin</option>
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editUser ? 'Update' : 'Create'} User</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
