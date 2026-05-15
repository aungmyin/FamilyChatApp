import React, { createContext, useState, useEffect } from 'react';

export const AuthContext = createContext();

const decodeToken = (token) => {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return decoded;
  } catch (err) {
    console.error('Error decoding token:', err);
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(null);
  const [userId, setUserId] = useState(null);
  const [username, setUsername] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUsername = localStorage.getItem('username');
    const storedUserId = localStorage.getItem('userId');

    if (storedToken && storedUsername && storedUserId) {
      setToken(storedToken);
      setUsername(storedUsername);
      setUserId(storedUserId);
    }

    setLoading(false);
  }, []);

  const login = (newToken, newUsername) => {
    const decoded = decodeToken(newToken);
    const newUserId = decoded?.id || decoded?.userId;

    setToken(newToken);
    setUsername(newUsername);
    setUserId(newUserId);
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', newUsername);
    localStorage.setItem('userId', newUserId);
  };

  const logout = () => {
    setToken(null);
    setUsername(null);
    setUserId(null);
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('userId');
  };

  return (
    <AuthContext.Provider value={{ token, userId, username, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
