import { ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../utils/supabase';
import { Menu, LogOut, ShoppingBag, BarChart3, Users, User } from 'lucide-react';
import './Layout.css';

interface LayoutProps {
  children: ReactNode;
  title: string;
  sidebarLinks?: { label: string; href: string; icon: ReactNode }[];
}

export default function Layout({ children, title, sidebarLinks = [] }: LayoutProps) {
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const defaultLinks = [];

  // Always show marketplace
  defaultLinks.push({ label: 'Marketplace', href: '/marketplace', icon: <ShoppingBag /> });

  // Add role-specific links
  if (roles.includes('admin')) {
    defaultLinks.push({ label: 'Admin', href: '/admin', icon: <BarChart3 /> });
  }
  if (roles.includes('vendor')) {
    defaultLinks.push({ label: 'Vendor', href: '/vendor', icon: <ShoppingBag /> });
  }
  if (roles.includes('affiliate')) {
    defaultLinks.push({ label: 'Affiliate', href: '/affiliate', icon: <Users /> });
  }
  if (roles.includes('consumer')) {
    defaultLinks.push({ label: 'Account', href: '/consumer', icon: <User /> });
  }

  const allLinks = sidebarLinks.length > 0 ? sidebarLinks : defaultLinks;

  return (
    <div className="layout">
      <nav className="navbar">
        <div className="navbar-content">
          <button
            className="navbar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu />
          </button>
          <h1 className="navbar-title">MultiVendor Ecosystem</h1>
          <div className="navbar-user">
            <div className="user-info">
              <span className="user-name">{user?.full_name || user?.email}</span>
              <div className="user-roles">
                {roles.length > 0 ? roles.map((role) => (
                  <span key={role} className={`role-badge role-${role}`}>
                    {role}
                  </span>
                )) : <span className="role-badge">Loading roles...</span>}
              </div>
            </div>
            <button onClick={handleLogout} className="btn-logout" title="Logout">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </nav>

      <div className="layout-container">
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-links">
            {allLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="sidebar-link"
                onClick={() => setSidebarOpen(false)}
              >
                {link.icon}
                <span>{link.label}</span>
              </a>
            ))}
          </div>
        </aside>

        <main className="main-content">
          <div className="content-header">
            <h2>{title}</h2>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
