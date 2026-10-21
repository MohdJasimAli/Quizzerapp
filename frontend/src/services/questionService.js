import api from './api';

export const getQuestions = async (testId) => {
  const res = await api.get(`/tests/${testId}/questions`);
  return res.data;
};

export const addQuestion = async (testId, questionData) => {
  const res = await api.post(`/tests/${testId}/questions`, questionData);
  return res.data;
};

export const updateQuestion = async (testId, questionId, questionData) => {
  const res = await api.put(`/tests/${testId}/questions/${questionId}`, questionData);
  return res.data;
};

export const deleteQuestion = async (testId, questionId) => {
  const res = await api.delete(`/tests/${testId}/questions/${questionId}`);
  return res.data;
};
