import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Inject Bearer token from localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('kairos_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle authentication expiry
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear token and dispatch custom event or redirect if not on login
      if (!window.location.pathname.includes('/login')) {
        localStorage.removeItem('kairos_token');
        localStorage.removeItem('kairos_user');
        window.location.href = '/login?expired=true';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
