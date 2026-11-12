import { Bell, BookOpenCheck, BriefcaseBusiness, Building2, ChartNoAxesCombined, LayoutDashboard, Settings, ShieldCheck, Signature, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

const navItems = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Organizations', to: '/organizations', icon: Building2, adminOnly: true },
  { label: 'Brands', to: '/brands', icon: BriefcaseBusiness },
  { label: 'Guidelines', to: '/guidelines', icon: BookOpenCheck },
  { label: 'Content', to: '/content', icon: Signature },
  { label: 'Reviews', to: '/reviews', icon: ShieldCheck, reviewerOnly: true },
  { label: 'Users', to: '/users', icon: Users, adminOnly: true },
  { label: 'Alerts', to: '/alerts', icon: Bell },
  { label: 'Analytics', to: '/analytics', icon: ChartNoAxesCombined },
  { label: 'Settings', to: '/settings', icon: Settings },
];

export default function Layout({ children, user, onLogout }) {
  const navigate = useNavigate();
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const logoutDialogRef = useRef(null);
  const roleLabel = (user?.role || 'User').replace('_', ' ');
  const statusTone = user?.role === 'ADMIN' ? 'Admin view' : user?.role === 'REVIEWER' ? 'Review lane' : 'Creator workspace';

  useEffect(() => {
    const dialog = logoutDialogRef.current;
    if (!dialog) return;
    if (logoutDialogOpen && !dialog.open) dialog.showModal();
    if (!logoutDialogOpen && dialog.open) dialog.close();
  }, [logoutDialogOpen]);

  const confirmLogout = () => {
    onLogout();
    setLogoutDialogOpen(false);
    navigate('/login', { replace: true });
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-header">
          <div className="brand-mark">BG</div>
          <div>
            <strong>BrandGuard AI</strong>
            <small>{roleLabel}</small>
          </div>
        </div>

        <div className="sidebar-card">
          <span className="eyebrow">Workspace</span>
          <div className="workspace-name">Governance Console</div>
          <div className="workspace-status">{statusTone}</div>
        </div>

        <div className="user-summary">
          <span className="summary-label">Signed in</span>
          <strong>{user?.name || 'Team member'}</strong>
          <small>{user?.email || 'brandguard@workspace.ai'}</small>
        </div>

        <nav className="nav-list">
          {navItems.filter((item) => (!item.adminOnly || user?.role === 'ADMIN') && (!item.reviewerOnly || ['ADMIN', 'REVIEWER'].includes(user?.role))).map(({ label, to, icon: Icon }) => (
            <NavLink key={label} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={16} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <button className="logout-btn btn-wrapper btn" onClick={() => setLogoutDialogOpen(true)}>Logout</button>
      </aside>

      <main className="main-panel">{children}</main>

      <dialog
        ref={logoutDialogRef}
        className="logout-dialog"
        aria-labelledby="logout-dialog-title"
        aria-describedby="logout-dialog-description"
        onCancel={(event) => {
          event.preventDefault();
          setLogoutDialogOpen(false);
        }}
        onClose={() => setLogoutDialogOpen(false)}
      >
        <h2 id="logout-dialog-title">Log out?</h2>
        <p id="logout-dialog-description">Are you sure you want to log out?</p>
        <div className="logout-dialog-actions">
          <button className="ghost-btn btn-wrapper btn" onClick={() => setLogoutDialogOpen(false)}>Cancel</button>
          <button className="logout-btn btn-wrapper btn" onClick={confirmLogout}>Logout</button>
        </div>
      </dialog>
    </div>
  );
}
