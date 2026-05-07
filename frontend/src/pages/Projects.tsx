import { useEffect, useState } from 'react';
import { projectsAPI, usersAPI } from '../api';
import { useAuth } from '../context/AuthContext';

interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  member_count: number;
  task_count: number;
  creator_name: string;
  status: string;
}

const Projects = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState<string | null>(null);
  const [newProject, setNewProject] = useState({ name: '', description: '', color: '#6366f1' });
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [error, setError] = useState('');

  const fetchProjects = async () => {
    try {
      const res = await projectsAPI.list();
      setProjects(res.data.projects || []);
    } catch (err) {
      console.error('Failed to fetch projects', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await projectsAPI.create(newProject);
      setShowModal(false);
      setNewProject({ name: '', description: '', color: '#6366f1' });
      fetchProjects();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to create project');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      await projectsAPI.delete(id);
      fetchProjects();
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const openAddMember = async (projectId: string) => {
    setShowMemberModal(projectId);
    try {
      const res = await usersAPI.list();
      setUsers(res.data.users || []);
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  };

  const handleAddMember = async () => {
    if (!showMemberModal || !selectedUser) return;
    try {
      await projectsAPI.addMember(showMemberModal, { user_id: selectedUser });
      setShowMemberModal(null);
      setSelectedUser('');
      fetchProjects();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      alert(axiosErr.response?.data?.error || 'Failed to add member');
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '3rem' }}><div className="spinner" /></div>;

  const isAdmin = user?.role === 'admin';

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Projects</h2>
        {isAdmin && (
          <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setShowModal(true)}>
            + New Project
          </button>
        )}
      </div>

      <div className="grid grid-cols-3">
        {projects.map((proj) => (
          <div key={proj.id} className="card" style={{ borderTop: `4px solid ${proj.color || '#6366f1'}` }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem' }}>{proj.name}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem', minHeight: '2.5em', overflow: 'hidden' }}>
              {proj.description || 'No description'}
            </p>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <span>👥 {proj.member_count} members</span>
              <span>📋 {proj.task_count} tasks</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              {isAdmin && (
                <>
                  <button className="btn-sm btn-secondary" onClick={() => openAddMember(proj.id)}>Add Member</button>
                  <button className="btn-sm btn-danger" onClick={() => handleDelete(proj.id)}>Delete</button>
                </>
              )}
            </div>
          </div>
        ))}
        {projects.length === 0 && (
          <div className="card" style={{ gridColumn: 'span 3', textAlign: 'center', padding: '4rem' }}>
            <p className="empty-state">No projects found. {isAdmin ? 'Create your first one!' : 'Ask an admin to add you to a project.'}</p>
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1.5rem', fontWeight: '600' }}>Create New Project</h3>
            {error && <div className="alert alert-error">{error}</div>}
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label className="form-label">Project Name</label>
                <input
                  className="form-input"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  required
                  placeholder="My Awesome Project"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-input"
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  placeholder="Brief description..."
                  rows={3}
                  style={{ resize: 'vertical' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Color</label>
                <input
                  type="color"
                  value={newProject.color}
                  onChange={(e) => setNewProject({ ...newProject, color: e.target.value })}
                  style={{ width: '60px', height: '36px', border: 'none', cursor: 'pointer' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>Create Project</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showMemberModal && (
        <div className="modal-overlay" onClick={() => setShowMemberModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1.5rem', fontWeight: '600' }}>Add Team Member</h3>
            <div className="form-group">
              <label className="form-label">Select User</label>
              <select className="form-input" value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
                <option value="">-- Select a user --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setShowMemberModal(null)}>Cancel</button>
              <button className="btn btn-primary" style={{ width: 'auto' }} onClick={handleAddMember} disabled={!selectedUser}>Add Member</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
