import api from './api';

export const getTests = async (params) => {
  const res = await api.get('/tests', { params });
  return res.data;
};

export const getTestById = async (id) => {
  const res = await api.get(`/tests/${id}`);
  return res.data;
};

export const createTest = async (testData) => {
  const res = await api.post('/tests', testData);
  return res.data;
};

export const updateTest = async (id, testData) => {
  const res = await api.put(`/tests/${id}`, testData);
  return res.data;
};

export const publishTest = async (id) => {
  const res = await api.patch(`/tests/${id}/publish`);
  return res.data;
};

export const unpublishTest = async (id) => {
  const res = await api.patch(`/tests/${id}/unpublish`);
  return res.data;
};

export const deleteTest = async (id) => {
  const res = await api.delete(`/tests/${id}`);
  return res.data;
};

export const toggleReleaseResults = async (id, release) => {
  const res = await api.patch(`/tests/${id}/release-results`, { release });
  return res.data;
};
