import { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const ruleForm = { category: 'tone', rule_title: '', rule_description: '', severity: 'medium' };

export default function GuidelinesPage() {
  const { user } = useAuth();
  const [brands, setBrands] = useState([]);
  const [guidelines, setGuidelines] = useState([]);
  const [rules, setRules] = useState([]);
  const [brandId, setBrandId] = useState('');
  const [guidelineId, setGuidelineId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [newRule, setNewRule] = useState(ruleForm);
  const [error, setError] = useState('');
  const isAdmin = user?.role === 'ADMIN';

  const loadBrands = async () => {
    try {
      const { data } = await api.get('/brands');
      setBrands(data.brands);
      if (data.brands[0]) setBrandId(String(data.brands[0].brand_id));
    } catch (err) {
      setError(err.response?.data?.message || 'Brands could not be loaded.');
    }
  };
  const loadGuidelines = async (id) => {
    if (!id) return;
    try {
      const { data } = await api.get(`/guidelines?brand_id=${id}`);
      setGuidelines(data.guidelines);
      if (data.guidelines[0]) {
        setGuidelineId(String(data.guidelines[0].guideline_id));
        loadRules(data.guidelines[0].guideline_id);
      } else {
        setGuidelineId('');
        setRules([]);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Guidelines could not be loaded.');
    }
  };
  const loadRules = async (id) => {
    try {
      const { data } = await api.get(`/guidelines/${id}/rules`);
      setRules(data.rules);
    } catch (err) {
      setError(err.response?.data?.message || 'Guideline rules could not be loaded.');
    }
  };

  useEffect(() => { loadBrands(); }, []);
  useEffect(() => { loadGuidelines(brandId); }, [brandId]);

  const createGuideline = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/guidelines', { brand_id: Number(brandId), title, description });
      setTitle('');
      setDescription('');
      await loadGuidelines(brandId);
      setGuidelineId(String(data.guideline_id));
      await loadRules(data.guideline_id);
    } catch (err) {
      setError(err.response?.data?.message || 'Guideline could not be created.');
    }
  };
  const activateGuideline = async () => {
    const selected = guidelines.find((item) => String(item.guideline_id) === guidelineId);
    if (!selected) return;
    try {
      await api.put(`/guidelines/${selected.guideline_id}`, {
        title: selected.title,
        description: selected.description,
        status: 'active',
        change_summary: 'Guideline activated',
      });
      await loadGuidelines(brandId);
    } catch (err) {
      setError(err.response?.data?.message || 'Guideline could not be activated.');
    }
  };
  const createRule = async (event) => {
    event.preventDefault();
    try {
      await api.post(`/guidelines/${guidelineId}/rules`, newRule);
      setNewRule(ruleForm);
      await loadRules(guidelineId);
    } catch (err) {
      setError(err.response?.data?.message || 'Rule could not be saved.');
    }
  };
  const toggleRule = async (rule) => {
    try {
      await api.put(`/guidelines/rules/${rule.rule_id}`, { ...rule, is_active: !rule.is_active });
      await loadRules(guidelineId);
    } catch (err) {
      setError(err.response?.data?.message || 'Rule could not be updated.');
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="page-intro">
          <span className="eyebrow">Governance</span>
          <h1 className="section-title">Brand guidelines</h1>
        </div>
        <div className="header-badge">{guidelines.length} guideline sets</div>
      </div>
      {error && <div className="notice error-state">{error}</div>}
      <div className="panel-card" style={{ marginBottom: 20 }}>
        <div className="form-row">
          <div className="field"><label>Brand</label><select value={brandId} onChange={(e) => setBrandId(e.target.value)}><option value="">Select brand</option>{brands.map((brand) => <option key={brand.brand_id} value={brand.brand_id}>{brand.brand_name}</option>)}</select></div>
          <div className="field"><label>Guideline</label><select value={guidelineId} onChange={(e) => { setGuidelineId(e.target.value); loadRules(e.target.value); }}><option value="">Select guideline</option>{guidelines.map((item) => <option key={item.guideline_id} value={item.guideline_id}>{item.title} · {item.status} · v{item.version}</option>)}</select></div>
          {isAdmin && guidelineId && guidelines.find((item) => String(item.guideline_id) === guidelineId)?.status !== 'active' && <div className="field"><label>Publish</label><button className="secondary-btn" onClick={activateGuideline}>Activate guideline</button></div>}
        </div>
      </div>
      {isAdmin && (
        <div className="panel-card" style={{ marginBottom: 20 }}>
          <h3>Create draft guideline</h3>
          <form className="form-grid" onSubmit={createGuideline}>
            <div className="field"><label>Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
            <div className="field"><label>Description</label><textarea rows="2" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <button className="primary-btn" disabled={!brandId}>Create guideline</button>
          </form>
        </div>
      )}
      {isAdmin && guidelineId && (
        <div className="panel-card" style={{ marginBottom: 20 }}>
          <h3>Add rule</h3>
          <form className="form-grid" onSubmit={createRule}>
            <div className="form-row">
              <div className="field"><label>Category</label><select value={newRule.category} onChange={(e) => setNewRule({ ...newRule, category: e.target.value })}><option>tone</option><option>terminology</option><option>claims</option><option>visual</option><option>accessibility</option><option>other</option></select></div>
              <div className="field"><label>Severity</label><select value={newRule.severity} onChange={(e) => setNewRule({ ...newRule, severity: e.target.value })}><option>low</option><option>medium</option><option>high</option><option>critical</option></select></div>
              <div className="field"><label>Title</label><input value={newRule.rule_title} onChange={(e) => setNewRule({ ...newRule, rule_title: e.target.value })} required /></div>
            </div>
            <div className="field"><label>Rule description (e.g. prohibit the phrase “guaranteed”)</label><textarea rows="2" value={newRule.rule_description} onChange={(e) => setNewRule({ ...newRule, rule_description: e.target.value })} required /></div>
            <button className="primary-btn">Save rule</button>
          </form>
        </div>
      )}
      <div className="table-card">
        <h3>Configured rules</h3>
        {rules.length ? <table className="table"><thead><tr><th>Rule</th><th>Category</th><th>Severity</th><th>Status</th>{isAdmin && <th />}</tr></thead><tbody>
          {rules.map((rule) => <tr key={rule.rule_id}><td><strong>{rule.rule_title}</strong><br /><span className="muted">{rule.rule_description}</span></td><td>{rule.category}</td><td>{rule.severity}</td><td>{rule.is_active ? 'Active' : 'Inactive'}</td>{isAdmin && <td><button className="secondary-btn" onClick={() => toggleRule(rule)}>{rule.is_active ? 'Disable' : 'Enable'}</button></td>}</tr>)}
        </tbody></table> : <p className="muted">Select a guideline with configured rules, or add rules as an administrator.</p>}
      </div>
    </div>
  );
}
