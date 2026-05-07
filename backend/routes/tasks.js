const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { authenticate, requireProjectMember } = require('../middleware/auth');

// GET /api/tasks — List all tasks visible to user
router.get('/', authenticate, async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin') {
      result = await pool.query(
        `SELECT t.*, u.name as assignee_name, u.avatar_color as assignee_color,
                p.name as project_name, p.color as project_color,
                c.name as creator_name
         FROM tasks t
         LEFT JOIN users u ON t.assigned_to = u.id
         JOIN projects p ON t.project_id = p.id
         JOIN users c ON t.created_by = c.id
         ORDER BY t.created_at DESC`
      );
    } else {
      result = await pool.query(
        `SELECT t.*, u.name as assignee_name, u.avatar_color as assignee_color,
                p.name as project_name, p.color as project_color,
                c.name as creator_name
         FROM tasks t
         LEFT JOIN users u ON t.assigned_to = u.id
         JOIN projects p ON t.project_id = p.id
         JOIN users c ON t.created_by = c.id
         JOIN project_members pm ON t.project_id = pm.project_id AND pm.user_id = $1
         ORDER BY t.created_at DESC`,
        [req.user.id]
      );
    }
    res.json({ tasks: result.rows });
  } catch (err) {
    console.error('List all tasks error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/tasks/project/:id — List tasks for a specific project
router.get('/project/:id', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      const mc = await pool.query('SELECT id FROM project_members WHERE project_id=$1 AND user_id=$2', [req.params.id, req.user.id]);
      if (mc.rows.length === 0) return res.status(403).json({ error: 'Access denied.' });
    }
    const result = await pool.query(
      `SELECT t.*, u.name as assignee_name, u.avatar_color as assignee_color, c.name as creator_name
       FROM tasks t LEFT JOIN users u ON t.assigned_to=u.id JOIN users c ON t.created_by=c.id
       WHERE t.project_id=$1 ORDER BY t.created_at DESC`, [req.params.id]
    );
    res.json({ tasks: result.rows });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error.' }); }
});

// POST /api/tasks
router.post('/', authenticate, [
  body('title').trim().isLength({ min: 1, max: 300 }),
  body('project_id').isUUID(),
  body('assigned_to').optional({ nullable: true }).isUUID(),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  body('due_date').optional({ nullable: true }).isISO8601(),
  body('description').optional().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { title, description, project_id, assigned_to, priority, due_date } = req.body;

    // Check project exists
    const pc = await pool.query('SELECT id FROM projects WHERE id=$1', [project_id]);
    if (pc.rows.length === 0) return res.status(404).json({ error: 'Project not found.' });

    // Check permission - admin or project admin
    if (req.user.role !== 'admin') {
      const mc = await pool.query('SELECT role FROM project_members WHERE project_id=$1 AND user_id=$2', [project_id, req.user.id]);
      if (mc.rows.length === 0 || mc.rows[0].role !== 'admin') return res.status(403).json({ error: 'Only admins can create tasks.' });
    }

    const result = await pool.query(
      `INSERT INTO tasks (title, description, project_id, assigned_to, created_by, priority, due_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [title, description || '', project_id, assigned_to || null, req.user.id, priority || 'medium', due_date || null]
    );

    const task = result.rows[0];
    // Fetch assignee info
    if (task.assigned_to) {
      const u = await pool.query('SELECT name, avatar_color FROM users WHERE id=$1', [task.assigned_to]);
      if (u.rows.length) { task.assignee_name = u.rows[0].name; task.assignee_color = u.rows[0].avatar_color; }
    }
    const c = await pool.query('SELECT name FROM users WHERE id=$1', [task.created_by]);
    task.creator_name = c.rows[0]?.name;

    res.status(201).json({ task });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error.' }); }
});

// PUT /api/tasks/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const task = await pool.query('SELECT * FROM tasks WHERE id=$1', [req.params.id]);
    if (task.rows.length === 0) return res.status(404).json({ error: 'Task not found.' });
    const t = task.rows[0];

    // Check permission
    if (req.user.role !== 'admin') {
      const mc = await pool.query('SELECT role FROM project_members WHERE project_id=$1 AND user_id=$2', [t.project_id, req.user.id]);
      if (mc.rows.length === 0) return res.status(403).json({ error: 'Access denied.' });
      if (mc.rows[0].role !== 'admin' && t.assigned_to !== req.user.id) return res.status(403).json({ error: 'Can only edit your own tasks.' });
    }

    const { title, description, assigned_to, status, priority, due_date } = req.body;
    const fields = []; const values = []; let idx = 1;
    if (title !== undefined) { fields.push(`title=$${idx++}`); values.push(title); }
    if (description !== undefined) { fields.push(`description=$${idx++}`); values.push(description); }
    if (assigned_to !== undefined) { fields.push(`assigned_to=$${idx++}`); values.push(assigned_to || null); }
    if (status !== undefined) { fields.push(`status=$${idx++}`); values.push(status); }
    if (priority !== undefined) { fields.push(`priority=$${idx++}`); values.push(priority); }
    if (due_date !== undefined) { fields.push(`due_date=$${idx++}`); values.push(due_date || null); }

    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update.' });

    values.push(req.params.id);
    const result = await pool.query(`UPDATE tasks SET ${fields.join(',')} WHERE id=$${idx} RETURNING *`, values);

    const updated = result.rows[0];
    if (updated.assigned_to) {
      const u = await pool.query('SELECT name, avatar_color FROM users WHERE id=$1', [updated.assigned_to]);
      if (u.rows.length) { updated.assignee_name = u.rows[0].name; updated.assignee_color = u.rows[0].avatar_color; }
    }

    res.json({ task: updated });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error.' }); }
});

// PATCH /api/tasks/:id/status
router.patch('/:id/status', authenticate, [
  body('status').isIn(['todo', 'in_progress', 'done']),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const task = await pool.query('SELECT * FROM tasks WHERE id=$1', [req.params.id]);
    if (task.rows.length === 0) return res.status(404).json({ error: 'Task not found.' });
    const t = task.rows[0];

    if (req.user.role !== 'admin') {
      const mc = await pool.query('SELECT role FROM project_members WHERE project_id=$1 AND user_id=$2', [t.project_id, req.user.id]);
      if (mc.rows.length === 0) return res.status(403).json({ error: 'Access denied.' });
      if (mc.rows[0].role !== 'admin' && t.assigned_to !== req.user.id) return res.status(403).json({ error: 'Can only update status of your own tasks.' });
    }

    const result = await pool.query('UPDATE tasks SET status=$1 WHERE id=$2 RETURNING *', [req.body.status, req.params.id]);
    res.json({ task: result.rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error.' }); }
});

// DELETE /api/tasks/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const task = await pool.query('SELECT * FROM tasks WHERE id=$1', [req.params.id]);
    if (task.rows.length === 0) return res.status(404).json({ error: 'Task not found.' });

    if (req.user.role !== 'admin') {
      const mc = await pool.query('SELECT role FROM project_members WHERE project_id=$1 AND user_id=$2', [task.rows[0].project_id, req.user.id]);
      if (mc.rows.length === 0 || mc.rows[0].role !== 'admin') return res.status(403).json({ error: 'Only admins can delete tasks.' });
    }

    await pool.query('DELETE FROM tasks WHERE id=$1', [req.params.id]);
    res.json({ message: 'Task deleted.' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error.' }); }
});

module.exports = router;
