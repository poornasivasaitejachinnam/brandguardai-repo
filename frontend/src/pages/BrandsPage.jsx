import { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const initialForm = { brand_name: '', organization_id: '', brand_description: '', industry: '', website: '', brand_tone: '' };

export default function BrandsPage() {
  const { user } = useAuth();
  const [brands, setBrands] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isAdmin = user?.role === 'ADMIN';

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [brandResponse, orgResponse] = await Promise.all([api.get('/brands'), api.get('/organizations')]);
      setBrands(brandResponse.data.brands);
      setOrganizations(orgResponse.data.organizations);
      if (!isAdmin && orgResponse.data.organizations[0]) {
        setForm((current) => ({ ...current, organization_id: String(orgResponse.data.organizations[0].organization_id) }));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Brand data could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editing) await api.put(`/brands/${editing}`, form);
      else await api.post('/brands', form);
      setForm(initialForm);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Brand could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (brand) => {
    setEditing(brand.brand_id);
    setForm({
      brand_name: brand.brand_name,
      organization_id: String(brand.organization_id),
      brand_description: brand.brand_description || '',
      industry: brand.industry || '',
      website: brand.website || '',
      brand_tone: brand.brand_tone || '',
      status: brand.status,
    });
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="page-intro">
          <span className="eyebrow">Portfolio</span>
          <h1 className="section-title">Brand management</h1>
        </div>
        <div className="header-badge">{brands.length} live brands</div>
      </div>
      {error && <div className="notice error-state">{error}</div>}
      {isAdmin && (
        <div className="panel-card" style={{ marginBottom: 24 }}>
          <h3>{editing ? 'Edit brand' : 'Create brand'}</h3>
          <form className="form-grid" onSubmit={save}>
            <div className="form-row">
              <div className="field"><label>Brand name</label><input name="brand_name" value={form.brand_name} onChange={change} required /></div>
              <div className="field"><label>Organization</label>
                <select name="organization_id" value={form.organization_id} onChange={change} required>
                  <option value="">Select organization</option>
                  {organizations.map((org) => <option value={org.organization_id} key={org.organization_id}>{org.organization_name}</option>)}
                </select>
              </div>
              <div className="field"><label>Industry</label><input name="industry" value={form.industry} onChange={change} /></div>
            </div>
            <div className="form-row">
              <div className="field"><label>Website</label><input name="website" type="url" value={form.website} onChange={change} /></div>
              <div className="field"><label>Brand tone</label><input name="brand_tone" value={form.brand_tone} onChange={change} /></div>
              <div className="field"><label>Status</label><select name="status" value={form.status || 'active'} onChange={change}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
            </div>
            <div className="field"><label>Description</label><textarea name="brand_description" rows="2" value={form.brand_description} onChange={change} /></div>
            <div className="button-row"><button className="primary-btn" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create brand'}</button>{editing && <button className="ghost-btn" type="button" onClick={() => { setEditing(null); setForm(initialForm); }}>Cancel</button>}</div>
          </form>
        </div>
      )}
      <div className="table-card">
        {loading ? <p>Loading brands…</p> : brands.length ? (
          <table className="table">
            <thead><tr><th>Brand</th><th>Organization</th><th>Industry</th><th>Status</th>{isAdmin && <th>Action</th>}</tr></thead>
            <tbody>{brands.map((brand) => (
              <tr key={brand.brand_id}>
                <td>{brand.brand_name}</td><td>{brand.organization_name}</td><td>{brand.industry || '—'}</td>
                <td><span className={`status ${brand.status === 'active' ? 'approved' : 'rejected'}`}>{brand.status}</span></td>
                {isAdmin && <td><button className="secondary-btn" onClick={() => startEdit(brand)}>Edit</button></td>}
              </tr>
            ))}</tbody>
          </table>
        ) : <p className="muted">No brands are available for this account.</p>}
      </div>
    </div>
  );
}
