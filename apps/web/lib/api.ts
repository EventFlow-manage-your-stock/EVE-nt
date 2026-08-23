import axios from 'axios';

// EVENTFLOW_PRODUCT_POLISH_V4:
// Normalizujemy adres API, bo w projekcie są oba style wywołań:
// - api.post('/auth/login')
// - api.get('/api/dashboard/summary')
// Backend Nest ma globalPrefix('api'), więc finalnie każde wywołanie ma trafić w /api/...
const rawBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api';
export const API_ORIGIN = rawBase.replace(/\/+$/, '').replace(/\/api$/, '');

export const api = axios.create({
  baseURL: API_ORIGIN,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const currentUrl = config.url || '';
  if (!/^https?:\/\//.test(currentUrl) && !currentUrl.startsWith('/api/')) {
    config.url = `/api${currentUrl.startsWith('/') ? currentUrl : `/${currentUrl}`}`;
  }

  if (typeof window !== 'undefined') {
    const token =
      localStorage.getItem('access_token') ||
      localStorage.getItem('eventflow_token') ||
      JSON.parse(localStorage.getItem('wms-auth-storage') || '{}')?.state?.accessToken;

    if (token) config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined' && error?.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('eventflow_token');
      localStorage.removeItem('user');
      localStorage.removeItem('eventflow_user');
    }
    return Promise.reject(error);
  }
);
