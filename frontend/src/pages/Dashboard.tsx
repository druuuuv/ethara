import { useEffect, useState } from 'react';
import { dashboardAPI } from '../api';

interface StatsData {
  totalTasks: number;
  todo: number;
  inProgress: number;
  done: number;
  overdue: number;
  projects: number;
  members: number;
}

interface TaskItem {
  id: string;
  title: string;
  status: string;
  priority: string;
  project_name: string;
  assignee_name?: string;
  due_date?: string;
}

const Dashboard = () => {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [recentTasks, setRecentTasks] = useState<TaskItem[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, overdueRes] = await Promise.all([
          dashboardAPI.stats(),
          dashboardAPI.overdue(),
        ]);
        setStats(statsRes.data.stats);
        setRecentTasks(statsRes.data.recentTasks || []);
        setOverdueTasks(overdueRes.data.tasks || []);
      } catch (err) {
        console.error('Failed to fetch dashboard data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner" />
    </div>
  );

  const cards = [
    { label: 'Total Tasks', value: stats?.totalTasks ?? 0, color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)' },
    { label: 'Completed', value: stats?.done ?? 0, color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
    { label: 'In Progress', value: stats?.inProgress ?? 0, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' },
    { label: 'Overdue', value: stats?.overdue ?? 0, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  ];

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Dashboard</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>Overview of your team's progress</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4" style={{ marginBottom: '2rem' }}>
        {cards.map((card, i) => (
          <div key={i} className="card stat-card">
            <div className="stat-icon" style={{ backgroundColor: card.bg, color: card.color }}>
              <span style={{ fontSize: '1.25rem', fontWeight: '700' }}>{card.value}</span>
            </div>
            <div>
              <div className="stat-value">{card.value}</div>
              <div className="stat-label">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2">
        {/* Recent Tasks */}
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem', fontWeight: '600', fontSize: '1rem' }}>Recent Tasks</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {recentTasks.length > 0 ? recentTasks.slice(0, 8).map((task) => (
              <div key={task.id} className="task-row">
                <div>
                  <div style={{ fontWeight: '500', fontSize: '0.875rem' }}>{task.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{task.project_name}</div>
                </div>
                <span className={`badge badge-${task.status}`}>
                  {task.status.replace('_', ' ')}
                </span>
              </div>
            )) : (
              <p className="empty-state">No recent tasks</p>
            )}
          </div>
        </div>

        {/* Overdue Tasks */}
        <div className="card">
          <h3 style={{ marginBottom: '1.5rem', fontWeight: '600', fontSize: '1rem', color: 'var(--danger)' }}>
            ⚠ Overdue Tasks ({overdueTasks.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {overdueTasks.length > 0 ? overdueTasks.slice(0, 8).map((task) => (
              <div key={task.id} className="task-row">
                <div>
                  <div style={{ fontWeight: '500', fontSize: '0.875rem' }}>{task.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {task.project_name} • Due: {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
                <span className="badge badge-overdue">overdue</span>
              </div>
            )) : (
              <p className="empty-state">🎉 No overdue tasks!</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
