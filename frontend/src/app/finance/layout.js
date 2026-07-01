"use client";

import { LayoutDashboard, FileText, CreditCard, ShieldCheck, Receipt, BarChart3 } from "lucide-react";
import RoleShell from "../Shared/RoleShell";

const NAV = [
  { href: "/finance/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/finance/invoices", label: "Invoices", icon: FileText },
  { href: "/finance/payments", label: "Payments", icon: CreditCard },
  { href: "/finance/deposits", label: "Deposits", icon: ShieldCheck },
  { href: "/finance/statements", label: "Statements", icon: Receipt },
  { href: "/finance/reports", label: "Reports", icon: BarChart3 },
];

export default function FinanceLayout({ children }) {
  return (
    <RoleShell role="finance" portalLabel="Finance" nav={NAV}>
      {children}
    </RoleShell>
  );
}
