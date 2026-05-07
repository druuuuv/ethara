const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

// Verify JWT token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await pool.query('SELECT id, name, email, role, avatar_color, created_at FROM users WHERE id = $1', [decoded.userId]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token. User not found.' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

// Require admin role (global)
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin role required.' });
  }
  next();
};

// Require project admin role
const requireProjectAdmin = async (req, res, next) => {
  try {
    const projectId = req.params.id || req.params.projectId;
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID required.' });
    }

    // Global admins can do anything
    if (req.user.role === 'admin') {
      return next();
    }

    // Check if user is project admin
    const result = await pool.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied. Not a project member.' });
    }

    if (result.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Project admin role required.' });
    }

    next();
  } catch (err) {
    return res.status(500).json({ error: 'Server error checking permissions.' });
  }
};

// Require project membership
const requireProjectMember = async (req, res, next) => {
  try {
    const projectId = req.params.id || req.params.projectId;
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID required.' });
    }

    // Global admins can do anything
    if (req.user.role === 'admin') {
      return next();
    }

    const result = await pool.query(
      'SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2',
      [projectId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied. Not a project member.' });
    }

    req.projectRole = result.rows[0].role;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Server error checking permissions.' });
  }
};

module.exports = { authenticate, requireAdmin, requireProjectAdmin, requireProjectMember };
