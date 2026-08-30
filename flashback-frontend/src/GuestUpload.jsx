import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Upload, CheckCircle, Image as ImageIcon, AlertCircle } from 'lucide-react';

export default function GuestUpload() {
  const [eventCode, setEventCode] = useState('');
  const [eventDetails, setEventDetails] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [guestToken, setGuestToken] = useState('');
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    // 1. Get event code from URL query string ?event=CODE
    const params = new URLSearchParams(window.location.search);
    const code = params.get('event');
    if (code) {
      setEventCode(code);
      fetchEventDetails(code);
    }

    // 2. Generate or retrieve guest token for quota tracking
    let token = localStorage.getItem('flashback_guest_token');
    if (!token) {
      token = 'guest_' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('flashback_guest_token', token);
    }
    setGuestToken(token);
  }, []);

  const fetchEventDetails = async (code) => {
    try {
      const res = await axios.get(`http://${window.location.hostname}:5000/api/events/${code}`);
      setEventDetails(res.data);
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Event not found or inactive.' });
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);

    // Generate object URLs for immediate image preview
    const objectUrls = files.map(file => URL.createObjectURL(file));
    setPreviews(objectUrls);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFiles.length || !eventCode) return;

    setUploading(true);
    setStatusMessage({ type: '', text: '' });

    const formData = new FormData();
    formData.append('eventCode', eventCode);
    formData.append('guestToken', guestToken);
    
    selectedFiles.forEach(file => {
      formData.append('photos', file);
    });

    try {
      const res = await axios.post(`http://${window.location.hostname}:5000/api/photos/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setStatusMessage({ type: 'success', text: 'Photos uploaded successfully!' });
      setSelectedFiles([]);
      setPreviews([]);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to upload photos.';
      setStatusMessage({ type: 'error', text: errorMsg });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ maxWidth: '500px', margin: '40px auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '8px' }}>📸 FlashBack</h1>
      
      {eventDetails ? (
        <h2 style={{ textAlign: 'center', color: '#4A5568', fontSize: '1.2rem', marginBottom: '24px' }}>
          {eventDetails.title}
        </h2>
      ) : (
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '6px' }}>Event Code:</label>
          <input 
            type="text" 
            value={eventCode} 
            onChange={(e) => setEventCode(e.target.value)} 
            placeholder="e.g., fun2026"
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}
          />
          <button 
            onClick={() => fetchEventDetails(eventCode)}
            style={{ width: '100%', marginTop: '8px', padding: '10px', background: '#3182CE', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            Join Event
          </button>
        </div>
      )}

      {statusMessage.text && (
        <div style={{
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '16px',
          backgroundColor: statusMessage.type === 'error' ? '#FED7D7' : '#C6F6D5',
          color: statusMessage.type === 'error' ? '#9B2C2C' : '#22543D',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {statusMessage.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {eventDetails && (
        <form onSubmit={handleUpload}>
          <div style={{
            border: '2px dashed #CBD5E0',
            borderRadius: '8px',
            padding: '30px',
            textAlign: 'center',
            backgroundColor: '#F7FAFC',
            cursor: 'pointer',
            marginBottom: '16px'
          }}>
            <input 
              type="file" 
              multiple 
              accept="image/*"
              onChange={handleFileSelect}
              id="file-upload"
              style={{ display: 'none' }}
            />
            <label htmlFor="file-upload" style={{ cursor: 'pointer', display: 'block' }}>
              <Upload size={40} color="#718096" style={{ marginBottom: '8px' }} />
              <p style={{ margin: 0, fontWeight: 'bold' }}>Tap to select photos</p>
              <small style={{ color: '#A0AEC0' }}>Select multiple images from gallery</small>
            </label>
          </div>

          {previews.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
              {previews.map((src, index) => (
                <img 
                  key={index} 
                  src={src} 
                  alt={`Preview ${index}`} 
                  style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '6px' }} 
                />
              ))}
            </div>
          )}

          <button 
            type="submit" 
            disabled={uploading || !selectedFiles.length}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: uploading || !selectedFiles.length ? '#A0AEC0' : '#38A169',
              color: '#FFF',
              border: 'none',
              borderRadius: '6px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: uploading || !selectedFiles.length ? 'not-allowed' : 'pointer'
            }}
          >
            {uploading ? 'Uploading...' : `Upload ${selectedFiles.length} Photo${selectedFiles.length === 1 ? '' : 's'}`}
          </button>
        </form>
      )}
    </div>
  );
}