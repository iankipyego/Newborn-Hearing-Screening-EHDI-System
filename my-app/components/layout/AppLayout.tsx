
'use client';
// components/layout/AppLayout.tsx
// Wraps all authenticated pages. Reads user from localStorage (set by 2FA page).
// Fetches live alert count from the API.
// §50.1 layout structure

import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import TopBar, { type Alert } from './TopBar';

interface AppLayoutProps {
  children: React.ReactNode;
}

interface StoredUser {
  id:      string;
  name:    string;
  email:   string;
  role:    string;
  site_id: string;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen,     setSidebarOpen]     = useState(false);
  const [user,            setUser]            = useState<StoredUser | null>(null);
  const [alerts,          setAlerts]          = useState<Alert[]>([]);
  const [correctionBadge, setCorrectionBadge] = useState(0);

  // Load user from localStorage (written by 2FA page after login)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) setUser(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  // Fetch internal alerts + correction badge (best-effort, non-blocking)
  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem('access_token');
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };

    // Alerts — system-level (§50.3): correction requests pending, equipment, export ready
    // TODO: wire to real /api/v1/dashboard/alerts endpoint in Phase 2
    // For now, seed with a placeholder so the bell is live-looking
    setAlerts([
      // Uncomment when endpoint exists:
      // fetched from /api/v1/dashboard/alerts
    ]);

    // Correction request badge — scoped to current user's own requests
    // TODO: wire to real endpoint in Phase 2
    // fetch('/api/v1/corrections?own=true&status=PENDING', { headers })
    //   .then(r => r.json())
    //   .then(d => setCorrectionBadge(d.count ?? 0))
    //   .catch(() => {});
  }, [user]);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  if (!user) {
    // Still loading from localStorage — show a minimal skeleton
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 rounded-full border-4 border-teal-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar — desktop persistent, mobile drawer */}
      <Sidebar
        role={user.role}
        userName={user.name}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        correctionBadge={correctionBadge}
      />

      {/* Right column: top bar + scrollable content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar
          userName={user.name}
          role={user.role}
          alerts={alerts}
          onMenuClick={() => setSidebarOpen(true)}
        />

        {/* Main scrollable content area */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
