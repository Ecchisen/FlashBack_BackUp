// flashback-frontend/src/AdminPanel.jsx
import React, { useState, useEffect } from 'react';
import {
  Shield, Users, Image as ImageIcon, Calendar, Trash2,
  RefreshCw, Loader2, AlertCircle, Check,
  AlertTriangle, ArrowLeft
} from 'lucide-react';

const getAdminToken = () => localStorage.getItem('admin_token');
const setAdminToken = (token) => {
  if (token) localStorage.setItem('admin_token', token);
  else localStorage.removeItem('admin_token');
};

export default function AdminPanel({ onBack }) {
  const [adminKey, setKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [stats, setStats] = useState({ totalEvents: 0, totalPhotos: 0, totalUsers: 0 });
  const [usersList, setUsersList] = useState([]);
  const [eventsList, setEventsList] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);

  useEffect(() => {
    const existing = getAdminToken();
    if (existing) {
      verifyToken(existing);
    } else {
      setCheckingAuth(false);
    }
  }, []);

  const adminFetch = async (url, options = {}) => {
    const token = getAdminToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };
    const res = await fetch(url, { ...options, headers });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Server returned status ${res.status}.`);
    }
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  const verifyToken = async (token) => {
    try {
      await adminFetch('/api/admin/verify');
      setIsAuthenticated(true);
      fetchDashboardData();
    } catch (e) {
      setAdminToken(null);
      setIsAuthenticated(false);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminKey })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid administrator password.');
      setAdminToken(data.token);
      setIsAuthenticated(true);
      fetchDashboardData();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const fetchDashboardData = async () => {
    setLoadingData(true);
    setErrorMsg(null);
    try {
      const [s, u, e] = await Promise.all([
        adminFetch('/api/admin/stats'),
        adminFetch('/api/admin/users'),
        adminFetch('/api/admin/events')
      ]);
      setStats(s);
      setUsersList(u.users || []);
      setEventsList(e.events || []);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to refresh admin data.');
    } finally {
      setLoadingData(false);
    }
  };

  // Delete button on the side: clears the account directly from the database
  const handleDeleteUser = async (userId, userEmail) => {
    if (!window.confirm(`Are you sure you want to delete account "${userEmail}" from the database? This cannot be undone.`)) {
      return;
    }
    setDeletingUserId(userId);
    setErrorMsg(null);
    try {
      await adminFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      setActionSuccess(`Account "${userEmail}" cleared from database.`);
      setTimeout(() => setActionSuccess(null), 4000);
      fetchDashboardData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to delete account.');
    } finally {
      setDeletingUserId(null);
    }
  };

  // Clear all test accounts
  const handleClearAllTestAccounts = async () => {
    setClearing(true);
    setErrorMsg(null);
    try {
      await adminFetch('/api/admin/clear-test-accounts', { method: 'POST' });
      setShowClearConfirm(false);
      setActionSuccess('All test accounts cleared from database.');
      setTimeout(() => setActionSuccess(null), 5000);
      fetchDashboardData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to clear test accounts.');
    } finally {
      setClearing(false);
    }
  };

  const handleToggleEvent = async (code) => {
    try {
      await adminFetch(`/api/admin/events/${code}/toggle`, { method: 'POST' });
      fetchDashboardData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to toggle event.');
    }
  };

  if (checkingAuth) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F3E9' }}>
        <Loader2 style={{ width: '32px', height: '32px', color: '#C04A25' }} className="animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: '85vh', backgroundColor: '#F7F3E9', padding: '32px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: '400px', width: '100%', backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '32px', border: '1px solid #E5E0D8', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.08)', position: 'relative' }}>
          
          <button
            type="button"
            onClick={onBack}
            style={{ position: 'absolute', top: '16px', left: '16px', display: 'flex', alignItems: 'center', gap: '4px', color: '#52525B', backgroundColor: '#F4F4F5', border: '1px solid #E4E4E7', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
          >
            <ArrowLeft style={{ width: '14px', height: '14px' }} />
            <span>Home</span>
          </button>

          <div style={{ textAlign: 'center', marginBottom: '24px', marginTop: '16px' }}>
            <div style={{ width: '48px', height: '48px', backgroundColor: '#FEF2F2', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
              <Shield style={{ width: '24px', height: '24px', color: '#DC2626' }} />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#18181B', margin: '0 0 6px 0' }}>System Administration</h2>
            <p style={{ fontSize: '13px', color: '#71717A', margin: 0 }}>Enter administrative master key to access controls</p>
          </div>

          {errorMsg && (
            <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #F87171', color: '#991B1B', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#27272A', marginBottom: '4px' }}>Admin Key / Password</label>
              <input
                type="password"
                required
                placeholder="Enter ADMIN_KEY"
                value={adminKey}
                onChange={(e) => setKey(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D4D4D8', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <button
              type="submit"
              style={{ width: '100%', backgroundColor: '#18181B', color: '#FFFFFF', padding: '12px', borderRadius: '8px', border: 'none', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              Authenticate Admin
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '90vh', backgroundColor: '#F7F3E9', padding: '32px 16px', color: '#18181B' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Admin Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: '20px 24px', borderRadius: '14px', border: '1px solid #E5E0D8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', backgroundColor: '#FEF2F2', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield style={{ width: '22px', height: '22px', color: '#DC2626' }} />
            </div>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#18181B' }}>FlashBack System Control</h1>
              <span style={{ fontSize: '13px', color: '#71717A' }}>Manage registered hosts, events, and database cleanup</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onBack}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#F4F4F5', border: '1px solid #D4D4D8', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >
              <ArrowLeft style={{ width: '14px', height: '14px' }} />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={fetchDashboardData}
              disabled={loadingData}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#F4F4F5', border: '1px solid #D4D4D8', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >
              <RefreshCw style={{ width: '14px', height: '14px', animation: loadingData ? 'spin 1s linear infinite' : 'none' }} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => { setAdminToken(null); setIsAuthenticated(false); }}
              style={{ backgroundColor: '#18181B', color: '#FFFFFF', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >
              Lock Admin
            </button>
          </div>
        </div>

        {actionSuccess && (
          <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '10px', padding: '12px 16px', color: '#166534', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Check style={{ width: '16px', height: '16px', color: '#16A34A' }} />
            <span>{actionSuccess}</span>
          </div>
        )}

        {errorMsg && (
          <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #F87171', color: '#991B1B', padding: '10px 12px', borderRadius: '8px', fontSize: '13px' }}>
            {errorMsg}
          </div>
        )}

        {/* Overview Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '14px', border: '1px solid #E5E0D8' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#71717A', textTransform: 'uppercase' }}>Registered Hosts</span>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#2563EB', marginTop: '6px' }}>{usersList.length}</div>
          </div>
          <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '14px', border: '1px solid #E5E0D8' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#71717A', textTransform: 'uppercase' }}>Total Events</span>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#18181B', marginTop: '6px' }}>{stats.totalEvents || eventsList.length || 0}</div>
          </div>
          <div style={{ backgroundColor: '#FFFFFF', padding: '20px', borderRadius: '14px', border: '1px solid #E5E0D8' }}>
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#71717A', textTransform: 'uppercase' }}>Photos Streamed</span>
            <div style={{ fontSize: '28px', fontWeight: '800', color: '#C04A25', marginTop: '6px' }}>{stats.totalPhotos || 0}</div>
          </div>
        </div>

        {/* Pre-Deployment Test Accounts Cleanup Banner */}
        <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <AlertTriangle style={{ width: '20px', height: '20px', color: '#D97706', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#78350F', margin: 0 }}>Pre-Deployment Database Clean</h3>
              <p style={{ fontSize: '12px', color: '#B45309', margin: '4px 0 0 0' }}>
                Clear all test accounts (including test101, sangam, bob) at once before going live, or use individual delete buttons below.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowClearConfirm(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#DC2626', color: '#FFFFFF', fontWeight: 'bold', padding: '10px 16px', borderRadius: '12px', fontSize: '12px', border: 'none', cursor: 'pointer', flexShrink: 0 }}
          >
            <Trash2 style={{ width: '16px', height: '16px' }} />
            <span>Clear All Accounts</span>
          </button>
        </div>

        {/* View of All Registered Accounts with Delete Button on Side */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', padding: '24px', border: '1px solid #E5E0D8' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#18181B', margin: 0 }}>
              All Registered Accounts ({usersList.length})
            </h2>
            <span style={{ fontSize: '12px', color: '#71717A' }}>Live from database `users` table</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #E5E0D8', color: '#71717A' }}>
                  <th style={{ padding: '10px 12px' }}>ID</th>
                  <th style={{ padding: '10px 12px' }}>Name</th>
                  <th style={{ padding: '10px 12px' }}>Email</th>
                  <th style={{ padding: '10px 12px' }}>Role</th>
                  <th style={{ padding: '10px 12px' }}>Events Owned</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersList.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: '#71717A' }}>
                      No registered accounts found in database. All cleared!
                    </td>
                  </tr>
                ) : (
                  usersList.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid #F4F4F5' }}>
                      <td style={{ padding: '12px', fontFamily: 'monospace', color: '#A1A1AA', fontSize: '12px' }}>#{u.id}</td>
                      <td style={{ padding: '12px', fontWeight: '600', color: '#18181B' }}>{u.display_name || u.displayName}</td>
                      <td style={{ padding: '12px', color: '#52525B', fontFamily: 'monospace', fontSize: '12px' }}>{u.email}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ backgroundColor: u.role === 'admin' ? '#FEF2F2' : '#F4F4F5', color: u.role === 'admin' ? '#DC2626' : '#52525B', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                          {u.role || 'user'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', fontWeight: '500' }}>{u.event_count || 0}</td>
                      
                      {/* Delete Button on the side */}
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <button
                          type="button"
                          disabled={deletingUserId === u.id}
                          onClick={() => handleDeleteUser(u.id, u.email)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            backgroundColor: '#DC2626',
                            color: '#FFFFFF',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                          title={`Permanently delete ${u.email} from database`}
                        >
                          <Trash2 style={{ width: '14px', height: '14px' }} />
                          <span>{deletingUserId === u.id ? 'Deleting...' : 'Delete'}</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* All Events List */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', padding: '24px', border: '1px solid #E5E0D8' }}>
          <h2 style={{ fontSize: '17px', fontWeight: '700', marginBottom: '14px', color: '#18181B' }}>All Events ({eventsList.length})</h2>
          {eventsList.length === 0 ? (
            <p style={{ fontSize: '14px', color: '#71717A', margin: 0, padding: '16px 0', textAlign: 'center' }}>No events found.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E5E0D8', color: '#71717A' }}>
                    <th style={{ padding: '10px 12px' }}>Code</th>
                    <th style={{ padding: '10px 12px' }}>Title</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                    <th style={{ padding: '10px 12px' }}>Photos</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {eventsList.map((e) => (
                    <tr key={e.id} style={{ borderBottom: '1px solid #F4F4F5' }}>
                      <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: 'bold', color: '#C04A25' }}>{e.event_code}</td>
                      <td style={{ padding: '12px', fontWeight: '600', color: '#18181B' }}>{e.title}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ backgroundColor: (e.is_active === 1 || e.status === 'active') ? '#DCFCE7' : '#FEF3C7', color: (e.is_active === 1 || e.status === 'active') ? '#15803D' : '#B45309', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                          {(e.is_active === 1 || e.status === 'active') ? 'Active' : 'Paused'}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>{e.photo_count || 0}</td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleEvent(e.event_code)}
                          style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', border: '1px solid #D4D4D8', backgroundColor: '#FFFFFF', cursor: 'pointer' }}
                        >
                          {(e.is_active === 1 || e.status === 'active') ? 'Pause' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Confirm Clear All Test Accounts */}
        {showClearConfirm && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000 }}>
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '100%', textAlign: 'center', border: '1px solid #E5E0D8' }}>
              <div style={{ width: '48px', height: '48px', backgroundColor: '#FEE2E2', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto', color: '#DC2626' }}>
                <Trash2 style={{ width: '24px', height: '24px' }} />
              </div>
              <h3 style={{ fontWeight: '800', fontSize: '18px', color: '#18181B', margin: '0 0 8px 0' }}>Clear All Test Accounts?</h3>
              <p style={{ fontSize: '13px', color: '#52525B', marginBottom: '24px', lineHeight: '1.5' }}>
                This will delete all test accounts created during testing (including test101, sangam, bob) so that the database is completely fresh and ready for clean production deployment.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  disabled={clearing}
                  onClick={handleClearAllTestAccounts}
                  style={{ flex: 1, backgroundColor: '#DC2626', color: '#FFFFFF', padding: '10px', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', border: 'none' }}
                >
                  {clearing ? 'Clearing...' : 'Yes, Clear All Accounts'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  style={{ flex: 1, backgroundColor: '#F4F4F5', color: '#18181B', padding: '10px', borderRadius: '10px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', border: '1px solid #D4D4D8' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}