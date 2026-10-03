"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/app/Context/AuthContext";
import api from "@/app/api/api";
import {
  LayoutDashboard,
  CreditCard,
  Wrench,
  Home,
  BookOpen,
  User,
  CalendarDays,
  MessagesSquare,
  CalendarCheck,
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
    href: "/tenant/messages",
    label: "Messages",
    icon: MessagesSquare,
  },
  {
    href: "/tenant/access-notices",
    label: "Access Notices",
    icon: CalendarCheck,
  },
  {
    href: "/tenant/welcome-pack",
    label: "Welcome Pack",
    icon: BookOpen,
  },
  {
    href: "/tenant/profile",
    label: "Profile",
    icon: User,
  },
];

// How often the sidebar re-checks for unread messages and new notices.
const BADGE_POLL_MS = 30000;

export default function TenantLayout({ children }) {
  const { profile } = useAuth();
  const pathname = usePathname();

  const hasOrganization = !!profile?.organizationId;

  // Unread messages from the office, and access notices not yet acknowledged.
  const [badges, setBadges] = useState({});

  useEffect(() => {
    if (!hasOrganization) return;
    let active = true;
    const check = async () => {
      try {
        const [m, a] = await Promise.all([
          api.get("/messages/my/unread"),
          api.get("/access-notices/my/pending"),
        ]);
        if (active) {
          setBadges({
            "/tenant/messages": m.data?.count || 0,
            "/tenant/access-notices": a.data?.count || 0,
          });
        }
      } catch {
        /* a badge is a nicety — the next poll tries again */
      }
    };
    check();
    const id = setInterval(check, BADGE_POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
    // Re-checked on navigation so opening Messages clears its badge promptly.
  }, [hasOrganization, pathname]);

  const nav = (hasOrganization
    ? ALL_NAV
    : ALL_NAV.filter((item) =>
        [
          "/tenant/dashboard",
          "/tenant/onboarding",
          "/tenant/viewing",
          "/tenant/profile",
        ].includes(item.href)
      )
  ).map((item) =>
    // The page being viewed has just read its own items, so no badge there.
    badges[item.href] && pathname !== item.href ? { ...item, badge: badges[item.href] } : item
  );

  return (
    <RoleShell role="tenant" portalLabel="Tenant" nav={nav}>
      {children}
    </RoleShell>
  );
}