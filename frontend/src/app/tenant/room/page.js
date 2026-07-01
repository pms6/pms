import React from "react";
import { FileText, Home, User, AlertCircle, MessageSquare } from "lucide-react";

const Page = () => {
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

        {/* Main Card */}
        <main className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-10 shadow-sm space-y-8">

          {/* Room Summary (mobile-first stack) */}
          <section className="space-y-3 sm:flex sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                Room 2
              </h2>
              <p className="text-slate-500 text-sm sm:text-base font-medium mt-1">
                £675 / month (Bills included)
              </p>
            </div>

            <span className="inline-flex w-fit px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider rounded-full border border-emerald-200">
              Active Tenancy
            </span>
          </section>

          {/* Tenancy Period */}
          <section className="bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-100">
            <h4 className="text-sm font-semibold text-slate-900 mb-2">
              Tenancy Period
            </h4>
            <p className="text-sm text-slate-600 leading-relaxed">
              Fixed term: <b>Feb 17, 2026</b> – <b>Feb 16, 2027</b>.
              <br />
              The tenancy continues on a periodic basis thereafter.
            </p>
          </section>

          {/* Documents */}
          <section className="space-y-3">
            <h3 className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-widest">
              Documents
            </h3>

            <div className="grid gap-3">
              {[
                { name: "Tenancy Agreement", file: "tenancy-agreement.pdf" },
                { name: "Deposit Information", file: "deposit-information.pdf" }
              ].map((doc, i) => (
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
                    <button className="text-sm font-semibold text-orange-600 hover:text-orange-700">
                      View
                    </button>
                    <button className="text-sm font-semibold text-slate-900 hover:text-slate-600">
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Footer / Actions */}
          <section className="border-t border-slate-100 pt-6 space-y-6 sm:space-y-0 sm:flex sm:items-center sm:justify-between">

            {/* Manager */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                <User className="text-slate-500" />
              </div>

              <div>
                <p className="font-bold text-slate-900">
                  Dahlia Properties
                </p>
                <p className="text-xs text-slate-500">
                  Property Management Team
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-1 sm:flex gap-3 w-full sm:w-auto">
              <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-semibold text-slate-700 transition">
                <MessageSquare className="w-4 h-4" />
                Feedback
              </button>

              <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-sm font-semibold shadow-md transition">
                <AlertCircle className="w-4 h-4" />
                Report Issue
              </button>
            </div>
          </section>

        </main>
      </div>
    </div>
  );
};

export default Page;