import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiGrid, FiPackage, FiShoppingCart, FiDollarSign, FiTruck, FiBarChart2, FiUsers, FiFileText, FiSettings, FiLogOut, FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';

export default function Sidebar() {
    const { user, logout, hasRole } = useAuth();
    const location = useLocation();

    const navItems = [
        {
            section: 'Main', items: [
                { path: '/', icon: <FiGrid />, label: 'Dashboard', roles: ['super_admin', 'store_manager', 'pharmacist', 'cashier'] },
                { path: '/pos', icon: <FiShoppingCart />, label: 'Point of Sale', roles: ['super_admin', 'pharmacist', 'cashier'] },
            ]
        },
        {
            section: 'Inventory', items: [
                { path: '/inventory', icon: <FiPackage />, label: 'Products', roles: ['super_admin', 'store_manager', 'pharmacist', 'cashier'] },
                { path: '/restocking', icon: <FiRefreshCw />, label: 'Restocking', roles: ['super_admin', 'store_manager', 'pharmacist'] },
                { path: '/suppliers', icon: <FiTruck />, label: 'Suppliers', roles: ['super_admin', 'store_manager'] },
            ]
        },
        {
            section: 'Sales', items: [
                { path: '/sales', icon: <FiDollarSign />, label: 'Sales History', roles: ['super_admin', 'store_manager', 'pharmacist', 'cashier'] },
                { path: '/reports', icon: <FiBarChart2 />, label: 'Reports', roles: ['super_admin', 'store_manager'] },
            ]
        },
        {
            section: 'System', items: [
                { path: '/users', icon: <FiUsers />, label: 'Users', roles: ['super_admin'] },
                { path: '/audit', icon: <FiFileText />, label: 'Audit Logs', roles: ['super_admin'] },
                { path: '/settings', icon: <FiSettings />, label: 'Settings', roles: ['super_admin'] },
            ]
        },
    ];

    const initials = user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';

    return (
        <aside className="sidebar">
            <div className="sidebar-brand">
                <div className="logo">💊</div>
                <h2>Glory Pharmacy</h2>
                <span>Management System</span>
            </div>

            <nav className="sidebar-nav">
                {navItems.map(section => {
                    const visibleItems = section.items.filter(item => hasRole(...item.roles));
                    if (!visibleItems.length) return null;
                    return (
                        <div key={section.section} className="sidebar-section">
                            <div className="sidebar-section-title">{section.section}</div>
                            {visibleItems.map(item => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    className={({ isActive }) => `sidebar-link ${isActive && location.pathname === item.path ? 'active' : ''}`}
                                    end={item.path === '/'}
                                >
                                    <span className="icon">{item.icon}</span>
                                    {item.label}
                                </NavLink>
                            ))}
                        </div>
                    );
                })}
            </nav>

            <div className="sidebar-footer">
                <div className="sidebar-user">
                    <div className="sidebar-avatar">{initials}</div>
                    <div className="sidebar-user-info">
                        <div className="name">{user?.full_name}</div>
                        <div className="role">{user?.role?.replace('_', ' ')}</div>
                    </div>
                    <button className="sidebar-logout" onClick={logout} title="Logout">
                        <FiLogOut />
                    </button>
                </div>
            </div>
        </aside>
    );
}
