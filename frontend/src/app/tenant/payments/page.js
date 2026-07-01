"use client";

import React, { useState } from "react";
import {
  Wallet,
  FileText,
  CheckCircle,
  AlertCircle,
  Clock,
} from "lucide-react";

const RENT_HISTORY = [
  { id: 1, date: "Jan 1, 2027", title: "Rent (1 Jan)", status: "Upcoming", amount: "£630.00", balance: "—" },
  { id: 2, date: "Dec 1, 2026", title: "Rent (1 Dec)", status: "Due", amount: "£675.00", balance: "—" },
  { id: 3, date: "Nov 1, 2026", title: "Rent (1 Nov)", status: "Paid", amount: "£675.00", balance: "£0.00" },
  { id: 4, date: "May 3, 2026", title: "Payment", status: "Paid", amount: "-£675.00", balance: "£0.00" },
];

export default function RentPage() {
  const [selected, setSelected] = useState(null);

  const StatusIcon = ({ status }) => {
    if (status === "Paid")
      return <CheckCircle className="text-emerald-500 w-4 h-4" />;
    if (status === "Due")
      return <AlertCircle className="text-rose-500 w-4 h-4" />;
    return <Clock className="text-amber-500 w-4 h-4" />;
  };

  return (
    <div className="max-w-5xl mx-auto px-0.5 sm:px-6 lg:px-8 py-6 space-y-6 bg-slate-50 min-h-screen">

      {/* HEADER */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
          Payment Dashboard
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage your rent, view payment history, and download receipts.
        </p>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: "Monthly Rent", value: "£675", icon: FileText },
          { label: "Next Due Date", value: "1 Jul 2026", icon: Clock },
          { label: "Account Balance", value: "£0.00", icon: Wallet },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-white p-4 sm:p-6 rounded-xl border border-amber-400 shadow-sm flex items-center gap-3"
          >
            <div className="p-2 sm:p-3 bg-indigo-50 rounded-lg text-indigo-600">
              <stat.icon size={18} />
            </div>
            <div>
              <p className="text-[10px] sm:text-xs text-slate-400 uppercase font-bold tracking-wider">
                {stat.label}
              </p>
              <p className="text-lg sm:text-xl font-bold text-slate-800">
                {stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* DESKTOP TABLE (hidden on mobile) */}
      <div className="hidden md:block bg-white rounded-2xl border border-amber-400 shadow-sm overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead className="bg-slate-50">
            <tr>
              {["Date", "Description", "Status", "Amount", "Balance"].map((h) => (
                <th
                  key={h}
                  className="text-left text-xs font-semibold text-slate-500 uppercase p-4"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y">
            {RENT_HISTORY.map((item) => (
              <tr
                key={item.id}
                onClick={() => setSelected(item)}
                className="hover:bg-indigo-50 cursor-pointer"
              >
                <td className="p-4">{item.date}</td>
                <td className="p-4">{item.title}</td>
                <td className="p-4 flex items-center gap-2">
                  <StatusIcon status={item.status} />
                  {item.status}
                </td>
                <td className="p-4 font-semibold">{item.amount}</td>
                <td className="p-4 text-slate-500">{item.balance}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MOBILE CARDS (better UX) */}
      <div className="md:hidden space-y-3">
        {RENT_HISTORY.map((item) => (
          <div
            key={item.id}
            onClick={() => setSelected(item)}
            className="bg-white p-4 rounded-xl border border-amber-400 shadow-sm"
          >
            <div className="flex justify-between items-center">
              <p className="font-semibold text-slate-800">{item.title}</p>
              <span className="flex items-center gap-1 text-sm">
                <StatusIcon status={item.status} />
                {item.status}
              </span>
            </div>

            <div className="mt-2 text-sm text-slate-500">
              <p>Date: {item.date}</p>
              <p>Amount: {item.amount}</p>
              <p>Balance: {item.balance}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}