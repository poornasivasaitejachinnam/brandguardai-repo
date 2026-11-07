const { query, withTransaction } = require('../config/db');

const isAdmin = (user) => String(user.role).toUpperCase() === 'ADMIN';

const listBrands = async (req, res, next) => {
  try {
    const rows = isAdmin(req.user)
      ? await query(
        `SELECT b.*, o.organization_name
         FROM brands b JOIN organizations o ON o.organization_id = b.organization_id
         ORDER BY b.created_at DESC LIMIT 100`
      )
      : await query(
        `SELECT b.*, o.organization_name
         FROM brands b JOIN organizations o ON o.organization_id = b.organization_id
         WHERE b.organization_id = ? ORDER BY b.created_at DESC LIMIT 100`,
        [req.user.organization_id]
      );
    return res.json({ success: true, brands: rows });
  } catch (error) {
    return next(error);
  }
};

const createBrand = async (req, res, next) => {
  try {
    const { brand_name, name, organization_id, brand_description, industry, website, brand_tone } = req.body;
    const displayName = brand_name || name;
    if (!displayName || !Number.isInteger(Number(organization_id))) {
      return res.status(400).json({ success: false, message: 'Brand name and a valid organization are required.' });
    }

    const brandId = await withTransaction(async (connection) => {
      const [result] = await connection.execute(
        `INSERT INTO brands
           (organization_id, brand_name, brand_description, industry, website, brand_tone, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, 'active', ?)`,
        [Number(organization_id), displayName, brand_description || null, industry || null, website || null, brand_tone || null, req.user.id]
      );
      await connection.execute(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES (?, 'brand_created', 'brand', ?, ?)`,
        [req.user.id, result.insertId, displayName]
      );
      return result.insertId;
    });
    return res.status(201).json({
      success: true,
      message: 'Brand created.',
      brand: { brand_id: brandId, brand_name: displayName, organization_id: Number(organization_id), status: 'active' },
    });
  } catch (error) {
    return next(error);
  }
};

const updateBrand = async (req, res, next) => {
  try {
    const { brand_name, brand_description, status, industry, website, brand_tone } = req.body;
    if (!brand_name) {
      return res.status(400).json({ success: false, message: 'Brand name is required.' });
    }
    await withTransaction(async (connection) => {
      await connection.execute(
        `UPDATE brands SET brand_name = ?, brand_description = ?, status = ?,
          industry = ?, website = ?, brand_tone = ?, updated_at = NOW()
         WHERE brand_id = ?`,
        [brand_name, brand_description || null, status || 'active', industry || null, website || null, brand_tone || null, req.params.id]
      );
      await connection.execute(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES (?, 'brand_updated', 'brand', ?, ?)`,
        [req.user.id, req.params.id, brand_name]
      );
    });
    return res.json({ success: true, message: 'Brand updated.' });
  } catch (error) {
    return next(error);
  }
};

const listOrganizations = async (req, res, next) => {
  try {
    const rows = isAdmin(req.user)
      ? await query('SELECT * FROM organizations ORDER BY created_at DESC LIMIT 100')
      : await query('SELECT * FROM organizations WHERE organization_id = ?', [req.user.organization_id]);
    return res.json({ success: true, organizations: rows });
  } catch (error) {
    return next(error);
  }
};

const createOrganization = async (req, res, next) => {
  try {
    const { organization_name, organization_type, industry, website, contact_email } = req.body;
    if (!organization_name) {
      return res.status(400).json({ success: false, message: 'Organization name is required.' });
    }
    const organizationId = await withTransaction(async (connection) => {
      const [result] = await connection.execute(
        `INSERT INTO organizations (organization_name, organization_type, industry, website, contact_email, status)
         VALUES (?, ?, ?, ?, ?, 'active')`,
        [organization_name, organization_type || null, industry || null, website || null, contact_email || null]
      );
      await connection.execute(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES (?, 'organization_created', 'organization', ?, ?)`,
        [req.user.id, result.insertId, organization_name]
      );
      return result.insertId;
    });
    return res.status(201).json({
      success: true,
      organization: { organization_id: organizationId, organization_name, status: 'active' },
    });
  } catch (error) {
    return next(error);
  }
};

const updateOrganization = async (req, res, next) => {
  try {
    const { organization_name, organization_type, industry, website, contact_email, status } = req.body;
    if (!organization_name) {
      return res.status(400).json({ success: false, message: 'Organization name is required.' });
    }
    await withTransaction(async (connection) => {
      await connection.execute(
        `UPDATE organizations SET organization_name = ?, organization_type = ?, industry = ?,
          website = ?, contact_email = ?, status = ? WHERE organization_id = ?`,
        [organization_name, organization_type || null, industry || null, website || null, contact_email || null, status || 'active', req.params.id]
      );
      await connection.execute(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
         VALUES (?, 'organization_updated', 'organization', ?, ?)`,
        [req.user.id, req.params.id, organization_name]
      );
    });
    return res.json({ success: true, message: 'Organization updated.' });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listBrands,
  createBrand,
  updateBrand,
  listOrganizations,
  createOrganization,
  updateOrganization,
};
