import { useEffect, useState } from 'react';
import api from '../services/api';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [error, setError] = useState('');

  const load = async () => {
    setError('');
    try {
      const [userData, orgData] = await Promise.all([api.get('/users'), api.get('/organizations')]);
      setUsers(userData.data.users);
      setOrganizations(orgData.data.organizations);
    } catch (err) {
      setError(err.response?.data?.message || 'User management is unavailable.');
    }
  };
  useEffect(() => { load(); }, []);

  const update = async (user, field, value) => {
    setError('');
    try {
      await api.put(`/users/${user.user_id}`, {
        role: field === 'role' ? value : user.role,
        status: field === 'status' ? value : user.status,
        organization_id: field === 'organization_id' ? value : user.organization_id,
      });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'User could not be updated.');
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="page-intro">
          <span className="eyebrow">Access</span>
          <h1 className="section-title">User management</h1>
        </div>
        <div className="header-badge">{users.length} accounts</div>
      </div>
      {error && <div className="notice error-state">{error}</div>}
      <div className="table-card">
        {users.length ? <table className="table"><thead><tr><th>User</th><th>Role</th><th>Organization</th><th>Status</th></tr></thead><tbody>
          {users.map((user) => <tr key={user.user_id}>
            <td>{user.full_name}<br /><small>{user.email}</small></td>
            <td><select value={user.role} onChange={(e) => update(user, 'role', e.target.value)}><option value="admin">Admin</option><option value="content_creator">Content creator</option><option value="reviewer">Reviewer</option></select></td>
            <td><select value={user.organization_id || ''} onChange={(e) => update(user, 'organization_id', e.target.value || null)}><option value="">Unassigned</option>{organizations.map((org) => <option key={org.organization_id} value={org.organization_id}>{org.organization_name}</option>)}</select></td>
            <td><select value={user.status} onChange={(e) => update(user, 'status', e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></td>
          </tr>)}
        </tbody></table> : <p className="muted">Loading users or no users are available.</p>}
      </div>
    </div>
  );
}
