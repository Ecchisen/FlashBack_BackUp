import React, { useState, useEffect } from 'react';

export default function AdminPanel() {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({ eventCode: '', title: '', maxPhotos: 25 });
  const [msg, setMsg] = useState('');

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/admin/events');
      const data = await res.json();
      if (Array.isArray(data)) setEvents(data);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    }
  };

  useEffect(() => { 
    fetchEvents(); 
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setMsg('');
    try {
      const res = await fetch('/api/events/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (res.ok) {
        setMsg('Event created successfully!');
        setForm({ eventCode: '', title: '', maxPhotos: 25 });
        fetchEvents();
      } else {
        setMsg(`${data.error || 'Failed to create event.'}`);
      }
    } catch (err) {
      setMsg('Error connecting to backend.');
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      await fetch(`/api/admin/events/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: currentStatus ? 0 : 1 })
      });
      fetchEvents();
    } catch (err) {
      console.error('Failed to toggle event status:', err);
    }
  };

  const handleDelete = async (id, code) => {
    if (!window.confirm(`Are you sure you want to delete event "${code}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/events/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setEvents(events.filter((ev) => ev.id !== id));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete event');
      }
    } catch (err) {
      console.error('Error deleting event:', err);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ textAlign: 'center' }}>FlashBack Admin Dashboard</h2>
      
      <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '30px' }}>
        <h3>Create New Event</h3>
        <input 
          placeholder="Event Code (e.g. fun2026)" 
          value={form.eventCode} 
          onChange={e => setForm({...form, eventCode: e.target.value})} 
          required 
        />
        <input 
          placeholder="Event Title" 
          value={form.title} 
          onChange={e => setForm({...form, title: e.target.value})} 
          required 
        />
        <input 
          type="number" 
          placeholder="Max Photos per Guest" 
          value={form.maxPhotos} 
          onChange={e => setForm({...form, maxPhotos: parseInt(e.target.value) || ''})} 
        />
        <button type="submit" style={{ padding: '10px', backgroundColor: '#0070f3', color: '#fff', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>
          Create Event
        </button>
        {msg && <p style={{ margin: '5px 0 0 0', fontWeight: 'bold' }}>{msg}</p>}
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
          {events.map(ev => (
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
          ))}
        </tbody>
      </table>
    </div>
  );
}