const { query, withTransaction } = require('../config/db');

const isAdmin = (user) => String(user.role).toUpperCase() === 'ADMIN';

const canReview = async (user, submissionId) => {
  if (isAdmin(user)) return true;
  const [assignment] = await query(
    `SELECT assignment_id FROM review_assignments
     WHERE submission_id = ? AND reviewer_id = ? AND assignment_status IN ('assigned', 'in_progress')`,
    [submissionId, user.id]
  );
  return Boolean(assignment);
};

const listReviews = async (req, res, next) => {
  try {
    const rows = isAdmin(req.user)
      ? await query(
        `SELECT s.submission_id, s.title, s.status, s.submitted_at, b.brand_name,
                u.full_name AS creator_name
         FROM content_submissions s
         JOIN brands b ON b.brand_id = s.brand_id
         JOIN users u ON u.user_id = s.submitted_by
         WHERE s.status IN ('submitted', 'analysis_completed', 'changes_requested')
         ORDER BY s.submitted_at ASC LIMIT 100`
      )
      : await query(
        `SELECT DISTINCT s.submission_id, s.title, s.status, s.submitted_at, b.brand_name,
                u.full_name AS creator_name
         FROM content_submissions s
         JOIN review_assignments a ON a.submission_id = s.submission_id
         JOIN brands b ON b.brand_id = s.brand_id
         JOIN users u ON u.user_id = s.submitted_by
         WHERE a.reviewer_id = ? AND a.assignment_status IN ('assigned', 'in_progress')
         ORDER BY s.submitted_at ASC LIMIT 100`,
        [req.user.id]
      );
    return res.json({ success: true, reviews: rows });
  } catch (error) {
    return next(error);
  }
};

const assignReviewer = async (req, res, next) => {
  try {
    const submissionId = Number(req.params.id);
    const reviewerId = Number(req.body.reviewer_id);
    if (!Number.isInteger(submissionId) || !Number.isInteger(reviewerId)) {
      return res.status(400).json({ success: false, message: 'Valid submission and reviewer IDs are required.' });
    }

    const [reviewer] = await query(
      "SELECT user_id FROM users WHERE user_id = ? AND role = 'reviewer' AND status = 'active'",
      [reviewerId]
    );
    const [submission] = await query('SELECT submission_id FROM content_submissions WHERE submission_id = ?', [submissionId]);
    if (!reviewer || !submission) {
      return res.status(404).json({ success: false, message: 'Active reviewer or submission not found.' });
    }

    await withTransaction(async (connection) => {
      await connection.execute(
        `INSERT INTO review_assignments (submission_id, reviewer_id, assigned_by, assignment_status)
         VALUES (?, ?, ?, 'assigned')`,
        [submissionId, reviewerId, req.user.id]
      );
      await connection.execute(
        `INSERT INTO notifications (user_id, title, message, notification_type, related_submission_id)
         VALUES (?, 'Review assigned', ?, 'review', ?)`,
        [reviewerId, `You have been assigned to review submission #${submissionId}.`, submissionId]
      );
      await connection.execute(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES (?, 'review_assigned', 'content_submission', ?, ?)`,
        [req.user.id, submissionId, `Assigned reviewer ${reviewerId}`]
      );
    });
    return res.status(201).json({ success: true, message: 'Reviewer assigned.' });
  } catch (error) {
    return next(error);
  }
};

const decideSubmission = (decision) => async (req, res, next) => {
  try {
    const submissionId = Number(req.params.id);
    if (!await canReview(req.user, submissionId)) {
      return res.status(403).json({ success: false, message: 'This submission is not assigned to you.' });
    }
    const [submission] = await query(
      'SELECT submission_id, submitted_by, status FROM content_submissions WHERE submission_id = ?',
      [submissionId]
    );
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found.' });
    }
    const comments = String(req.body.comments || '').trim() || null;
    const nextStatus = decision === 'changes_requested' ? 'changes_requested' : decision;

    const reviewId = await withTransaction(async (connection) => {
      const [previous] = await connection.execute(
        'SELECT review_id, decision FROM review_actions WHERE submission_id = ? ORDER BY reviewed_at DESC LIMIT 1',
        [submissionId]
      );
      const [action] = await connection.execute(
        'INSERT INTO review_actions (submission_id, reviewer_id, decision, comments) VALUES (?, ?, ?, ?)',
        [submissionId, req.user.id, decision, comments]
      );
      if (previous.length) {
        await connection.execute(
          `INSERT INTO review_action_history
             (review_id, previous_decision, new_decision, changed_by, change_reason)
           VALUES (?, ?, ?, ?, ?)`,
          [previous[0].review_id, previous[0].decision, decision, req.user.id, comments]
        );
      }
      if (comments) {
        await connection.execute(
          'INSERT INTO review_comments (review_id, user_id, comment_text) VALUES (?, ?, ?)',
          [action.insertId, req.user.id, comments]
        );
      }
      await connection.execute(
        'UPDATE content_submissions SET status = ?, updated_at = NOW() WHERE submission_id = ?',
        [nextStatus, submissionId]
      );
      await connection.execute(
        `UPDATE review_assignments SET assignment_status = 'completed', completed_at = NOW()
         WHERE submission_id = ? AND reviewer_id = ? AND assignment_status IN ('assigned', 'in_progress')`,
        [submissionId, req.user.id]
      );
      await connection.execute(
        `INSERT INTO submission_activity (submission_id, user_id, activity_type, activity_description)
         VALUES (?, ?, ?, ?)`,
        [submissionId, req.user.id, decision, comments || `Submission ${decision}.`]
      );
      const notificationType = decision === 'approved' ? 'approval' : decision === 'rejected' ? 'rejection' : 'review';
      await connection.execute(
        `INSERT INTO notifications (user_id, title, message, notification_type, related_submission_id)
         VALUES (?, ?, ?, ?, ?)`,
        [submission.submitted_by, `Content ${decision.replace('_', ' ')}`, comments || `Your content was ${decision.replace('_', ' ')}.`, notificationType, submissionId]
      );
      await connection.execute(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES (?, ?, 'content_submission', ?, ?)`,
        [req.user.id, `content_${decision}`, submissionId, comments]
      );
      return action.insertId;
    });
    return res.json({ success: true, review_id: reviewId, message: `Submission ${decision.replace('_', ' ')}.` });
  } catch (error) {
    return next(error);
  }
};

const addComment = async (req, res, next) => {
  try {
    const submissionId = Number(req.params.id);
    if (!await canReview(req.user, submissionId)) {
      return res.status(403).json({ success: false, message: 'This submission is not assigned to you.' });
    }
    const comment = String(req.body.comment_text || '').trim();
    if (!comment) {
      return res.status(400).json({ success: false, message: 'Comment cannot be empty.' });
    }
    const [actions] = await query(
      'SELECT review_id FROM review_actions WHERE submission_id = ? AND reviewer_id = ? ORDER BY reviewed_at DESC LIMIT 1',
      [submissionId, req.user.id]
    );
    if (!actions) {
      return res.status(409).json({ success: false, message: 'Create a review action before adding review comments.' });
    }
    await query(
      'INSERT INTO review_comments (review_id, user_id, comment_text) VALUES (?, ?, ?)',
      [actions.review_id, req.user.id, comment]
    );
    return res.status(201).json({ success: true, message: 'Comment added.' });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listReviews,
  assignReviewer,
  approveSubmission: decideSubmission('approved'),
  rejectSubmission: decideSubmission('rejected'),
  requestChanges: decideSubmission('changes_requested'),
  addComment,
};
