import { useEffect, useState } from 'react';
import api from '../services/api';

const empty = { organization_name: '', organization_type: '', industry: '', website: '', contact_email: '' };

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/organizations');
      setOrganizations(data.organizations);
    } catch (err) {
      setError(err.response?.data?.message || 'Organizations could not be loaded.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const updateForm = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const save = async (event) => {
    event.preventDefault();
    setError('');
    try {
      if (editing) await api.put(`/organizations/${editing}`, form);
      else await api.post('/organizations', form);
      setForm(empty);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Organization could not be saved.');
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="page-intro">
          <span className="eyebrow">Network</span>
          <h1 className="section-title">Organizations</h1>
        </div>
        <div className="header-badge">{organizations.length} organizations</div>
      </div>
      {error && <div className="notice error-state">{error}</div>}
      <div className="panel-card" style={{ marginBottom: 24 }}>
        <h3>{editing ? 'Edit organization' : 'Create organization'}</h3>
        <form className="form-grid" onSubmit={save}>
          <div className="form-row">
            <div className="field"><label>Name</label><input name="organization_name" value={form.organization_name} onChange={updateForm} required /></div>
            <div className="field"><label>Type</label><input name="organization_type" value={form.organization_type} onChange={updateForm} /></div>
            <div className="field"><label>Industry</label><input name="industry" value={form.industry} onChange={updateForm} /></div>
          </div>
          <div className="form-row">
            <div className="field"><label>Website</label><input name="website" type="url" value={form.website} onChange={updateForm} /></div>
            <div className="field"><label>Contact email</label><input name="contact_email" type="email" value={form.contact_email} onChange={updateForm} /></div>
          </div>
          <div className="button-row"><button className="primary-btn">{editing ? 'Save changes' : 'Create organization'}</button>{editing && <button className="ghost-btn" type="button" onClick={() => { setEditing(null); setForm(empty); }}>Cancel</button>}</div>
        </form>
      </div>
      <div className="table-card">
        {loading ? <p>Loading organizations…</p> : organizations.length ? (
          <table className="table">
            <thead><tr><th>Organization</th><th>Industry</th><th>Website</th><th>Status</th><th /></tr></thead>
            <tbody>{organizations.map((org) => (
              <tr key={org.organization_id}>
                <td>{org.organization_name}</td><td>{org.industry || '—'}</td><td>{org.website || '—'}</td>
                <td>{org.status}</td>
                <td><button className="secondary-btn" onClick={() => { setEditing(org.organization_id); setForm({ ...empty, ...org }); }}>Edit</button></td>
              </tr>
            ))}</tbody>
          </table>
        ) : <p className="muted">No organizations found.</p>}
      </div>
    </div>
  );
}
