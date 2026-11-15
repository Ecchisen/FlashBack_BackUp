import React, { useState } from 'react';
import { Camera, Plus, User, ArrowRight, Sparkles } from 'lucide-react';

export default function LandingPage() {
  const [code, setCode] = useState('');

  const handleJoin = (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    const cleanCode = code.trim().toLowerCase();
    window.location.href = `/?event=${cleanCode}`;
  };

  return (
    <div style={{ backgroundColor: '#F7F3E9', minHeight: '100vh', color: '#1F2937', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', paddingBottom: '80px' }}>
      
      {/* Top Navigation */}
      <nav style={{ maxWidth: '480px', margin: '0 auto', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800', fontSize: '1.25rem', color: '#1F2937' }}>
          <div style={{ backgroundColor: '#C04A25', color: '#FFF', padding: '6px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Camera size={20} />
          </div>
          <span>FlashBack</span>
        </div>
        <a href="/?dashboard=true" style={{ fontSize: '0.9rem', color: '#C04A25', textDecoration: 'none', fontWeight: '600' }}>
          Host Dashboard
        </a>
      </nav>

      <main style={{ maxWidth: '480px', margin: '0 auto', padding: '0 16px' }}>
        
        {/* Hero Section */}
        <section style={{ position: 'relative', borderRadius: '24px', overflow: 'hidden', minHeight: '380px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '24px', color: '#FFF', marginBottom: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
          <img 
            src="https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=800&q=80" 
            alt="Event celebration" 
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.65)' }}
          />
          <div style={{ position: 'relative', zIndex: 2 }}>
            <h1 style={{ fontSize: '2.4rem', fontWeight: '800', lineHeight: '1.1', marginBottom: '10px', textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
              Every moment, shared.
            </h1>
            <p style={{ fontSize: '1.05rem', color: '#E5E7EB', marginBottom: '20px', lineHeight: '1.4' }}>
              All the photos from your event, in one place.
            </p>

            {/* Direct Event Code Input Form */}
            <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(12px)', padding: '12px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.25)' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  type="text" 
                  placeholder="Enter 5-digit event code" 
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={10}
                  style={{ flex: 1, padding: '12px 16px', borderRadius: '10px', border: 'none', fontSize: '0.95rem', backgroundColor: '#FFF', color: '#1F2937', outline: 'none' }}
                />
                <button 
                  type="submit"
                  style={{ backgroundColor: '#18181B', color: '#FFF', border: 'none', padding: '12px 20px', borderRadius: '10px', fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'transform 0.1s' }}
                >
                  Join <ArrowRight size={16} />
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Terracotta Grid Feature Section */}
        <section style={{ backgroundColor: '#C04A25', borderRadius: '24px', padding: '20px', color: '#FFF', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '16px', color: '#FFF' }}>
            Moments worth keeping
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <img src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=400&q=80" alt="Friends" style={{ width: '100%', height: '130px', objectFit: 'cover', borderRadius: '14px' }} />
            <img src="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=400&q=80" alt="Wedding guest" style={{ width: '100%', height: '130px', objectFit: 'cover', borderRadius: '14px' }} />
            <img src="https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=400&q=80" alt="Party venue" style={{ width: '100%', height: '130px', objectFit: 'cover', borderRadius: '14px' }} />
            <img src="https://images.unsplash.com/photo-1522673607200-164d1b6ce486?auto=format&fit=crop&w=400&q=80" alt="Couple sunset" style={{ width: '100%', height: '130px', objectFit: 'cover', borderRadius: '14px' }} />
          </div>
        </section>

        {/* Lower Banner Section */}
        <section style={{ backgroundColor: '#FFF', borderRadius: '24px', padding: '24px', border: '1px solid #E5E0D8', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#C04A25', fontWeight: '700', fontSize: '0.85rem' }}>
            <Sparkles size={16} /> NO APP OR ACCOUNT REQUIRED
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: '800', margin: 0, color: '#1F2937' }}>
            Memories, together.
          </h2>
          <p style={{ margin: 0, color: '#6B7280', fontSize: '0.95rem', lineHeight: '1.5' }}>
            FlashBack helps you collect photos from everyone at your event, so no moment gets left behind.
          </p>
          <a 
            href="/?dashboard=true" 
            style={{ display: 'block', textAlign: 'center', backgroundColor: '#18181B', color: '#FFF', padding: '14px', borderRadius: '12px', textDecoration: 'none', fontWeight: '700', fontSize: '0.95rem', marginTop: '8px' }}
          >
            Create an event
          </a>
        </section>

      </main>

      {/* Fixed Bottom Navigation Bar */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#FFF', borderTop: '1px solid #E5E0D8', display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '10px 0', zIndex: 1000, maxWidth: '480px', margin: '0 auto' }}>
        <a href="/" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', color: '#C04A25', textDecoration: 'none', fontSize: '0.75rem', fontWeight: '600' }}>
          <Camera size={20} />
          <span>Home</span>
        </a>
        <a href="/?dashboard=true" style={{ width: '42px', height: '42px', backgroundColor: '#C04A25', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', textDecoration: 'none', marginTop: '-15px', boxShadow: '0 4px 12px rgba(192, 74, 37, 0.3)' }}>
          <Plus size={22} />
        </a>
        <a href="/?dashboard=true" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', color: '#6B7280', textDecoration: 'none', fontSize: '0.75rem', fontWeight: '600' }}>
          <User size={20} />
          <span>Account</span>
        </a>
      </div>

    </div>
  );
}