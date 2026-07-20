'use client';
// components/layout/TopBar.tsx
// Dark: glass effect. Light: white. Theme toggle added.

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Menu, ChevronDown, User, LogOut, Sun, Moon } from 'lucide-react';
import { ROLE_BADGE } from '@/lib/nav';
import { useTheme } from '@/lib/theme';

export interface Alert {
  id:   string;
  text: string;
  href: string;
  read: boolean;
}

interface TopBarProps {
  userName:    string;
  role:        string;
  alerts?:     Alert[];
  onMenuClick: () => void;
}

export default function TopBar({
  userName, role, alerts = [], onMenuClick,
}: TopBarProps) {
  const { theme, toggle } = useTheme();
  const [alertsOpen,  setAlertsOpen]  = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const alertsRef  = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const router     = useRouter();

  const badge       = ROLE_BADGE[role] ?? { label: role, color: 'bg-gray-100 text-gray-700', darkColor: 'bg-gray-800 text-gray-300 border border-gray-700' };
  const unreadCount = alerts.filter((a) => !a.read).length;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (alertsRef.current  && !alertsRef.current.contains(e.target  as Node)) setAlertsOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    try {
      const accessToken  = localStorage.getItem('access_token')  ?? '';
      const refreshToken = localStorage.getItem('refresh_token') ?? '';
      await fetch('/api/v1/auth/logout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body:    JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch { /* best-effort */ }
    localStorage.clear();
    document.cookie = 'access_token=; max-age=0; path=/';
    router.push('/login');
  };

  return (
    <header className="h-14 bg-white/80 dark:bg-surface-elevated/70 backdrop-blur-xl
                       border-b border-gray-200 dark:border-surface-border
                       flex items-center px-4 gap-3 shrink-0 z-30 sticky top-0">

      {/* Hamburger */}
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 rounded-lg text-gray-500 dark:text-fg-muted hover:bg-gray-100 dark:hover:bg-white/5"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      <span className="md:hidden text-sm font-bold text-teal-800 dark:text-accent-light truncate">
        Mama Rachel EHDI
      </span>

      <div className="flex-1" />

      {/* Theme toggle */}
      <button
        onClick={toggle}
        className="p-2 rounded-lg text-gray-500 dark:text-fg-muted
                   hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      {/* Alerts */}
      <div className="relative" ref={alertsRef}>
        <button
          onClick={() => { setAlertsOpen((v) => !v); setProfileOpen(false); }}
          className="relative p-2 rounded-lg text-gray-500 dark:text-fg-muted hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          aria-label={`${unreadCount} alerts`}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 inline-flex items-center justify-center
                             min-w-[1.1rem] h-[1.1rem] px-0.5 rounded-full
                             bg-red-500 text-white text-[10px] font-bold leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {alertsOpen && (
          <div className="absolute right-0 mt-2 w-80 rounded-xl shadow-xl border
                          border-gray-200 dark:border-surface-border z-50 overflow-hidden
                          bg-white dark:bg-surface-card">
            <div className="px-4 py-2.5 border-b border-gray-100 dark:border-surface-border">
              <p className="text-sm font-semibold text-gray-800 dark:text-fg">System Alerts</p>
            </div>
            {alerts.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500 dark:text-fg-muted">
                No pending alerts
              </div>
            ) : (
              <ul className="max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-surface-border">
                {alerts.map((alert) => (
                  <li key={alert.id}>
                    <a
                      href={alert.href}
                      onClick={() => setAlertsOpen(false)}
                      className={`block px-4 py-3 text-sm transition-colors
                                  ${alert.read
                                    ? 'text-gray-500 dark:text-fg-muted'
                                    : 'text-gray-800 dark:text-fg font-medium'}
                                  hover:bg-gray-50 dark:hover:bg-white/5`}
                    >
                      {!alert.read && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent mr-2 mb-0.5" />
                      )}
                      {alert.text}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* User menu */}
      <div className="relative" ref={profileRef}>
        <button
          onClick={() => { setProfileOpen((v) => !v); setAlertsOpen(false); }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg
                     text-gray-700 dark:text-fg
                     hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
        >
          <span className="hidden sm:block text-sm font-medium truncate max-w-[140px]">
            {userName}
          </span>
          <span className={`hidden sm:inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full
                           ${badge.darkColor}`}>
            {badge.label}
          </span>
          <ChevronDown size={16} className="text-gray-400 dark:text-fg-muted shrink-0" />
        </button>

        {profileOpen && (
          <div className="absolute right-0 mt-2 w-48 rounded-xl shadow-xl border
                          border-gray-200 dark:border-surface-border z-50 overflow-hidden py-1
                          bg-white dark:bg-surface-card">
            <a
              href="/profile"
              onClick={() => setProfileOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-fg
                         hover:bg-gray-50 dark:hover:bg-white/5"
            >
              <User size={16} className="text-gray-400 dark:text-fg-muted" />
              My Profile
            </a>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 dark:text-red-400
                         hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <LogOut size={16} />
              Log Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}