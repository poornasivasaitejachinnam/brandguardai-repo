import { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ReviewsPage() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [reviewerId, setReviewerId] = useState('');
  const [comments, setComments] = useState({});
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const isAdmin = user?.role === 'ADMIN';

  const load = async () => {
    setError('');
    try {
      const { data } = await api.get('/reviews');
      setReviews(data.reviews);
      if (isAdmin) {
        const users = await api.get('/users');
        setReviewers(users.data.users.filter((item) => item.role === 'reviewer' && item.status === 'active'));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Review queue could not be loaded.');
    }
  };
  useEffect(() => { load(); }, []);

  const decide = async (id, decision) => {
    setError('');
    try {
      await api.put(`/reviews/${id}/${decision}`, { comments: comments[id] || '' });
      setComments((current) => ({ ...current, [id]: '' }));
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Review action failed.');
    }
  };
  const assign = async (id) => {
    setError('');
    try {
      await api.post(`/reviews/${id}/assign`, { reviewer_id: Number(reviewerId) });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Reviewer assignment failed.');
    }
  };
  const viewAnalysis = async (id) => {
    setError('');
    try {
      const { data } = await api.get(`/content/${id}`);
      setDetail(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Submission analysis could not be loaded.');
    }
  };

  return (
    <div className="page-shell">
      <div className="page-header">
        <div className="page-intro">
          <span className="eyebrow">Quality gate</span>
          <h1 className="section-title">Review queue</h1>
          <p className="page-subtitle">Assess AI findings and record clear approval decisions.</p>
        </div>
        <div className="header-badge">{reviews.length} pending reviews</div>
      </div>
      {error && <div className="notice error-state">{error}</div>}
      <div className="table-card">
        <div className="section-heading"><span className="eyebrow">Work in progress</span><h3>Assigned submissions</h3></div>
        {reviews.length ? <div className="table-scroll"><table className="table">
          <thead><tr><th>Submission</th><th>Brand</th><th>Creator</th><th>Status</th><th>AI review</th><th>Review action</th></tr></thead>
          <tbody>{reviews.map((item) => (
            <tr key={item.submission_id}>
              <td>{item.title}<br /><small>#{item.submission_id}</small></td>
              <td>{item.brand_name}</td><td>{item.creator_name}</td>
              <td>{item.status.replaceAll('_', ' ')}</td>
              <td><button className="secondary-btn btn-wrapper btn" onClick={() => viewAnalysis(item.submission_id)}>View analysis</button></td>
              <td>
                {isAdmin ? (
                  <div className="inline-controls">
                    <select aria-label="Reviewer" value={reviewerId} onChange={(e) => setReviewerId(e.target.value)}><option value="">Select reviewer</option>{reviewers.map((reviewer) => <option value={reviewer.user_id} key={reviewer.user_id}>{reviewer.full_name}</option>)}</select>
                    <button className="secondary-btn btn-wrapper btn" disabled={!reviewerId} onClick={() => assign(item.submission_id)}>Assign</button>
                  </div>
                ) : (
                  <>
                    <input className="comment-input" placeholder="Optional reviewer comment" value={comments[item.submission_id] || ''} onChange={(e) => setComments({ ...comments, [item.submission_id]: e.target.value })} />
                    <div className="button-row" style={{ marginTop: 6 }}>
                      <button className="secondary-btn btn-wrapper btn" onClick={() => decide(item.submission_id, 'approve')}>Approve</button>
                      <button className="ghost-btn btn-wrapper btn" onClick={() => decide(item.submission_id, 'reject')}>Reject</button>
                      <button className="ghost-btn btn-wrapper btn" onClick={() => decide(item.submission_id, 'changes-requested')}>Request changes</button>
                    </div>
                  </>
                )}
              </td>
            </tr>
          ))}</tbody>
        </table></div> : <div className="empty-state"><strong>Queue is clear</strong><p className="muted">No submissions are waiting for review.</p></div>}
      </div>
      {detail && <div className="panel-card detail-panel">
        <div className="toolbar"><h3>{detail.submission.title}</h3><button className="ghost-btn btn-wrapper btn" onClick={() => setDetail(null)}>Close</button></div>
        <p><strong>Brand:</strong> {detail.submission.brand_name} · <strong>Status:</strong> {detail.submission.status.replaceAll('_', ' ')}</p>
        <pre className="content-preview">{detail.submission.content_text}</pre>
        {detail.analyses?.[0] && <p><strong>Compliance score:</strong> {detail.analyses[0].overall_score}% — {detail.analyses[0].compliance_status.replaceAll('_', ' ')}</p>}
        {detail.issues?.length ? <ul>{detail.issues.map((issue) => <li key={issue.detected_issue_id}><strong>{issue.severity}</strong> — {issue.issue_description}<br /><span className="muted">{issue.suggested_text}</span></li>)}</ul> : <p className="muted">No detected issues.</p>}
        <h4>Review history</h4>
        {detail.reviewActions?.length ? detail.reviewActions.map((action) => <p key={action.review_id}><strong>{action.reviewer_name}:</strong> {action.decision} — {action.comments || 'No comments'} ({new Date(action.reviewed_at).toLocaleString()})</p>) : <p className="muted">No review decisions recorded.</p>}
        {detail.reviewComments?.map((comment) => <p key={comment.comment_id}><strong>{comment.full_name} commented:</strong> {comment.comment_text}</p>)}
      </div>}
    </div>
  );
}
