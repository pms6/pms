"use client";

import { useAuth } from "@/app/Context/AuthContext";
import {
  LayoutDashboard,
  CreditCard,
  Wrench,
  Home,
  ShieldCheck,
  BookOpen,
  Users,
  User,
  CalendarDays,
} from "lucide-react";
import RoleShell from "../Shared/RoleShell";

const ALL_NAV = [
  {
    href: "/tenant/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/tenant/onboarding",
    label: "Onboarding",
    icon: CreditCard,
  },
  {
    href: "/tenant/viewing",
    label: "Viewings",
    icon: CalendarDays,
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
  const { profile } = useAuth();

  const hasOrganization = !!profile?.organizationId;

  const nav = hasOrganization
    ? ALL_NAV
    : ALL_NAV.filter((item) =>
        [
          "/tenant/dashboard",
          "/tenant/onboarding",
          "/tenant/viewing",
          "/tenant/profile",
        ].includes(item.href)
      );

  return (
    <RoleShell role="tenant" portalLabel="Tenant" nav={nav}>
      {children}
    </RoleShell>
  );
}