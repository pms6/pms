"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Building2, X, Menu } from "lucide-react";
import { useAuth } from "../Context/AuthContext";
import { getEffectiveRole, dashboardPathFor } from "../utils/roles";

export default function RoleShell({
  role,
  portalLabel,
  // A flat list of { href, label, icon }.
  nav = [],
  // Rendered in the top bar, left of the user chip. The agent portal puts its
  // live-location switch here so it is reachable from every page rather than
  // buried on one.
  headerExtra = null,
  children,
}) {
  const { user, profile, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Role guard — compares the user's EFFECTIVE role (which accounts for the
  // organization team sub-role) against the area this shell protects.
  const effectiveRole = getEffectiveRole(user);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace("/");
    } else if (effectiveRole !== role) {
      router.replace(dashboardPathFor(user));
    }
  }, [loading, user, role, effectiveRole, router]);

  const handleLogout = async () => {
    await logout();
    router.replace("/");
  };

  if (loading || !user || effectiveRole !== role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-8 h-8 border-2 border-[#F47C3C]/30 border-t-[#F47C3C] rounded-full animate-spin" />
      </div>
    );
  }

  const navLink = ({ href, label, icon: Icon }) => {
    const active = pathname === href || pathname.startsWith(href + "/");

    return (
      <Link
        key={href}
        href={href}
        onClick={() => setIsOpen(false)}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition ${
          active
            ? "bg-[#F47C3C] text-white"
            : "text-white/60 hover:text-white hover:bg-white/5"
        }`}
      >
        <Icon size={18} />
        {label}
      </Link>
    );
  };

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="px-6 py-6 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#F47C3C] flex items-center justify-center">
            <Building2 size={18} />
          </div>
          <div>
            <p className="font-bold leading-tight">PMS</p>
            <p className="text-[10px] uppercase tracking-widest text-white/40">
              {portalLabel}
            </p>
          </div>
        </div>

        {/* close button (mobile only) */}
        <button className="md:hidden" onClick={() => setIsOpen(false)}>
          <X size={20} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-5 space-y-1">{nav.map(navLink)}</nav>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="m-3 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-white/60 hover:text-white hover:bg-white/5 transition"
      >
        <LogOut size={18} />
        Sign out
      </button>
    </>
  );

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      {/* Mobile menu button */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 "
        onClick={() => setIsOpen(true)}
      >
        <Menu size={20} />
      </button>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-[#0F253B] text-white">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0F253B] text-white transform transition-transform duration-300 md:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-10">
          

          <div className="flex-1" />

          {headerExtra && <div className="mr-3">{headerExtra}</div>}

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-[#0F253B] leading-tight">
                {user.name}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-gray-400">
                {user.organizationRole || user.role}
              </p>
            </div>

            <div className="w-9 h-9 rounded-full bg-[#0F253B] text-white flex items-center justify-center text-sm font-bold overflow-hidden">
              {profile?.profileImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.profileImage}
                  alt={user.name || "Profile"}
                  className="w-full h-full object-cover"
                />
              ) : (
                (user.name || "?").charAt(0).toUpperCase()
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}