import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Upload, Camera, CheckCircle, AlertCircle, X } from 'lucide-react';

export default function GuestUpload() {
  const [eventCode, setEventCode] = useState('');
  const [eventDetails, setEventDetails] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [guestToken, setGuestToken] = useState('');
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState({ type: '', text: '' });

  const galleryInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('event');
    if (code) {
      setEventCode(code);
      fetchEventDetails(code);
    }

    let token = localStorage.getItem('flashback_guest_token');
    if (!token) {
      token = 'guest_' + Math.random().toString(36).substring(2, 11);
      localStorage.setItem('flashback_guest_token', token);
    }
    setGuestToken(token);
  }, []);

  const fetchEventDetails = async (code) => {
    if (!code) return;
    setStatusMessage({ type: '', text: '' });

    try {
      const res = await axios.get(`/api/events/${code.trim()}`);
      
      if (!res.data.is_active) {
        setStatusMessage({ type: 'error', text: 'This event is currently disabled.' });
        setEventDetails(null);
        return;
      }

      setEventDetails(res.data);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Event not found or inactive.';
      setStatusMessage({ type: 'error', text: errorMsg });
      setEventDetails(null);
    }
  };

  const handleFileSelect = (e) => {
    const newlySelected = Array.from(e.target.files);
    if (!newlySelected.length) return;

    const updatedFiles = [...selectedFiles, ...newlySelected];
    setSelectedFiles(updatedFiles);

    const newObjectUrls = newlySelected.map(file => URL.createObjectURL(file));
    setPreviews(prev => [...prev, ...newObjectUrls]);

    // Reset input value to allow re-selecting the same file if needed
    e.target.value = '';
  };

  // Remove individual photo by index
  const handleRemovePhoto = (indexToRemove) => {
    // Revoke object URL to prevent browser memory leaks
    URL.revokeObjectURL(previews[indexToRemove]);

    setSelectedFiles(prev => prev.filter((_, idx) => idx !== indexToRemove));
    setPreviews(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFiles.length || !eventCode) return;

    setUploading(true);
    setStatusMessage({ type: '', text: '' });

    const formData = new FormData();
    formData.append('eventCode', eventCode.trim());
    formData.append('guestToken', guestToken);
    
    selectedFiles.forEach(file => {
      formData.append('photos', file);
    });

    try {
      const res = await axios.post('/api/photos/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setStatusMessage({ type: 'success', text: res.data.message || 'Uploaded successfully!' });
      
      // Cleanup previews
      previews.forEach(url => URL.revokeObjectURL(url));
      setSelectedFiles([]);
      setPreviews([]);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to Upload.';
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
            placeholder="Enter event code"
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing: 'border-box' }}
          />
          <button 
            onClick={() => fetchEventDetails(eventCode)}
            style={{ width: '100%', marginTop: '8px', padding: '10px', background: '#3182CE', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            Start Uploading
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
          <input 
            type="file" 
            multiple 
            accept="image/*"
            onChange={handleFileSelect}
            ref={galleryInputRef}
            style={{ display: 'none' }}
          />
          <input 
            type="file" 
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            ref={cameraInputRef}
            style={{ display: 'none' }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <button
              type="button"
              onClick={() => cameraInputRef.current.click()}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                border: '2px dashed #CBD5E0',
                borderRadius: '8px',
                backgroundColor: '#F7FAFC',
                cursor: 'pointer'
              }}
            >
              <Camera size={32} color="#3182CE" style={{ marginBottom: '8px' }} />
              <span style={{ fontWeight: 'bold', color: '#2D3748' }}>Take Photo</span>
              <small style={{ color: '#A0AEC0' }}>Use Camera</small>
            </button>

            <button
              type="button"
              onClick={() => galleryInputRef.current.click()}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                border: '2px dashed #CBD5E0',
                borderRadius: '8px',
                backgroundColor: '#F7FAFC',
                cursor: 'pointer'
              }}
            >
              <Upload size={32} color="#38A169" style={{ marginBottom: '8px' }} />
              <span style={{ fontWeight: 'bold', color: '#2D3748' }}>Choose Files</span>
              <small style={{ color: '#A0AEC0' }}>Select Multiple</small>
            </button>
          </div>

          {/* Previews Grid with Removal Button */}
          {previews.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
              {previews.map((src, index) => (
                <div key={index} style={{ position: 'relative', width: '100%', height: '100px' }}>
                  <img 
                    src={src} 
                    alt={`Preview ${index}`} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} 
                  />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(index)}
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      backgroundColor: 'rgba(0, 0, 0, 0.65)',
                      color: '#FFF',
                      border: 'none',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      padding: 0
                    }}
                    title="Remove photo"
                  >
                    <X size={14} />
                  </button>
                </div>
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