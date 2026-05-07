import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';

const Layout = () => {
  const { user } = useAuth();

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <header className="page-header">
          <div />
          <div className="user-badge">
            <div className="avatar" style={{ backgroundColor: user?.avatar_color || '#6366f1' }}>
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>{user?.name}</span>
            <span className={`badge badge-${user?.role === 'admin' ? 'in_progress' : 'todo'}`}>{user?.role}</span>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
