const { query, withTransaction } = require('../config/db');

const categories = new Set(['tone', 'terminology', 'claims', 'visual', 'accessibility', 'other']);
const severities = new Set(['low', 'medium', 'high', 'critical']);
const isAdmin = (user) => String(user.role).toUpperCase() === 'ADMIN';

const listGuidelines = async (req, res, next) => {
  try {
    const { brand_id } = req.query;
    const rows = isAdmin(req.user)
      ? await query(
        `SELECT g.*, b.brand_name
         FROM brand_guidelines g
         JOIN brands b ON b.brand_id = g.brand_id
         WHERE (? IS NULL OR g.brand_id = ?)
         ORDER BY g.updated_at DESC`,
        [brand_id || null, brand_id || null]
      )
      : await query(
        `SELECT g.*, b.brand_name
         FROM brand_guidelines g
         JOIN brands b ON b.brand_id = g.brand_id
         WHERE b.organization_id = ? AND (? IS NULL OR g.brand_id = ?)
         ORDER BY g.updated_at DESC`,
        [req.user.organization_id, brand_id || null, brand_id || null]
      );
    return res.json({ success: true, guidelines: rows });
  } catch (error) {
    return next(error);
  }
};

const createGuideline = async (req, res, next) => {
  try {
    const { brand_id, title, description, effective_from, effective_until } = req.body;
    if (!Number.isInteger(Number(brand_id)) || !title) {
      return res.status(400).json({ success: false, message: 'A brand and guideline title are required.' });
    }

    const created = await withTransaction(async (connection) => {
      const [guideline] = await connection.execute(
        `INSERT INTO brand_guidelines
           (brand_id, title, description, version, status, created_by, effective_from, effective_until)
         VALUES (?, ?, ?, '1.0', 'draft', ?, ?, ?)`,
        [Number(brand_id), title, description || null, req.user.id, effective_from || null, effective_until || null]
      );
      await connection.execute(
        `INSERT INTO brand_guideline_versions (guideline_id, version_number, change_summary, created_by)
         VALUES (?, '1.0', 'Initial guideline version', ?)`,
        [guideline.insertId, req.user.id]
      );
      await connection.execute(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES (?, 'guideline_created', 'brand_guideline', ?, ?)`,
        [req.user.id, guideline.insertId, title]
      );
      return guideline.insertId;
    });

    return res.status(201).json({ success: true, guideline_id: created, message: 'Draft guideline created.' });
  } catch (error) {
    return next(error);
  }
};

const updateGuideline = async (req, res, next) => {
  try {
    const { title, description, status, change_summary, effective_from, effective_until } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: 'Guideline title is required.' });
    }
    if (status && !['draft', 'active', 'archived'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid guideline status.' });
    }

    await withTransaction(async (connection) => {
      const [guidelines] = await connection.execute(
        'SELECT guideline_id, version FROM brand_guidelines WHERE guideline_id = ? FOR UPDATE',
        [req.params.id]
      );
      if (!guidelines.length) {
        const error = new Error('Guideline not found.');
        error.status = 404;
        throw error;
      }

      const versionParts = String(guidelines[0].version || '1.0').split('.');
      const major = Number(versionParts[0]) || 1;
      const minor = Number(versionParts[1]) || 0;
      const nextVersion = `${major}.${minor + 1}`;
      const nextStatus = status || 'draft';

      await connection.execute(
        `UPDATE brand_guidelines
         SET title = ?, description = ?, version = ?, status = ?,
             approved_by = ?, effective_from = ?, effective_until = ?, updated_at = NOW()
         WHERE guideline_id = ?`,
        [
          title,
          description || null,
          nextVersion,
          nextStatus,
          nextStatus === 'active' ? req.user.id : null,
          effective_from || null,
          effective_until || null,
          req.params.id,
        ]
      );
      await connection.execute(
        `INSERT INTO brand_guideline_versions (guideline_id, version_number, change_summary, created_by)
         VALUES (?, ?, ?, ?)`,
        [req.params.id, nextVersion, change_summary || 'Guideline updated', req.user.id]
      );
      await connection.execute(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES (?, 'guideline_updated', 'brand_guideline', ?, ?)`,
        [req.user.id, req.params.id, `Saved version ${nextVersion}`]
      );
    });
    return res.json({ success: true, message: 'Guideline version saved.' });
  } catch (error) {
    return next(error);
  }
};

const listRules = async (req, res, next) => {
  try {
    if (!isAdmin(req.user)) {
      const [guideline] = await query(
        `SELECT g.guideline_id
         FROM brand_guidelines g JOIN brands b ON b.brand_id = g.brand_id
         WHERE g.guideline_id = ? AND b.organization_id = ?`,
        [req.params.id, req.user.organization_id]
      );
      if (!guideline) {
        return res.status(404).json({ success: false, message: 'Guideline not found.' });
      }
    }
    const rows = await query(
      'SELECT * FROM guideline_rules WHERE guideline_id = ? ORDER BY priority, rule_id',
      [req.params.id]
    );
    return res.json({ success: true, rules: rows });
  } catch (error) {
    return next(error);
  }
};

const createRule = async (req, res, next) => {
  try {
    const { category, rule_title, rule_description, severity = 'medium', priority = 0, reference_url } = req.body;
    if (!categories.has(category) || !rule_title || !rule_description || !severities.has(severity)) {
      return res.status(400).json({ success: false, message: 'Provide a valid category, title, description and severity.' });
    }
    const ruleId = await withTransaction(async (connection) => {
      const [result] = await connection.execute(
        `INSERT INTO guideline_rules
           (guideline_id, category, rule_title, rule_description, severity, is_active, priority, reference_url)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        [req.params.id, category, rule_title, rule_description, severity, Number(priority) || 0, reference_url || null]
      );
      await connection.execute(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES (?, 'guideline_rule_created', 'guideline_rule', ?, ?)`,
        [req.user.id, result.insertId, rule_title]
      );
      return result.insertId;
    });
    return res.status(201).json({ success: true, rule_id: ruleId });
  } catch (error) {
    return next(error);
  }
};

const updateRule = async (req, res, next) => {
  try {
    const { category, rule_title, rule_description, severity, is_active, priority, reference_url } = req.body;
    if (!categories.has(category) || !rule_title || !rule_description || !severities.has(severity)) {
      return res.status(400).json({ success: false, message: 'Provide a valid category, title, description and severity.' });
    }
    await withTransaction(async (connection) => {
      await connection.execute(
        `UPDATE guideline_rules
         SET category = ?, rule_title = ?, rule_description = ?, severity = ?, is_active = ?, priority = ?, reference_url = ?
         WHERE rule_id = ?`,
        [category, rule_title, rule_description, severity, is_active ? 1 : 0, Number(priority) || 0, reference_url || null, req.params.ruleId]
      );
      await connection.execute(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES (?, 'guideline_rule_updated', 'guideline_rule', ?, ?)`,
        [req.user.id, req.params.ruleId, rule_title]
      );
    });
    return res.json({ success: true, message: 'Rule updated.' });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listGuidelines,
  createGuideline,
  updateGuideline,
  listRules,
  createRule,
  updateRule,
};
