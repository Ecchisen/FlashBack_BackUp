// flashback-frontend/src/Slideshow.jsx
import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  ArrowLeft, Maximize, Minimize, RefreshCw, QrCode,
  Sparkles, Play, Pause, ChevronRight
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

// =========================================================================
// SHUFFLE-BAG SLIDESHOW ALGORITHM (Client-Side)
// =========================================================================
/**
 * ShuffleBag Class
 * 
 * An implementation of the "Shuffle-Bag" (also known as Random Grab-Bag) algorithm.
 * 
 * WHY IT IS NEEDED:
 * In a traditional sequential slideshow (or purely random with replacement):
 * - Sequential: Uploading a new photo or hitting the end always resets back to Photo #1,
 *   causing Photo #1 to dominate screen time and feel repetitive.
 * - Pure Random: Randomly picking photos can show the exact same photo three times in a row,
 *   while neglecting others entirely (the "random clustering" effect).
 * 
 * HOW THE SHUFFLE-BAG SOLVES THIS:
 * 1. FAIR COVERAGE: Think of a physical bag containing one copy of every uploaded photo.
 *    Each slide transition draws (pops) one photo out of the bag.
 *    Every single photo is guaranteed to appear exactly once before ANY photo repeats!
 * 2. FISHER-YATES SHUFFLE: When the bag is empty, it is refilled with all photos and
 *    shuffled thoroughly in O(n) time using the unbiased Fisher-Yates algorithm.
 * 3. BOUNDARY DUPLICATE PREVENTION: When a cycle completes and a new bag is shuffled,
 *    if the first item in the new bag happens to be identical to the last item just shown,
 *    it is swapped with the last item in the bag to prevent back-to-back repetition.
 * 4. REAL-TIME NEW PHOTO PRIORITY: When a guest uploads a new photo, it is displayed
 *    immediately on the screen (the "VIP moment"), while seamlessly registering it in
 *    the master pool and removing it from the pending bag so the slideshow moves on
 *    to the remaining shuffled photos without bouncing back to Photo #1!
 */
class ShuffleBag {
  constructor() {
    this.masterList = []; // All unique photos uploaded for this event
    this.bag = [];        // Remaining photos in the current shuffled cycle
    this.lastShownId = null;
    this.cycleCount = 1;
  }

  // Refill the bag with all master items and perform an unbiased Fisher-Yates shuffle
  refill() {
    if (this.masterList.length === 0) {
      this.bag = [];
      return;
    }

    // 1. Fill the bag with all available photos
    this.bag = [...this.masterList];

    // 2. Fisher-Yates Shuffle
    for (let i = this.bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
    }

    // 3. Boundary check: If the first item of the new bag is identical to the last photo shown,
    // swap it with the last item in the bag to prevent consecutive duplicate display.
    if (this.bag.length > 1 && this.lastShownId && this.bag[0].id === this.lastShownId) {
      const lastIndex = this.bag.length - 1;
      [this.bag[0], this.bag[lastIndex]] = [this.bag[lastIndex], this.bag[0]];
    }
  }

  // Sync / update the master list of photos from server
  syncPhotos(photos) {
    if (!photos || photos.length === 0) return;

    const existingIds = new Set(this.masterList.map(p => p.id));

    for (const p of photos) {
      if (!existingIds.has(p.id)) {
        this.masterList.push(p);
        existingIds.add(p.id);
      }
    }

    // If the bag was empty, initialize it immediately
    if (this.bag.length === 0 && this.masterList.length > 0) {
      this.refill();
    }
  }

  // Add a newly uploaded photo directly with priority
  onNewPhoto(photo) {
    if (!photo || !photo.id) return;

    // Ensure it exists in the master pool
    const exists = this.masterList.some(p => p.id === photo.id);
    if (!exists) {
      this.masterList.push(photo);
    }

    // Mark as currently shown
    this.lastShownId = photo.id;

    // Remove from the remaining bag if it exists so it won't repeat immediately on the next slide
    this.bag = this.bag.filter(p => p.id !== photo.id);
  }

  // Pull the next photo from the shuffled bag
  next() {
    if (this.masterList.length === 0) return null;

    // If the bag is empty, all photos have been shown once: start a new cycle!
    if (this.bag.length === 0) {
      this.cycleCount++;
      this.refill();
    }

    // Draw the next photo from the shuffled bag
    const selected = this.bag.pop();
    if (selected) {
      this.lastShownId = selected.id;
    }
    return selected;
  }

  // Status for display in controls
  getStatus() {
    return {
      total: this.masterList.length,
      remainingInBag: this.bag.length,
      cycle: this.cycleCount
    };
  }
}

export default function Slideshow({ eventCode, onExit }) {
  const [currentPhoto, setCurrentPhoto] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showQr, setShowQr] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isNewUpload, setIsNewUpload] = useState(false);
  const [bagStats, setBagStats] = useState({ total: 0, remainingInBag: 0, cycle: 1 });

  // Shuffle-Bag instance preserved across component renders
  const shuffleBagRef = useRef(new ShuffleBag());
  const timerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  // Transition to the next photo according to the Shuffle-Bag algorithm
  const advanceToNextPhoto = () => {
    setIsNewUpload(false);
    const bag = shuffleBagRef.current;
    const nextItem = bag.next();

    if (nextItem) {
      setCurrentPhoto(nextItem);
      setBagStats(bag.getStatus());
    }
  };

  // Fetch full photo pool from backend and initialize bag
  const fetchInitialPool = async () => {
    try {
      const res = await fetch(`/api/events/${eventCode}/photos`);
      if (res.ok) {
        const data = await res.json();
        if (data.photos && data.photos.length > 0) {
          const bag = shuffleBagRef.current;
          bag.syncPhotos(data.photos);

          // If no photo currently displayed, pick the first one from the shuffled bag
          if (!currentPhoto) {
            const first = bag.next();
            if (first) {
              setCurrentPhoto(first);
              setBagStats(bag.getStatus());
            }
          }
        }
      } else {
        // Fallback to slideshow/next endpoint
        const nextRes = await fetch(`/api/events/${eventCode}/slideshow/next`);
        if (nextRes.ok) {
          const data = await nextRes.json();
          if (data.photo) {
            shuffleBagRef.current.syncPhotos([data.photo]);
            setCurrentPhoto(data.photo);
          }
        }
      }
    } catch (err) {
      console.warn('[Slideshow Sync]', err.message);
    }
  };

  useEffect(() => {
    fetchInitialPool();

    // Connect to Socket.io to receive live photo uploads from guests
    const socket = io();
    socket.emit('join_event', eventCode);

    // Real-time handler when ANY guest uploads a photo
    const handleLivePhoto = (photo) => {
      if (!photo) return;

      const formattedPhoto = {
        id: photo.id || Date.now(),
        photo_url: photo.photo_url || photo.url,
        display_name: photo.display_name || 'Guest',
        uploaded_at: photo.uploaded_at || new Date().toISOString()
      };

      // 1. Immediately inject into the Shuffle-Bag (marks as shown, avoids immediate repeat)
      const bag = shuffleBagRef.current;
      bag.onNewPhoto(formattedPhoto);
      setBagStats(bag.getStatus());

      // 2. Display the newly uploaded photo immediately on the projector screen
      setCurrentPhoto(formattedPhoto);
      setIsNewUpload(true);

      // 3. Reset the auto-cycle timer so guests get full 7 seconds to admire the new photo
      resetTimer();
    };

    socket.on('photo_uploaded', handleLivePhoto);
    socket.on('new_photo', handleLivePhoto);

    // Periodic sync every 20 seconds to catch any photos uploaded if socket briefly dropped
    const syncInterval = setInterval(() => {
      fetch(`/api/events/${eventCode}/photos`)
        .then(res => res.json())
        .then(data => {
          if (data.photos) {
            shuffleBagRef.current.syncPhotos(data.photos);
            setBagStats(shuffleBagRef.current.getStatus());
          }
        })
        .catch(() => {});
    }, 20000);

    return () => {
      socket.off('photo_uploaded', handleLivePhoto);
      socket.off('new_photo', handleLivePhoto);
      socket.disconnect();
      clearInterval(syncInterval);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [eventCode]);

  // Handle timer lifecycle for auto-advancing slides every 6.5 seconds
  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!isPaused) {
      timerRef.current = setInterval(() => {
        advanceToNextPhoto();
      }, 6500);
    }
  };

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, currentPhoto]);

  // Hide controls after 3.5 seconds of mouse inactivity
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3500);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
        userSelect: 'none',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      {/* Top Floating Controls Bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 40,
          transition: 'opacity 0.3s ease',
          opacity: showControls ? 1 : 0,
          pointerEvents: showControls ? 'auto' : 'none',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)'
        }}
      >
        {/* Left: Exit button & Bag Status Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={onExit || (() => window.location.href = '/')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'rgba(24, 24, 27, 0.85)',
              color: '#FFFFFF',
              border: '1px solid #3F3F46',
              padding: '8px 16px',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)'
            }}
          >
            <ArrowLeft size={16} />
            <span>Exit</span>
          </button>

          {/* Shuffle-Bag Status Badge */}
          {bagStats.total > 0 && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'rgba(24, 24, 27, 0.7)',
                color: '#A1A1AA',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '6px 14px',
                borderRadius: '999px',
                fontSize: '12px',
                backdropFilter: 'blur(8px)'
              }}
              title="Shuffle-Bag algorithm ensures all photos are shown once per cycle before repeating"
            >
              <RefreshCw size={12} color="#C04A25" />
              <span>
                Bag: <strong style={{ color: '#FFFFFF' }}>{bagStats.remainingInBag}</strong> of {bagStats.total} left (Cycle {bagStats.cycle})
              </span>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Pause / Play */}
          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(24, 24, 27, 0.85)',
              color: '#FFFFFF',
              border: '1px solid #3F3F46',
              padding: '8px 14px',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)'
            }}
            title={isPaused ? 'Resume slideshow' : 'Pause slideshow'}
          >
            {isPaused ? <Play size={14} color="#22C55E" /> : <Pause size={14} />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          {/* Next Slide Manual Skip */}
          <button
            type="button"
            onClick={advanceToNextPhoto}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(24, 24, 27, 0.85)',
              color: '#FFFFFF',
              border: '1px solid #3F3F46',
              padding: '8px 14px',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)'
            }}
            title="Next random photo from Shuffle-Bag"
          >
            <span>Next</span>
            <ChevronRight size={14} />
          </button>

          {/* Toggle QR */}
          <button
            type="button"
            onClick={() => setShowQr(!showQr)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(24, 24, 27, 0.85)',
              color: '#FFFFFF',
              border: '1px solid #3F3F46',
              padding: '8px 16px',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)'
            }}
          >
            <QrCode size={16} color="#C04A25" />
            <span>{showQr ? 'Hide QR' : 'Event QR'}</span>
          </button>

          {/* Toggle Fullscreen */}
          <button
            type="button"
            onClick={toggleFullscreen}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(24, 24, 27, 0.85)',
              color: '#FFFFFF',
              border: '1px solid #3F3F46',
              width: '38px',
              height: '38px',
              borderRadius: '999px',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)'
            }}
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
        </div>
      </div>

      {/* Main Slide Display */}
      {currentPhoto ? (
        <div
          style={{
            textAlign: 'center',
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {/* Main Photo with smooth key transition */}
          <img
            key={currentPhoto.id + currentPhoto.photo_url}
            src={currentPhoto.photo_url}
            alt="Event Slide"
            style={{
              maxHeight: '92vh',
              maxWidth: '94vw',
              objectFit: 'contain',
              borderRadius: '14px',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.85)',
              animation: 'fadeIn 0.6s ease-out'
            }}
          />

          {/* Bottom Floating Info Pill: Guest Name & New Upload Tag */}
          <div
            style={{
              position: 'absolute',
              bottom: '26px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(15, 15, 18, 0.85)',
              backdropFilter: 'blur(12px)',
              border: isNewUpload ? '1px solid #F97316' : '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: isNewUpload ? '0 0 20px rgba(249, 115, 22, 0.4)' : '0 10px 25px rgba(0,0,0,0.5)',
              color: '#FFFFFF',
              padding: '10px 24px',
              borderRadius: '999px',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              zIndex: 35,
              transition: 'all 0.3s ease'
            }}
          >
            {isNewUpload ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#EA580C',
                  color: '#FFFFFF',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: '800',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase'
                }}
              >
                <Sparkles size={12} />
                Just Uploaded
              </span>
            ) : (
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22C55E' }} />
            )}

            <span>Shared by:</span>
            <strong style={{ color: '#FDBA74', fontWeight: 'bold' }}>
              {currentPhoto.display_name}
            </strong>
          </div>
        </div>
      ) : (
        /* Empty State: Waiting for photos with QR */
        <div style={{ textAlign: 'center', padding: '32px', maxWidth: '520px', color: '#FFFFFF' }}>
          <div style={{ width: '64px', height: '64px', backgroundColor: '#18181B', border: '1px solid #27272A', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', color: '#C04A25' }}>
            <Sparkles size={32} />
          </div>
          <h2 style={{ fontSize: '26px', fontWeight: '800', marginBottom: '8px' }}>Waiting for photos...</h2>
          <p style={{ color: '#A1A1AA', fontSize: '14px', marginBottom: '24px' }}>
            Photos uploaded by guests will automatically appear right here on the big screen in real time with shuffle-bag rotation.
          </p>
          <div style={{ backgroundColor: 'rgba(24, 24, 27, 0.9)', border: '1px solid #27272A', padding: '24px', borderRadius: '20px', display: 'inline-block' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#71717A', fontWeight: 'bold', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>Join Code</span>
            <span style={{ fontFamily: 'monospace', fontWeight: '800', fontSize: '32px', color: '#C04A25', letterSpacing: '0.1em', display: 'block', marginBottom: '16px' }}>
              {eventCode.toUpperCase()}
            </span>
            <div style={{ backgroundColor: '#FFFFFF', padding: '14px', borderRadius: '14px', display: 'inline-block' }}>
              <QRCodeSVG
                value={`${window.location.origin}/?event=${eventCode}`}
                size={160}
              />
            </div>
            <p style={{ fontSize: '12px', color: '#A1A1AA', marginTop: '14px', margin: 0 }}>Scan with your phone to upload photos</p>
          </div>
        </div>
      )}

      {/* Persistent / Toggleable QR Code in Corner for Guests */}
      {showQr && currentPhoto && (
        <div
          style={{
            position: 'absolute',
            top: '80px',
            right: '24px',
            backgroundColor: 'rgba(15, 15, 18, 0.9)',
            backdropFilter: 'blur(12px)',
            padding: '16px',
            borderRadius: '18px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            textAlign: 'center',
            zIndex: 40
          }}
        >
          <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#A1A1AA', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Join Event</span>
          <span style={{ fontFamily: 'monospace', fontWeight: '800', fontSize: '20px', color: '#C04A25', display: 'block', marginBottom: '10px' }}>
            {eventCode.toUpperCase()}
          </span>
          <div style={{ backgroundColor: '#FFFFFF', padding: '10px', borderRadius: '12px', display: 'inline-block', marginBottom: '8px' }}>
            <QRCodeSVG
              value={`${window.location.origin}/?event=${eventCode}`}
              size={120}
            />
          </div>
          <p style={{ fontSize: '11px', color: '#D4D4D8', margin: 0 }}>Scan to share photos</p>
        </div>
      )}

      {/* CSS Animation for smooth photo fade-in */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.985); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}