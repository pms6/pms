"use client";

import {
  LayoutDashboard,
  Building2,
  KeyRound,
  UserPlus,
  CalendarClock,
  ClipboardCheck,
  DoorOpen,
  Wallet,
  Wrench,
  HardHat,
  Banknote,
  BarChart3,
  MessageSquare,
  ShieldCheck,
  TrendingUp,
  Users,
  Settings,
  Search,
  DockIcon,
  Package,
  Wifi,
  UserRound,
  Receipt,
  ListChecks,
  MapPin,
  LogIn,
  LogOut,
  PiggyBank,
  Table2,
  Database,
  Contact,
} from "lucide-react";
import RoleShell from "../Shared/RoleShell";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/properties", label: "Properties", icon: Building2 },
  { href: "/admin/inventory", label: "Inventory", icon: Package },
  { href: "/admin/void", label: "Void", icon: CalendarClock },
  { href: "/admin/available", label: "Available Room", icon: CalendarClock },
  { href: "/admin/owners", label: "Property Owners", icon: KeyRound },
  { href: "/admin/leads", label: "Leads", icon: UserPlus },
  { href: "/admin/viewings", label: "Viewings", icon: CalendarClock },
  { href: "/admin/onboarding", label: "Onboarding", icon: ClipboardCheck },
  { href: "/admin/occupancy", label: "Occupancy", icon: DoorOpen },
  { href: "/admin/tenants", label: "Tenants", icon: UserRound },
  { href: "/admin/welcome-pack", label: "Welcome Pack", icon: Wallet },
  { href: "/admin/Inspection", label: "Inspection", icon: Search},
  { href: "/admin/compliance", label: "Compliance", icon: DockIcon},
  { href: "/admin/rent-collection", label: "Rent Collection", icon: Wallet },
  { href: "/admin/rent-review", label: "Rent Review", icon: TrendingUp },
  { href: "/admin/finances", label: "Finances", icon: Banknote },
  { href: "/admin/expenses", label: "Expenses", icon: Receipt },
  { href: "/admin/deposits", label: "Deposits", icon: ShieldCheck },
  { href: "/admin/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/admin/suppliers", label: "Suppliers", icon: HardHat },
  { href: "/admin/internet", label: "Internet Details", icon: Wifi },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/feedback", label: "Feedback", icon: MessageSquare },
  { href: "/admin/audit", label: "Audit Log", icon: ClipboardCheck },
  { href: "/admin/users", label: "Team", icon: Users },
  { href: "/admin/live-location", label: "Live Location", icon: MapPin },
  { href: "/admin/tasks", label: "Task Management", icon: ListChecks },
  { href: "/admin/settings", label: "Account", icon: Settings },

  // The registers that replace the office spreadsheets. Kept together and in
  // lifecycle order — a tenant moves in, holds a deposit, moves out — but as
  // plain entries like everything else above them.
  { href: "/admin/client-database", label: "Client Database", icon: Database },
  { href: "/admin/room-status", label: "Room Status List", icon: Table2 },
  { href: "/admin/check-in", label: "Check-in", icon: LogIn },
  { href: "/admin/reference-data", label: "Reference Data", icon: Contact },
  { href: "/admin/deposit-register", label: "Deposit", icon: PiggyBank },
  { href: "/admin/check-out", label: "Check-out", icon: LogOut },
];

export default function AdminLayout({ children }) {
  return (
    <RoleShell role="organization" portalLabel="organization" nav={NAV}>
      {children}
    </RoleShell>
  );
}
