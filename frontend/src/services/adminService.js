import api from './api';

export const getDashboardStats = async () => {
  const res = await api.get('/admin/stats');
  return res.data;
};

export const getUsers = async (params) => {
  const res = await api.get('/admin/users', { params });
  return res.data;
};

export const createUser = async (userData) => {
  const res = await api.post('/admin/users', userData);
  return res.data;
};

export const updateUser = async (id, userData) => {
  const res = await api.put(`/admin/users/${id}`, userData);
  return res.data;
};

export const deleteUser = async (id) => {
  const res = await api.delete(`/admin/users/${id}`);
  return res.data;
};

export const getActivityLogs = async (params) => {
  const res = await api.get('/admin/activity-logs', { params });
  return res.data;
};
