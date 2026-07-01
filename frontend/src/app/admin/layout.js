"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Building2,
  Home,
} from "lucide-react";
import { useAuth } from "../Context/AuthContext";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/properties", label: "Properties", icon: Home },
  { href: "/admin/users", label: "Team", icon: Users },
  { href: "/admin/settings", label: "Account", icon: Settings },
];

export default function AdminLayout({ children }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Role guard: only admins may see this section. Wait for the auth check
  // to finish (loading) before deciding, so we don't redirect prematurely.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/");
    } else if (user.role !== "admin") {
      router.replace(`/${user.role}/dashboard`);
    }
  }, [loading, user, router]);

  if (loading || !user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-8 h-8 border-2 border-[#F47C3C]/30 border-t-[#F47C3C] rounded-full animate-spin" />
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    router.replace("/");
  };

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-[#0F253B] text-white">
        <div className="px-6 py-6 flex items-center gap-3 border-b border-white/10">
          <div className="w-9 h-9 rounded-xl bg-[#F47C3C] flex items-center justify-center">
            <Building2 size={18} />
          </div>
          <div>
            <p className="font-bold leading-tight">PMS Admin</p>
            <p className="text-[10px] uppercase tracking-widest text-white/40">Portal</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  active
                    ? "bg-[#F47C3C] text-white shadow-lg shadow-orange-500/20"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={handleLogout}
          className="m-3 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-white/60 hover:text-white hover:bg-white/5 transition-all"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="md:hidden font-bold text-[#0F253B]">PMS Admin</div>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-[#0F253B] leading-tight">{user.name}</p>
              <p className="text-[10px] uppercase tracking-widest text-gray-400">{user.role}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#0F253B] text-white flex items-center justify-center text-sm font-bold">
              {(user.name || "?").charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
