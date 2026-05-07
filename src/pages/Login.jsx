import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FiUser, FiLock } from 'react-icons/fi';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username || !password) return toast.error('Please enter username and password');
        setLoading(true);
        try {
            await login(username, password);
            toast.success('Welcome to Glory Pharmacy!');
            navigate('/');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-logo">
                    <div className="icon">💊</div>
                    <h1>Glory Pharmacy</h1>
                    <p>Management System • Hola, Tana River</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Username</label>
                        <div style={{ position: 'relative' }}>
                            <FiUser style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#8892B0' }} />
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Enter your username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                style={{ paddingLeft: 40 }}
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <div style={{ position: 'relative' }}>
                            <FiLock style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#8892B0' }} />
                            <input
                                type="password"
                                className="form-input"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{ paddingLeft: 40 }}
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading}>
                        {loading ? <><span className="spinner" style={{ width: 18, height: 18, borderWidth: 2, marginRight: 8 }}></span>Signing in...</> : 'Sign In'}
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: 24, fontSize: '0.75rem', color: '#8892B0' }}>
                    🔒 Secure login • Only authorized personnel
                </p>
            </div>
        </div>
    );
}
