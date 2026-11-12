import { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [reports, setReports] = useState([]);
  const [organizationId, setOrganizationId] = useState('');
  const [error, setError] = useState('');
  const isAdmin = user?.role === 'ADMIN';

  const load = async () => {
    setError('');
    try {
      const { data } = await api.get('/analytics');
      setAnalytics(data.analytics);
      if (isAdmin) {
        const [orgs, reportData] = await Promise.all([api.get('/organizations'), api.get('/reports')]);
        setOrganizations(orgs.data.organizations);
        setReports(reportData.data.reports);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Analytics could not be loaded.');
    }
  };
  useEffect(() => { load(); }, []);

  const generate = async () => {
    setError('');
    try {
      await api.post('/reports', { organization_id: Number(organizationId), report_title: 'Brand compliance summary' });
      const { data } = await api.get('/reports');
      setReports(data.reports);
    } catch (err) {
      setError(err.response?.data?.message || 'Report could not be generated.');
    }
  };

  return (
    <div>
      <h1 className="section-title">Analytics & reports</h1>
      {error && <div className="notice error-state">{error}</div>}
      <div className="table-card">
        {analytics.length ? <table className="table"><thead><tr><th>Submission status</th><th>Submissions</th><th>Average compliance</th></tr></thead><tbody>
          {analytics.map((row) => <tr key={row.status}><td>{row.status.replaceAll('_', ' ')}</td><td>{row.submissions}</td><td>{row.average_score == null ? '—' : `${Number(row.average_score).toFixed(1)}%`}</td></tr>)}
        </tbody></table> : <p className="muted">No analysis data is available yet.</p>}
      </div>
      {isAdmin && <>
        <div className="panel-card" style={{ marginTop: 20 }}>
          <h3>Generate report</h3>
          <div className="form-row">
            <div className="field"><label>Organization</label><select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}><option value="">Select organization</option>{organizations.map((org) => <option value={org.organization_id} key={org.organization_id}>{org.organization_name}</option>)}</select></div>
            <div className="field" style={{ justifyContent: 'end', display: 'flex', alignItems: 'end' }}><button className="primary-btn btn-wrapper btn" disabled={!organizationId} onClick={generate}>Generate report</button></div>
          </div>
        </div>
        <div className="table-card" style={{ marginTop: 20 }}>
          <h3>Saved reports</h3>
          {reports.length ? <table className="table"><thead><tr><th>Report</th><th>Generated</th><th>Submissions</th><th>Average score</th><th /></tr></thead><tbody>
            {reports.map((report) => <tr key={report.report_id}><td>{report.report_title}</td><td>{new Date(report.generated_at).toLocaleString()}</td><td>{report.total_submissions}</td><td>{report.average_compliance_score ?? '—'}</td><td><a className="secondary-btn btn-wrapper btn" href={`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/reports/${report.report_id}/export.csv`} onClick={(event) => { event.preventDefault(); api.get(`/reports/${report.report_id}/export.csv`, { responseType: 'blob' }).then(({ data }) => { const url = URL.createObjectURL(data); const link = document.createElement('a'); link.href = url; link.download = `brandguard-report-${report.report_id}.csv`; link.click(); URL.revokeObjectURL(url); }).catch((err) => setError(err.response?.data?.message || 'Report export failed.')); }}>Download CSV</a></td></tr>)}
          </tbody></table> : <p className="muted">No reports generated.</p>}
        </div>
      </>}
    </div>
  );
}
