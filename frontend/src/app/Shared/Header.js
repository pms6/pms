"use client"
import { Building2, ChevronDown, LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useRef, useState, useEffect } from 'react'
import { useAuth } from '../Context/AuthContext';

const Header = () => {

    const [open, setOpen] = useState(false);
    const { user, profile, loading, logout } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        await logout();
        setOpen(false);
        router.push("/");
    };

    const dashboardPath =
        user?.role === "organization"
            ? "/admin/dashboard"
            : "/tenant/dashboard";

    /* ------------------------------------------------------------------ */
    /* Auth: avatar + signed-in user menu                                  */
    /* ------------------------------------------------------------------ */
    
    function Avatar({ user, profile, size = 36 }) {
      const url = profile?.profileImage;
      const initial = (user?.name || user?.email || "?").charAt(0).toUpperCase();
      if (url) {
        // eslint-disable-next-line @next/next/no-img-element
        return (
          <img
            src={url}
            alt={user?.name || "Profile"}
            style={{ width: size, height: size }}
            className="rounded-full object-cover border border-gray-200 shrink-0"
          />
        );
      }
      return (
        <div
          style={{ width: size, height: size }}
          className="rounded-full bg-[#0F253B] text-white flex items-center justify-center font-bold shrink-0"
        >
          {initial}
        </div>
      );
    }

    function UserMenu({ user, profile, onLogout }) {
        const [menuOpen, setMenuOpen] = useState(false);
        const ref = useRef(null);

        // Close on outside click.
        useEffect(() => {
            const onClick = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false);
            };
            document.addEventListener("mousedown", onClick);
            return () => document.removeEventListener("mousedown", onClick);
        }, []);

        return (
            <div className="relative" ref={ref}>
            <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full border border-gray-200 hover:bg-gray-50 transition"
            >
                <Avatar user={user} profile={profile} size={32} />
                <span className="text-sm font-bold text-[#0F253B] max-w-[140px] truncate">
                {user.name || "My account"}
                </span>
                <ChevronDown size={16} className={`text-gray-400 transition ${menuOpen ? "rotate-180" : ""}`} />
            </button>

            {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-bold text-[#0F253B] truncate">{user.name || "My account"}</p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
                <Link
                    href={dashboardPath}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-[#0F253B] hover:bg-gray-50"
                >
                    <LayoutDashboard size={16} />
                    Dashboard
                </Link>
                <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition"
                >
                    <LogOut size={16} /> Sign out
                </button>
                </div>
            )}
            </div>
        );
    }


    const NAV = [
    { label: "Home", href: "#home" },
    { label: "Properties", href: "#properties" },
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Contact", href: "#contact" },
    ];

  return (
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="#home" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#F47C3C] flex items-center justify-center text-white">
              <Building2 size={18} />
            </div>
            <div className="leading-tight">
              <p className="font-extrabold text-lg tracking-tight">PMS</p>
              <p className="text-[9px] uppercase tracking-[0.2em] text-gray-400 -mt-0.5">Property Suite</p>
            </div>
          </Link>

          {/* Desktop nav — 5 sections */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-[#0F253B] hover:bg-gray-50 transition"
              >
                {n.label}
              </a>
            ))}
          </nav>

          {/* Auth actions */}
          <div className="hidden md:flex items-center gap-2">
            {loading ? null : user ? (
              <UserMenu user={user} profile={profile} onLogout={handleLogout} />
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-[#0F253B] hover:bg-gray-50 transition"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-[#F47C3C] hover:brightness-105 shadow-sm shadow-[#F47C3C]/30 transition"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button className="md:hidden p-2" onClick={() => setOpen((v) => !v)} aria-label="Menu">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                {n.label}
              </a>
            ))}
            {user ? (
              <div className="pt-2 space-y-2">
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-50">
                  <Avatar user={user} profile={profile} size={38} />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#0F253B] truncate">{user.name || "My account"}</p>
                    <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
                  </div>
                </div>
                <Link
                    href={
                    user?.role === "organization"
                        ? "/admin/dashboard"
                        : "/tenant/dashboard"
                    }
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-semibold text-[#0F253B] hover:bg-gray-50 transition"
                    onClick={() => setMenuOpen(false)}
                >
                    <LayoutDashboard size={16} />
                    Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            ) : (
              <div className="flex gap-2 pt-2">
                <Link href="/login" onClick={() => setOpen(false)} className="flex-1 text-center px-4 py-2.5 rounded-lg text-sm font-semibold border border-gray-200">
                  Log in
                </Link>
                <Link href="/signup" onClick={() => setOpen(false)} className="flex-1 text-center px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-[#F47C3C]">
                  Sign up
                </Link>
              </div>
            )}
          </div>
        )}
      </header>
  )
}

export default Header
