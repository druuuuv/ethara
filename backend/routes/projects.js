const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { authenticate, requireAdmin } = require('../middleware/auth');

// GET /api/projects — List projects visible to current user
router.get('/', authenticate, async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin') {
      result = await pool.query(`
        SELECT p.*, u.name as creator_name,
          (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count
        FROM projects p
        JOIN users u ON p.created_by = u.id
        ORDER BY p.created_at DESC
      `);
    } else {
      result = await pool.query(`
        SELECT p.*, u.name as creator_name,
          (SELECT COUNT(*) FROM project_members pm WHERE pm.project_id = p.id) as member_count,
          (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) as task_count
        FROM projects p
        JOIN users u ON p.created_by = u.id
        JOIN project_members pm ON p.id = pm.project_id AND pm.user_id = $1
        ORDER BY p.created_at DESC
      `, [req.user.id]);
    }
    res.json({ projects: result.rows });
  } catch (err) {
    console.error('List projects error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/projects/:id — Get single project with members
router.get('/:id', authenticate, async (req, res) => {
  try {
    const project = await pool.query('SELECT p.*, u.name as creator_name FROM projects p JOIN users u ON p.created_by = u.id WHERE p.id = $1', [req.params.id]);
    if (project.rows.length === 0) return res.status(404).json({ error: 'Project not found.' });

    // Check access
    if (req.user.role !== 'admin') {
      const mc = await pool.query('SELECT id FROM project_members WHERE project_id=$1 AND user_id=$2', [req.params.id, req.user.id]);
      if (mc.rows.length === 0) return res.status(403).json({ error: 'Access denied.' });
    }

    // Get members
    const members = await pool.query(
      'SELECT u.id, u.name, u.email, u.avatar_color, pm.role, pm.joined_at FROM project_members pm JOIN users u ON pm.user_id = u.id WHERE pm.project_id = $1 ORDER BY pm.joined_at',
      [req.params.id]
    );

    res.json({ project: { ...project.rows[0], members: members.rows } });
  } catch (err) {
    console.error('Get project error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/projects — Create project (admin only)
router.post('/', authenticate, [
  body('name').trim().isLength({ min: 1, max: 200 }).withMessage('Project name required (max 200 chars)'),
  body('description').optional().trim(),
  body('color').optional().matches(/^#[0-9a-fA-F]{6}$/),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    // Only admins can create projects
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can create projects.' });
    }

    const { name, description, color } = req.body;
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6'];
    const projectColor = color || colors[Math.floor(Math.random() * colors.length)];

    const result = await pool.query(
      'INSERT INTO projects (name, description, created_by, color) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, description || '', req.user.id, projectColor]
    );

    const project = result.rows[0];

    // Auto-add creator as project admin member
    await pool.query(
      'INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)',
      [project.id, req.user.id, 'admin']
    );

    project.member_count = 1;
    project.task_count = 0;
    project.creator_name = req.user.name;

    res.status(201).json({ project });
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/projects/:id — Update project
router.put('/:id', authenticate, async (req, res) => {
  try {
    const project = await pool.query('SELECT * FROM projects WHERE id=$1', [req.params.id]);
    if (project.rows.length === 0) return res.status(404).json({ error: 'Project not found.' });

    // Check permission — must be global admin or project admin
    if (req.user.role !== 'admin') {
      const mc = await pool.query('SELECT role FROM project_members WHERE project_id=$1 AND user_id=$2', [req.params.id, req.user.id]);
      if (mc.rows.length === 0 || mc.rows[0].role !== 'admin') return res.status(403).json({ error: 'Access denied.' });
    }

    const { name, description, color, status } = req.body;
    const fields = []; const values = []; let idx = 1;
    if (name !== undefined) { fields.push(`name=$${idx++}`); values.push(name); }
    if (description !== undefined) { fields.push(`description=$${idx++}`); values.push(description); }
    if (color !== undefined) { fields.push(`color=$${idx++}`); values.push(color); }
    if (status !== undefined) { fields.push(`status=$${idx++}`); values.push(status); }

    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update.' });

    values.push(req.params.id);
    const result = await pool.query(`UPDATE projects SET ${fields.join(',')} WHERE id=$${idx} RETURNING *`, values);

    res.json({ project: result.rows[0] });
  } catch (err) {
    console.error('Update project error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/projects/:id — Delete project (admin only)
router.delete('/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete projects.' });
    }

    const project = await pool.query('SELECT id FROM projects WHERE id=$1', [req.params.id]);
    if (project.rows.length === 0) return res.status(404).json({ error: 'Project not found.' });

    await pool.query('DELETE FROM projects WHERE id=$1', [req.params.id]);
    res.json({ message: 'Project deleted.' });
  } catch (err) {
    console.error('Delete project error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/projects/:id/members — Add member to project
router.post('/:id/members', authenticate, [
  body('user_id').isUUID().withMessage('Valid user ID required'),
  body('role').optional().isIn(['admin', 'member']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    // Check permission
    if (req.user.role !== 'admin') {
      const mc = await pool.query('SELECT role FROM project_members WHERE project_id=$1 AND user_id=$2', [req.params.id, req.user.id]);
      if (mc.rows.length === 0 || mc.rows[0].role !== 'admin') return res.status(403).json({ error: 'Access denied.' });
    }

    const { user_id, role = 'member' } = req.body;

    // Check user exists
    const userExists = await pool.query('SELECT id FROM users WHERE id=$1', [user_id]);
    if (userExists.rows.length === 0) return res.status(404).json({ error: 'User not found.' });

    // Check not already member
    const existing = await pool.query('SELECT id FROM project_members WHERE project_id=$1 AND user_id=$2', [req.params.id, user_id]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'User is already a member.' });

    await pool.query('INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, $3)', [req.params.id, user_id, role]);

    const member = await pool.query('SELECT u.id, u.name, u.email, u.avatar_color FROM users u WHERE u.id=$1', [user_id]);
    res.status(201).json({ member: { ...member.rows[0], role } });
  } catch (err) {
    console.error('Add member error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/projects/:id/members/:userId — Remove member
router.delete('/:id/members/:userId', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      const mc = await pool.query('SELECT role FROM project_members WHERE project_id=$1 AND user_id=$2', [req.params.id, req.user.id]);
      if (mc.rows.length === 0 || mc.rows[0].role !== 'admin') return res.status(403).json({ error: 'Access denied.' });
    }

    const result = await pool.query('DELETE FROM project_members WHERE project_id=$1 AND user_id=$2', [req.params.id, req.params.userId]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Member not found.' });

    res.json({ message: 'Member removed.' });
  } catch (err) {
    console.error('Remove member error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
