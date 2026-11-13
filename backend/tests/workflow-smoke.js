const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const crypto = require('crypto');
const fs = require('fs/promises');
const mysql = require('mysql2/promise');

const baseUrl = 'http://127.0.0.1:5000';
const testData = { users: [], organizationName: `Temporary ${crypto.randomUUID()}`, brandName: `Temporary ${crypto.randomUUID()}`, guidelineTitle: `Temporary ${crypto.randomUUID()}` };

async function api(route, { method = 'GET', token, body } = {}) {
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${method} ${route} failed with HTTP ${response.status}: ${result.message || 'request failed'}`);
  }
  return result;
}

async function createAccount(connection, role = 'content_creator') {
  const email = `brandguard-flow-${crypto.randomUUID()}@example.invalid`;
  const password = `${crypto.randomBytes(24).toString('base64url')}!`;
  const account = { email, password, role };
  testData.users.push(account);
  const result = await api('/api/auth/register', {
    method: 'POST',
    body: { name: `Temporary ${role}`, email, password },
  });
  account.id = result.user.id;
  if (role !== 'content_creator') {
    await connection.execute('UPDATE users SET role = ? WHERE user_id = ?', [role, account.id]);
  }
  return account;
}

async function login(account) {
  const result = await api('/api/auth/login', {
    method: 'POST',
    body: { email: account.email, password: account.password },
  });
  return result.token;
}

async function cleanup(connection) {
  await connection.beginTransaction();
  try {
    if (!testData.organizationId && testData.organizationName) {
      const [rows] = await connection.execute('SELECT organization_id FROM organizations WHERE organization_name = ?', [testData.organizationName]);
      testData.organizationId = rows[0]?.organization_id;
    }
    if (!testData.brandId && testData.brandName) {
      const [rows] = await connection.execute('SELECT brand_id FROM brands WHERE brand_name = ?', [testData.brandName]);
      testData.brandId = rows[0]?.brand_id;
    }
    if (!testData.guidelineId && testData.brandId) {
      const [rows] = await connection.execute(
        'SELECT guideline_id FROM brand_guidelines WHERE brand_id = ? AND title = ?',
        [testData.brandId, testData.guidelineTitle]
      );
      testData.guidelineId = rows[0]?.guideline_id;
    }
    if (testData.submissionId) {
      const [files] = await connection.execute(
        'SELECT file_id, stored_name FROM submission_files WHERE submission_id = ?',
        [testData.submissionId]
      );
      for (const file of files) {
        await connection.execute('DELETE FROM submission_files WHERE file_id = ?', [file.file_id]);
        const filePath = path.join(__dirname, '..', 'uploads', file.stored_name);
        await fs.unlink(filePath).catch((error) => {
          if (error.code !== 'ENOENT') throw error;
        });
      }
      const [reviewRows] = await connection.query(
        'SELECT review_id FROM review_actions WHERE submission_id = ?',
        [testData.submissionId]
      );
      const reviewIds = reviewRows.map((row) => row.review_id);
      if (reviewIds.length) {
        const placeholders = reviewIds.map(() => '?').join(',');
        await connection.execute(`DELETE FROM review_comments WHERE review_id IN (${placeholders})`, reviewIds);
        await connection.execute(`DELETE FROM review_action_history WHERE review_id IN (${placeholders})`, reviewIds);
      }
      await connection.execute('DELETE FROM review_actions WHERE submission_id = ?', [testData.submissionId]);
      await connection.execute('DELETE FROM review_assignments WHERE submission_id = ?', [testData.submissionId]);
      await connection.execute('DELETE FROM notifications WHERE related_submission_id = ?', [testData.submissionId]);
      await connection.execute(
        `DELETE r FROM ai_recommendations r
         JOIN ai_detected_issues i ON i.detected_issue_id = r.detected_issue_id
         JOIN ai_analysis_runs a ON a.run_id = i.run_id
         WHERE a.submission_id = ?`,
        [testData.submissionId]
      );
      await connection.execute(
        'DELETE FROM ai_detected_issues WHERE run_id IN (SELECT run_id FROM ai_analysis_runs WHERE submission_id = ?)',
        [testData.submissionId]
      );
      await connection.execute('DELETE FROM ai_analysis_runs WHERE submission_id = ?', [testData.submissionId]);
      await connection.execute('DELETE FROM submission_activity WHERE submission_id = ?', [testData.submissionId]);
      await connection.execute('DELETE FROM content_versions WHERE submission_id = ?', [testData.submissionId]);
      await connection.execute('DELETE FROM content_submissions WHERE submission_id = ?', [testData.submissionId]);
    }
    if (testData.reportId) {
      await connection.execute('DELETE FROM report_exports WHERE report_id = ?', [testData.reportId]);
      await connection.execute('DELETE FROM compliance_reports WHERE report_id = ?', [testData.reportId]);
    }
    if (testData.guidelineId) {
      await connection.execute('DELETE FROM guideline_rules WHERE guideline_id = ?', [testData.guidelineId]);
      await connection.execute('DELETE FROM brand_guideline_versions WHERE guideline_id = ?', [testData.guidelineId]);
      await connection.execute('DELETE FROM brand_guidelines WHERE guideline_id = ?', [testData.guidelineId]);
    }
    if (testData.brandId) {
      await connection.execute('DELETE FROM brands WHERE brand_id = ?', [testData.brandId]);
    }
    for (const user of testData.users) {
      if (!user.id) {
        const [rows] = await connection.execute('SELECT user_id FROM users WHERE email = ?', [user.email]);
        user.id = rows[0]?.user_id;
      }
      if (!user.id) continue;
      await connection.execute('DELETE FROM notifications WHERE user_id = ?', [user.id]);
      await connection.execute('DELETE FROM audit_logs WHERE user_id = ?', [user.id]);
      await connection.execute('UPDATE users SET organization_id = NULL WHERE user_id = ?', [user.id]);
      await connection.execute('DELETE FROM users WHERE user_id = ?', [user.id]);
    }
    if (testData.organizationId) {
      await connection.execute('DELETE FROM organizations WHERE organization_id = ?', [testData.organizationId]);
    }
    await connection.commit();
    console.log('Temporary workflow records removed.');
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const admin = await createAccount(connection, 'admin');
    const creator = await createAccount(connection);
    const reviewer = await createAccount(connection, 'reviewer');
    const adminToken = await login(admin);

    const orgResponse = await api('/api/organizations', {
      method: 'POST',
      token: adminToken,
      body: { organization_name: testData.organizationName, industry: 'Test' },
    });
    testData.organizationId = orgResponse.organization.organization_id;
    await connection.execute('UPDATE users SET organization_id = ? WHERE user_id = ?', [testData.organizationId, creator.id]);
    const creatorToken = await login(creator);
    const reviewerToken = await login(reviewer);
    const brandResponse = await api('/api/brands', {
      method: 'POST',
      token: adminToken,
      body: { organization_id: testData.organizationId, brand_name: testData.brandName },
    });
    testData.brandId = brandResponse.brand.brand_id;
    const guidelineResponse = await api('/api/guidelines', {
      method: 'POST',
      token: adminToken,
      body: { brand_id: testData.brandId, title: testData.guidelineTitle },
    });
    testData.guidelineId = guidelineResponse.guideline_id;
    await api(`/api/guidelines/${testData.guidelineId}/rules`, {
      method: 'POST',
      token: adminToken,
      body: {
        category: 'claims',
        rule_title: 'Prohibited claims',
        rule_description: 'Do not use: “guaranteed”',
        severity: 'high',
      },
    });
    const [guideline] = await connection.execute(
      'SELECT title, description FROM brand_guidelines WHERE guideline_id = ?',
      [testData.guidelineId]
    );
    await api(`/api/guidelines/${testData.guidelineId}`, {
      method: 'PUT',
      token: adminToken,
      body: { ...guideline[0], status: 'active', change_summary: 'Activate test rule' },
    });
    console.log('PASS organization, brand, guideline, and rule persistence');

    const form = new FormData();
    form.set('brand_id', String(testData.brandId));
    form.set('title', 'Temporary test content');
    form.set('content_text', 'Our new product is guaranteed to work.');
    form.set('file', new Blob(['Temporary integration attachment.'], { type: 'text/plain' }), 'workflow-test.txt');
    const submission = await api('/api/content', {
      method: 'POST',
      token: creatorToken,
      body: form,
    });
    testData.submissionId = submission.submission.submission_id;
    if (submission.analysis.compliance_score !== 80 || submission.analysis.issues.length !== 1) {
      throw new Error('Configured guideline violation was not reflected in AI results.');
    }
    const [runRows] = await connection.execute(
      `SELECT run_id, overall_score, compliance_status FROM ai_analysis_runs
       WHERE submission_id = ? ORDER BY run_id DESC LIMIT 1`,
      [testData.submissionId]
    );
    const [issueRows] = await connection.execute(
      'SELECT detected_issue_id FROM ai_detected_issues WHERE run_id = ?',
      [runRows[0].run_id]
    );
    if (!runRows[0] || runRows[0].compliance_status !== 'partially_compliant' || issueRows.length !== 1) {
      throw new Error(`AI analysis persistence mismatch: status=${runRows[0]?.compliance_status || 'missing'}, issues=${issueRows.length}.`);
    }
    const [fileRows] = await connection.execute('SELECT file_id FROM submission_files WHERE submission_id = ?', [testData.submissionId]);
    if (fileRows.length !== 1) {
      throw new Error('Submission attachment was not persisted.');
    }
    console.log('PASS file upload and submission -> FastAPI -> analysis persistence');

    await api(`/api/reviews/${testData.submissionId}/assign`, {
      method: 'POST',
      token: adminToken,
      body: { reviewer_id: reviewer.id },
    });
    const queue = await api('/api/reviews', { token: reviewerToken });
    if (!queue.reviews.some((item) => item.submission_id === testData.submissionId)) {
      throw new Error('Assigned reviewer could not retrieve the submission.');
    }
    await api(`/api/reviews/${testData.submissionId}/changes-requested`, {
      method: 'PUT',
      token: reviewerToken,
      body: { comments: 'Please remove the prohibited claim.' },
    });
    const resubmission = await api(`/api/content/${testData.submissionId}/resubmit`, {
      method: 'PUT',
      token: creatorToken,
      body: { content_text: 'Our new product is built for lasting value.' },
    });
    if (resubmission.analysis.compliance_score !== 100 || resubmission.analysis.issues.length !== 0) {
      throw new Error('Resubmission did not run against the active guideline rules.');
    }
    await api(`/api/reviews/${testData.submissionId}/assign`, {
      method: 'POST',
      token: adminToken,
      body: { reviewer_id: reviewer.id },
    });
    await api(`/api/reviews/${testData.submissionId}/approve`, {
      method: 'PUT',
      token: reviewerToken,
      body: { comments: 'Temporary workflow approval test.' },
    });
    const [statusRows] = await connection.execute(
      'SELECT status FROM content_submissions WHERE submission_id = ?',
      [testData.submissionId]
    );
    const [versionRows] = await connection.execute(
      'SELECT COUNT(*) AS total FROM content_versions WHERE submission_id = ?',
      [testData.submissionId]
    );
    const [actionRows] = await connection.execute(
      'SELECT COUNT(*) AS total FROM review_actions WHERE submission_id = ?',
      [testData.submissionId]
    );
    if (statusRows[0]?.status !== 'approved' || versionRows[0].total !== 1 || actionRows[0].total !== 2) {
      throw new Error('Review decision did not update submission status.');
    }
    console.log('PASS resubmission versioning, reviewer reassignment, decision, notifications, and final status');

    const report = await api('/api/reports', {
      method: 'POST',
      token: adminToken,
      body: { organization_id: testData.organizationId, report_title: 'Temporary workflow report' },
    });
    testData.reportId = report.report_id;
    if (report.report.total_submissions !== 1) {
      throw new Error('Generated report did not aggregate the workflow submission.');
    }
    const exported = await fetch(`${baseUrl}/api/reports/${testData.reportId}/export.csv`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!exported.ok || !(await exported.text()).includes('total_submissions')) {
      throw new Error('CSV report export failed.');
    }
    console.log('PASS analytics report generation and CSV export');
  } finally {
    try {
      await cleanup(connection);
    } finally {
      await connection.end();
    }
  }
}

main().catch((error) => {
  console.error(`Workflow smoke test failed: ${error.message}`);
  process.exitCode = 1;
});
