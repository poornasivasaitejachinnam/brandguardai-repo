import { Bell, BookOpenCheck, BriefcaseBusiness, Building2, ChartNoAxesCombined, LayoutDashboard, Settings, ShieldCheck, Signature, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';

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
  const roleLabel = (user?.role || 'User').replace('_', ' ');
  const statusTone = user?.role === 'ADMIN' ? 'Admin view' : user?.role === 'REVIEWER' ? 'Review lane' : 'Creator workspace';

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

        <button className="logout-btn" onClick={onLogout}>Logout</button>
      </aside>

      <main className="main-panel">{children}</main>
    </div>
  );
}
