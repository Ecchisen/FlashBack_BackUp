import React, { useState, useEffect } from 'react';

// Use environment variable or fallback to relative path
const API_BASE = import.meta.env.VITE_API_URL || '';

export default function AdminPanel() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({ eventCode: '', title: '', maxPhotos: 25 });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const token = sessionStorage.getItem('admin_token');
    if (token) {
      setIsAuthenticated(true);
      fetchEvents(token);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');

    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        sessionStorage.setItem('admin_token', data.token);
        setIsAuthenticated(true);
        fetchEvents(data.token);
      } else {
        setAuthError(data.error || 'Invalid password!');
      }
    } catch (err) {
      setAuthError('Cannot reach backend server. Check network connection.');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_token');
    setIsAuthenticated(false);
    setPassword('');
  };

  const fetchEvents = async (token) => {
    const authToken = token || sessionStorage.getItem('admin_token');
    try {
      const res = await fetch(`${API_BASE}/api/admin/events`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) setEvents(data);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setMsg('');

    const sanitizedCode = form.eventCode.toLowerCase().replace(/[^a-z0-9_-]/g, '');

    if (!sanitizedCode) {
      setMsg('Please provide a valid event code.');
      return;
    }

    try {
      const token = sessionStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/api/events/create`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...form, eventCode: sanitizedCode })
      });
      const data = await res.json();

      if (res.ok) {
        setMsg('Event created successfully!');
        setForm({ eventCode: '', title: '', maxPhotos: 25 });
        fetchEvents(token);
      } else {
        setMsg(`Error: ${data.error || 'Failed to create event.'}`);
      }
    } catch (err) {
      setMsg('Network error: Could not connect to API.');
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      const token = sessionStorage.getItem('admin_token');
      await fetch(`${API_BASE}/api/admin/events/${id}/toggle`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: currentStatus ? 0 : 1 })
      });
      fetchEvents(token);
    } catch (err) {
      console.error('Failed to toggle event status:', err);
    }
  };

  const handleDelete = async (id, code) => {
    if (!window.confirm(`Are you sure you want to delete event "${code}"?`)) return;

    try {
      const token = sessionStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/api/admin/events/${id}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setEvents(events.filter((ev) => ev.id !== id));
      } else {
        alert('Failed to delete event.');
      }
    } catch (err) {
      console.error('Error deleting event:', err);
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={{ maxWidth: '360px', margin: '80px auto', padding: '24px', fontFamily: 'sans-serif', border: '1px solid #333', borderRadius: '8px', textAlign: 'center' }}>
        <h2>Admin Login</h2>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="password"
            placeholder="Enter Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: '10px', fontSize: '1rem', borderRadius: '4px', border: '1px solid #555' }}
            required
          />
          <button type="submit" style={{ padding: '10px', backgroundColor: '#0070f3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            Unlock Dashboard
          </button>
        </form>
        {authError && <p style={{ color: '#ff6b6b', marginTop: '12px', margin: 0 }}>{authError}</p>}
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>FlashBack Dashboard</h2>
        <button 
          onClick={handleLogout}
          style={{ padding: '6px 14px', backgroundColor: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Logout
        </button>
      </div>

      <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '30px', padding: '16px', border: '1px solid #ccc', borderRadius: '8px' }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Create New Event</h3>
        <input 
          placeholder="Enter Event Code" 
          value={form.eventCode} 
          onChange={e => setForm({...form, eventCode: e.target.value})} 
          required 
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <input 
          placeholder="Event Title" 
          value={form.title} 
          onChange={e => setForm({...form, title: e.target.value})} 
          required 
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <input 
          type="number" 
          placeholder="Max Photos per Guest" 
          value={form.maxPhotos} 
          onChange={e => setForm({...form, maxPhotos: parseInt(e.target.value) || ''})} 
          style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <button type="submit" style={{ padding: '10px', backgroundColor: '#0070f3', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold' }}>
          Create Event
        </button>
        {msg && <p style={{ margin: '5px 0 0 0', fontWeight: 'bold', color: msg.startsWith('Error') || msg.startsWith('Network') ? '#ff6b6b' : '#28a745' }}>{msg}</p>}
      </form>

      <h3>Existing Events</h3>
      <table border="1" cellPadding="8" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
        <thead>
          <tr>
            <th>Code</th>
            <th>Title</th>
            <th>Max Photos</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {events.length === 0 ? (
            <tr>
              <td colSpan="5" style={{ textAlign: 'center' }}>No events found.</td>
            </tr>
          ) : (
            events.map(ev => (
              <tr key={ev.id}>
                <td>{ev.event_code}</td>
                <td>{ev.title}</td>
                <td>{ev.max_photos_per_user}</td>
                <td>{ev.is_active ? 'Active' : 'Disabled'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => toggleStatus(ev.id, ev.is_active)}
                      style={{
                        padding: '4px 10px',
                        backgroundColor: ev.is_active ? '#6c757d' : '#28a745',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      {ev.is_active ? 'Disable' : 'Enable'}
                    </button>

                    <button 
                      onClick={() => handleDelete(ev.id, ev.event_code)}
                      style={{
                        padding: '4px 10px',
                        backgroundColor: '#dc3545',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}