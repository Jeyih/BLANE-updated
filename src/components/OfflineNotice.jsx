import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { lastOfflineSnapshot } from '../lib/offline-data.js';
import '../styles/offline.css';

export default function OfflineNotice() {
  const { user } = useAuth();
  const [online, setOnline] = useState(navigator.onLine !== false);
  const [savedAt, setSavedAt] = useState(lastOfflineSnapshot());
  useEffect(() => {
    const update = () => { setOnline(navigator.onLine !== false); setSavedAt(lastOfflineSnapshot()); };
    for (const event of ['online', 'offline', 'blane-offline-data']) window.addEventListener(event, update);
    return () => { for (const event of ['online', 'offline', 'blane-offline-data']) window.removeEventListener(event, update); };
  }, []);
  if (online && !savedAt) return null;
  return <aside className="offline-notice" role="status">
    <strong>{online ? 'Showing saved data' : 'You’re offline'}</strong>
    <span>{user ? 'Previously opened data is available on this device. Meal plans and groceries save locally; profile changes, health logs and account syncing need internet.' : 'Previously visited pages may be available. Sign-in and registration need internet.'}
      {savedAt && ` Saved copy: ${new Date(savedAt).toLocaleString('en-PH')}. Prices and market information may be out of date.`}
    </span>
    {online && <button type="button" onClick={() => window.location.reload()}>Reload latest data</button>}
  </aside>;
}
