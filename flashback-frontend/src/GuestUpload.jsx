// flashback-frontend/src/GuestUpload.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Camera, Upload, CheckCircle2, AlertCircle, RefreshCw,
  Image as ImageIcon, Loader2, Info
} from 'lucide-react';

// Internal Token Management (Replacing api.js abstraction)
const getOrCreateGuestToken = () => {
  let token = localStorage.getItem('guest_token');
  if (!token) {
    token = 'guest_' + Math.random().toString(36).substr(2, 9) + Date.now();
    localStorage.setItem('guest_token', token);
  }
  return token;
};

export default function GuestUpload({ eventCode, onBack }) {
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [quota, setQuota] = useState({ uploaded: 0, maxAllowed: 10, remaining: 10 });
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const guestToken = getOrCreateGuestToken();

  useEffect(() => {
    loadEventDetails();
  }, [eventCode]);

  // Direct Relative Endpoints via internal fetch
  const loadEventDetails = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/events/${eventCode}`);
      if (!res.ok) throw new Error('Event not found or currently unavailable.');
      const data = await res.json();
      setEventData(data);

      const quotaRes = await fetch(`/api/events/${eventCode}/quota?guestToken=${guestToken}`);
      if (!quotaRes.ok) throw new Error('Failed to fetch quota limit.');
      const quotaData = await quotaRes.json();
      setQuota(quotaData);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setErrorMsg(null);
    setUploadSuccess(false);

    if (quota.remaining <= 0) {
      setErrorMsg(`Upload limit reached (${quota.maxAllowed} photos per guest).`);
      return;
    }

    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      setErrorMsg('Please select valid image files (JPG, PNG, WebP, HEIC).');
      return;
    }

    const filesToSend = validFiles.slice(0, quota.remaining);
    const formData = new FormData();
    filesToSend.forEach((file) => {
      formData.append('photos', file);
    });
    formData.append('guestToken', guestToken);

    setUploading(true);
    try {
      const res = await fetch(`/api/events/${eventCode}/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to upload photos. Please try again.');

      setUploadSuccess(true);
      setUploadedCount(filesToSend.length);
      
      const quotaRes = await fetch(`/api/events/${eventCode}/quota?guestToken=${guestToken}`);
      const quotaData = await quotaRes.json();
      setQuota(quotaData);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setUploading(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center bg-[#F7F3E9]" style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F3E9' }}>
        <Loader2 className="w-9 h-9 text-[#C04A25] animate-spin" style={{ width: '36px', height: '36px', color: '#C04A25', animation: 'spin 1s linear infinite' }} />
        <p className="mt-3 text-sm text-zinc-500" style={{ marginTop: '12px', color: '#71717A', fontSize: '14px' }}>Loading event details...</p>
      </div>
    );
  }

  if (errorMsg && !eventData) {
    return (
      <div className="min-h-[85vh] bg-[#F7F3E9] py-8 px-4 flex items-center justify-center" style={{ minHeight: '85vh', backgroundColor: '#F7F3E9', padding: '32px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="max-w-[420px] w-full bg-white rounded-2xl p-7 text-center border border-[#E5E0D8] shadow-[0_10px_25px_-5px_rgba(0,0,0,0.06)]" style={{ maxWidth: '420px', width: '100%', backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '28px', textAlign: 'center', border: '1px solid #E5E0D8', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.06)' }}>
          <AlertCircle className="w-11 h-11 text-red-500 mx-auto mb-3" style={{ width: '44px', height: '44px', color: '#EF4444', margin: '0 auto 12px auto' }} />
          <h2 className="text-xl font-extrabold text-zinc-900 mb-2" style={{ fontSize: '20px', fontWeight: '800', color: '#18181B', marginBottom: '8px' }}>Event Not Available</h2>
          <p className="text-sm text-zinc-500 mb-5" style={{ color: '#71717A', fontSize: '14px', marginBottom: '20px' }}>{errorMsg}</p>
          <div className="flex gap-2.5 justify-center" style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              onClick={loadEventDetails}
              className="inline-flex items-center gap-1.5 bg-[#C04A25] text-white border-none py-2.5 px-4.5 rounded-lg font-semibold cursor-pointer text-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#C04A25', color: '#FFFFFF', border: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}
            >
              <RefreshCw className="w-3.5 h-3.5" style={{ width: '14px', height: '14px' }} />
              <span>Retry</span>
            </button>
            <button
              onClick={onBack}
              className="bg-zinc-100 text-zinc-900 border border-zinc-300 py-2.5 px-4.5 rounded-lg font-semibold cursor-pointer text-sm"
              style={{ backgroundColor: '#F4F4F5', color: '#18181B', border: '1px solid #D4D4D8', padding: '10px 18px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '14px' }}
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[90vh] bg-[#F7F3E9] py-6 px-4 text-zinc-900" style={{ minHeight: '90vh', backgroundColor: '#F7F3E9', padding: '24px 16px', color: '#18181B' }}>
      <div className="max-w-[480px] mx-auto flex flex-col gap-5" style={{ maxWidth: '480px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        <div className="bg-white rounded-2xl p-6 border border-[#E5E0D8] text-center shadow-[0_4px_14px_rgba(0,0,0,0.04)]" style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '24px', border: '1px solid #E5E0D8', textAlign: 'center', boxShadow: '0 4px 14px rgba(0,0,0,0.04)' }}>
          <span className="bg-[#FDF2E9] text-[#C04A25] py-1 px-2.5 rounded-full text-[11px] font-bold uppercase tracking-wider" style={{ backgroundColor: '#FDF2E9', color: '#C04A25', padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Live Photo Stream</span>
          <h1 className="text-[22px] font-extrabold my-2 text-zinc-900" style={{ fontSize: '22px', fontWeight: '800', margin: '8px 0 4px 0', color: '#18181B' }}>{eventData?.title}</h1>
          <p className="text-[13px] text-zinc-500 m-0" style={{ fontSize: '13px', color: '#71717A', margin: 0 }}>
            Event Code: <strong className="text-zinc-900 font-mono" style={{ color: '#18181B', fontFamily: 'monospace' }}>{eventCode}</strong>
          </p>

          <div className="mt-4 p-3 bg-[#FAFAF9] rounded-[10px] border border-[#E5E0D8]" style={{ marginTop: '16px', padding: '12px', backgroundColor: '#FAFAF9', borderRadius: '10px', border: '1px solid #E5E0D8' }}>
            <div className="flex justify-between text-xs font-semibold text-zinc-600 mb-1.5" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '600', color: '#52525B', marginBottom: '6px' }}>
              <span>Photos Shared: {quota.uploaded} / {quota.maxAllowed}</span>
              <span>{quota.remaining} remaining</span>
            </div>
            <div className="w-full h-2 bg-zinc-200 rounded-full overflow-hidden" style={{ width: '100%', height: '8px', backgroundColor: '#E4E4E7', borderRadius: '999px', overflow: 'hidden' }}>
              <div
                className="h-full bg-[#C04A25] transition-all duration-300 ease-in-out"
                style={{ width: `${Math.min(100, (quota.uploaded / quota.maxAllowed) * 100)}%`, height: '100%', backgroundColor: '#C04A25', transition: 'width 0.3s ease' }}
              />
            </div>
          </div>
        </div>

        {uploadSuccess && (
          <div className="bg-green-50 border border-green-300 rounded-xl p-3.5 flex items-center gap-2.5 text-green-800" style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '12px', padding: '14px', display: 'flex', alignItems: 'center', gap: '10px', color: '#166534' }}>
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-green-600" style={{ width: '20px', height: '20px', flexShrink: 0, color: '#16A34A' }} />
            <div className="text-[13px] font-semibold" style={{ fontSize: '13px', fontWeight: '600' }}>
              Successfully uploaded {uploadedCount} photo{uploadedCount > 1 ? 's' : ''}! Watch the main projector screen to see your moments appear.
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-3.5 flex items-center gap-2.5 text-red-800" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '12px', padding: '14px', display: 'flex', alignItems: 'center', gap: '10px', color: '#991B1B' }}>
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" style={{ width: '20px', height: '20px', flexShrink: 0, color: '#DC2626' }} />
            <div className="text-[13px] font-semibold" style={{ fontSize: '13px', fontWeight: '600' }}>{errorMsg}</div>
          </div>
        )}

        <div className="bg-white rounded-2xl p-6 border border-[#E5E0D8] flex flex-col gap-3.5 shadow-[0_4px_14px_rgba(0,0,0,0.04)]" style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '24px', border: '1px solid #E5E0D8', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 4px 14px rgba(0,0,0,0.04)' }}>
          <h2 className="text-base font-bold text-zinc-900 m-0 text-center" style={{ fontSize: '16px', fontWeight: '700', color: '#18181B', margin: 0, textAlign: 'center' }}>Share Your Moments</h2>

          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files)} />
          <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files)} />

          <button
            type="button"
            disabled={uploading || quota.remaining <= 0}
            onClick={() => cameraInputRef.current && cameraInputRef.current.click()}
            className="flex items-center justify-center gap-2.5 text-white p-4 rounded-xl border-none text-base font-bold shadow-[0_4px_12px_rgba(192,74,37,0.2)] disabled:bg-zinc-400 disabled:cursor-not-allowed bg-[#C04A25] cursor-pointer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', backgroundColor: quota.remaining <= 0 ? '#A1A1AA' : '#C04A25', color: '#FFFFFF', padding: '16px', borderRadius: '12px', border: 'none', fontSize: '16px', fontWeight: '700', cursor: quota.remaining <= 0 ? 'not-allowed' : 'pointer', boxShadow: '0 4px 12px rgba(192,74,37,0.2)' }}
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} /> : <Camera className="w-[22px] h-[22px]" style={{ width: '22px', height: '22px' }} />}
            <span>{uploading ? 'Processing Image...' : 'Take Photo (Camera)'}</span>
          </button>

          <button
            type="button"
            disabled={uploading || quota.remaining <= 0}
            onClick={() => galleryInputRef.current && galleryInputRef.current.click()}
            className="flex items-center justify-center gap-2.5 p-4 rounded-xl border-none text-base font-bold disabled:bg-zinc-200 disabled:text-zinc-400 disabled:cursor-not-allowed bg-zinc-900 text-white cursor-pointer"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', backgroundColor: quota.remaining <= 0 ? '#E4E4E7' : '#18181B', color: quota.remaining <= 0 ? '#A1A1AA' : '#FFFFFF', padding: '16px', borderRadius: '12px', border: 'none', fontSize: '16px', fontWeight: '700', cursor: quota.remaining <= 0 ? 'not-allowed' : 'pointer' }}
          >
            <ImageIcon className="w-[22px] h-[22px]" style={{ width: '22px', height: '22px' }} />
            <span>Choose Photos (Gallery)</span>
          </button>

          <p className="text-xs text-zinc-500 m-0 mt-1 text-center flex items-center justify-center gap-1" style={{ fontSize: '12px', color: '#71717A', margin: '4px 0 0 0', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
            <Info className="w-[13px] h-[13px]" style={{ width: '13px', height: '13px' }} />
            <span>Photos are optimized to 1080p and streamed live to the projector.</span>
          </p>
        </div>
      </div>
    </div>
  );
}