// lib/nav.ts
// Single source of truth for sidebar navigation per §50.2.

export type NavItem = {
  label:  string;
  href:   string;
  icon:   string;
  badge?: 'correction_requests' | 'alerts';
};

export type NavSection = {
  items: NavItem[];
};

export const ROLE_BADGE: Record<string, {
  label: string;
  color: string;
  darkColor: string;
}> = {
  DATA_CLERK:  { label: 'Clerk',      color: 'bg-blue-100 text-blue-800',    darkColor: 'bg-blue-900/40 text-blue-300 border border-blue-800/40' },
  SCREENER:    { label: 'Screener',   color: 'bg-green-100 text-green-800',  darkColor: 'bg-green-900/40 text-green-300 border border-green-800/40' },
  SUPERVISOR:  { label: 'Supervisor', color: 'bg-orange-100 text-orange-800',darkColor: 'bg-orange-900/40 text-orange-300 border border-orange-800/40' },
  RESEARCHER:  { label: 'Researcher', color: 'bg-purple-100 text-purple-800',darkColor: 'bg-purple-900/40 text-purple-300 border border-purple-800/40' },
  ADMIN:       { label: 'Admin',      color: 'bg-red-100 text-red-800',      darkColor: 'bg-red-900/40 text-red-300 border border-red-800/40' },
};

export const NAV_BY_ROLE: Record<string, NavItem[]> = {
  DATA_CLERK: [
    { label: 'Dashboard',           href: '/dashboard',              icon: 'LayoutDashboard' },
    { label: 'Register New Child',  href: '/children/new',           icon: 'UserPlus'        },
    { label: 'Search Children',     href: '/children/search',       icon: 'Search'          },
    { label: 'Operational Log',     href: '/operational-logs',      icon: 'ClipboardList'   },
    { label: 'Correction Requests', href: '/corrections',           icon: 'FilePenLine', badge: 'correction_requests' },
  ],
  SCREENER: [
    { label: 'Dashboard',           href: '/dashboard',              icon: 'LayoutDashboard' },
    { label: 'Search Children',     href: '/children/search',       icon: 'Search'          },
    { label: 'Correction Requests', href: '/corrections',           icon: 'FilePenLine', badge: 'correction_requests' },
  ],
  SUPERVISOR: [
    { label: 'Dashboard',           href: '/dashboard',              icon: 'LayoutDashboard' },
    { label: 'Search Children',     href: '/children/search',       icon: 'Search'          },
    { label: 'Quality Dashboard',   href: '/quality',                icon: 'BarChart2'       },
    { label: 'Action-Needed List',  href: '/quality/action-needed',  icon: 'AlertTriangle'   },
    { label: 'Operational Log',     href: '/operational-logs',      icon: 'ClipboardList'   },
    { label: 'Correction Requests', href: '/corrections',           icon: 'FilePenLine', badge: 'correction_requests' },
    { label: 'Training Events',     href: '/admin/training',        icon: 'GraduationCap'   },
    { label: 'Equipment',           href: '/admin/equipment',       icon: 'Stethoscope'     },
  ],
  RESEARCHER: [
    { label: 'Quality Dashboard',   href: '/quality',                icon: 'BarChart2'       },
    { label: 'Research Exports',    href: '/exports',                icon: 'Download'        },
  ],
  ADMIN: [
    { label: 'Dashboard',           href: '/dashboard',              icon: 'LayoutDashboard' },
    { label: 'Register New Child',  href: '/children/new',           icon: 'UserPlus'        },
    { label: 'Search Children',     href: '/children/search',       icon: 'Search'          },
    { label: 'Quality Dashboard',   href: '/quality',                icon: 'BarChart2'       },
    { label: 'Action-Needed List',  href: '/quality/action-needed',  icon: 'AlertTriangle'   },
    { label: 'Operational Log',     href: '/operational-logs',      icon: 'ClipboardList'   },
    { label: 'Correction Requests', href: '/corrections',           icon: 'FilePenLine', badge: 'correction_requests' },
    { label: 'Research Exports',    href: '/exports',                icon: 'Download'        },
    { label: 'User Management',     href: '/admin/users',            icon: 'Users'           },
    { label: 'Site Management',     href: '/admin/sites',            icon: 'Building2'       },
    { label: 'Audit Log',           href: '/admin/audit-log',        icon: 'ScrollText'      },
    { label: 'Paper Backup Form',   href: '/admin/paper-backup-form',icon: 'FileText'        },
    { label: 'Training Events',     href: '/admin/training',        icon: 'GraduationCap'   },
    { label: 'Equipment',           href: '/admin/equipment',       icon: 'Stethoscope'     },
  ],
};