"use client";

import { LayoutDashboard, CreditCard, UserPlus, CalendarClock, ShieldCheck, BarChart3, ListChecks, MapPin, FileText } from "lucide-react";
import RoleShell from "../Shared/RoleShell";
import ScreenMonitorToggle from "../Shared/ScreenMonitorToggle";

// Rent itself is still charged on Rent & Payments (a rent charge IS the
// charge raised). Invoices is for everything that is not rent — repair
// recharges, fees, deductions — to tenants and landlords.
const NAV = [
  { href: "/finance/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/finance/payments", label: "Rent & Payments", icon: CreditCard },
  { href: "/finance/invoices", label: "Invoices", icon: FileText },
  { href: "/finance/leads", label: "Leads", icon: UserPlus },
  { href: "/finance/viewings", label: "Viewings", icon: CalendarClock },
  { href: "/finance/deposits", label: "Deposits", icon: ShieldCheck },
  { href: "/finance/reports", label: "Reports", icon: BarChart3 },
  { href: "/finance/tasks", label: "My Tasks", icon: ListChecks },
  { href: "/finance/live-location", label: "Live Location", icon: MapPin },
];

export default function FinanceLayout({ children }) {
  return (
    <RoleShell
      role="finance"
      portalLabel="Finance"
      nav={NAV}
      headerExtra={<ScreenMonitorToggle />}
    >
      {children}
    </RoleShell>
  );
}
