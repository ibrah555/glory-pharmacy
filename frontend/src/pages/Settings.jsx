import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FiSave, FiDatabase, FiDownload } from 'react-icons/fi';

export default function Settings() {
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [backups, setBackups] = useState([]);

    useEffect(() => {
        axios.get('/api/backup/settings').then(r => { setSettings(r.data); setLoading(false); });
        axios.get('/api/backup/list').then(r => setBackups(r.data));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await axios.put('/api/backup/settings', settings);
            toast.success('Settings saved');
        } catch (err) {
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleBackup = async () => {
        try {
            const res = await axios.post('/api/backup');
            toast.success(`Backup created: ${res.data.path}`);
            const b = await axios.get('/api/backup/list');
            setBackups(b.data);
        } catch (err) {
            toast.error('Backup failed');
        }
    };

    if (loading) return <div className="loading"><div className="spinner"></div>Loading...</div>;

    return (
        <>
            <div className="page-header">
                <div><h1>System Settings</h1><p>Configure Glory Pharmacy system</p></div>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    <FiSave /> {saving ? 'Saving...' : 'Save Settings'}
                </button>
            </div>
            <div className="page-body">
                <div className="grid-2">
                    <div className="card">
                        <div className="card-header"><h3>🏥 Pharmacy Information</h3></div>
                        <div className="card-body">
                            <div className="form-group">
                                <label>Pharmacy Name</label>
                                <input className="form-input" value={settings.pharmacy_name || ''} onChange={e => setSettings({ ...settings, pharmacy_name: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Location</label>
                                <input className="form-input" value={settings.pharmacy_location || ''} onChange={e => setSettings({ ...settings, pharmacy_location: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Phone</label>
                                <input className="form-input" value={settings.pharmacy_phone || ''} onChange={e => setSettings({ ...settings, pharmacy_phone: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Email</label>
                                <input className="form-input" value={settings.pharmacy_email || ''} onChange={e => setSettings({ ...settings, pharmacy_email: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Expiry Alert (months before)</label>
                                <input className="form-input" type="number" min="1" max="12" value={settings.expiry_alert_months || '3'} onChange={e => setSettings({ ...settings, expiry_alert_months: e.target.value })} />
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header"><h3>📱 M-Pesa Configuration</h3></div>
                        <div className="card-body">
                            <div className="form-group">
                                <label>Environment</label>
                                <select className="form-select" value={settings.mpesa_environment || 'sandbox'} onChange={e => setSettings({ ...settings, mpesa_environment: e.target.value })}>
                                    <option value="sandbox">Sandbox (Testing)</option>
                                    <option value="production">Production (Live)</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Consumer Key</label>
                                <input className="form-input" value={settings.mpesa_consumer_key || ''} onChange={e => setSettings({ ...settings, mpesa_consumer_key: e.target.value })} placeholder="From Safaricom Daraja" />
                            </div>
                            <div className="form-group">
                                <label>Consumer Secret</label>
                                <input className="form-input" type="password" value={settings.mpesa_consumer_secret || ''} onChange={e => setSettings({ ...settings, mpesa_consumer_secret: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Shortcode</label>
                                <input className="form-input" value={settings.mpesa_shortcode || ''} onChange={e => setSettings({ ...settings, mpesa_shortcode: e.target.value })} />
                            </div>
                            <div className="form-group">
                                <label>Passkey</label>
                                <input className="form-input" type="password" value={settings.mpesa_passkey || ''} onChange={e => setSettings({ ...settings, mpesa_passkey: e.target.value })} />
                            </div>
                            <div className="alert-card info">
                                ℹ️ Get M-Pesa API credentials from <a href="https://developer.safaricom.co.ke" target="_blank" rel="noreferrer" style={{ color: 'inherit', fontWeight: 600 }}>Safaricom Daraja Portal</a>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card mt-24">
                    <div className="card-header">
                        <h3>💾 Database Backup</h3>
                        <button className="btn btn-sm btn-accent" onClick={handleBackup}>
                            <FiDatabase /> Create Backup Now
                        </button>
                    </div>
                    <div className="card-body">
                        {backups.length === 0 ? (
                            <div className="empty-state" style={{ padding: 30 }}><p>No backups yet. Create your first backup above.</p></div>
                        ) : (
                            <table>
                                <thead><tr><th>File</th><th>Size</th><th>Created</th></tr></thead>
                                <tbody>
                                    {backups.map((b, i) => (
                                        <tr key={i}>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{b.name}</td>
                                            <td>{(b.size / 1024).toFixed(1)} KB</td>
                                            <td>{new Date(b.created).toLocaleString()}</td>
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
