import api from './api';

export const getAttemptResult = async (attemptId) => {
  const res = await api.get(`/results/attempt/${attemptId}`);
  return res.data;
};

export const getTestResults = async (testId) => {
  const res = await api.get(`/results/test/${testId}`);
  return res.data;
};

export const manualEvaluate = async (resultId, data) => {
  const res = await api.put(`/results/${resultId}/manual-evaluate`, data);
  return res.data;
};

export const exportResultsCSV = async (testId, testTitle = 'test') => {
  const res = await api.get(`/results/test/${testId}/export-csv`, {
    responseType: 'blob',
  });
  
  // Trigger file download in browser
  const blob = new Blob([res.data], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `KairosTest_${testTitle.replace(/\s+/g, '_')}_Results.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
