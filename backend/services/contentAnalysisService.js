const { withTransaction } = require('../config/db');
const { analyzeContent } = require('./aiClient');

async function analyzeAndPersist({ submissionId, guidelineId, brandId, rules, content, userId, categoryId }) {
  const startedAt = Date.now();
  let result;
  try {
    result = await analyzeContent({
      content,
      brand: { id: brandId },
      guideline_rules: rules,
      category_id: categoryId || null,
    });
  } catch (error) {
    await withTransaction(async (connection) => {
      await connection.execute(
        `INSERT INTO ai_analysis_runs
           (submission_id, guideline_id, compliance_status, error_message, processing_time_ms, completed_at)
         VALUES (?, ?, 'failed', ?, ?, NOW())`,
        [submissionId, guidelineId, 'The AI service could not analyze the submitted content.', Date.now() - startedAt]
      );
    });
    const serviceError = new Error('AI_SERVICE_UNAVAILABLE');
    serviceError.code = 'AI_SERVICE_UNAVAILABLE';
    throw serviceError;
  }

  const status = result.compliance_score >= 85
    ? 'compliant'
    : result.compliance_score >= 60 ? 'partially_compliant' : 'non_compliant';
  const runId = await withTransaction(async (connection) => {
    const [run] = await connection.execute(
      `INSERT INTO ai_analysis_runs
         (submission_id, guideline_id, model_name, overall_score, compliance_status, analysis_summary, processing_time_ms, started_at, completed_at)
       VALUES (?, ?, 'rule-based', ?, ?, ?, ?, NOW(), NOW())`,
      [submissionId, guidelineId, result.compliance_score, status, result.summary, Date.now() - startedAt]
    );
    for (const issue of result.issues) {
      const [createdIssue] = await connection.execute(
        `INSERT INTO ai_detected_issues
           (run_id, rule_id, issue_category, severity, detected_text, issue_description, confidence_score)
         VALUES (?, ?, ?, ?, ?, ?, 100)`,
        [
          run.insertId,
          issue.rule_id || null,
          issue.type,
          issue.severity,
          issue.detected_text || null,
          issue.message,
        ]
      );
      await connection.execute(
        `INSERT INTO ai_recommendations
           (detected_issue_id, original_text, suggested_text, explanation)
         VALUES (?, ?, ?, ?)`,
        [createdIssue.insertId, issue.detected_text || null, issue.suggestion, issue.message]
      );
    }
    await connection.execute(
      `UPDATE content_submissions SET status = 'analysis_completed', updated_at = NOW()
       WHERE submission_id = ?`,
      [submissionId]
    );
    await connection.execute(
      `INSERT INTO submission_activity (submission_id, user_id, activity_type, activity_description)
       VALUES (?, ?, 'analysis_completed', ?)`,
      [submissionId, userId, result.summary]
    );
    await connection.execute(
      `INSERT INTO notifications (user_id, title, message, notification_type, related_submission_id)
       VALUES (?, 'Analysis complete', ?, 'analysis', ?)`,
      [userId, result.summary, submissionId]
    );
    return run.insertId;
  });
  return { runId, result };
}

module.exports = { analyzeAndPersist };
