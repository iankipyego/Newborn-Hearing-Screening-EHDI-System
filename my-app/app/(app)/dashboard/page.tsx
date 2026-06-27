'use client';
// app/(app)/dashboard/page.tsx
// Role-aware dashboard landing page.
// Shows different quick-action cards per role per §50.2.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  UserPlus, Search, ClipboardList, BarChart2,
  AlertTriangle, Download, Users, FilePenLine,
} from 'lucide-react';
import { NAV_BY_ROLE, ROLE_BADGE } from '@/lib/nav';

interface StoredUser {
  id:      string;
  name:    string;
  role:    string;
  site_id: string;
}

// Quick-action cards shown on the dashboard per role
// Only the most important 4 items — the sidebar has the full list
const QUICK_ACTIONS: Record<string, { label: string; href: string; icon: React.ElementType; description: string }[]> = {
  DATA_CLERK: [
    { label: "Register New Child",  href: "/children/new",     icon: UserPlus,      description: "Add a new newborn to the system" },
    { label: "Search Children",     href: "/children/search",  icon: Search,        description: "Find an existing child record"    },
    { label: "Operational Log",     href: "/operational-logs", icon: ClipboardList, description: "Record today's screening activity" },
    { label: "Correction Requests", href: "/corrections",      icon: FilePenLine,   description: "View your pending corrections"    },
  ],
  SCREENER: [
    { label: "Search Children",     href: "/children/search",  icon: Search,        description: "Find a child to screen"           },
    { label: "Correction Requests", href: "/corrections",      icon: FilePenLine,   description: "View your flagged records"         },
  ],
  SUPERVISOR: [
    { label: "Quality Dashboard",   href: "/quality",                    icon: BarChart2,     description: "Review KPIs and coverage rates"  },
    { label: "Action-Needed List",  href: "/quality/action-needed",      icon: AlertTriangle, description: "Children needing follow-up"       },
    { label: "Correction Requests", href: "/corrections",                icon: FilePenLine,   description: "Review pending correction queue"  },
    { label: "Search Children",     href: "/children/search",            icon: Search,        description: "Look up any child record"         },
  ],
  RESEARCHER: [
    { label: "Quality Dashboard",   href: "/quality",   icon: BarChart2, description: "Aggregate programme metrics"       },
    { label: "Research Exports",    href: "/exports",   icon: Download,  description: "Download de-identified datasets"   },
  ],
  ADMIN: [
    { label: "User Management",     href: "/admin/users",      icon: Users,         description: "Manage staff accounts and roles"  },
    { label: "Quality Dashboard",   href: "/quality",          icon: BarChart2,     description: "Programme-wide KPIs"              },
    { label: "Correction Requests", href: "/corrections",      icon: FilePenLine,   description: "Full correction request queue"    },
    { label: "Audit Log",           href: "/admin/audit-log",  icon: Search,        description: "Review all system activity"       },
  ],
};

export default function DashboardPage() {
  const [user, setUser] = useState<StoredUser | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('user');
      if (raw) setUser(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  if (!user) return null;

  const badge   = ROLE_BADGE[user.role] ?? { label: user.role, color: 'bg-gray-100 text-gray-700' };
  const actions = QUICK_ACTIONS[user.role] ?? [];

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome, {user.name.split(' ')[0]}
          </h1>
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${badge.color}`}>
            {badge.label}
          </span>
        </div>
        <p className="text-gray-500 text-sm">
          Mama Rachel Hospital · Newborn Hearing Screening System
        </p>
      </div>

      {/* Quick-action cards */}
      {actions.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group flex flex-col gap-3 p-5 bg-white rounded-xl border border-gray-200
                             hover:border-teal-400 hover:shadow-md transition-all duration-150"
                >
                  <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center
                                  group-hover:bg-teal-100 transition-colors">
                    <Icon size={20} className="text-teal-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 group-hover:text-teal-700">
                      {action.label}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{action.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Placeholder stats area — Phase 2 will populate these */}
      <div className="mt-10">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Programme Summary
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Screened",    value: "—" },
            { label: "Coverage Rate",     value: "—" },
            { label: "Referral Rate",     value: "—" },
            { label: "Lost to Follow-up", value: "—" },
          ].map((stat) => (
            <div key={stat.label}
              className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <p className="text-2xl font-bold text-gray-300">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
              <p className="text-xs text-teal-600 mt-2">Available in Phase 2</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
