import api from './api';

export const runCodeSample = async ({ questionId, language, code, customInput }) => {
  const res = await api.post('/execution/run', {
    questionId,
    language,
    code,
    customInput,
  });
  return res.data;
};
