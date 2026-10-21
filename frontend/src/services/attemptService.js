import api from './api';

export const startTest = async (testId) => {
  const res = await api.post(`/attempts/${testId}/start`);
  return res.data;
};

export const autosaveMCQ = async (attemptId, data) => {
  const res = await api.post(`/attempts/${attemptId}/save-mcq`, data);
  return res.data;
};

export const autosaveCoding = async (attemptId, data) => {
  const res = await api.post(`/attempts/${attemptId}/save-coding`, data);
  return res.data;
};

export const logIntegrityEvent = async (attemptId, eventType, details) => {
  const res = await api.post(`/attempts/${attemptId}/integrity-event`, {
    eventType,
    details,
  });
  return res.data;
};

export const submitTest = async (attemptId, isAutoSubmit = false, reason = 'manual_submit') => {
  const res = await api.post(`/attempts/${attemptId}/submit`, {
    isAutoSubmit,
    reason,
  });
  return res.data;
};

export const getMyAttempts = async () => {
  const res = await api.get('/attempts/my-attempts');
  return res.data;
};

export const getAttemptById = async (attemptId) => {
  const res = await api.get(`/attempts/${attemptId}`);
  return res.data;
};
