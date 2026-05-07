const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

// GET /api/users — List all users (for dropdowns)
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, avatar_color, created_at FROM users ORDER BY name ASC'
    );
    res.json({ users: result.rows });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Server error fetching users.' });
  }
});

// GET /api/users/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, avatar_color, created_at FROM users WHERE id = $1',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Server error fetching user.' });
  }
});

module.exports = router;
