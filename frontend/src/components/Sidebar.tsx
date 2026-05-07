import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const { logout } = useAuth();

  const navItems = [
    { path: '/', label: '📊 Dashboard' },
    { path: '/projects', label: '📁 Projects' },
    { path: '/tasks', label: '✅ Tasks' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <span>⚡</span>
          <span>Ethara</span>
        </div>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
        <button onClick={logout} className="nav-item" style={{ width: '100%', color: 'var(--danger)', cursor: 'pointer' }}>
          <span>🚪 Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
