import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const ruleForm = { category: 'tone', rule_title: '', rule_description: '', severity: 'medium' };

export default function GuidelinesPage() {
  const { user } = useAuth();
  const brandIdRef = useRef('');
  const [brands, setBrands] = useState([]);
  const [guidelines, setGuidelines] = useState([]);
  const [rules, setRules] = useState([]);
  const [brandId, setBrandId] = useState('');
  const [guidelineId, setGuidelineId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [newRule, setNewRule] = useState(ruleForm);
  const [error, setError] = useState('');
  const [loadingBrands, setLoadingBrands] = useState(true);
  const [loadingGuidelines, setLoadingGuidelines] = useState(false);
  const [loadingRules, setLoadingRules] = useState(false);
  const [rulesRevision, setRulesRevision] = useState(0);
  const isAdmin = user?.role === 'ADMIN';

  brandIdRef.current = brandId;

  useEffect(() => {
    let active = true;
    const loadBrands = async () => {
      setLoadingBrands(true);
      setError('');
      try {
        const { data } = await api.get('/brands');
        if (!Array.isArray(data.brands)) throw new Error('The brand service returned an unexpected response.');
        if (!active) return;
        setBrands(data.brands);
      } catch (err) {
        if (active) {
          setBrands([]);
          setBrandId('');
          setError(err.response?.data?.message || err.message || 'Brands could not be loaded.');
        }
      } finally {
        if (active) setLoadingBrands(false);
      }
    };
    loadBrands();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setGuidelines([]);
    setGuidelineId('');
    setRules([]);
    setError('');

    if (!brandId) {
      setLoadingGuidelines(false);
      return () => { active = false; };
    }

    const loadGuidelines = async () => {
      setLoadingGuidelines(true);
      try {
        const { data } = await api.get('/guidelines', { params: { brand_id: brandId } });
        if (!Array.isArray(data.guidelines)) throw new Error('The guidelines service returned an unexpected response.');
        if (!active) return;
        setGuidelines(data.guidelines);
      } catch (err) {
        if (active) {
          setGuidelines([]);
          setGuidelineId('');
          setError(err.response?.data?.message || err.message || 'Guidelines could not be loaded.');
        }
      } finally {
        if (active) setLoadingGuidelines(false);
      }
    };
    loadGuidelines();
    return () => { active = false; };
  }, [brandId]);

  useEffect(() => {
    let active = true;
    setRules([]);
    setError('');

    if (!guidelineId) {
      setLoadingRules(false);
      return () => { active = false; };
    }

    const loadRules = async () => {
      setLoadingRules(true);
      try {
        const { data } = await api.get(`/guidelines/${encodeURIComponent(guidelineId)}/rules`);
        if (!Array.isArray(data.rules)) throw new Error('The rules service returned an unexpected response.');
        if (active) setRules(data.rules);
      } catch (err) {
        if (active) {
          setRules([]);
          setError(err.response?.data?.message || err.message || 'Guideline rules could not be loaded.');
        }
      } finally {
        if (active) setLoadingRules(false);
      }
    };
    loadRules();
    return () => { active = false; };
  }, [guidelineId, rulesRevision]);

  const refreshGuidelines = async (id) => {
    setLoadingGuidelines(true);
    try {
      const { data } = await api.get('/guidelines', { params: { brand_id: id } });
      if (!Array.isArray(data.guidelines)) throw new Error('The guidelines service returned an unexpected response.');
      if (String(id) === brandIdRef.current) setGuidelines(data.guidelines);
      return data.guidelines;
    } finally {
      setLoadingGuidelines(false);
    }
  };

  const createGuideline = async (event) => {
    event.preventDefault();
    setError('');
    try {
      const selectedBrandId = brandId;
      const { data } = await api.post('/guidelines', { brand_id: Number(selectedBrandId), title, description });
      setTitle('');
      setDescription('');
      await refreshGuidelines(selectedBrandId);
      if (selectedBrandId === brandIdRef.current) setGuidelineId(String(data.guideline_id));
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Guideline could not be created.');
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
      await refreshGuidelines(brandId);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Guideline could not be activated.');
    }
  };
  const createRule = async (event) => {
    event.preventDefault();
    setError('');
    try {
      await api.post(`/guidelines/${guidelineId}/rules`, newRule);
      setNewRule(ruleForm);
      setRulesRevision((revision) => revision + 1);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Rule could not be saved.');
    }
  };
  const toggleRule = async (rule) => {
    setError('');
    try {
      await api.put(`/guidelines/rules/${rule.rule_id}`, { ...rule, is_active: !rule.is_active });
      setRulesRevision((revision) => revision + 1);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Rule could not be updated.');
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
          <div className="field">
            <label htmlFor="brand-select">Brand</label>
            <select id="brand-select" value={brandId} disabled={loadingBrands || !brands.length} onChange={(event) => {
              setBrandId(event.target.value);
              setGuidelines([]);
              setGuidelineId('');
              setRules([]);
              setError('');
            }}>
              <option value="">{loadingBrands ? 'Loading brands…' : brands.length ? 'Select Brand' : 'No brands available'}</option>
              {brands.map((brand) => <option key={brand.brand_id} value={brand.brand_id}>{brand.brand_name}</option>)}
            </select>
            {loadingBrands && <small className="muted" role="status">Loading brands…</small>}
            {!loadingBrands && !brands.length && !error && <small className="muted">No brands are available for this account.</small>}
          </div>
          <div className="field">
            <label htmlFor="guideline-select">Guidelines</label>
            <select id="guideline-select" value={guidelineId} disabled={!brandId || loadingGuidelines || !guidelines.length} onChange={(event) => {
              setGuidelineId(event.target.value);
              setError('');
            }}>
              <option value="">{!brandId ? 'Select a brand first' : loadingGuidelines ? 'Loading guidelines…' : guidelines.length ? 'Select Guidelines' : 'No guidelines available'}</option>
              {guidelines.map((item) => <option key={item.guideline_id} value={item.guideline_id}>{item.title} · {item.status} · v{item.version}</option>)}
            </select>
            {loadingGuidelines && <small className="muted" role="status">Loading guidelines…</small>}
            {!loadingGuidelines && brandId && !guidelines.length && !error && <small className="muted">No guidelines are available for this brand.</small>}
          </div>
          {isAdmin && guidelineId && guidelines.find((item) => String(item.guideline_id) === guidelineId)?.status !== 'active' && <div className="field"><label>Publish</label><button className="secondary-btn btn-wrapper btn" onClick={activateGuideline}>Activate guideline</button></div>}
        </div>
      </div>
      {isAdmin && (
        <div className="panel-card" style={{ marginBottom: 20 }}>
          <h3>Create draft guideline</h3>
          <form className="form-grid" onSubmit={createGuideline}>
            <div className="field"><label>Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
            <div className="field"><label>Description</label><textarea rows="2" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <button className="primary-btn btn-wrapper btn" disabled={!brandId}>Create guideline</button>
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
            <button className="primary-btn btn-wrapper btn">Save rule</button>
          </form>
        </div>
      )}
      <div className="table-card">
        <h3>Configured rules</h3>
        {loadingRules ? <p className="muted" role="status">Loading rules…</p> : rules.length ? <table className="table"><thead><tr><th>Rule</th><th>Category</th><th>Severity</th><th>Status</th>{isAdmin && <th />}</tr></thead><tbody>
          {rules.map((rule) => <tr key={rule.rule_id}><td><strong>{rule.rule_title}</strong><br /><span className="muted">{rule.rule_description}</span></td><td>{rule.category}</td><td>{rule.severity}</td><td>{rule.is_active ? 'Active' : 'Inactive'}</td>{isAdmin && <td><button className="secondary-btn btn-wrapper btn" onClick={() => toggleRule(rule)}>{rule.is_active ? 'Disable' : 'Enable'}</button></td>}</tr>)}
        </tbody></table> : <p className="muted">Select a guideline with configured rules, or add rules as an administrator.</p>}
      </div>
    </div>
  );
}
