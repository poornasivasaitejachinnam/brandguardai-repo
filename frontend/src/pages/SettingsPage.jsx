import { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function SettingsPage() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState({ full_name: user?.name || '', email: user?.email || '' });
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '' });
  const [visiblePasswords, setVisiblePasswords] = useState({ current: false, new: false });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setProfile({ full_name: user?.name || '', email: user?.email || '' });
  }, [user]);

  const saveProfile = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const { data } = await api.put('/auth/profile', profile);
      updateUser(data);
      setMessage('Profile updated.');
    } catch (err) {
      setError(err.response?.data?.message || 'Profile could not be updated.');
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const { data } = await api.put('/auth/profile', passwords);
      updateUser(data);
      setPasswords({ current_password: '', new_password: '' });
      setMessage('Password updated.');
    } catch (err) {
      setError(err.response?.data?.message || 'Password could not be updated.');
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="page-intro">
          <span className="eyebrow">Account</span>
          <h1 className="section-title">Profile and settings</h1>
          <p className="page-subtitle">Manage your personal information and sign-in security.</p>
        </div>
        <div className="header-badge">{user?.role?.replace('_', ' ') || 'User'}</div>
      </div>
      {error && <div className="notice error-state">{error}</div>}
      {message && <div className="notice success-state">{message}</div>}
      <div className="form-row">
        <form className="panel-card form-grid" onSubmit={saveProfile}>
          <div className="section-heading"><span className="eyebrow">Personal details</span><h2>Profile</h2><p className="muted">Your name and email used across BrandGuard.</p></div>
          <div className="field">
            <label htmlFor="full-name">Full name</label>
            <input id="full-name" value={profile.full_name} onChange={(event) => setProfile({ ...profile, full_name: event.target.value })} required maxLength={100} />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} required maxLength={150} />
          </div>
          <button className="primary-btn btn-wrapper btn" type="submit">Save profile</button>
        </form>
        <form className="panel-card form-grid" onSubmit={changePassword}>
          <div className="section-heading"><span className="eyebrow">Security</span><h2>Change password</h2><p className="muted">Choose a unique password with at least 10 characters.</p></div>
          <div className="field">
            <label htmlFor="current-password">Current password</label>
            <div className="password-wrap">
              <input id="current-password" type={visiblePasswords.current ? 'text' : 'password'} autoComplete="current-password" value={passwords.current_password} onChange={(event) => setPasswords({ ...passwords, current_password: event.target.value })} required />
              <button className="password-toggle monkey-toggle" type="button" aria-controls="current-password" aria-label={visiblePasswords.current ? 'Hide current password' : 'Show current password'} onClick={() => setVisiblePasswords((current) => ({ ...current, current: !current.current }))}><span aria-hidden="true">{visiblePasswords.current ? '🐵' : '🙈'}</span></button>
            </div>
          </div>
          <div className="field">
            <label htmlFor="new-password">New password (at least 10 characters)</label>
            <div className="password-wrap">
              <input id="new-password" type={visiblePasswords.new ? 'text' : 'password'} autoComplete="new-password" minLength={10} value={passwords.new_password} onChange={(event) => setPasswords({ ...passwords, new_password: event.target.value })} required />
              <button className="password-toggle monkey-toggle" type="button" aria-controls="new-password" aria-label={visiblePasswords.new ? 'Hide new password' : 'Show new password'} onClick={() => setVisiblePasswords((current) => ({ ...current, new: !current.new }))}><span aria-hidden="true">{visiblePasswords.new ? '🐵' : '🙈'}</span></button>
            </div>
          </div>
          <button className="primary-btn btn-wrapper btn" type="submit">Change password</button>
        </form>
      </div>
    </div>
  );
}
