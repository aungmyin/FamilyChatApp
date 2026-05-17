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
  const [familyCode, setFamilyCode] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUsername = localStorage.getItem('username');
    const storedUserId = localStorage.getItem('userId');
    const storedFamilyCode = localStorage.getItem('familyCode');
    const storedIsAdmin = localStorage.getItem('isAdmin');

    if (storedToken && storedUsername && storedUserId) {
      setToken(storedToken);
      setUsername(storedUsername);
      setUserId(storedUserId);
      setFamilyCode(storedFamilyCode || '');
      setIsAdmin(storedIsAdmin === 'true');
    }

    setLoading(false);
  }, []);

  const login = (newToken, newUsername) => {
    const decoded = decodeToken(newToken);
    const newUserId = decoded?.id || decoded?.userId;
    const newFamilyCode = decoded?.familyCode || '';
    const newIsAdmin = decoded?.isAdmin || false;

    setToken(newToken);
    setUsername(newUsername);
    setUserId(newUserId);
    setFamilyCode(newFamilyCode);
    setIsAdmin(newIsAdmin);
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', newUsername);
    localStorage.setItem('userId', newUserId);
    localStorage.setItem('familyCode', newFamilyCode);
    localStorage.setItem('isAdmin', newIsAdmin.toString());
  };

  const logout = () => {
    setToken(null);
    setUsername(null);
    setUserId(null);
    setFamilyCode('');
    setIsAdmin(false);
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('userId');
    localStorage.removeItem('familyCode');
    localStorage.removeItem('isAdmin');
  };

  return (
    <AuthContext.Provider value={{ token, userId, username, familyCode, isAdmin, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
