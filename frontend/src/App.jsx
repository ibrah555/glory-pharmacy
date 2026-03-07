import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import Sales from './pages/Sales';
import Suppliers from './pages/Suppliers';
import Restocking from './pages/Restocking';
import Reports from './pages/Reports';
import Users from './pages/Users';
import AuditLogs from './pages/AuditLogs';
import Settings from './pages/Settings';

function ProtectedRoute({ children, roles }) {
    const { user, loading } = useAuth();
    if (loading) return <div className="loading"><div className="spinner"></div>Loading...</div>;
    if (!user) return <Navigate to="/login" />;
    if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
    return children;
}

function AppLayout({ children }) {
    return (
        <div className="app-layout">
            <Sidebar />
            <main className="main-content">{children}</main>
        </div>
    );
}

function AppRoutes() {
    const { user, loading } = useAuth();

    if (loading) return <div className="loading" style={{ height: '100vh' }}><div className="spinner"></div>Loading...</div>;

    return (
        <Routes>
            <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
            <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/pos" element={<ProtectedRoute roles={['super_admin', 'pharmacist', 'cashier']}><AppLayout><POS /></AppLayout></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><AppLayout><Inventory /></AppLayout></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute><AppLayout><Sales /></AppLayout></ProtectedRoute>} />
            <Route path="/suppliers" element={<ProtectedRoute roles={['super_admin', 'store_manager']}><AppLayout><Suppliers /></AppLayout></ProtectedRoute>} />
            <Route path="/restocking" element={<ProtectedRoute roles={['super_admin', 'store_manager', 'pharmacist']}><AppLayout><Restocking /></AppLayout></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute roles={['super_admin', 'store_manager']}><AppLayout><Reports /></AppLayout></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute roles={['super_admin']}><AppLayout><Users /></AppLayout></ProtectedRoute>} />
            <Route path="/audit" element={<ProtectedRoute roles={['super_admin']}><AppLayout><AuditLogs /></AppLayout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute roles={['super_admin']}><AppLayout><Settings /></AppLayout></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
        </Routes>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Toaster position="top-right" toastOptions={{
                    style: { fontFamily: 'Inter, sans-serif', fontSize: '0.85rem' },
                    success: { style: { background: '#E8F5E9', color: '#1B5E20', border: '1px solid #A5D6A7' } },
                    error: { style: { background: '#FFEBEE', color: '#C62828', border: '1px solid #EF9A9A' } },
                }} />
                <AppRoutes />
            </AuthProvider>
        </BrowserRouter>
    );
}
