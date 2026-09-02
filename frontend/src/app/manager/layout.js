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
  HardHat,
  Banknote,
  BarChart3,
  MessageSquare,
  ShieldCheck,
  TrendingUp,
  Users,
  Search,
  Package,
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

// The manager portal mirrors the owner's, minus four sections the owner keeps
// to themselves: Void, Maintenance, Compliance and Internet Details. Order
// follows admin/layout.js so somebody moving between the two portals finds
// things in the same place.
//
// Most of these pages are one-line re-exports of the admin screen rather than
// copies — see any manager/<section>/page.js. The API scopes every request by
// organizationId and the role guard is on RoleShell below, so sharing the
// implementation is safe and leaves one place to fix a bug.
const NAV = [
  { href: "/manager/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/manager/properties", label: "Properties", icon: Building2 },
  { href: "/manager/inventory", label: "Inventory", icon: Package },
  { href: "/manager/available", label: "Available Room", icon: CalendarClock },
  { href: "/manager/owners", label: "Property Owners", icon: KeyRound },
  { href: "/manager/leads", label: "Leads", icon: UserPlus },
  { href: "/manager/viewings", label: "Viewings", icon: CalendarClock },
  { href: "/manager/onboarding", label: "Onboarding", icon: ClipboardCheck },
  { href: "/manager/occupancy", label: "Occupancy", icon: DoorOpen },
  { href: "/manager/tenants", label: "Tenants", icon: UserRound },
  { href: "/manager/welcome-pack", label: "Welcome Pack", icon: Wallet },
  { href: "/manager/Inspection", label: "Inspection", icon: Search },
  { href: "/manager/rent-collection", label: "Rent Collection", icon: Wallet },
  { href: "/manager/rent-review", label: "Rent Review", icon: TrendingUp },
  { href: "/manager/finances", label: "Finances", icon: Banknote },
  { href: "/manager/expenses", label: "Expenses", icon: Receipt },
  { href: "/manager/deposits", label: "Deposits", icon: ShieldCheck },
  { href: "/manager/suppliers", label: "Suppliers", icon: HardHat },
  { href: "/manager/reports", label: "Reports", icon: BarChart3 },
  { href: "/manager/feedback", label: "Feedback", icon: MessageSquare },
  { href: "/manager/audit", label: "Audit Log", icon: ClipboardCheck },
  { href: "/manager/team", label: "Team", icon: Users },
  { href: "/manager/live-location", label: "Live Location", icon: MapPin },
  { href: "/manager/tasks", label: "My Tasks", icon: ListChecks },

  // The registers that replace the office spreadsheets, in the same order as
  // the owner portal.
  { href: "/manager/client-database", label: "Client Database", icon: Database },
  { href: "/manager/room-status", label: "Room Status List", icon: Table2 },
  { href: "/manager/check-in", label: "Check-in", icon: LogIn },
  { href: "/manager/reference-data", label: "Reference Data", icon: Contact },
  { href: "/manager/deposit-register", label: "Deposit", icon: PiggyBank },
  { href: "/manager/check-out", label: "Check-out", icon: LogOut },
];

export default function ManagerLayout({ children }) {
  return (
    <RoleShell role="manager" portalLabel="Manager" nav={NAV}>
      {children}
    </RoleShell>
  );
}
