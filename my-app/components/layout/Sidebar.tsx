'use client';
// components/layout/Sidebar.tsx
// Dark: navy sidebar with teal accents. Light: teal-800.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import {
  LayoutDashboard, UserPlus, Search, ClipboardList, FilePenLine,
  BarChart2, AlertTriangle, Download, Users, Building2, ScrollText,
  FileText, GraduationCap, Stethoscope, X,
} from 'lucide-react';
import { NAV_BY_ROLE, ROLE_BADGE, type NavItem } from '@/lib/nav';

const ICONS: Record<string, React.ElementType> = {
  LayoutDashboard, UserPlus, Search, ClipboardList, FilePenLine,
  BarChart2, AlertTriangle, Download, Users, Building2, ScrollText,
  FileText, GraduationCap, Stethoscope,
};

interface SidebarProps {
  role:             string;
  userName:         string;
  open:             boolean;
  onClose:          () => void;
  correctionBadge?: number;
}

export default function Sidebar({
  role, userName, open, onClose, correctionBadge = 0,
}: SidebarProps) {
  const pathname  = usePathname();
  const drawerRef = useRef<HTMLDivElement>(null);

  const items = NAV_BY_ROLE[role] ?? [];
  const badge = ROLE_BADGE[role] ?? {
    label: role,
    color: 'bg-gray-100 text-gray-700',
    darkColor: 'bg-gray-800 text-gray-300 border border-gray-700',
  };

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (open && drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  useEffect(() => { onClose(); }, [pathname]); // eslint-disable-line

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href);

  const NavLink = ({ item }: { item: NavItem }) => {
    const Icon   = ICONS[item.icon] ?? LayoutDashboard;
    const active = isActive(item.href);
    const showBadge = item.badge === 'correction_requests' && correctionBadge > 0;

    return (
      <Link
        href={item.href}
        className={`
          group flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium
          transition-all duration-150 relative
          ${active
            ? 'bg-accent text-white shadow-lg shadow-accent/20'
            : 'text-gray-300 hover:bg-white/5 hover:text-white'
          }
        `}
      >
        <Icon size={18} className="shrink-0" />
        <span className="truncate">{item.label}</span>
        {showBadge && (
          <span className="ml-auto inline-flex items-center justify-center
                           min-w-[1.25rem] h-5 px-1 rounded-full
                           bg-warn text-gray-900 text-[10px] font-bold leading-none">
            {correctionBadge > 99 ? '99+' : correctionBadge}
          </span>
        )}
      </Link>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <span className="text-accent-light font-display font-bold text-sm">EH</span>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-accent/60 uppercase tracking-[0.15em]">EHDI System</p>
            <p className="text-xs font-bold text-fg leading-tight">Mama Rachel Hospital</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-lg text-fg-muted hover:text-fg hover:bg-white/5"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      {/* User */}
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <p className="text-sm font-medium text-fg truncate">{userName}</p>
        <span className={`mt-1.5 inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full
                         ${badge.darkColor}`}>
          {badge.label}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {items.map((item) => (
          <NavLink key={item.href} item={item} />
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/[0.06]">
        <p className="text-[10px] text-fg-muted/60">Phase 1A · Mama Rachel EHDI</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-surface-elevated border-r border-surface-border min-h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
          <div
            ref={drawerRef}
            className="absolute left-0 top-0 bottom-0 w-72 bg-surface-elevated flex flex-col z-50 shadow-2xl"
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}