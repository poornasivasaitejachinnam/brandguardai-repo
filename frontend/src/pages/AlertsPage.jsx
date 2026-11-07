import { useEffect, useState } from 'react';
import api from '../services/api';

export default function AlertsPage() {
  const [notifications, setNotifications] = useState([]);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications);
    } catch (err) {
      setError(err.response?.data?.message || 'Notifications could not be loaded.');
    }
  };
  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    try {
      await api.put(`/notifications/${id}/read`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Notification could not be updated.');
    }
  };
  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Notifications could not be updated.');
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="page-intro">
          <span className="eyebrow">Signals</span>
          <h1 className="section-title">Notifications</h1>
        </div>
        <button className="secondary-btn" onClick={markAllRead}>Mark all read</button>
      </div>
      {error && <div className="notice error-state">{error}</div>}
      <div className="notification-list">
        {notifications.length ? notifications.map((item) => (
          <article className={`notification-item ${item.is_read ? '' : 'unread'}`} key={item.notification_id}>
            <div><strong>{item.title}</strong><p>{item.message}</p><small>{new Date(item.created_at).toLocaleString()} · {item.notification_type}</small></div>
            {!item.is_read && <button className="ghost-btn" onClick={() => markRead(item.notification_id)}>Mark read</button>}
          </article>
        )) : <div className="panel-card muted">No notifications.</div>}
      </div>
    </div>
  );
}
