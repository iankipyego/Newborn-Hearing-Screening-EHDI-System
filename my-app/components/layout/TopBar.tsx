'use client';
// components/layout/TopBar.tsx
// §50.3 — logo left, alerts bell centre-right, user menu right
// §50.5 — hamburger on mobile

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Menu, ChevronDown, User, LogOut } from 'lucide-react';
import { ROLE_BADGE } from '@/lib/nav';

export interface Alert {
  id:    string;
  text:  string;
  href:  string;
  read:  boolean;
}

interface TopBarProps {
  userName:    string;
  role:        string;
  alerts?:     Alert[];
  onMenuClick: () => void;            // opens mobile sidebar
}

export default function TopBar({ userName, role, alerts = [], onMenuClick }: TopBarProps) {
  const [alertsOpen,  setAlertsOpen]  = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const alertsRef  = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const router     = useRouter();

  const badge       = ROLE_BADGE[role] ?? { label: role, color: 'bg-gray-100 text-gray-700' };
  const unreadCount = alerts.filter((a) => !a.read).length;

  // Close dropdowns on outside click
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
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-4 shrink-0 z-30 sticky top-0">

      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* System name — shown on mobile since sidebar is hidden */}
      <span className="md:hidden text-sm font-bold text-teal-800 truncate">
        Mama Rachel EHDI
      </span>

      {/* Spacer */}
      <div className="flex-1" />

      {/* ── Alerts bell (§50.3) ── */}
      <div className="relative" ref={alertsRef}>
        <button
          onClick={() => { setAlertsOpen((v) => !v); setProfileOpen(false); }}
          className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          aria-label={`${unreadCount} alerts`}
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 inline-flex items-center justify-center
                             min-w-[1.1rem] h-[1.1rem] px-0.5 rounded-full
                             bg-red-500 text-white text-[10px] font-bold leading-none">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {alertsOpen && (
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg
                          border border-gray-200 z-50 overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">System Alerts</p>
            </div>
            {alerts.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-500">
                No pending alerts
              </div>
            ) : (
              <ul className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                {alerts.map((alert) => (
                  <li key={alert.id}>
                    <a
                      href={alert.href}
                      onClick={() => setAlertsOpen(false)}
                      className={`block px-4 py-3 text-sm hover:bg-gray-50 transition-colors
                                  ${alert.read ? 'text-gray-500' : 'text-gray-800 font-medium'}`}
                    >
                      {!alert.read && (
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-500 mr-2 mb-0.5" />
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

      {/* ── User menu (§50.3) ── */}
      <div className="relative" ref={profileRef}>
        <button
          onClick={() => { setProfileOpen((v) => !v); setAlertsOpen(false); }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg
                     text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <span className="hidden sm:block text-sm font-medium truncate max-w-[140px]">
            {userName}
          </span>
          <span className={`hidden sm:inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${badge.color}`}>
            {badge.label}
          </span>
          <ChevronDown size={16} className="text-gray-400 shrink-0" />
        </button>

        {profileOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg
                          border border-gray-200 z-50 overflow-hidden py-1">
            <a
              href="/profile"
              onClick={() => setProfileOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <User size={16} className="text-gray-400" />
              My Profile
            </a>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600
                         hover:bg-red-50 transition-colors"
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
