import React, { createContext, useContext, useState, useEffect } from 'react';
import api, { setToken, clearToken } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const stored = (() => {
    try { return JSON.parse(sessionStorage.getItem('wa_user')); } catch { return null; }
  })();

  const [user, setUserState]  = useState(stored);
  const [loading, setLoading] = useState(!stored);

  const setUser = (u) => {
    setUserState(u);
    if (u) sessionStorage.setItem('wa_user', JSON.stringify(u));
    else sessionStorage.removeItem('wa_user');
  };

  useEffect(() => {
    const tryRefresh = async () => {
      if (stored) {
        try {
          const r = await api.post('/auth/refresh', {}, { withCredentials: true });
          setToken(r.data.access_token);
        } catch {
          setUser(null);
          clearToken();
        }
      }
      setLoading(false);
    };
    tryRefresh();
  }, []);

  const login = async (email, password) => {
    const sessionOnly = (() => {
      try { return localStorage.getItem('wa_cookie_consent') === 'declined'; }
      catch { return false; }
    })();
    const r = await api.post('/auth/login', { email, password, session_only: sessionOnly }, { withCredentials: true });
    setToken(r.data.access_token);
    setUser({ role: r.data.role, email: r.data.email });
    return r.data.role;
  };

  const logout = async () => {
    await api.post('/auth/logout', {}, { withCredentials: true }).catch(() => {});
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
