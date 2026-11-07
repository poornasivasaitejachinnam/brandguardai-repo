const jwt = require('jsonwebtoken');

const authenticate = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication token missing.' });
  }

  try {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'replace_with_a_secure_secret') {
      return res.status(503).json({ success: false, message: 'Authentication is unavailable until JWT_SECRET is configured.' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(String(req.user.role).toUpperCase())) {
    return res.status(403).json({ success: false, message: 'You are not authorized to perform this action.' });
  }

  return next();
};

module.exports = { authenticate, authorize };
