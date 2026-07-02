"use client";

import {
  LayoutDashboard,
  Building2,
  KeyRound,
  UserPlus,
  CalendarClock,
  ClipboardCheck,
  Wallet,
  Wrench,
  Banknote,
  BarChart3,
  Users,
  Settings,
  Search,
} from "lucide-react";
import RoleShell from "../Shared/RoleShell";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/properties", label: "Properties", icon: Building2 },
  { href: "/admin/owners", label: "Property Owners", icon: KeyRound },
  { href: "/admin/leads", label: "Leads", icon: UserPlus },
  { href: "/admin/viewings", label: "Viewings", icon: CalendarClock },
  { href: "/admin/onboarding", label: "Onboarding", icon: ClipboardCheck },
  { href: "/admin/welcome-pack", label: "Welcome Pack", icon: Wallet },
  { href: "/admin/Inspection", label: "Inspection", icon: Search},
  { href: "/admin/rent-collection", label: "Rent Collection", icon: Wallet },
  { href: "/admin/finances", label: "Finances", icon: Banknote },
  { href: "/admin/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/users", label: "Team", icon: Users },
  { href: "/admin/settings", label: "Account", icon: Settings },
];

export default function AdminLayout({ children }) {
  return (
    <RoleShell role="admin" portalLabel="Admin" nav={NAV}>
      {children}
    </RoleShell>
  );
}
