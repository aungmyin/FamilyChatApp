import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import ChatRoom from './components/ChatRoom';

const PrivateRoute = ({ children }) => {
  const { token, loading } = useContext(AuthContext);

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  return token ? children : <Navigate to="/" />;
};

const AppRoutes = () => {
  const { token } = useContext(AuthContext);

  return (
    <Routes>
      <Route path="/" element={token ? <Navigate to="/chat" /> : <Login />} />
      <Route path="/register" element={token ? <Navigate to="/chat" /> : <Register />} />
      <Route
        path="/chat"
        element={
          <PrivateRoute>
            <ChatRoom />
          </PrivateRoute>
        }
      />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
