// lib/nav.ts
// Single source of truth for sidebar navigation per §50.2.
// Every role sees only the items listed here — nothing more.
// Icons are lucide-react names (string keys resolved in the sidebar component).

export type NavItem = {
  label:  string;
  href:   string;
  icon:   string;
  badge?: "correction_requests" | "alerts"; // live badge types
};

export type NavSection = {
  items: NavItem[];
};

// Role badge colours per §50.3
export const ROLE_BADGE: Record<string, { label: string; color: string }> = {
  DATA_CLERK:  { label: "Clerk",      color: "bg-blue-100 text-blue-800"   },
  SCREENER:    { label: "Screener",   color: "bg-green-100 text-green-800"  },
  SUPERVISOR:  { label: "Supervisor", color: "bg-orange-100 text-orange-800" },
  RESEARCHER:  { label: "Researcher", color: "bg-purple-100 text-purple-800" },
  ADMIN:       { label: "Admin",      color: "bg-red-100 text-red-800"      },
};

// §50.2 — exact items per role, in display order
export const NAV_BY_ROLE: Record<string, NavItem[]> = {
  DATA_CLERK: [
    { label: "Dashboard",          href: "/dashboard",          icon: "LayoutDashboard" },
    { label: "Register New Child", href: "/children/new",       icon: "UserPlus"        },
    { label: "Search Children",    href: "/children/search",    icon: "Search"          },
    { label: "Operational Log",    href: "/operational-logs",   icon: "ClipboardList"   },
    { label: "Correction Requests",href: "/corrections",        icon: "FilePenLine", badge: "correction_requests" },
  ],

  SCREENER: [
    { label: "Dashboard",          href: "/dashboard",          icon: "LayoutDashboard" },
    { label: "Search Children",    href: "/children/search",    icon: "Search"          },
    { label: "Correction Requests",href: "/corrections",        icon: "FilePenLine", badge: "correction_requests" },
  ],

  SUPERVISOR: [
    { label: "Dashboard",          href: "/dashboard",          icon: "LayoutDashboard" },
    { label: "Search Children",    href: "/children/search",    icon: "Search"          },
    { label: "Quality Dashboard",  href: "/quality",            icon: "BarChart2"       },
    { label: "Action-Needed List", href: "/quality/action-needed", icon: "AlertTriangle" },
    { label: "Operational Log",    href: "/operational-logs",   icon: "ClipboardList"   },
    { label: "Correction Requests",href: "/corrections",        icon: "FilePenLine", badge: "correction_requests" },
    { label: "Training Events",    href: "/admin/training",     icon: "GraduationCap"   },
    { label: "Equipment",          href: "/admin/equipment",    icon: "Stethoscope"     },
  ],

  RESEARCHER: [
    { label: "Quality Dashboard",  href: "/quality",            icon: "BarChart2"       },
    { label: "Research Exports",   href: "/exports",            icon: "Download"        },
  ],

  ADMIN: [
    { label: "Dashboard",          href: "/dashboard",          icon: "LayoutDashboard" },
    { label: "Register New Child", href: "/children/new",       icon: "UserPlus"        },
    { label: "Search Children",    href: "/children/search",    icon: "Search"          },
    { label: "Quality Dashboard",  href: "/quality",            icon: "BarChart2"       },
    { label: "Action-Needed List", href: "/quality/action-needed", icon: "AlertTriangle" },
    { label: "Operational Log",    href: "/operational-logs",   icon: "ClipboardList"   },
    { label: "Correction Requests",href: "/corrections",        icon: "FilePenLine", badge: "correction_requests" },
    { label: "Research Exports",   href: "/exports",            icon: "Download"        },
    { label: "User Management",    href: "/admin/users",        icon: "Users"           },
    { label: "Site Management",    href: "/admin/sites",        icon: "Building2"       },
    { label: "Audit Log",          href: "/admin/audit-log",    icon: "ScrollText"      },
    { label: "Paper Backup Form",  href: "/admin/paper-backup-form", icon: "FileText"  },
    { label: "Training Events",    href: "/admin/training",     icon: "GraduationCap"   },
    { label: "Equipment",          href: "/admin/equipment",    icon: "Stethoscope"     },
  ],
};