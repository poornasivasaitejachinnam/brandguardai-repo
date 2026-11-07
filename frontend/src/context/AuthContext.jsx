import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api, { setAuthToken } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const persistUser = (nextUser) => {
    if (nextUser) {
      localStorage.setItem('brandguard-user', JSON.stringify(nextUser));
    } else {
      localStorage.removeItem('brandguard-user');
    }
  };

  const fetchCurrentUser = async () => {
    const token = localStorage.getItem('brandguard-token');
    if (!token) {
      persistUser(null);
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const { data } = await api.get('/auth/me');
      persistUser(data.user);
      setUser(data.user);
    } catch (_error) {
      setAuthToken(null);
      persistUser(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (credentials) => {
    const { data } = await api.post('/auth/login', credentials);
    setAuthToken(data.token);
    persistUser(data.user);
    setUser(data.user);
    return data;
  };

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    setAuthToken(data.token);
    persistUser(data.user);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    setAuthToken(null);
    persistUser(null);
    setUser(null);
  };

  const updateUser = (data) => {
    if (data.token) setAuthToken(data.token);
    persistUser(data.user);
    setUser(data.user);
  };

  const value = useMemo(() => ({ user, loading, login, register, logout, updateUser }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
