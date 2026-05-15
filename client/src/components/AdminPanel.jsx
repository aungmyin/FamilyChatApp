import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import './AdminPanel.css';

export default function AdminPanel({ onClose }) {
  const { token } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(null);
  const [savingStates, setSavingStates] = useState({});

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/admin/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data);
      setError('');
    } catch (err) {
      console.error('Fetch users error:', err);
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleGroupToggle = (userId, group) => {
    setUsers((prev) =>
      prev.map((user) => {
        if (user._id === userId) {
          const newGroups = user.groups.includes(group)
            ? user.groups.filter((g) => g !== group)
            : [...user.groups, group];
          return { ...user, groups: newGroups };
        }
        return user;
      })
    );
  };

  const handleSaveUser = async (userId) => {
    try {
      setSavingStates((prev) => ({ ...prev, [userId]: true }));
      const user = users.find((u) => u._id === userId);

      const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/api/admin/users/${userId}/groups`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ groups: user.groups }),
      });

      if (!response.ok) {
        throw new Error('Failed to save user');
      }

      setSavingStates((prev) => ({ ...prev, [userId]: false }));
    } catch (err) {
      console.error('Save user error:', err);
      setError(err.message || 'Failed to save user');
      setSavingStates((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const groupLabels = {
    'yangon-family': 'Yangon Family',
    'native-family': 'Native Family',
  };

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h2>⚙️ Manage Users</h2>
        <button onClick={onClose} className="admin-close-button">
          ✕
        </button>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-content">
        {loading ? (
          <div className="admin-loading">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="admin-empty">No users found</div>
        ) : (
          <div className="admin-users-list">
            {users.map((user) => (
              <div key={user._id} className="admin-user-row">
                <div className="admin-user-info">
                  <div className="admin-username">{user.username}</div>
                  <div className="admin-email">{user.email}</div>
                </div>

                <div className="admin-groups-section">
                  {Object.entries(groupLabels).map(([groupKey, groupLabel]) => (
                    <label key={groupKey} className="admin-group-label">
                      <input
                        type="checkbox"
                        checked={user.groups.includes(groupKey)}
                        onChange={() => handleGroupToggle(user._id, groupKey)}
                      />
                      <span>{groupLabel}</span>
                    </label>
                  ))}
                </div>

                <button
                  onClick={() => handleSaveUser(user._id)}
                  className="admin-save-button"
                  disabled={savingStates[user._id]}
                >
                  {savingStates[user._id] ? '⏳' : '✓ Save'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
