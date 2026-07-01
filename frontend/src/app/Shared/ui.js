"use client";

/* Shared presentational primitives for the role dashboards. */

const TONES = {
  navy: "bg-[#0F253B] text-white",
  orange: "bg-[#F47C3C] text-white",
  light: "bg-white text-[#0F253B] border border-gray-100",
};

export function StatCard({ icon: Icon, label, value, sub, tone = "light" }) {
  const iconTone = tone === "light" ? "bg-gray-50 text-[#F47C3C]" : "bg-white/15 text-white";
  const subTone = tone === "light" ? "text-gray-400" : "text-white/70";
  return (
    <div className={`rounded-2xl p-5 shadow-sm ${TONES[tone]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${tone === "light" ? "text-gray-400" : "text-white/60"}`}>
            {label}
          </p>
          <p className="text-3xl font-bold mt-2">{value}</p>
          {sub && <p className={`text-xs mt-1 font-medium ${subTone}`}>{sub}</p>}
        </div>
        {Icon && (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconTone}`}>
            <Icon size={20} />
          </div>
        )}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-end justify-between flex-wrap gap-3">
      <div>
        <h1 className="text-2xl font-bold text-[#0F253B]">{title}</h1>
        {subtitle && <p className="text-sm text-gray-400 font-medium">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ title, action, children, className = "" }) {
  return (
    <div className={`bg-white border border-gray-100 rounded-2xl p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between mb-4">
          {title && <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{title}</p>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Badge({ children, tone = "gray" }) {
  const tones = {
    gray: "bg-gray-100 text-gray-600",
    green: "bg-emerald-100 text-emerald-700",
    orange: "bg-[#F47C3C] text-white",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
  };
  return <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold capitalize ${tones[tone]}`}>{children}</span>;
}
