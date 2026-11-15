// flashback-frontend/src/UserDashboard.jsx
import React, { useState, useEffect } from 'react';
import {
  Calendar, Plus, LogOut, Image as ImageIcon, Play,
  QrCode, ExternalLink, RefreshCw, Loader2, AlertCircle, User, Check,
  Eye, EyeOff, ArrowLeft, Home, CheckCircle2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

// Local storage token helper functions
const getUserToken = () => localStorage.getItem('user_token');
const setUserToken = (token) => {
  if (token) localStorage.setItem('user_token', token);
  else localStorage.removeItem('user_token');
};

export default function UserDashboard({ onBack, onOpenSlideshow, onOpenUpload, onOpenAdmin }) {
  const [token, setToken] = useState(getUserToken());
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Auth form states
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // Create Event state
  const [eventTitle, setEventTitle] = useState('');
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [selectedQrEvent, setSelectedQrEvent] = useState(null);

  useEffect(() => {
    const curToken = getUserToken();
    if (curToken) {
      loadUserData(curToken);
    } else {
      setLoading(false);
    }
  }, []);

  // Safe response parser that returns parsed JSON or clear descriptive error
  const parseResponse = async (res) => {
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}. Please check your connection or server status.`);
      }
      throw new Error('Unable to parse server response. Please try again.');
    }

    if (!res.ok) {
      throw new Error(data.error || `Request failed with status ${res.status}.`);
    }
    return data;
  };

  const loadUserData = async (authToken) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const userRes = await fetch('/api/auth/me', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });
      const userData = await parseResponse(userRes);
      setUser(userData.user);

      // Load user events
      const eventsRes = await fetch('/api/events/my-events', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      });
      const eventsData = await parseResponse(eventsRes);
      setEvents(eventsData.events || []);
    } catch (err) {
      console.warn('[Session Verification]', err.message);
      if (err.message.includes('401') || err.message.includes('expired') || err.message.includes('token')) {
        setUserToken(null);
        setToken(null);
        setUser(null);
        setErrorMsg('Your session has expired. Please log in again.');
      } else {
        setErrorMsg(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshEvents = async () => {
    const currentToken = getUserToken();
    if (!currentToken) return;
    try {
      const res = await fetch('/api/events/my-events', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        }
      });
      const data = await parseResponse(res);
      setEvents(data.events || []);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to refresh events.');
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const body = isRegister ? { email, password, displayName } : { email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await parseResponse(res);

      setUserToken(data.token);
      setToken(data.token);
      setUser(data.user);
      setSuccessMsg(isRegister ? 'Account created successfully!' : 'Signed in successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);

      // Fetch events using newly returned token directly
      try {
        const eventsRes = await fetch('/api/events/my-events', {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${data.token}`
          }
        });
        const eventsData = await parseResponse(eventsRes);
        setEvents(eventsData.events || []);
      } catch (evtErr) {
        console.warn('Failed to pre-fetch events:', evtErr.message);
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    if (!eventTitle.trim()) return;
    setCreatingEvent(true);
    setErrorMsg(null);
    try {
      const curToken = getUserToken();
      const res = await fetch('/api/events/user-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${curToken}`
        },
        body: JSON.stringify({ title: eventTitle.trim() })
      });
      await parseResponse(res);
      setEventTitle('');
      setSuccessMsg('Event created successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
      refreshEvents();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create event.');
    } finally {
      setCreatingEvent(false);
    }
  };

  const handleLogout = () => {
    setUserToken(null);
    setToken(null);
    setUser(null);
    setEvents([]);
    setErrorMsg(null);
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center bg-[#F7F3E9]" style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7F3E9' }}>
        <Loader2 className="w-8 h-8 text-[#C04A25] animate-spin" style={{ width: '32px', height: '32px', color: '#C04A25' }} />
        <p className="mt-3 text-sm text-zinc-600 font-medium" style={{ marginTop: '12px', fontSize: '14px', color: '#52525B' }}>Loading Host Dashboard...</p>
      </div>
    );
  }

  // Auth Screen (Login / Register)
  if (!token || !user) {
    return (
      <div className="min-h-[85vh] bg-[#F7F3E9] py-8 px-4 flex items-center justify-center" style={{ minHeight: '85vh', backgroundColor: '#F7F3E9', padding: '32px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="max-w-[400px] w-full bg-white rounded-2xl p-8 border border-[#E5E0D8] shadow-[0_10px_25px_-5px_rgba(0,0,0,0.08)] relative" style={{ maxWidth: '400px', width: '100%', backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '32px', border: '1px solid #E5E0D8', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.08)', position: 'relative' }}>
          
          {/* Top Left Back to Home Button */}
          <button
            type="button"
            onClick={onBack}
            className="absolute top-4 left-4 flex items-center gap-1 text-zinc-600 hover:text-zinc-900 bg-zinc-100 border border-zinc-200 py-1.5 px-2.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
            style={{ position: 'absolute', top: '16px', left: '16px', display: 'flex', alignItems: 'center', gap: '4px', color: '#52525B', backgroundColor: '#F4F4F5', border: '1px solid #E4E4E7', padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
          >
            <ArrowLeft className="w-3.5 h-3.5" style={{ width: '14px', height: '14px' }} />
            <span>Home</span>
          </button>

          <div className="text-center mb-6 mt-4" style={{ textAlign: 'center', marginBottom: '24px', marginTop: '16px' }}>
            <div className="w-12 h-12 bg-[#FDF2E9] rounded-xl inline-flex items-center justify-center mb-3" style={{ width: '48px', height: '48px', backgroundColor: '#FDF2E9', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
              <User className="w-6 h-6 text-[#C04A25]" style={{ width: '24px', height: '24px', color: '#C04A25' }} />
            </div>
            <h2 className="text-[22px] font-extrabold text-zinc-900 m-0 mb-1.5" style={{ fontSize: '22px', fontWeight: '800', color: '#18181B', margin: '0 0 6px 0' }}>
              {isRegister ? 'Create Host Account' : 'Host Sign In'}
            </h2>
            <p className="text-[13px] text-zinc-500 m-0" style={{ fontSize: '13px', color: '#71717A', margin: 0 }}>
              {isRegister ? 'Register to create and manage your photo sharing events' : 'Access your events and projector slideshows'}
            </p>
          </div>

          {errorMsg && (
            <div className="bg-red-50 border border-red-300 text-red-800 py-2.5 px-3 rounded-lg text-[13px] mb-4 flex items-start gap-2" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" style={{ width: '16px', height: '16px', color: '#DC2626', flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-green-50 border border-green-300 text-green-800 py-2.5 px-3 rounded-lg text-[13px] mb-4 flex items-center gap-2" style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', color: '#166534', padding: '10px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" style={{ width: '16px', height: '16px', color: '#16A34A', flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="flex flex-col gap-3.5" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {isRegister && (
              <div>
                <label className="block text-[13px] font-semibold text-zinc-800 mb-1" style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#27272A', marginBottom: '4px' }}>Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Smith"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full py-2.5 px-3 rounded-lg border border-zinc-300 text-sm outline-none box-border"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D4D4D8', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            )}

            <div>
              <label className="block text-[13px] font-semibold text-zinc-800 mb-1" style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#27272A', marginBottom: '4px' }}>Email Address</label>
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full py-2.5 px-3 rounded-lg border border-zinc-300 text-sm outline-none box-border"
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D4D4D8', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            
            {/* Password Field with Toggle Eye Button */}
            <div>
              <label className="block text-[13px] font-semibold text-zinc-800 mb-1" style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#27272A', marginBottom: '4px' }}>Password</label>
              <div className="relative flex items-center" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full py-2.5 pl-3 pr-10 rounded-lg border border-zinc-300 text-sm outline-none box-border"
                  style={{ width: '100%', padding: '10px 38px 10px 12px', borderRadius: '8px', border: '1px solid #D4D4D8', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 text-zinc-400 hover:text-zinc-600 border-none bg-transparent cursor-pointer p-1"
                  style={{ position: 'absolute', right: '10px', color: '#9CA3AF', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', padding: '4px' }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" style={{ width: '18px', height: '18px' }} />
                  ) : (
                    <Eye className="w-4 h-4" style={{ width: '18px', height: '18px' }} />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-[#C04A25] text-white p-3 rounded-lg border-none text-sm font-bold cursor-pointer hover:bg-[#A83E1E] transition-colors"
              style={{ width: '100%', backgroundColor: '#C04A25', color: '#FFFFFF', padding: '12px', borderRadius: '8px', border: 'none', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              {authLoading ? 'Processing...' : (isRegister ? 'Create Account' : 'Sign In')}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-zinc-200 text-center text-[13px] text-zinc-600" style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #E5E0D8', textAlign: 'center', fontSize: '13px', color: '#52525B' }}>
            {isRegister ? 'Already have a host account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => { setIsRegister(!isRegister); setErrorMsg(null); }}
              className="text-[#C04A25] font-bold border-none bg-transparent cursor-pointer underline"
              style={{ color: '#C04A25', fontWeight: 'bold', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {isRegister ? 'Sign In' : 'Register'}
            </button>
          </div>

          {onOpenAdmin && (
            <div className="mt-3 text-center" style={{ marginTop: '12px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={onOpenAdmin}
                className="text-xs text-zinc-400 hover:text-zinc-700 underline border-none bg-transparent cursor-pointer"
                style={{ fontSize: '11px', color: '#A1A1AA', textDecoration: 'underline', border: 'none', background: 'transparent', cursor: 'pointer' }}
              >
                System Admin Portal
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Logged-In User Dashboard View
  return (
    <div className="min-h-[90vh] bg-[#F7F3E9] py-8 px-4 text-zinc-900" style={{ minHeight: '90vh', backgroundColor: '#F7F3E9', padding: '32px 16px', color: '#18181B' }}>
      <div className="max-w-[900px] mx-auto flex flex-col gap-6" style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Dashboard Header */}
        <div className="flex items-center justify-between bg-white py-5 px-6 rounded-2xl border border-[#E5E0D8]" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: '20px 24px', borderRadius: '14px', border: '1px solid #E5E0D8' }}>
          <div>
            <h1 className="text-xl font-extrabold m-0 text-zinc-900" style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#18181B' }}>Welcome back, {user.displayName}</h1>
            <span className="text-[13px] text-zinc-500" style={{ fontSize: '13px', color: '#71717A' }}>{user.email}</span>
          </div>
          <div className="flex gap-2" style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 bg-zinc-100 border border-zinc-300 py-2 px-3 rounded-lg text-[13px] font-semibold cursor-pointer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#F4F4F5', border: '1px solid #D4D4D8', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >
              <Home className="w-3.5 h-3.5" style={{ width: '14px', height: '14px' }} />
              <span>Home</span>
            </button>
            <button
              type="button"
              onClick={refreshEvents}
              className="inline-flex items-center gap-1.5 bg-zinc-100 border border-zinc-300 py-2 px-3 rounded-lg text-[13px] font-semibold cursor-pointer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#F4F4F5', border: '1px solid #D4D4D8', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >
              <RefreshCw className="w-3.5 h-3.5" style={{ width: '14px', height: '14px' }} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 bg-zinc-900 text-white border-none py-2 px-3.5 rounded-lg text-[13px] font-semibold cursor-pointer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#18181B', color: '#FFFFFF', border: 'none', padding: '8px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
            >
              <LogOut className="w-3.5 h-3.5" style={{ width: '14px', height: '14px' }} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-300 text-red-800 py-3 px-4 rounded-xl text-[13px] font-semibold flex items-center gap-2" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '10px', padding: '12px 16px', color: '#991B1B', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle className="w-4 h-4 text-red-600" style={{ width: '16px', height: '16px', color: '#DC2626' }} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="bg-green-50 border border-green-300 text-green-800 py-3 px-4 rounded-xl text-[13px] font-semibold flex items-center gap-2" style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '10px', padding: '12px 16px', color: '#166534', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 className="w-4 h-4 text-green-600" style={{ width: '16px', height: '16px', color: '#16A34A' }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Create Event Card */}
        <div className="bg-white rounded-2xl p-6 border border-[#E5E0D8]" style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', padding: '24px', border: '1px solid #E5E0D8' }}>
          <h2 className="text-[17px] font-bold mb-1 text-zinc-900" style={{ fontSize: '17px', fontWeight: '700', marginBottom: '4px', color: '#18181B' }}>Create New Photo Event</h2>
          <p className="text-[13px] text-zinc-500 mb-4" style={{ fontSize: '13px', color: '#71717A', marginBottom: '16px' }}>Generate a new 5-digit code and interactive guest upload stream</p>
          <form onSubmit={handleCreateEvent} className="flex gap-3" style={{ display: 'flex', gap: '12px' }}>
            <input
              type="text"
              required
              placeholder="Event Title (e.g., Sarah & Mark's Wedding)"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              className="flex-1 py-2.5 px-3.5 rounded-lg border border-zinc-300 text-sm outline-none"
              style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #D4D4D8', fontSize: '14px', outline: 'none' }}
            />
            <button
              type="submit"
              disabled={creatingEvent}
              className="inline-flex items-center gap-2 bg-[#C04A25] text-white border-none py-2.5 px-5 rounded-lg text-sm font-bold cursor-pointer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', backgroundColor: '#C04A25', color: '#FFFFFF', border: 'none', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer' }}
            >
              <Plus className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
              <span>{creatingEvent ? 'Creating...' : 'Create Event'}</span>
            </button>
          </form>
        </div>

        {/* Events Grid */}
        <div className="bg-white rounded-2xl p-6 border border-[#E5E0D8]" style={{ backgroundColor: '#FFFFFF', borderRadius: '14px', padding: '24px', border: '1px solid #E5E0D8' }}>
          <h2 className="text-[17px] font-bold mb-4 text-zinc-900" style={{ fontSize: '17px', fontWeight: '700', marginBottom: '16px', color: '#18181B' }}>Your Active Events ({events.length})</h2>
          {events.length === 0 ? (
            <p className="text-[13px] text-zinc-500 text-center py-8" style={{ fontSize: '13px', color: '#71717A', textAlign: 'center', padding: '32px 0' }}>No events created yet. Use the form above to get started!</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {events.map((evt) => (
                <div key={evt.id} className="p-4 rounded-xl border border-zinc-200 bg-[#FAFAF9] flex flex-col justify-between" style={{ padding: '16px', borderRadius: '12px', border: '1px solid #E5E0D8', backgroundColor: '#FAFAF9', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div className="flex justify-between items-start mb-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <h3 className="font-bold text-base text-zinc-900 m-0" style={{ fontWeight: '700', fontSize: '16px', color: '#18181B', margin: 0 }}>{evt.title}</h3>
                      <span className="font-mono font-bold text-sm text-[#C04A25] bg-[#FDF2E9] py-0.5 px-2 rounded" style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '14px', color: '#C04A25', backgroundColor: '#FDF2E9', padding: '2px 8px', borderRadius: '4px' }}>
                        {evt.event_code}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-zinc-500 mb-4" style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: '#71717A', marginBottom: '16px' }}>
                      <span>Photos: <strong>{evt.photo_count || 0}</strong></span>
                      <span>Status: <strong style={{ color: evt.status === 'paused' ? '#B45309' : '#15803D' }}>{evt.status || 'active'}</strong></span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-zinc-200" style={{ display: 'flex', gap: '8px', paddingTop: '8px', borderTop: '1px solid #E5E0D8' }}>
                    <button
                      type="button"
                      onClick={() => onOpenSlideshow(evt.event_code)}
                      className="flex-1 inline-flex items-center justify-center gap-1 bg-zinc-900 text-white py-2 px-3 rounded-lg text-xs font-semibold cursor-pointer"
                      style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', backgroundColor: '#18181B', color: '#FFFFFF', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      <Play className="w-3.5 h-3.5" style={{ width: '14px', height: '14px' }} />
                      <span>Slideshow</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenUpload(evt.event_code)}
                      className="inline-flex items-center justify-center gap-1 bg-zinc-100 border border-zinc-300 py-2 px-3 rounded-lg text-xs font-semibold cursor-pointer"
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', backgroundColor: '#F4F4F5', border: '1px solid #D4D4D8', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      <ExternalLink className="w-3.5 h-3.5" style={{ width: '14px', height: '14px' }} />
                      <span>Guest View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedQrEvent(evt)}
                      className="inline-flex items-center justify-center bg-[#FDF2E9] text-[#C04A25] border border-[#FDBA74] p-2 rounded-lg cursor-pointer"
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FDF2E9', color: '#C04A25', border: '1px solid #FDBA74', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
                      title="Show Event QR Code"
                    >
                      <QrCode className="w-4 h-4" style={{ width: '16px', height: '16px' }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal for QR Code Display */}
        {selectedQrEvent && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 1000 }}>
            <div className="bg-white rounded-2xl p-6 max-w-[360px] w-full text-center" style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '24px', maxWidth: '360px', width: '100%', textAlign: 'center' }}>
              <h3 className="font-bold text-lg text-zinc-900 m-0 mb-1" style={{ fontWeight: '700', fontSize: '18px', color: '#18181B', margin: '0 0 4px 0' }}>{selectedQrEvent.title}</h3>
              <p className="text-xs text-zinc-500 mb-4" style={{ fontSize: '12px', color: '#71717A', marginBottom: '16px' }}>Scan to join photo stream</p>
              
              <div className="bg-white p-4 rounded-xl inline-block border border-zinc-200 mb-4" style={{ backgroundColor: '#FFFFFF', padding: '16px', borderRadius: '12px', display: 'inline-block', border: '1px solid #E5E0D8', marginBottom: '16px' }}>
                <QRCodeSVG
                  value={`${window.location.origin}/?event=${selectedQrEvent.event_code}`}
                  size={200}
                />
              </div>
              <p className="font-mono font-bold text-lg text-[#C04A25] mb-4" style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '18px', color: '#C04A25', marginBottom: '16px' }}>
                Code: {selectedQrEvent.event_code}
              </p>
              <button
                type="button"
                onClick={() => setSelectedQrEvent(null)}
                className="w-full bg-zinc-900 text-white py-2.5 rounded-lg font-semibold cursor-pointer border-none"
                style={{ width: '100%', backgroundColor: '#18181B', color: '#FFFFFF', padding: '10px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', border: 'none' }}
              >
                Close
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}