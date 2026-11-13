const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, withTransaction } = require('../config/db');

// In‑memory user store used when the DB is not configured or unavailable
const memUsers = [];

// Helper to create a JWT (uses JWT_SECRET from env or a generated one)
const createToken = (user) => jwt.sign(
  { id: user.user_id, email: user.email, role: user.role.toUpperCase(), organization_id: user.organization_id || null },
  process.env.JWT_SECRET,
  { expiresIn: '8h' }
);

// ---------------------- Register ----------------------
const register = async (req, res, next) => {
  try {
    const { full_name, name, email, password } = req.body;
    const displayName = full_name || name;
    if (!displayName || !email || !password || password.length < 10) {
      return res.status(400).json({ success: false, message: 'Name, email and a password of at least 10 characters are required.' });
    }

    // Try real DB first
    try {
      const existing = await query('SELECT user_id FROM users WHERE email = ? LIMIT 1', [email]);
      if (existing.length > 0) {
        return res.status(409).json({ success: false, message: 'User already exists.' });
      }

      const hash = await bcrypt.hash(password, 10);
      const userId = await withTransaction(async (connection) => {
        const [row] = await connection.execute(
          'INSERT INTO users (full_name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)',
          [displayName, email, hash, 'content_creator', 'active']
        );
        await connection.execute(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)` +
          ` VALUES (?, 'user_registered', 'user', ?, 'Public creator registration')`,
          [row.insertId, row.insertId]
        );
        return row.insertId;
      });

      const newUser = { user_id: userId, full_name: displayName, email, role: 'content_creator' };
      return res.status(201).json({ success: true, message: 'User registered.', user: { id: newUser.user_id, name: displayName, email, role: 'CONTENT_CREATOR' }, token: createToken(newUser) });
    } catch (dbErr) {
      // DB not reachable – fall back to in‑memory store
      if (memUsers.find(u => u.email === email)) {
        return res.status(409).json({ success: false, message: 'User already exists.' });
      }
      const hash = await bcrypt.hash(password, 10);
      const userId = memUsers.length + 1;
      const newUser = { user_id: userId, full_name: displayName, email, password_hash: hash, role: 'content_creator', status: 'active' };
      memUsers.push(newUser);
      return res.status(201).json({ success: true, message: 'User registered.', user: { id: userId, name: displayName, email, role: 'CONTENT_CREATOR' }, token: createToken(newUser) });
    }
  } catch (error) {
    return next(error);
  }
};

// ---------------------- Login ----------------------
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    // Try DB first
    try {
      const rows = await query('SELECT user_id, full_name, email, password_hash, role, status, organization_id FROM users WHERE email = ? LIMIT 1', [email]);
      if (!rows.length || rows[0].status !== 'active') {
        return res.status(401).json({ success: false, message: 'Invalid credentials.' });
      }
      const user = rows[0];
      const valid = await bcrypt.compare(password, user.password_hash || '');
      if (!valid) {
        return res.status(401).json({ success: false, message: 'Invalid credentials.' });
      }
      await query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)` +
        ` VALUES (?, 'login', 'user', ?, 'Successful login')`,
        [user.user_id, user.user_id]
      );
      const safeUser = { id: user.user_id, name: user.full_name, email: user.email, role: user.role.toUpperCase(), organization_id: user.organization_id };
      return res.json({ success: true, user: safeUser, token: createToken(user) });
    } catch (dbErr) {
      // DB fallback – use in‑memory store
      const memUser = memUsers.find(u => u.email === email);
      if (!memUser) {
        return res.status(401).json({ success: false, message: 'Invalid credentials.' });
      }
      const valid = await bcrypt.compare(password, memUser.password_hash);
      if (!valid) {
        return res.status(401).json({ success: false, message: 'Invalid credentials.' });
      }
      const safeUser = { id: memUser.user_id, name: memUser.full_name, email: memUser.email, role: memUser.role.toUpperCase(), organization_id: memUser.organization_id };
      return res.json({ success: true, user: safeUser, token: createToken(memUser) });
    }
  } catch (error) {
    return next(error);
  }
};

// ---------------------- Me ----------------------
const me = async (req, res) => {
  // Prefer DB – if DB not configured, try in‑memory
  try {
    const [user] = await query(
      'SELECT user_id AS id, full_name AS name, email, role, organization_id FROM users WHERE user_id = ? AND status = ?',
      [req.user.id, 'active']
    );
    if (!user) {
      return res.status(401).json({ success: false, message: 'User is no longer active.' });
    }
    user.role = user.role.toUpperCase();
    return res.json({ success: true, user });
  } catch (_) {
    // DB fallback – search in‑memory store
    const memUser = memUsers.find(u => u.user_id === req.user.id && u.status === 'active');
    if (!memUser) {
      return res.status(401).json({ success: false, message: 'User is no longer active.' });
    }
    const user = { id: memUser.user_id, name: memUser.full_name, email: memUser.email, role: memUser.role.toUpperCase(), organization_id: memUser.organization_id };
    return res.json({ success: true, user });
  }
};

// ---------------------- Update Profile ----------------------
const updateProfile = async (req, res, next) => {
  try {
    const body = req.body || {};
    if (
      ('full_name' in body && typeof body.full_name !== 'string') ||
      ('email' in body && typeof body.email !== 'string') ||
      ('current_password' in body && typeof body.current_password !== 'string') ||
      ('new_password' in body && typeof body.new_password !== 'string')
    ) {
      return res.status(400).json({ success: false, message: 'Profile fields must be strings.' });
    }
    const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : undefined;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined;
    const currentPassword = body.current_password;
    const newPassword = body.new_password;

    if (fullName !== undefined && (!fullName || fullName.length > 100)) {
      return res.status(400).json({ success: false, message: 'Name must contain 1 to 100 characters.' });
    }
    if (email !== undefined && (email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return res.status(400).json({ success: false, message: 'A valid email address is required.' });
    }
    if ((currentPassword && !newPassword) || (!currentPassword && newPassword)) {
      return res.status(400).json({ success: false, message: 'Current and new passwords are both required to change your password.' });
    }
    if (newPassword && (typeof newPassword !== 'string' || newPassword.length < 10)) {
      return res.status(400).json({ success: false, message: 'The new password must be at least 10 characters.' });
    }
    if (fullName === undefined && email === undefined && !newPassword) {
      return res.status(400).json({ success: false, message: 'Provide a profile field or new password to update.' });
    }

    // DB first – fallback to memory if it fails
    try {
      const [currentUser] = await query(
        'SELECT user_id, full_name, email, password_hash, role, status, organization_id FROM users WHERE user_id = ?',
        [req.user.id]
      );
      if (!currentUser || currentUser.status !== 'active') {
        return res.status(401).json({ success: false, message: 'User is no longer active.' });
      }
      if (newPassword && !(await bcrypt.compare(currentPassword, currentUser.password_hash || ''))) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
      }
      if (email !== undefined) {
        const [existingUser] = await query('SELECT user_id FROM users WHERE email = ? AND user_id <> ? LIMIT 1', [email, req.user.id]);
        if (existingUser) {
          return res.status(409).json({ success: false, message: 'That email address is already in use.' });
        }
      }

      const passwordHash = newPassword ? await bcrypt.hash(newPassword, 10) : null;
      const updatedUser = await withTransaction(async (connection) => {
        await connection.execute(
          `UPDATE users\r\n          SET full_name = COALESCE(?, full_name), email = COALESCE(?, email),\r\n              password_hash = COALESCE(?, password_hash)\r\n          WHERE user_id = ? AND status = 'active'`,
          [fullName ?? null, email ?? null, passwordHash, req.user.id]
        );
        await connection.execute(
          `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, 'profile_updated', 'user', ?, ?)`,
          [req.user.id, req.user.id, JSON.stringify({ full_name: fullName, email, password_changed: Boolean(newPassword) })]
        );
        const [user] = await connection.execute('SELECT user_id, full_name, email, role, organization_id FROM users WHERE user_id = ?', [req.user.id]);
        return user[0];
      });

      const user = { id: updatedUser.user_id, name: updatedUser.full_name, email: updatedUser.email, role: updatedUser.role.toUpperCase(), organization_id: updatedUser.organization_id };
      return res.json({ success: true, user, token: createToken(updatedUser) });
    } catch (_) {
      // Memory fallback
      const memUser = memUsers.find(u => u.user_id === req.user.id);
      if (!memUser) {
        return res.status(401).json({ success: false, message: 'User is no longer active.' });
      }
      if (email !== undefined) {
        if (memUsers.find(u => u.email === email && u.user_id !== req.user.id)) {
          return res.status(409).json({ success: false, message: 'That email address is already in use.' });
        }
        memUser.email = email;
      }
      if (fullName !== undefined) memUser.full_name = fullName;
      if (newPassword) memUser.password_hash = await bcrypt.hash(newPassword, 10);
      const user = { id: memUser.user_id, name: memUser.full_name, email: memUser.email, role: memUser.role.toUpperCase(), organization_id: memUser.organization_id };
      return res.json({ success: true, user, token: createToken(memUser) });
    }
  } catch (error) {
    return next(error);
  }
};

module.exports = { register, login, me, updateProfile };