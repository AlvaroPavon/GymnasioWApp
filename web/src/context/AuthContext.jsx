import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { API_URL, getApiErrorMessage } from '../lib/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const sessionVersionRef = useRef(0);

  const logout = useCallback(() => {
    sessionVersionRef.current += 1;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    const requestSessionVersion = sessionVersionRef.current;
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    try {
      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (requestSessionVersion !== sessionVersionRef.current || localStorage.getItem('token') !== token) {
        return null;
      }
      localStorage.setItem('user', JSON.stringify(response.data));
      setUser(response.data);
      return response.data;
    } catch (error) {
      if (error?.response?.status === 401 && requestSessionVersion === sessionVersionRef.current) {
        logout();
        return null;
      }
      throw error;
    }
  }, [logout]);

  useEffect(() => {
    // Restaurar sesión
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch {
          localStorage.removeItem('user');
        }
      }
      refreshCurrentUser().catch(() => {}).finally(() => setLoading(false));
      return;
    }
    setLoading(false);
  }, [refreshCurrentUser]);

  const login = async (email, password) => {
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { email, password });
      const token = res.data.accessToken || res.data.token;
      sessionVersionRef.current += 1;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setUser(res.data.user);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      return { success: true };
    } catch (error) {
      return { success: false, message: getApiErrorMessage(error, 'Error al iniciar sesión') };
    }
  };

  if (loading) return <div className="min-h-screen text-white bg-gym-dark flex items-center justify-center">Cargando...</div>;

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, refreshCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
};
