"use client";

import { LayoutDashboard, CreditCard, UserPlus, CalendarClock, ShieldCheck, BarChart3, ListChecks, MapPin } from "lucide-react";
import RoleShell from "../Shared/RoleShell";

// Invoices and Statements were removed rather than stubbed: this system has no
// Invoice model — a rent charge IS the charge raised, and it lives on the Rent
// & Payments page — and no owner-statement concept exists at all. Both linked
// to pages that were never built, so every item here now resolves.
const NAV = [
  { href: "/finance/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/finance/payments", label: "Rent & Payments", icon: CreditCard },
  { href: "/finance/leads", label: "Leads", icon: UserPlus },
  { href: "/finance/viewings", label: "Viewings", icon: CalendarClock },
  { href: "/finance/deposits", label: "Deposits", icon: ShieldCheck },
  { href: "/finance/reports", label: "Reports", icon: BarChart3 },
  { href: "/finance/tasks", label: "My Tasks", icon: ListChecks },
  { href: "/finance/live-location", label: "Live Location", icon: MapPin },
];

export default function FinanceLayout({ children }) {
  return (
    <RoleShell role="finance" portalLabel="Finance" nav={NAV}>
      {children}
    </RoleShell>
  );
}
