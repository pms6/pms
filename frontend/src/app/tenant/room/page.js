"use client";

import React, { useEffect, useState } from "react";
import { FileText, Home, User, AlertCircle, MessageSquare } from "lucide-react";
import api from "@/app/api/api";

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

const fmtMoney = (n) =>
  `£${Number(n || 0).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;

const Page = () => {
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await api.get("/tenancies/my-room");
        if (active) setRoom(res.data?.data || null);
      } catch (err) {
        if (active)
          setError(err?.response?.data?.message || "Failed to load your room.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const startDate = fmtDate(room?.startDate);
  const fixedTermEnd = fmtDate(room?.fixedTermEnd);
  const periodicStart = fmtDate(room?.periodicStart);

  return (
    <div className="min-h-screen md:p-12 bg-slate-50">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <header className="flex items-center gap-3">
          <Home className="w-6 h-6 text-orange-500" />
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            My Room
          </h1>
        </header>

        {loading ? (
          <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-10 text-center text-slate-500">
            Loading your room…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
            {error}
          </div>
        ) : !room ? (
          <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-10 text-center">
            <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
              <Home size={24} className="text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">No active tenancy yet</p>
            <p className="text-sm text-slate-400 mt-1">
              Once your tenancy starts, your room details will appear here.
            </p>
          </div>
        ) : (
          /* Main Card */
          <main className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-10 shadow-sm space-y-8">

            {/* Room Summary */}
            <section className="space-y-3 sm:flex sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  {room.room || room.property || "Your Room"}
                </h2>
                <p className="text-slate-500 text-sm sm:text-base font-medium mt-1">
                  {fmtMoney(room.rent)} / month
                  {room.property && room.room ? ` · ${room.property}` : ""}
                </p>
              </div>

              {room.status && (
                <span className="inline-flex w-fit px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider rounded-full border border-emerald-200">
                  {room.status}
                </span>
              )}
            </section>

            {/* Tenancy Period */}
            {(startDate || fixedTermEnd || periodicStart) && (
              <section className="bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-100">
                <h4 className="text-sm font-semibold text-slate-900 mb-2">
                  Tenancy Period
                </h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {fixedTermEnd ? (
                    <>
                      Fixed term: <b>{startDate || "—"}</b> – <b>{fixedTermEnd}</b>.
                      <br />
                      The tenancy continues on a periodic basis thereafter.
                    </>
                  ) : periodicStart ? (
                    <>
                      Periodic tenancy since <b>{periodicStart}</b>.
                    </>
                  ) : (
                    <>
                      Started <b>{startDate}</b>.
                    </>
                  )}
                </p>
              </section>
            )}

            {/* Documents */}
            <section className="space-y-3">
              <h3 className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-widest">
                Documents
              </h3>

              {room.documents?.length > 0 ? (
                <div className="grid gap-3">
                  {room.documents.map((doc, i) => (
                    <div
                      key={i}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border border-slate-200 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-slate-400" />
                        <span className="text-sm font-medium text-slate-700">
                          {doc.name}
                        </span>
                      </div>

                      <div className="flex gap-3 sm:gap-4">
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-semibold text-orange-600 hover:text-orange-700"
                        >
                          View
                        </a>
                        <a
                          href={doc.url}
                          download
                          className="text-sm font-semibold text-slate-900 hover:text-slate-600"
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">
                  No documents have been shared yet.
                </p>
              )}
            </section>

            {/* Footer / Actions */}
            <section className="border-t border-slate-100 pt-6 space-y-6 sm:space-y-0 sm:flex sm:items-center sm:justify-between">

              {/* Manager */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden">
                  {room.organization?.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={room.organization.logo}
                      alt={room.organization.name || "Manager"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="text-slate-500" />
                  )}
                </div>

                <div>
                  <p className="font-bold text-slate-900">
                    {room.organization?.name || "Property Management Team"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {room.organization?.phone || "Property Management Team"}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-1 sm:flex gap-3 w-full sm:w-auto">
                <a
                  href="/tenant/welcome-pack"
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-semibold text-slate-700 transition"
                >
                  <MessageSquare className="w-4 h-4" />
                  Feedback
                </a>

                <a
                  href="/tenant/maintenance"
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-semibold shadow-md transition"
                >
                  <AlertCircle className="w-4 h-4" />
                  Report Issue
                </a>
              </div>
            </section>

          </main>
        )}
      </div>
    </div>
  );
};

export default Page;
