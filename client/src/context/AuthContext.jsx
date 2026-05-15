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
  const [groups, setGroups] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUsername = localStorage.getItem('username');
    const storedUserId = localStorage.getItem('userId');
    const storedGroups = localStorage.getItem('groups');
    const storedIsAdmin = localStorage.getItem('isAdmin');

    if (storedToken && storedUsername && storedUserId) {
      setToken(storedToken);
      setUsername(storedUsername);
      setUserId(storedUserId);
      setGroups(storedGroups ? JSON.parse(storedGroups) : []);
      setIsAdmin(storedIsAdmin === 'true');
    }

    setLoading(false);
  }, []);

  const login = (newToken, newUsername) => {
    const decoded = decodeToken(newToken);
    const newUserId = decoded?.id || decoded?.userId;
    const newGroups = decoded?.groups || [];
    const newIsAdmin = decoded?.isAdmin || false;

    setToken(newToken);
    setUsername(newUsername);
    setUserId(newUserId);
    setGroups(newGroups);
    setIsAdmin(newIsAdmin);
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', newUsername);
    localStorage.setItem('userId', newUserId);
    localStorage.setItem('groups', JSON.stringify(newGroups));
    localStorage.setItem('isAdmin', newIsAdmin);
  };

  const logout = () => {
    setToken(null);
    setUsername(null);
    setUserId(null);
    setGroups([]);
    setIsAdmin(false);
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('userId');
    localStorage.removeItem('groups');
    localStorage.removeItem('isAdmin');
  };

  return (
    <AuthContext.Provider value={{ token, userId, username, groups, isAdmin, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
