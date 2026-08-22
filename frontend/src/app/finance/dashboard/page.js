"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  PoundSterling, AlertCircle, ShieldCheck, Wallet, Clock, ArrowRight,
  TrendingDown, Scale, ShieldAlert,
} from "lucide-react";
import { StatCard, PageHeader, Card, Badge } from "../../Shared/ui";
import api from "../../api/api";

const STATUS_TONE = {
  paid: "green",
  due: "amber",
  overdue: "red",
  upcoming: "gray",
  awaiting_confirmation: "blue",
};

const STATUS_LABEL = {
  paid: "paid",
  due: "due",
  overdue: "overdue",
  upcoming: "upcoming",
  awaiting_confirmation: "awaiting",
};

const money = (n) =>
  `£${Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Compact form for the headline tiles: £38.4k rather than £38,400.00.
const moneyShort = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1000) return `£${(v / 1000).toFixed(1)}k`;
  return `£${v.toFixed(0)}`;
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

// "2026-08" -> "Aug"
const shortMonth = (key) => {
  if (!key) return "";
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return Number.isNaN(d.getTime()) ? key : d.toLocaleDateString("en-GB", { month: "short" });
};

const currentPeriodKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * Finance dashboard — the real ledger, not a sample.
 *
 * Reads the same three endpoints the rest of the portal uses: the rent ledger
 * (GET /payments) for collection, the deposit register (GET /payments/deposits)
 * for what is held and protected, and the expense sheet for costs. Nothing here
 * is computed differently from the pages it links to, so the numbers agree.
 */
export default function FinanceDashboard() {
  const [ledger, setLedger] = useState(null);
  const [deposits, setDeposits] = useState(null);
  const [expenses, setExpenses] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [payRes, depRes, expRes] = await Promise.all([
        api.get("/payments"),
        api.get("/payments/deposits"),
        api.get("/expenses/monthly", { params: { year: new Date().getFullYear() } }),
      ]);
      setLedger(payRes.data || null);
      setDeposits(depRes.data || null);
      setExpenses(expRes.data || null);
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load finance data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => { await loadData(); })();
  }, [loadData]);

  const summary = ledger?.summary;
  const byMonth = ledger?.byMonth || [];
  const charges = ledger?.data || [];
  const depSummary = deposits?.summary;

  // Month to date, from the same series the Payments page charts.
  const thisMonth = byMonth.find((m) => m.periodKey === currentPeriodKey());
  const mtdCollected = thisMonth?.collected || 0;
  const mtdBilled = thisMonth?.billed || 0;
  const mtdRate = mtdBilled ? Math.round((mtdCollected / mtdBilled) * 100) : 0;

  // Last six billing periods for the revenue chart.
  const revenue = byMonth.slice(-6);
  const maxRevenue = Math.max(1, ...revenue.map((r) => r.billed));

  // Anything a person still has to act on, newest first.
  const needsAction = charges
    .filter((c) => c.status === "awaiting_confirmation" || c.status === "overdue")
    .sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate))
    .slice(0, 5);

  const recent = charges.slice(0, 5);

  const expenseTotal = expenses?.total || 0;
  const net = (summary?.collected || 0) - expenseTotal;

  const unprotectedCount =
    (depSummary?.byStatus?.not_started || 0) +
    (depSummary?.byStatus?.pending || 0) +
    (depSummary?.byStatus?.failed || 0);

  const dash = loading ? "—" : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Finance Dashboard" subtitle="Rent, deposits and settlements" />

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={PoundSterling}
          label="Collected (MTD)"
          value={dash ?? moneyShort(mtdCollected)}
          sub={loading ? "" : mtdBilled ? `${mtdRate}% of ${moneyShort(mtdBilled)} due` : "nothing billed this month"}
          tone="navy"
        />
        <StatCard
          icon={AlertCircle}
          label="Outstanding"
          value={dash ?? moneyShort(summary?.outstanding)}
          sub={loading ? "" : `${(summary?.total || 0) - (summary?.byStatus?.paid || 0)} charges`}
          tone="orange"
        />
        <StatCard
          icon={Wallet}
          label="Overdue"
          value={dash ?? moneyShort(summary?.overdue)}
          sub={loading ? "" : `${summary?.byStatus?.overdue || 0} charges`}
        />
        <StatCard
          icon={ShieldCheck}
          label="Deposits protected"
          value={dash ?? moneyShort(depSummary?.protected)}
          sub={loading ? "" : `of ${moneyShort(depSummary?.total)} across ${depSummary?.count || 0} tenancies`}
        />
      </div>

      {/* Things a person still has to do */}
      {!loading && (summary?.byStatus?.awaiting_confirmation > 0 || unprotectedCount > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {summary?.byStatus?.awaiting_confirmation > 0 && (
            <Link
              href="/finance/payments"
              className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 hover:bg-blue-100 transition-all"
            >
              <Clock size={18} className="text-blue-600 shrink-0" />
              <span className="flex-1 text-sm font-medium text-blue-900">
                <strong>{summary.byStatus.awaiting_confirmation}</strong> payment
                {summary.byStatus.awaiting_confirmation === 1 ? "" : "s"} awaiting your confirmation
                {" · "}{money(summary.awaiting)}
              </span>
              <ArrowRight size={16} className="text-blue-600 shrink-0" />
            </Link>
          )}
          {unprotectedCount > 0 && (
            <Link
              href="/finance/deposits"
              className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 hover:bg-amber-100 transition-all"
            >
              <ShieldAlert size={18} className="text-amber-700 shrink-0" />
              <span className="flex-1 text-sm font-medium text-amber-900">
                <strong>{money(depSummary.unprotected)}</strong> in deposits not recorded as protected
                {" · "}{unprotectedCount} tenanc{unprotectedCount === 1 ? "y" : "ies"}
              </span>
              <ArrowRight size={16} className="text-amber-700 shrink-0" />
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card
          title="Rent — billed vs collected"
          action={
            <Link href="/finance/reports" className="text-[10px] font-bold text-[#F47C3C] hover:underline">
              Reports
            </Link>
          }
        >
          {loading ? (
            <div className="h-40 flex items-center justify-center text-sm text-gray-400 font-medium">
              Loading…
            </div>
          ) : revenue.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-sm text-gray-400 font-medium">
              No rent charges raised yet.
            </div>
          ) : (
            <>
              <div className="flex items-end gap-3 h-40 pt-2">
                {revenue.map((r) => (
                  <div key={r.periodKey} className="flex-1 flex flex-col items-center gap-2 min-w-0">
                    <div className="w-full h-full bg-gray-100 rounded-lg relative overflow-hidden">
                      <div
                        className="w-full bg-gray-200 rounded-lg absolute bottom-0"
                        style={{ height: `${(r.billed / maxRevenue) * 100}%` }}
                        title={`Billed ${money(r.billed)}`}
                      />
                      <div
                        className="w-full bg-[#F47C3C] rounded-lg absolute bottom-0"
                        style={{ height: `${(r.collected / maxRevenue) * 100}%` }}
                        title={`Collected ${money(r.collected)}`}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-gray-400">{shortMonth(r.periodKey)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 mt-3 text-[10px] font-bold text-gray-400">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#F47C3C]" /> Collected</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-gray-200" /> Billed</span>
              </div>
            </>
          )}
        </Card>

        <Card
          title={needsAction.length ? "Needs attention" : "Recent charges"}
          action={
            <Link href="/finance/payments" className="text-[10px] font-bold text-[#F47C3C] hover:underline">
              View all
            </Link>
          }
        >
          {loading ? (
            <p className="text-sm text-gray-400 font-medium py-8 text-center">Loading…</p>
          ) : (needsAction.length ? needsAction : recent).length === 0 ? (
            <p className="text-sm text-gray-400 font-medium py-8 text-center">
              No rent charges yet. They are generated monthly from each tenancy&apos;s rent and start date.
            </p>
          ) : (
            <ul className="space-y-2">
              {(needsAction.length ? needsAction : recent).map((c) => (
                <li key={c._id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#0F253B] truncate">
                      {c.tenantEmail || "Unknown tenant"}
                    </p>
                    <p className="text-xs text-gray-400 font-medium truncate">
                      {c.property || "—"}
                      {c.room ? ` · ${c.room}` : ""}
                      {" · due "}{fmtDate(c.dueDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-bold text-[#0F253B]">{money(c.amount)}</span>
                    <Badge tone={STATUS_TONE[c.status] || "gray"}>
                      {STATUS_LABEL[c.status] || c.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Money in against money out, this calendar year */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={PoundSterling}
          label="Rent collected (all time)"
          value={dash ?? moneyShort(summary?.collected)}
          sub={loading ? "" : `${summary?.collectionRate ?? 0}% of ${moneyShort(summary?.billed)} billed`}
        />
        <StatCard
          icon={TrendingDown}
          label={`Expenses (${new Date().getFullYear()})`}
          value={dash ?? moneyShort(expenseTotal)}
          sub={loading ? "" : `${expenses?.count ?? 0} entries`}
        />
        <StatCard
          icon={Scale}
          label="Net position"
          value={dash ?? moneyShort(net)}
          sub={loading ? "" : "collected rent less expenses"}
          tone={net < 0 ? "orange" : "light"}
        />
      </div>
    </div>
  );
}
