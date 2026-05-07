import { useEffect, useState } from 'react';
import { tasksAPI, projectsAPI, usersAPI } from '../api';
import { useAuth } from '../context/AuthContext';

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  project_name: string;
  project_id: string;
  assignee_name?: string;
  due_date?: string;
}

const Tasks = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [newTask, setNewTask] = useState({ title: '', description: '', project_id: '', assigned_to: '', priority: 'medium', due_date: '' });
  const [error, setError] = useState('');

  const fetchTasks = async () => {
    try {
      const res = await tasksAPI.listAll();
      setTasks(res.data.tasks || []);
    } catch (err) {
      console.error('Failed to fetch tasks', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await tasksAPI.updateStatus(taskId, newStatus);
      fetchTasks();
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  const openCreateModal = async () => {
    setShowModal(true);
    try {
      const [projRes, userRes] = await Promise.all([projectsAPI.list(), usersAPI.list()]);
      setProjects(projRes.data.projects || []);
      setUsers(userRes.data.users || []);
    } catch (err) {
      console.error('Failed to fetch data for modal', err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await tasksAPI.create({
        ...newTask,
        assigned_to: newTask.assigned_to || null,
        due_date: newTask.due_date || null,
      });
      setShowModal(false);
      setNewTask({ title: '', description: '', project_id: '', assigned_to: '', priority: 'medium', due_date: '' });
      fetchTasks();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to create task');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this task?')) return;
    try {
      await tasksAPI.delete(id);
      fetchTasks();
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      default: return '#22c55e';
    }
  };

  const filteredTasks = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  const isAdmin = user?.role === 'admin';

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Tasks</h2>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select className="form-input" style={{ width: 'auto' }} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
          {isAdmin && (
            <button className="btn btn-primary" style={{ width: 'auto' }} onClick={openCreateModal}>
              + Add Task
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr className="table-header">
              <th style={{ padding: '1rem 1.5rem' }}>Task</th>
              <th style={{ padding: '1rem 1.5rem' }}>Project</th>
              <th style={{ padding: '1rem 1.5rem' }}>Assignee</th>
              <th style={{ padding: '1rem 1.5rem' }}>Priority</th>
              <th style={{ padding: '1rem 1.5rem' }}>Status</th>
              <th style={{ padding: '1rem 1.5rem' }}>Due Date</th>
              {isAdmin && <th style={{ padding: '1rem 1.5rem' }}>Actions</th>}
            </tr>
          </thead>
          <tbody style={{ fontSize: '0.875rem' }}>
            {filteredTasks.map((task) => (
              <tr key={task.id} className="table-row">
                <td style={{ padding: '1rem 1.5rem' }}>
                  <div style={{ fontWeight: '600' }}>{task.title}</div>
                </td>
                <td style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)' }}>{task.project_name}</td>
                <td style={{ padding: '1rem 1.5rem' }}>{task.assignee_name || 'Unassigned'}</td>
                <td style={{ padding: '1rem 1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: getPriorityColor(task.priority) }} />
                    <span style={{ textTransform: 'capitalize' }}>{task.priority}</span>
                  </div>
                </td>
                <td style={{ padding: '1rem 1.5rem' }}>
                  <select
                    className="status-select"
                    value={task.status}
                    onChange={(e) => handleStatusChange(task.id, e.target.value)}
                  >
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                </td>
                <td style={{ padding: '1rem 1.5rem', color: 'var(--text-muted)' }}>
                  {task.due_date ? new Date(task.due_date).toLocaleDateString() : '—'}
                </td>
                {isAdmin && (
                  <td style={{ padding: '1rem 1.5rem' }}>
                    <button className="btn-sm btn-danger" onClick={() => handleDelete(task.id)}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
            {filteredTasks.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No tasks found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Task Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1.5rem', fontWeight: '600' }}>Create New Task</h3>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input className="form-input" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} required placeholder="Task title" />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input" value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} placeholder="Optional description..." rows={2} style={{ resize: 'vertical' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Project</label>
                <select className="form-input" value={newTask.project_id} onChange={(e) => setNewTask({ ...newTask, project_id: e.target.value })} required>
                  <option value="">-- Select Project --</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Assign To</label>
                <select className="form-input" value={newTask.assigned_to} onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })}>
                  <option value="">Unassigned</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Priority</label>
                  <select className="form-input" value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Due Date</label>
                  <input type="date" className="form-input" value={newTask.due_date} onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>Create Task</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
