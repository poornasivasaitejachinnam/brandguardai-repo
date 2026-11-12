import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const labels = {
  ADMIN: [
    ['users', 'Total users'], ['organizations', 'Organizations'], ['brands', 'Brands'],
    ['submissions', 'Submissions'], ['pendingReviews', 'Pending reviews'],
    ['approved', 'Approved'], ['rejected', 'Rejected'], ['averageComplianceScore', 'Average score'],
  ],
  CONTENT_CREATOR: [
    ['submissions', 'My submissions'], ['pendingAnalysis', 'Pending analysis'],
    ['underReview', 'Under review'], ['approved', 'Approved'], ['rejected', 'Rejected'],
  ],
  REVIEWER: [
    ['assigned', 'Assigned submissions'], ['pendingReviews', 'Pending reviews'],
    ['approved', 'Approved'], ['rejected', 'Rejected'],
  ],
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/dashboard');
      setDashboard(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Dashboard data could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const role = user?.role || 'CONTENT_CREATOR';
  const summaryLabel = role === 'ADMIN' ? 'Executive overview' : role === 'REVIEWER' ? 'Review performance' : 'Content operations';

  return (
    <div className="page-shell dashboard-page">
      <div className="page-header">
        <div className="page-intro">
          <span className="eyebrow">{summaryLabel}</span>
          <h1 className="section-title">{role.replace('_', ' ')} dashboard</h1>
          <p className="page-subtitle">A clear view of your brand governance activity.</p>
        </div>
        <div className="header-badge"><span className="status-dot" />{user?.name || 'Team member'}</div>
      </div>

      {loading && <div className="panel-card loading-card">Loading dashboard data…</div>}
      {error && <div className="panel-card error-state">{error} <button className="secondary-btn btn-wrapper btn" onClick={load}>Retry</button></div>}
      {!loading && dashboard && (
        <>
          <div className="card-grid">
            {(labels[role] || labels.CONTENT_CREATOR).map(([key, label]) => (
              <div className="stat-card" key={key}>
                <div className="label">{label}</div>
                <div className="value">{key === 'averageComplianceScore'
                  ? `${Number(dashboard.stats[key] || 0).toFixed(1)}%`
                  : dashboard.stats[key] ?? 0}</div>
                <div className="trend-indicator"><span className="status-dot" />Current total</div>
              </div>
            ))}
          </div>

          <div className="panel-card activity-panel">
            <div className="toolbar compact">
              <div><span className="eyebrow">Latest updates</span><h3>Recent activity</h3></div>
              <span className="mini-pill">Live feed</span>
            </div>
            {dashboard.recentActivities?.length ? (
              <ul className="activity-list">
                {dashboard.recentActivities.map((activity, index) => (
                  <li key={`${activity.created_at}-${index}`}>
                    <strong>{activity.activity_type?.replaceAll('_', ' ') || 'Activity'}</strong>
                    <span>{activity.activity_description}</span>
                    <small>{new Date(activity.created_at).toLocaleString()}</small>
                  </li>
                ))}
              </ul>
            ) : <p className="muted">No activity recorded yet.</p>}
          </div>
        </>
      )}
    </div>
  );
}
