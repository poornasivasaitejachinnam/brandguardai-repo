const { query } = require('../config/db');

const health = async (_req, res) => {
  res.json({ success: true, service: 'BrandGuard AI backend', status: 'online' });
};

const databaseHealth = async (_req, res, next) => {
  try {
    await query('SELECT 1 AS available');
    return res.json({ success: true, service: 'MySQL', status: 'connected' });
  } catch (error) {
    return next(error);
  }
};

module.exports = { health, databaseHealth };
