const { query, withTransaction } = require('../config/db');

const listUsers = async (_req, res, next) => {
  try {
    const users = await query(
      `SELECT user_id, full_name, email, role, status, organization_id, created_at
       FROM users ORDER BY created_at DESC LIMIT 200`
    );
    return res.json({ success: true, users });
  } catch (error) {
    return next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { role, status, organization_id } = req.body;
    const allowedRoles = new Set(['admin', 'content_creator', 'reviewer']);
    const allowedStatuses = new Set(['active', 'inactive']);
    if ((role && !allowedRoles.has(role)) || (status && !allowedStatuses.has(status))) {
      return res.status(400).json({ success: false, message: 'Role or status is invalid.' });
    }

    await withTransaction(async (connection) => {
      await connection.execute(
        `UPDATE users SET role = COALESCE(?, role), status = COALESCE(?, status),
           organization_id = ? WHERE user_id = ?`,
        [role || null, status || null, organization_id ? Number(organization_id) : null, req.params.id]
      );
      await connection.execute(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES (?, 'user_updated', 'user', ?, ?)`,
        [req.user.id, req.params.id, JSON.stringify({ role, status, organization_id })]
      );
    });
    return res.json({ success: true, message: 'User updated.' });
  } catch (error) {
    return next(error);
  }
};

const listNotifications = async (req, res, next) => {
  try {
    const notifications = await query(
      `SELECT notification_id, title, message, notification_type, related_submission_id, is_read, created_at
       FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
      [req.user.id]
    );
    return res.json({ success: true, notifications });
  } catch (error) {
    return next(error);
  }
};

const markNotificationRead = async (req, res, next) => {
  try {
    await query(
      'UPDATE notifications SET is_read = 1 WHERE notification_id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    return res.json({ success: true, message: 'Notification marked as read.' });
  } catch (error) {
    return next(error);
  }
};

const markAllNotificationsRead = async (req, res, next) => {
  try {
    await query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.user.id]);
    return res.json({ success: true, message: 'Unread notifications marked as read.' });
  } catch (error) {
    return next(error);
  }
};

const listAuditLogs = async (_req, res, next) => {
  try {
    const logs = await query(
      `SELECT a.log_id, a.action, a.entity_type, a.entity_id, a.details, a.created_at, u.full_name, u.email
       FROM audit_logs a LEFT JOIN users u ON u.user_id = a.user_id
       ORDER BY a.created_at DESC LIMIT 200`
    );
    return res.json({ success: true, logs });
  } catch (error) {
    return next(error);
  }
};

const getAnalytics = async (req, res, next) => {
  try {
    const role = String(req.user.role).toUpperCase();
    let rows;
    if (role === 'ADMIN') {
      rows = await query(
        `SELECT s.status, COUNT(*) AS submissions, AVG(r.overall_score) AS average_score
         FROM content_submissions s
         LEFT JOIN (
           SELECT submission_id, MAX(run_id) AS run_id
           FROM ai_analysis_runs GROUP BY submission_id
         ) latest ON latest.submission_id = s.submission_id
         LEFT JOIN ai_analysis_runs r ON r.run_id = latest.run_id
         GROUP BY s.status`
      );
    } else if (role === 'REVIEWER') {
      rows = await query(
        `SELECT s.status, COUNT(DISTINCT s.submission_id) AS submissions, AVG(r.overall_score) AS average_score
         FROM content_submissions s
         JOIN review_assignments a ON a.submission_id = s.submission_id
         LEFT JOIN (
           SELECT submission_id, MAX(run_id) AS run_id FROM ai_analysis_runs GROUP BY submission_id
         ) latest ON latest.submission_id = s.submission_id
         LEFT JOIN ai_analysis_runs r ON r.run_id = latest.run_id
         WHERE a.reviewer_id = ? GROUP BY s.status`,
        [req.user.id]
      );
    } else {
      rows = await query(
        `SELECT s.status, COUNT(*) AS submissions, AVG(r.overall_score) AS average_score
         FROM content_submissions s
         LEFT JOIN (
           SELECT submission_id, MAX(run_id) AS run_id FROM ai_analysis_runs GROUP BY submission_id
         ) latest ON latest.submission_id = s.submission_id
         LEFT JOIN ai_analysis_runs r ON r.run_id = latest.run_id
         WHERE s.submitted_by = ? GROUP BY s.status`,
        [req.user.id]
      );
    }
    return res.json({ success: true, analytics: rows });
  } catch (error) {
    return next(error);
  }
};

const listReports = async (req, res, next) => {
  try {
    const reports = String(req.user.role).toUpperCase() === 'ADMIN'
      ? await query('SELECT * FROM compliance_reports ORDER BY generated_at DESC LIMIT 100')
      : await query('SELECT * FROM compliance_reports WHERE generated_by = ? ORDER BY generated_at DESC LIMIT 100', [req.user.id]);
    return res.json({ success: true, reports });
  } catch (error) {
    return next(error);
  }
};

const generateReport = async (req, res, next) => {
  try {
    const {
      organization_id,
      brand_id = null,
      report_title = 'Brand compliance summary',
      report_type = 'brand_compliance',
      date_from = null,
      date_to = null,
    } = req.body;
    if (!organization_id || !['brand_compliance', 'submission_summary', 'violation_summary', 'review_summary', 'custom'].includes(report_type)) {
      return res.status(400).json({ success: false, message: 'A valid organization and report type are required.' });
    }
    const [counts] = await query(
      `SELECT COUNT(DISTINCT s.submission_id) AS total_submissions,
         SUM(r.compliance_status = 'compliant') AS compliant_count,
         SUM(r.compliance_status = 'partially_compliant') AS partially_compliant_count,
         SUM(r.compliance_status = 'non_compliant') AS non_compliant_count,
         AVG(r.overall_score) AS average_compliance_score
       FROM content_submissions s
       JOIN brands b ON b.brand_id = s.brand_id
       LEFT JOIN (
         SELECT ar.submission_id, ar.compliance_status, ar.overall_score
         FROM ai_analysis_runs ar
         JOIN (SELECT submission_id, MAX(run_id) AS run_id FROM ai_analysis_runs GROUP BY submission_id) latest
           ON latest.run_id = ar.run_id
       ) r ON r.submission_id = s.submission_id
       WHERE b.organization_id = ? AND (? IS NULL OR b.brand_id = ?)
         AND (? IS NULL OR DATE(s.submitted_at) >= ?)
         AND (? IS NULL OR DATE(s.submitted_at) <= ?)`,
      [Number(organization_id), brand_id ? Number(brand_id) : null, brand_id ? Number(brand_id) : null, date_from, date_from, date_to, date_to]
    );
    const data = {
      total_submissions: Number(counts.total_submissions || 0),
      compliant_count: Number(counts.compliant_count || 0),
      partially_compliant_count: Number(counts.partially_compliant_count || 0),
      non_compliant_count: Number(counts.non_compliant_count || 0),
      average_compliance_score: Number(counts.average_compliance_score || 0),
    };
    const reportId = await withTransaction(async (connection) => {
      const [report] = await connection.execute(
        `INSERT INTO compliance_reports
           (organization_id, brand_id, generated_by, report_title, report_type, date_from, date_to,
            total_submissions, compliant_count, partially_compliant_count, non_compliant_count,
            average_compliance_score, report_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          Number(organization_id),
          brand_id ? Number(brand_id) : null,
          req.user.id,
          report_title,
          report_type,
          date_from,
          date_to,
          data.total_submissions,
          data.compliant_count,
          data.partially_compliant_count,
          data.non_compliant_count,
          data.average_compliance_score,
          JSON.stringify(data),
        ]
      );
      await connection.execute(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES (?, 'report_generated', 'compliance_report', ?, ?)`,
        [req.user.id, report.insertId, report_title]
      );
      return report.insertId;
    });
    return res.status(201).json({ success: true, report_id: reportId, report: data });
  } catch (error) {
    return next(error);
  }
};

const exportReportCsv = async (req, res, next) => {
  try {
    const [report] = await query(
      String(req.user.role).toUpperCase() === 'ADMIN'
        ? 'SELECT * FROM compliance_reports WHERE report_id = ?'
        : 'SELECT * FROM compliance_reports WHERE report_id = ? AND generated_by = ?',
      String(req.user.role).toUpperCase() === 'ADMIN' ? [req.params.id] : [req.params.id, req.user.id]
    );
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }
    await query(
      'INSERT INTO report_exports (report_id, exported_by, file_format) VALUES (?, ?, ?)',
      [report.report_id, req.user.id, 'csv']
    );
    const data = typeof report.report_data === 'string' ? JSON.parse(report.report_data) : report.report_data;
    const csv = [
      'metric,value',
      ...Object.entries(data || {}).map(([key, value]) => `${key},${JSON.stringify(value)}`),
    ].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="brandguard-report-${report.report_id}.csv"`);
    return res.send(csv);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listUsers,
  updateUser,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  listAuditLogs,
  getAnalytics,
  listReports,
  generateReport,
  exportReportCsv,
};
