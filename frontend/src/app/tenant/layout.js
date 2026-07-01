"use client";

import { LayoutDashboard, CreditCard, Wrench, Home, ShieldCheck, BookOpen, Users, User } from "lucide-react";
import RoleShell from "../Shared/RoleShell";

const NAV = [
  {
    href: "/tenant/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/tenant/room",
    label: "Room",
    icon: Home,
  },
  {
    href: "/tenant/payments",
    label: "Rent & Payments",
    icon: CreditCard,
  },
  {
    href: "/tenant/maintenance",
    label: "Maintenance",
    icon: Wrench,
  },
  {
    href: "/tenant/compliance",
    label: "Compliance",
    icon: ShieldCheck,
  },
  {
    href: "/tenant/welcome-pack",
    label: "Welcome Pack",
    icon: BookOpen,
  },
  {
    href: "/tenant/housemates",
    label: "Housemates",
    icon: Users,
  },
  {
    href: "/tenant/profile",
    label: "Profile",
    icon: User,
  },
];

export default function TenantLayout({ children }) {
  return (
    <RoleShell role="tenant" portalLabel="Tenant" nav={NAV}>
      {children}
    </RoleShell>
  );
}
