import axios from 'axios';

const BASE = '/api';

const api = axios.create({ baseURL: BASE, withCredentials: true });

export const setToken   = t => sessionStorage.setItem('wa_token', t);
export const clearToken = () => sessionStorage.removeItem('wa_token');
export const getToken   = () => sessionStorage.getItem('wa_token');

api.interceptors.request.use(config => {
  const token = getToken();
  console.log('[API] Request to', config.url, '| Token:', token ? token.slice(0,20)+'...' : 'NULL');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing = null;

api.interceptors.response.use(
  res => res,
  async err => {
    const orig = err.config;
    if (err.response?.status === 401 && !orig._retry) {
      orig._retry = true;
      try {
        if (!refreshing) {
          refreshing = axios.post(`${BASE}/auth/refresh`, {}, { withCredentials: true })
            .then(r => { setToken(r.data.access_token); return r.data.access_token; })
            .catch(() => null)
            .finally(() => { refreshing = null; });
        }
        const token = await refreshing;
        if (token) {
          orig.headers.Authorization = `Bearer ${token}`;
          return api(orig);
        }
      } catch {
        // ignore
      }
      clearToken();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
