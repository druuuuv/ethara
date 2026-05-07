const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

// GET /api/dashboard
router.get('/', authenticate, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const userId = req.user.id;

    // Total projects
    let projectCount;
    if (isAdmin) {
      projectCount = await pool.query('SELECT COUNT(*) FROM projects');
    } else {
      projectCount = await pool.query('SELECT COUNT(*) FROM project_members WHERE user_id=$1', [userId]);
    }

    // Task stats
    let taskBase = isAdmin
      ? 'FROM tasks'
      : 'FROM tasks t JOIN project_members pm ON t.project_id=pm.project_id AND pm.user_id=$1';
    const params = isAdmin ? [] : [userId];

    const totalTasks = await pool.query(`SELECT COUNT(*) ${taskBase}`, params);
    const todoTasks = await pool.query(`SELECT COUNT(*) ${taskBase} ${isAdmin ? 'WHERE' : 'AND'} ${isAdmin ? '' : 't.'}status='todo'`, params);
    const inProgressTasks = await pool.query(`SELECT COUNT(*) ${taskBase} ${isAdmin ? 'WHERE' : 'AND'} ${isAdmin ? '' : 't.'}status='in_progress'`, params);
    const doneTasks = await pool.query(`SELECT COUNT(*) ${taskBase} ${isAdmin ? 'WHERE' : 'AND'} ${isAdmin ? '' : 't.'}status='done'`, params);
    const overdueTasks = await pool.query(
      `SELECT COUNT(*) ${taskBase} ${isAdmin ? 'WHERE' : 'AND'} ${isAdmin ? '' : 't.'}due_date < CURRENT_DATE AND ${isAdmin ? '' : 't.'}status != 'done'`,
      params
    );

    // Recent tasks
    let recentQuery;
    if (isAdmin) {
      recentQuery = `SELECT t.*, u.name as assignee_name, u.avatar_color as assignee_color, p.name as project_name
        FROM tasks t LEFT JOIN users u ON t.assigned_to=u.id JOIN projects p ON t.project_id=p.id
        ORDER BY t.created_at DESC LIMIT 10`;
    } else {
      recentQuery = `SELECT t.*, u.name as assignee_name, u.avatar_color as assignee_color, p.name as project_name
        FROM tasks t LEFT JOIN users u ON t.assigned_to=u.id JOIN projects p ON t.project_id=p.id
        JOIN project_members pm ON t.project_id=pm.project_id AND pm.user_id=$1
        ORDER BY t.created_at DESC LIMIT 10`;
    }
    const recentTasks = await pool.query(recentQuery, isAdmin ? [] : [userId]);

    // Member count (for admins)
    const memberCount = await pool.query('SELECT COUNT(*) FROM users');

    res.json({
      stats: {
        projects: parseInt(projectCount.rows[0].count),
        totalTasks: parseInt(totalTasks.rows[0].count),
        todo: parseInt(todoTasks.rows[0].count),
        inProgress: parseInt(inProgressTasks.rows[0].count),
        done: parseInt(doneTasks.rows[0].count),
        overdue: parseInt(overdueTasks.rows[0].count),
        members: parseInt(memberCount.rows[0].count),
      },
      recentTasks: recentTasks.rows,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/dashboard/overdue
router.get('/overdue', authenticate, async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    let query;
    let params;

    if (isAdmin) {
      query = `SELECT t.*, u.name as assignee_name, u.avatar_color as assignee_color, p.name as project_name
        FROM tasks t LEFT JOIN users u ON t.assigned_to=u.id JOIN projects p ON t.project_id=p.id
        WHERE t.due_date < CURRENT_DATE AND t.status != 'done'
        ORDER BY t.due_date ASC`;
      params = [];
    } else {
      query = `SELECT t.*, u.name as assignee_name, u.avatar_color as assignee_color, p.name as project_name
        FROM tasks t LEFT JOIN users u ON t.assigned_to=u.id JOIN projects p ON t.project_id=p.id
        JOIN project_members pm ON t.project_id=pm.project_id AND pm.user_id=$1
        WHERE t.due_date < CURRENT_DATE AND t.status != 'done'
        ORDER BY t.due_date ASC`;
      params = [req.user.id];
    }

    const result = await pool.query(query, params);
    res.json({ tasks: result.rows });
  } catch (err) {
    console.error('Overdue error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
