// flashback-frontend/src/App.jsx
import React, { useState, useEffect } from 'react';
import LandingPage from './LandingPage';
import GuestUpload from './GuestUpload';
import AdminPanel from './AdminPanel';
import Slideshow from './Slideshow';
import UserDashboard from './UserDashboard';

// Error Boundary Component to prevent blank screens
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("FlashBack Render Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', padding: '32px 16px', backgroundColor: '#F7F3E9', fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ maxWidth: '500px', width: '100%', backgroundColor: '#FFFFFF', padding: '24px', borderRadius: '16px', border: '1px solid #E5E0D8', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ color: '#DC2626', marginTop: 0 }}>Application Error</h2>
            <p style={{ fontSize: '14px', color: '#52525B' }}>A rendering error occurred in FlashBack:</p>
            <pre style={{ backgroundColor: '#FEF2F2', padding: '12px', borderRadius: '8px', fontSize: '12px', color: '#991B1B', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
              {this.state.error?.toString() || 'Unknown Error'}
            </pre>
            <button
              onClick={() => window.location.href = '/'}
              style={{ backgroundColor: '#18181B', color: '#FFFFFF', padding: '10px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', marginTop: '12px' }}
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const parseRoute = () => {
    const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');
    const query = new URLSearchParams(window.location.search);

    if (path === '/adminpanel' || path === '/admin' || query.get('admin') === 'true') {
      return { view: 'admin' };
    }
    const slideshow = query.get('slideshow');
    if (slideshow || path.startsWith('/slideshow/')) {
      return { view: 'slideshow', code: slideshow || path.split('/')[2] };
    }
    const event = query.get('event');
    if (event || path.startsWith('/event/')) {
      return { view: 'upload', code: event || path.split('/')[2] };
    }
    if (path === '/dashboard' || query.get('dashboard') === 'true') {
      return { view: 'dashboard' };
    }
    return { view: 'landing' };
  };

  const [route, setRoute] = useState(parseRoute());

  useEffect(() => {
    const onPop = () => setRoute(parseRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = (view, param = '') => {
    let url = '/';
    if (view === 'dashboard') url = '/?dashboard=true';
    else if (view === 'admin') url = '/adminpanel';
    else if (view === 'upload') url = `/?event=${param}`;
    else if (view === 'slideshow') url = `/?slideshow=${param}`;

    window.history.pushState({}, '', url);
    setRoute({ view, code: param });
  };

  const renderView = () => {
    if (route.view === 'admin') {
      return <AdminPanel onBack={() => navigate('landing')} onOpenSlideshow={(c) => navigate('slideshow', c)} onOpenUpload={(c) => navigate('upload', c)} />;
    }
    if (route.view === 'slideshow') {
      return <Slideshow eventCode={route.code} onExit={() => navigate('landing')} />;
    }
    if (route.view === 'upload') {
      return <GuestUpload eventCode={route.code} onBack={() => navigate('landing')} onOpenSlideshow={(c) => navigate('slideshow', c)} />;
    }
    if (route.view === 'dashboard') {
      return <UserDashboard onBack={() => navigate('landing')} onOpenSlideshow={(c) => navigate('slideshow', c)} onOpenUpload={(c) => navigate('upload', c)} />;
    }
    return <LandingPage onJoinEvent={(c) => navigate('upload', c)} onOpenDashboard={() => navigate('dashboard')} onOpenAdmin={() => navigate('admin')} />;
  };

  return (
    <ErrorBoundary>
      {renderView()}
    </ErrorBoundary>
  );
}