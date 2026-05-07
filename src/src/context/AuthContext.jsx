import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('glory_token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            axios.get('/api/auth/me')
                .then(res => { setUser(res.data); setLoading(false); })
                .catch(() => { logout(); setLoading(false); });
        } else {
            setLoading(false);
        }
    }, [token]);

    const login = async (username, password) => {
        const res = await axios.post('/api/auth/login', { username, password });
        const { token: newToken, user: userData } = res.data;
        localStorage.setItem('glory_token', newToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        setToken(newToken);
        setUser(userData);
        return userData;
    };

    const logout = () => {
        localStorage.removeItem('glory_token');
        delete axios.defaults.headers.common['Authorization'];
        setToken(null);
        setUser(null);
    };

    const hasRole = (...roles) => user && roles.includes(user.role);

    return (
        <AuthContext.Provider value={{ user, token, loading, login, logout, hasRole }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
