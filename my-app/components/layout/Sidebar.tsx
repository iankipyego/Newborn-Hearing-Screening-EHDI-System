'use client';
// components/layout/Sidebar.tsx
// §50.1 — persistent on desktop, hamburger drawer on mobile (<768px)
// §50.2 — items driven entirely by NAV_BY_ROLE[role]
// §50.3 — role badge colours

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import {
  LayoutDashboard, UserPlus, Search, ClipboardList, FilePenLine,
  BarChart2, AlertTriangle, Download, Users, Building2, ScrollText,
  FileText, GraduationCap, Stethoscope, X,
} from 'lucide-react';
import { NAV_BY_ROLE, ROLE_BADGE, type NavItem } from '@/lib/nav';

// Map icon string → component
const ICONS: Record<string, React.ElementType> = {
  LayoutDashboard, UserPlus, Search, ClipboardList, FilePenLine,
  BarChart2, AlertTriangle, Download, Users, Building2, ScrollText,
  FileText, GraduationCap, Stethoscope,
};

interface SidebarProps {
  role:              string;
  userName:          string;
  open:              boolean;           // mobile drawer state
  onClose:           () => void;
  correctionBadge?:  number;           // unacted correction requests
}

export default function Sidebar({
  role, userName, open, onClose, correctionBadge = 0,
}: SidebarProps) {
  const pathname  = usePathname();
  const drawerRef = useRef<HTMLDivElement>(null);

  const items: NavItem[] = NAV_BY_ROLE[role] ?? [];
  const badge            = ROLE_BADGE[role] ?? { label: role, color: 'bg-gray-100 text-gray-700' };

  // Close drawer on outside click (mobile)
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (open && drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  // Close on route change (mobile)
  useEffect(() => { onClose(); }, [pathname]); // eslint-disable-line

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href);

  const NavLink = ({ item }: { item: NavItem }) => {
    const Icon     = ICONS[item.icon] ?? LayoutDashboard;
    const active   = isActive(item.href);
    const showBadge = item.badge === 'correction_requests' && correctionBadge > 0;

    return (
      <Link
        href={item.href}
        className={`
          group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
          transition-colors duration-150 relative
          ${active
            ? 'bg-teal-700 text-white'
            : 'text-teal-100 hover:bg-teal-700/60 hover:text-white'
          }
        `}
      >
        <Icon size={18} className="shrink-0" />
        <span className="truncate">{item.label}</span>
        {showBadge && (
          <span className="ml-auto inline-flex items-center justify-center
                           min-w-[1.25rem] h-5 px-1 rounded-full
                           bg-amber-400 text-amber-900 text-xs font-bold leading-none">
            {correctionBadge > 99 ? '99+' : correctionBadge}
          </span>
        )}
      </Link>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo / system name */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-teal-700">
        <div>
          <p className="text-xs font-semibold text-teal-300 uppercase tracking-widest">CHISHLO EHDI</p>
          <p className="text-sm font-bold text-white leading-tight">Mama Rachel Hospital</p>
        </div>
        {/* Close button — mobile only */}
        <button
          onClick={onClose}
          className="md:hidden p-1 rounded text-teal-300 hover:text-white hover:bg-teal-700"
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
      </div>

      {/* User identity */}
      <div className="px-4 py-3 border-b border-teal-700">
        <p className="text-sm font-medium text-white truncate">{userName}</p>
        <span className={`mt-1 inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${badge.color}`}>
          {badge.label}
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {items.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-teal-700">
        <p className="text-xs text-teal-400">Phase 1A · Mama Rachel EHDI</p>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop sidebar — always visible ── */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-teal-800 min-h-screen">
        {sidebarContent}
      </aside>

      {/* ── Mobile drawer overlay ── */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50" aria-hidden="true" />
          {/* Drawer */}
          <div
            ref={drawerRef}
            className="absolute left-0 top-0 bottom-0 w-72 bg-teal-800 flex flex-col z-50
                       shadow-2xl animate-in slide-in-from-left duration-200"
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
