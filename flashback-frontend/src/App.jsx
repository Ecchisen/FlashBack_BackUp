import React from 'react';
import GuestUpload from './GuestUpload';
import AdminPanel from './AdminPanel';

function App() {
  
  const isAdmin = window.location.search.includes('admin=true') || window.location.pathname.includes('/admin');
  if (isAdmin) {
    return <AdminPanel />;
  }
  return <GuestUpload />;
}

export default App;