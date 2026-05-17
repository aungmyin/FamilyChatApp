import React, { useState, useEffect } from 'react';
import './AdminPanel.css';

export default function AdminPanel({ onClose, token }) {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [families, setFamilies] = useState([]);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [newFamilyCode, setNewFamilyCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const API_URL = import.meta.env.VITE_SERVER_URL;

  useEffect(() => {
    fetchUsers();
    fetchFamilies();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (err) {
      setError('Failed to fetch users');
    }
  };

  const fetchFamilies = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/families`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setFamilies(data);
      }
    } catch (err) {
      setError('Failed to fetch families');
    }
  };

  const toggleBlockUser = async (userId) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/users/${userId}/block`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        fetchUsers();
        setSuccess('User status updated');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError('Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  const reassignFamily = async (userId, familyCode) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/users/${userId}/family`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ familyCode }),
      });
      if (response.ok) {
        fetchUsers();
        setSuccess('User reassigned');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError('Failed to reassign user');
    } finally {
      setLoading(false);
    }
  };

  const createFamily = async (e) => {
    e.preventDefault();
    if (!newFamilyName.trim()) {
      setError('Family name required');
      return;
    }
    if (!newFamilyCode.trim()) {
      setError('Family code required');
      return;
    }
    if (newFamilyCode.length < 3) {
      setError('Family code must be at least 3 characters');
      return;
    }
    if (!/^[a-z0-9]+$/.test(newFamilyCode)) {
      setError('Family code must contain only lowercase letters and numbers');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/families`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: newFamilyName, code: newFamilyCode }),
      });
      if (response.ok) {
        setNewFamilyName('');
        setNewFamilyCode('');
        fetchFamilies();
        setSuccess('Family created successfully');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to create family');
      }
    } catch (err) {
      setError('Network error: Failed to create family');
    } finally {
      setLoading(false);
    }
  };

  const deleteFamily = async (familyId) => {
    const family = families.find(f => f._id === familyId);
    if (!confirm(`Delete family "${family?.name}"? Make sure all users are reassigned first.`)) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/families/${familyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        fetchFamilies();
        setSuccess('Family deleted successfully');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to delete family');
      }
    } catch (err) {
      setError('Network error: Failed to delete family');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-panel-overlay" onClick={onClose}>
      <div className="admin-panel" onClick={(e) => e.stopPropagation()}>
        <div className="admin-header">
          <h2>Admin Panel</h2>
          <button onClick={onClose} className="close-button">✕</button>
        </div>

        <div className="admin-tabs">
          <button
            className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Users
          </button>
          <button
            className={`tab-button ${activeTab === 'families' ? 'active' : ''}`}
            onClick={() => setActiveTab('families')}
          >
            Family Codes
          </button>
        </div>

        {error && <div className="admin-error">{error}</div>}
        {success && <div className="admin-success">{success}</div>}

        <div className="admin-content">
          {activeTab === 'users' && (
            <div className="users-tab">
              <h3>All Users</h3>
              <div className="users-table">
                {users.length === 0 ? (
                  <p>No users found</p>
                ) : (
                  users.map((user) => (
                    <div key={user._id} className="user-row">
                      <div className="user-info">
                        <div className="user-username">{user.username}</div>
                        <div className="user-email">{user.email}</div>
                        <div className="user-meta">
                          <span className="family-code">Family: {user.familyCode}</span>
                          <span className={`status ${user.isBlocked ? 'blocked' : 'active'}`}>
                            {user.isBlocked ? 'BLOCKED' : 'ACTIVE'}
                          </span>
                        </div>
                      </div>
                      <div className="user-actions">
                        <select
                          onChange={(e) => reassignFamily(user._id, e.target.value)}
                          defaultValue={user.familyCode}
                          disabled={loading}
                          className="family-select"
                        >
                          <option value="">Select family</option>
                          {families.map((family) => (
                            <option key={family._id} value={family.code}>
                              {family.name} ({family.code})
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => toggleBlockUser(user._id)}
                          disabled={loading}
                          className={`block-button ${user.isBlocked ? 'unblock' : 'block'}`}
                        >
                          {user.isBlocked ? 'Unblock' : 'Block'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'families' && (
            <div className="families-tab">
              <h3>Family Groups</h3>
              <div className="families-list">
                {families.length === 0 ? (
                  <p>No families found</p>
                ) : (
                  families.map((family) => (
                    <div key={family._id} className="family-item">
                      <div className="family-info">
                        <div className="family-name">{family.name}</div>
                        <div className="family-code">{family.code}</div>
                      </div>
                      <button
                        onClick={() => deleteFamily(family._id)}
                        disabled={loading}
                        className="delete-button"
                      >
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={createFamily} className="create-family-form">
                <h4>Create New Family</h4>
                <div className="form-field">
                  <input
                    type="text"
                    placeholder="Family Name (e.g., Yangon Family)"
                    value={newFamilyName}
                    onChange={(e) => setNewFamilyName(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="form-field">
                  <input
                    type="text"
                    placeholder="Family Code (e.g., yangonfamily123)"
                    value={newFamilyCode}
                    onChange={(e) => setNewFamilyCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                    disabled={loading}
                  />
                  <small className="hint">Code: 3+ characters, lowercase letters & numbers only. Users enter this to join.</small>
                </div>
                <button type="submit" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Family'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
