import { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const initialForm = { brand_id: '', title: '', content_text: '', category_id: '', campaign_name: '', target_audience: '', platform: '' };

export default function ContentPage() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [file, setFile] = useState(null);
  const [selected, setSelected] = useState(null);
  const [resubmitText, setResubmitText] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [submissionResponse, brandResponse, categoryResponse] = await Promise.all([
        api.get('/content'),
        api.get('/brands'),
        api.get('/content/categories'),
      ]);
      setSubmissions(submissionResponse.data.submissions);
      setBrands(brandResponse.data.brands);
      setCategories(categoryResponse.data.categories);
      if (brandResponse.data.brands[0]) {
        setForm((current) => ({ ...current, brand_id: current.brand_id || String(brandResponse.data.brands[0].brand_id) }));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Submissions could not be loaded.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const updateForm = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    setAnalysis(null);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => { if (value) body.append(key, value); });
      if (file) body.append('file', file);
      const { data } = await api.post('/content', body);
      setMessage(data.message);
      setAnalysis(data.analysis);
      setForm((current) => ({ ...initialForm, brand_id: current.brand_id }));
      setFile(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Submission failed.');
      if (err.response?.data?.submission_id) {
        setMessage(`Submission #${err.response.data.submission_id} was saved. Analysis needs retry.`);
      }
    } finally {
      setSaving(false);
    }
  };

  const viewSubmission = async (submission) => {
    setError('');
    try {
      const { data } = await api.get(`/content/${submission.submission_id}`);
      setSelected(data);
      setResubmitText(data.submission.content_text || '');
    } catch (err) {
      setError(err.response?.data?.message || 'Submission details could not be loaded.');
    }
  };

  const resubmit = async () => {
    try {
      const { data } = await api.put(`/content/${selected.submission.submission_id}/resubmit`, { content_text: resubmitText });
      setMessage(data.message);
      setAnalysis(data.analysis);
      setSelected(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Resubmission failed.');
    }
  };
  const retryAnalysis = async () => {
    try {
      const { data } = await api.post(`/content/${selected.submission.submission_id}/analyze`);
      setMessage('Analysis completed.');
      setAnalysis(data.analysis);
      await load();
      await viewSubmission({ submission_id: selected.submission.submission_id });
    } catch (err) {
      setError(err.response?.data?.message || 'Analysis retry failed.');
    }
  };

  const isCreator = user?.role === 'CONTENT_CREATOR';
  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="page-intro">
          <span className="eyebrow">Content</span>
          <h1 className="section-title">Content submissions</h1>
          <p className="page-subtitle">Prepare content, review compliance, and track decisions.</p>
        </div>
        <div className="header-badge">{submissions.length} submissions</div>
      </div>
      {error && <div className="notice error-state">{error}</div>}
      {message && <div className="notice success-state">{message}</div>}
      {isCreator && (
        <div className="panel-card submission-form-card">
          <div className="section-heading"><span className="eyebrow">New review</span><h3>Submit content for analysis</h3><p className="muted">Add campaign details and check your draft against the selected brand guidelines.</p></div>
          <form className="form-grid" onSubmit={submit}>
            <div className="form-row">
              <div className="field"><label>Brand</label><select name="brand_id" value={form.brand_id} onChange={updateForm} required><option value="">Select brand</option>{brands.map((brand) => <option value={brand.brand_id} key={brand.brand_id}>{brand.brand_name}</option>)}</select></div>
              <div className="field"><label>Category</label><select name="category_id" value={form.category_id} onChange={updateForm}><option value="">No category</option>{categories.map((category) => <option value={category.category_id} key={category.category_id}>{category.category_name}</option>)}</select></div>
              <div className="field"><label>Title</label><input name="title" value={form.title} onChange={updateForm} maxLength="200" required /></div>
            </div>
            <div className="form-row">
              <div className="field"><label>Campaign</label><input name="campaign_name" value={form.campaign_name} onChange={updateForm} /></div>
              <div className="field"><label>Target audience</label><input name="target_audience" value={form.target_audience} onChange={updateForm} /></div>
              <div className="field"><label>Platform</label><input name="platform" value={form.platform} onChange={updateForm} /></div>
            </div>
            <div className="field"><label>Text to analyze</label><textarea name="content_text" rows="5" value={form.content_text} onChange={updateForm} required /></div>
            <div className="field"><label>Attachment (optional, max 10 MB)</label><input type="file" accept=".png,.jpg,.jpeg,.webp,.pdf,.doc,.docx,.txt" onChange={(event) => setFile(event.target.files?.[0] || null)} /></div>
            <button className="primary-btn" disabled={saving || !brands.length}>{saving ? 'Analyzing…' : 'Submit and analyze'}</button>
          </form>
        </div>
      )}
      {analysis && (
        <div className="panel-card analysis-card">
          <div className="toolbar"><h3>Compliance analysis</h3><span className="score-pill">{analysis.compliance_score}%</span></div>
          <p>{analysis.summary}</p>
          <p><strong>Status:</strong> {analysis.status.replaceAll('_', ' ')}</p>
          {analysis.issues.length ? <ul>{analysis.issues.map((issue, index) => <li key={`${issue.rule_id}-${index}`}><strong>{issue.severity}</strong> — {issue.message}<br /><span className="muted">{issue.suggestion}</span></li>)}</ul> : <p className="muted">No configured-rule violations detected.</p>}
        </div>
      )}
      <div className="table-card">
        <div className="section-heading"><span className="eyebrow">Workspace record</span><h3>Submission history</h3></div>
        {loading ? <p>Loading submissions…</p> : submissions.length ? (
          <div className="table-scroll"><table className="table">
            <thead><tr><th>Title</th><th>Brand</th><th>Status</th><th>Score</th><th>Submitted</th><th /></tr></thead>
            <tbody>{submissions.map((item) => (
              <tr key={item.submission_id}>
                <td>{item.title}</td><td>{item.brand_name || '—'}</td>
                <td><span className={`status ${item.status === 'approved' ? 'approved' : item.status === 'rejected' ? 'rejected' : 'pending'}`}>{item.status?.replaceAll('_', ' ')}</span></td>
                <td>{item.overall_score == null ? '—' : `${Number(item.overall_score).toFixed(0)}%`}</td>
                <td>{item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : '—'}</td>
                <td><button className="secondary-btn" onClick={() => viewSubmission(item)}>Details</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="muted">No submissions yet.</p>}
      </div>
      {selected && (
        <div className="panel-card detail-panel">
          <div className="toolbar"><h3>{selected.submission.title}</h3><button className="ghost-btn" onClick={() => setSelected(null)}>Close</button></div>
          <p><strong>Status:</strong> {selected.submission.status.replaceAll('_', ' ')} · <strong>Brand:</strong> {selected.submission.brand_name}</p>
          {isCreator && ['rejected', 'changes_requested'].includes(selected.submission.status) ? (
            <div className="field"><label>Update content for resubmission</label><textarea rows="6" value={resubmitText} onChange={(event) => setResubmitText(event.target.value)} /><button className="primary-btn" style={{ marginTop: 10 }} onClick={resubmit}>Resubmit for analysis</button></div>
          ) : <pre className="content-preview">{selected.submission.content_text}</pre>}
          {isCreator && ['submitted', 'analyzing'].includes(selected.submission.status) && selected.analyses?.[0]?.compliance_status === 'failed' && <button className="primary-btn" onClick={retryAnalysis}>Retry analysis</button>}
          {selected.analyses?.[0] && <p><strong>Latest compliance:</strong> {selected.analyses[0].overall_score}% — {selected.analyses[0].compliance_status.replaceAll('_', ' ')}</p>}
          {selected.issues?.length ? <ul>{selected.issues.map((issue) => <li key={issue.detected_issue_id}>{issue.issue_description}<br /><span className="muted">{issue.suggested_text}</span></li>)}</ul> : <p className="muted">No detected issues.</p>}
          {selected.files?.map((item) => <p key={item.file_id}><a href={`http://localhost:5000${item.file_path}`} target="_blank" rel="noreferrer">{item.original_name}</a> · {item.scan_status}</p>)}
        </div>
      )}
    </div>
  );
}
