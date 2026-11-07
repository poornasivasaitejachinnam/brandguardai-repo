const fs = require('fs/promises');
const { query, withTransaction } = require('../config/db');
const { analyzeAndPersist } = require('../services/contentAnalysisService');

const isAdmin = (user) => String(user.role).toUpperCase() === 'ADMIN';
const removeUpload = async (filePath) => {
  if (!filePath) return;
  await fs.unlink(filePath).catch((error) => {
    console.error('Unable to remove rejected upload:', error.message);
  });
};

const listContent = async (req, res, next) => {
  try {
    let rows;
    if (isAdmin(req.user)) {
      rows = await query(
        `SELECT s.*, b.brand_name, c.category_name, latest.overall_score, latest.compliance_status
         FROM content_submissions s
         LEFT JOIN brands b ON b.brand_id = s.brand_id
         LEFT JOIN content_categories c ON c.category_id = s.category_id
         LEFT JOIN (SELECT ar.submission_id, ar.overall_score, ar.compliance_status
                    FROM ai_analysis_runs ar
                    JOIN (SELECT submission_id, MAX(run_id) AS run_id FROM ai_analysis_runs GROUP BY submission_id) x
                      ON x.run_id = ar.run_id) latest ON latest.submission_id = s.submission_id
         ORDER BY s.submitted_at DESC LIMIT 100`
      );
    } else if (String(req.user.role).toUpperCase() === 'REVIEWER') {
      rows = await query(
        `SELECT DISTINCT s.*, b.brand_name, c.category_name, latest.overall_score, latest.compliance_status
         FROM content_submissions s
         JOIN review_assignments a ON a.submission_id = s.submission_id
         LEFT JOIN brands b ON b.brand_id = s.brand_id
         LEFT JOIN content_categories c ON c.category_id = s.category_id
         LEFT JOIN (SELECT ar.submission_id, ar.overall_score, ar.compliance_status
                    FROM ai_analysis_runs ar
                    JOIN (SELECT submission_id, MAX(run_id) AS run_id FROM ai_analysis_runs GROUP BY submission_id) x
                      ON x.run_id = ar.run_id) latest ON latest.submission_id = s.submission_id
         WHERE a.reviewer_id = ? ORDER BY s.submitted_at DESC LIMIT 100`,
        [req.user.id]
      );
    } else {
      rows = await query(
        `SELECT s.*, b.brand_name, c.category_name, latest.overall_score, latest.compliance_status
         FROM content_submissions s
         LEFT JOIN brands b ON b.brand_id = s.brand_id
         LEFT JOIN content_categories c ON c.category_id = s.category_id
         LEFT JOIN (SELECT ar.submission_id, ar.overall_score, ar.compliance_status
                    FROM ai_analysis_runs ar
                    JOIN (SELECT submission_id, MAX(run_id) AS run_id FROM ai_analysis_runs GROUP BY submission_id) x
                      ON x.run_id = ar.run_id) latest ON latest.submission_id = s.submission_id
         WHERE s.submitted_by = ? ORDER BY s.submitted_at DESC LIMIT 100`,
        [req.user.id]
      );
    }

    return res.json({ success: true, submissions: rows });
  } catch (error) {
    return next(error);
  }
};

const listCategories = async (_req, res, next) => {
  try {
    const categories = await query('SELECT category_id, category_name, description FROM content_categories ORDER BY category_name');
    return res.json({ success: true, categories });
  } catch (error) {
    return next(error);
  }
};

const createSubmission = async (req, res, next) => {
  let uploadedPath;
  let savedSubmission = false;
  try {
    uploadedPath = req.file?.path;
    const {
      brand_id,
      title,
      content_text,
      category_id,
      campaign_name,
      target_audience,
      platform,
    } = req.body;
    const brandId = Number(brand_id);
    if (!Number.isInteger(brandId) || brandId <= 0 || !String(content_text || '').trim()) {
      await removeUpload(uploadedPath);
      return res.status(400).json({ success: false, message: 'A valid brand and text content are required for analysis.' });
    }

    const [brand] = await query(
      'SELECT brand_id, organization_id FROM brands WHERE brand_id = ? AND status = ?',
      [brandId, 'active']
    );
    if (!brand) {
      await removeUpload(uploadedPath);
      return res.status(404).json({ success: false, message: 'Active brand not found.' });
    }
    if (!isAdmin(req.user) && Number(req.user.organization_id) !== Number(brand.organization_id)) {
      await removeUpload(uploadedPath);
      return res.status(403).json({ success: false, message: 'This brand is outside your organization.' });
    }

    const guidelines = await query(
      `SELECT guideline_id FROM brand_guidelines
       WHERE brand_id = ? AND status = 'active'
         AND (effective_from IS NULL OR effective_from <= CURRENT_DATE())
         AND (effective_until IS NULL OR effective_until >= CURRENT_DATE())
       ORDER BY updated_at DESC LIMIT 1`,
      [brandId]
    );
    if (!guidelines.length) {
      await removeUpload(uploadedPath);
      return res.status(409).json({ success: false, message: 'This brand has no currently active guideline. Activate a guideline before submitting content.' });
    }

    const guidelineId = guidelines[0].guideline_id;
    const rules = await query(
      `SELECT rule_id, category, rule_title, rule_description, severity
       FROM guideline_rules
       WHERE guideline_id = ? AND is_active = 1
       ORDER BY priority, rule_id`,
      [guidelineId]
    );

    const contentType = req.file
      ? (req.file.mimetype.startsWith('image/') ? 'mixed' : 'document')
      : 'text';
    const submissionId = await withTransaction(async (connection) => {
      const [insert] = await connection.execute(
        `INSERT INTO content_submissions
           (submitted_by, title, content_text, content_type, status, brand_id, category_id, campaign_name, target_audience, platform)
         VALUES (?, ?, ?, ?, 'submitted', ?, ?, ?, ?, ?)`,
        [
          req.user.id,
          String(title || 'Untitled submission').slice(0, 200),
          content_text,
          contentType,
          brandId,
          category_id ? Number(category_id) : null,
          campaign_name || null,
          target_audience || null,
          platform || null,
        ]
      );
      if (req.file) {
        await connection.execute(
          `INSERT INTO submission_files
             (submission_id, original_name, stored_name, mime_type, file_path, file_size, uploaded_by, scan_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
          [
            insert.insertId,
            req.file.originalname.slice(0, 255),
            req.file.filename,
            req.file.mimetype,
            `/uploads/${req.file.filename}`,
            req.file.size,
            req.user.id,
          ]
        );
      }
      await connection.execute(
        `INSERT INTO submission_activity (submission_id, user_id, activity_type, activity_description)
         VALUES (?, ?, 'submitted', 'Content submitted for brand compliance analysis')`,
        [insert.insertId, req.user.id]
      );
      await connection.execute(
        `INSERT INTO notifications (user_id, title, message, notification_type, related_submission_id)
         VALUES (?, 'New content submission', ?, 'submission', ?)`,
        [req.user.id, 'Your content has been submitted for analysis.', insert.insertId]
      );
      return insert.insertId;
    });
    savedSubmission = true;

    let analysis;
    try {
      analysis = await analyzeAndPersist({
        submissionId,
        guidelineId,
        brandId,
        rules,
        content: content_text,
        userId: req.user.id,
        categoryId: category_id ? Number(category_id) : null,
      });
    } catch (error) {
      if (error.code !== 'AI_SERVICE_UNAVAILABLE') throw error;
      return res.status(502).json({
        success: false,
        message: 'Submission was saved, but the AI service did not complete analysis. Retry analysis from the submission detail.',
        submission_id: submissionId,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Submission analyzed against the active brand rules.',
      submission: { submission_id: submissionId, brand_id: brandId, title, status: 'analysis_completed' },
      analysis: { run_id: analysis.runId, ...analysis.result },
    });
  } catch (error) {
    if (uploadedPath && !savedSubmission) {
      await fs.unlink(uploadedPath).catch((cleanupError) => {
        console.error('Unable to remove upload after failed submission:', cleanupError.message);
      });
    }
    return next(error);
  }
};

const resubmit = async (req, res, next) => {
  try {
    const submissionId = Number(req.params.id);
    const content = String(req.body.content_text || '').trim();
    if (!content) {
      return res.status(400).json({ success: false, message: 'Updated text content is required.' });
    }
    const [submission] = await query(
      `SELECT submission_id, submitted_by, brand_id, category_id, title, status
       FROM content_submissions WHERE submission_id = ?`,
      [submissionId]
    );
    if (!submission || Number(submission.submitted_by) !== Number(req.user.id)) {
      return res.status(404).json({ success: false, message: 'Editable submission not found.' });
    }
    if (!['rejected', 'changes_requested'].includes(submission.status)) {
      return res.status(409).json({ success: false, message: 'Only rejected or change-requested submissions can be resubmitted.' });
    }
    const [guideline] = await query(
      `SELECT guideline_id FROM brand_guidelines
       WHERE brand_id = ? AND status = 'active'
         AND (effective_from IS NULL OR effective_from <= CURRENT_DATE())
         AND (effective_until IS NULL OR effective_until >= CURRENT_DATE())
       ORDER BY updated_at DESC LIMIT 1`,
      [submission.brand_id]
    );
    if (!guideline) {
      return res.status(409).json({ success: false, message: 'There is no active guideline for this brand.' });
    }
    const rules = await query(
      `SELECT rule_id, category, rule_title, rule_description, severity
       FROM guideline_rules WHERE guideline_id = ? AND is_active = 1 ORDER BY priority, rule_id`,
      [guideline.guideline_id]
    );
    const versionRows = await query(
      'SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version FROM content_versions WHERE submission_id = ?',
      [submissionId]
    );
    await withTransaction(async (connection) => {
      await connection.execute(
        `INSERT INTO content_versions (submission_id, version_number, content_text, updated_by, change_summary)
         VALUES (?, ?, ?, ?, 'Creator resubmission')`,
        [submissionId, versionRows[0].next_version, content, req.user.id]
      );
      await connection.execute(
        `UPDATE content_submissions SET content_text = ?, status = 'submitted', updated_at = NOW()
         WHERE submission_id = ?`,
        [content, submissionId]
      );
      await connection.execute(
        `INSERT INTO submission_activity (submission_id, user_id, activity_type, activity_description)
         VALUES (?, ?, 'resubmitted', 'Updated content submitted for re-analysis')`,
        [submissionId, req.user.id]
      );
    });
    const analysis = await analyzeAndPersist({
      submissionId,
      guidelineId: guideline.guideline_id,
      brandId: submission.brand_id,
      rules,
      content,
      userId: req.user.id,
      categoryId: submission.category_id,
    });
    return res.json({
      success: true,
      message: 'Updated submission analyzed against the active brand rules.',
      analysis: { run_id: analysis.runId, ...analysis.result },
    });
  } catch (error) {
    if (error.code === 'AI_SERVICE_UNAVAILABLE') {
      return res.status(502).json({
        success: false,
        message: 'Updated content was saved, but the AI service could not complete analysis.',
      });
    }
    return next(error);
  }
};

const retryAnalysis = async (req, res, next) => {
  try {
    const submissionId = Number(req.params.id);
    const [submission] = await query(
      `SELECT submission_id, submitted_by, brand_id, category_id, content_text, status
       FROM content_submissions WHERE submission_id = ?`,
      [submissionId]
    );
    if (!submission || (!isAdmin(req.user) && Number(submission.submitted_by) !== Number(req.user.id))) {
      return res.status(404).json({ success: false, message: 'Submission not found.' });
    }
    if (!['submitted', 'analyzing'].includes(submission.status)) {
      return res.status(409).json({ success: false, message: 'Analysis can only be retried while the submission is awaiting analysis.' });
    }
    const [guideline] = await query(
      `SELECT guideline_id FROM brand_guidelines
       WHERE brand_id = ? AND status = 'active'
         AND (effective_from IS NULL OR effective_from <= CURRENT_DATE())
         AND (effective_until IS NULL OR effective_until >= CURRENT_DATE())
       ORDER BY updated_at DESC LIMIT 1`,
      [submission.brand_id]
    );
    if (!guideline) {
      return res.status(409).json({ success: false, message: 'There is no active guideline for this brand.' });
    }
    const rules = await query(
      `SELECT rule_id, category, rule_title, rule_description, severity
       FROM guideline_rules WHERE guideline_id = ? AND is_active = 1 ORDER BY priority, rule_id`,
      [guideline.guideline_id]
    );
    const analysis = await analyzeAndPersist({
      submissionId,
      guidelineId: guideline.guideline_id,
      brandId: submission.brand_id,
      rules,
      content: submission.content_text,
      userId: req.user.id,
      categoryId: submission.category_id,
    });
    return res.json({ success: true, analysis: { run_id: analysis.runId, ...analysis.result } });
  } catch (error) {
    if (error.code === 'AI_SERVICE_UNAVAILABLE') {
      return res.status(502).json({ success: false, message: 'The AI service could not complete the analysis. Retry later.' });
    }
    return next(error);
  }
};

const getSubmission = async (req, res, next) => {
  try {
    const [submission] = await query(
      `SELECT s.*, b.brand_name, c.category_name
       FROM content_submissions s
       LEFT JOIN brands b ON b.brand_id = s.brand_id
       LEFT JOIN content_categories c ON c.category_id = s.category_id
       WHERE s.submission_id = ?`,
      [req.params.id]
    );
    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found.' });
    }
    if (!isAdmin(req.user) && Number(submission.submitted_by) !== Number(req.user.id)) {
      const [assignment] = await query(
        `SELECT assignment_id FROM review_assignments
         WHERE submission_id = ? AND reviewer_id = ? LIMIT 1`,
        [req.params.id, req.user.id]
      );
      if (!assignment) {
        return res.status(403).json({ success: false, message: 'You do not have access to this submission.' });
      }
    }

    const [runs, files, activity, reviewActions] = await Promise.all([
      query('SELECT * FROM ai_analysis_runs WHERE submission_id = ? ORDER BY run_id DESC', [req.params.id]),
      query('SELECT file_id, original_name, file_path, file_size, mime_type, scan_status FROM submission_files WHERE submission_id = ?', [req.params.id]),
      query('SELECT activity_type, activity_description, created_at FROM submission_activity WHERE submission_id = ? ORDER BY created_at DESC', [req.params.id]),
      query(
        `SELECT r.*, u.full_name AS reviewer_name
         FROM review_actions r JOIN users u ON u.user_id = r.reviewer_id
         WHERE r.submission_id = ? ORDER BY r.reviewed_at DESC`,
        [req.params.id]
      ),
    ]);
    const issues = runs.length
      ? await query(
        `SELECT i.*, r.suggested_text, r.explanation AS recommendation_explanation
         FROM ai_detected_issues i
         LEFT JOIN ai_recommendations r ON r.detected_issue_id = i.detected_issue_id
         WHERE i.run_id = ? ORDER BY i.detected_issue_id`,
        [runs[0].run_id]
      )
      : [];
    const reviewIds = reviewActions.map((action) => action.review_id);
    const reviewComments = reviewIds.length
      ? await query(
        `SELECT c.*, u.full_name
         FROM review_comments c JOIN users u ON u.user_id = c.user_id
         WHERE c.review_id IN (${reviewIds.map(() => '?').join(',')})
         ORDER BY c.created_at DESC`,
        reviewIds
      )
      : [];
    const reviewHistory = reviewIds.length
      ? await query(
        `SELECT * FROM review_action_history
         WHERE review_id IN (${reviewIds.map(() => '?').join(',')})
         ORDER BY changed_at DESC`,
        reviewIds
      )
      : [];
    return res.json({ success: true, submission, analyses: runs, issues, files, activity, reviewActions, reviewComments, reviewHistory });
  } catch (error) {
    return next(error);
  }
};

module.exports = { listContent, listCategories, createSubmission, retryAnalysis, resubmit, getSubmission };
