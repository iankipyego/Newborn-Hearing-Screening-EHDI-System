'use client';
// components/layout/AppLayout.tsx
// Dark/light-aware layout shell with atmospheric effects.

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) setUser(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('access_token');
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    // TODO: wire to real endpoints in Phase 2
    setAlerts([]);
  }, [user]);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-surface">
        <div className="h-8 w-8 rounded-full border-4 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="theme-transition flex h-screen bg-gray-50 dark:bg-surface overflow-hidden">
      {/* Dark mode atmosphere — hidden in light mode via CSS */}
      <div className="atmosphere" aria-hidden="true" />
      <div className="noise" aria-hidden="true" />

      {/* Sidebar */}
      <Sidebar
        role={user.role}
        userName={user.name}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        correctionBadge={correctionBadge}
      />

      {/* Main column */}
      <div className="relative z-10 flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar
          userName={user.name}
          role={user.role}
          alerts={alerts}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}