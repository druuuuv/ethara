import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const ANALYTICS_URL = import.meta.env.VITE_ANALYTICS_URL || 'http://localhost:8000/api';

const api = axios.create({ baseURL: API_URL });
const analyticsApi = axios.create({ baseURL: ANALYTICS_URL });

// Add auth token to requests — uses 'token' key (same as AuthContext)
const addAuth = (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
};
api.interceptors.request.use(addAuth);
analyticsApi.interceptors.request.use(addAuth);

// Handle 401 responses
const handle401 = (error: AxiosError): Promise<never> => {
  if (error.response?.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }
  return Promise.reject(error);
};
api.interceptors.response.use((r) => r, handle401);
analyticsApi.interceptors.response.use((r) => r, handle401);

// Auth
export const authAPI = {
  signup: (data: { name: string; email: string; password: string; role?: string }) => api.post('/auth/signup', data),
  login: (data: { email: string; password: string }) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

// Users
export const usersAPI = {
  list: () => api.get('/users'),
  get: (id: string) => api.get(`/users/${id}`),
};

// Projects
export const projectsAPI = {
  list: () => api.get('/projects'),
  get: (id: string) => api.get(`/projects/${id}`),
  create: (data: { name: string; description?: string; color?: string }) => api.post('/projects', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/projects/${id}`, data),
  delete: (id: string) => api.delete(`/projects/${id}`),
  addMember: (id: string, data: { user_id: string; role?: string }) => api.post(`/projects/${id}/members`, data),
  removeMember: (id: string, userId: string) => api.delete(`/projects/${id}/members/${userId}`),
};

// Tasks
export const tasksAPI = {
  listAll: () => api.get('/tasks'),
  listByProject: (projectId: string) => api.get(`/tasks/project/${projectId}`),
  create: (data: Record<string, unknown>) => api.post('/tasks', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/tasks/${id}`, data),
  updateStatus: (id: string, status: string) => api.patch(`/tasks/${id}/status`, { status }),
  delete: (id: string) => api.delete(`/tasks/${id}`),
};

// Dashboard
export const dashboardAPI = {
  stats: () => api.get('/dashboard'),
  overdue: () => api.get('/dashboard/overdue'),
};

// Analytics (FastAPI)
export const analyticsAPI = {
  projectSummary: () => analyticsApi.get('/analytics/project-summary'),
  userWorkload: () => analyticsApi.get('/analytics/user-workload'),
  overdueReport: () => analyticsApi.get('/analytics/overdue-report'),
  exportCSV: () => analyticsApi.get('/analytics/export/tasks', { responseType: 'blob' }),
};

export default api;
