const { query } = require('../config/db');

const firstValue = (rows) => Number(rows[0]?.total || 0);

const getDashboard = async (req, res, next) => {
  try {
    const role = String(req.user.role).toUpperCase();
    let stats;
    let recentActivities;

    if (role === 'ADMIN') {
      const [users, organizations, brands, submissions, pendingReviews, approved, rejected, average] = await Promise.all([
        query('SELECT COUNT(*) AS total FROM users'),
        query('SELECT COUNT(*) AS total FROM organizations'),
        query('SELECT COUNT(*) AS total FROM brands'),
        query('SELECT COUNT(*) AS total FROM content_submissions'),
        query("SELECT COUNT(*) AS total FROM content_submissions WHERE status IN ('analysis_completed', 'changes_requested')"),
        query("SELECT COUNT(*) AS total FROM content_submissions WHERE status = 'approved'"),
        query("SELECT COUNT(*) AS total FROM content_submissions WHERE status = 'rejected'"),
        query('SELECT AVG(overall_score) AS average FROM ai_analysis_runs WHERE compliance_status != \'failed\''),
      ]);
      stats = {
        users: firstValue(users),
        organizations: firstValue(organizations),
        brands: firstValue(brands),
        submissions: firstValue(submissions),
        pendingReviews: firstValue(pendingReviews),
        approved: firstValue(approved),
        rejected: firstValue(rejected),
        averageComplianceScore: Number(average[0]?.average || 0),
      };
      recentActivities = await query(
        `SELECT a.activity_type, a.activity_description, a.created_at, u.full_name, s.title
         FROM submission_activity a
         JOIN users u ON u.user_id = a.user_id
         JOIN content_submissions s ON s.submission_id = a.submission_id
         ORDER BY a.created_at DESC LIMIT 10`
      );
    } else if (role === 'REVIEWER') {
      const [assigned, pending, approved, rejected] = await Promise.all([
        query('SELECT COUNT(DISTINCT submission_id) AS total FROM review_assignments WHERE reviewer_id = ?', [req.user.id]),
        query(`SELECT COUNT(DISTINCT s.submission_id) AS total FROM content_submissions s
               JOIN review_assignments a ON a.submission_id = s.submission_id
               WHERE a.reviewer_id = ? AND a.assignment_status IN ('assigned', 'in_progress')`, [req.user.id]),
        query(`SELECT COUNT(*) AS total FROM review_actions WHERE reviewer_id = ? AND decision = 'approved'`, [req.user.id]),
        query(`SELECT COUNT(*) AS total FROM review_actions WHERE reviewer_id = ? AND decision = 'rejected'`, [req.user.id]),
      ]);
      stats = { assigned: firstValue(assigned), pendingReviews: firstValue(pending), approved: firstValue(approved), rejected: firstValue(rejected) };
      recentActivities = await query(
        `SELECT a.activity_type, a.activity_description, a.created_at, s.title
         FROM submission_activity a
         JOIN review_assignments ra ON ra.submission_id = a.submission_id
         JOIN content_submissions s ON s.submission_id = a.submission_id
         WHERE ra.reviewer_id = ? ORDER BY a.created_at DESC LIMIT 10`,
        [req.user.id]
      );
    } else {
      const [mine, pendingAnalysis, underReview, approved, rejected] = await Promise.all([
        query('SELECT COUNT(*) AS total FROM content_submissions WHERE submitted_by = ?', [req.user.id]),
        query("SELECT COUNT(*) AS total FROM content_submissions WHERE submitted_by = ? AND status IN ('submitted', 'analyzing')", [req.user.id]),
        query("SELECT COUNT(*) AS total FROM content_submissions WHERE submitted_by = ? AND status IN ('analysis_completed', 'changes_requested')", [req.user.id]),
        query("SELECT COUNT(*) AS total FROM content_submissions WHERE submitted_by = ? AND status = 'approved'", [req.user.id]),
        query("SELECT COUNT(*) AS total FROM content_submissions WHERE submitted_by = ? AND status = 'rejected'", [req.user.id]),
      ]);
      stats = {
        submissions: firstValue(mine),
        pendingAnalysis: firstValue(pendingAnalysis),
        underReview: firstValue(underReview),
        approved: firstValue(approved),
        rejected: firstValue(rejected),
      };
      recentActivities = await query(
        `SELECT activity_type, activity_description, created_at
         FROM submission_activity WHERE user_id = ? ORDER BY created_at DESC LIMIT 10`,
        [req.user.id]
      );
    }

    return res.json({ success: true, role, stats, recentActivities });
  } catch (error) {
    return next(error);
  }
};

module.exports = { getDashboard };
