

import React from "react";
import {
  Home,
  CalendarDays,
  PoundSterling,
  ShieldCheck,
  CheckCircle2,
  Clock3,
  Circle,
  FileText,
  CreditCard,
  History,
} from "lucide-react";

const steps = [
  {
    title: "Room reserved",
    status: "completed",
    next: "",
  },
  {
    title: "Application form",
    status: "completed",
    next: "",
  },
  {
    title: "Contract",
    status: "progress",
    next: [
      "Dahlia Properties to propose a rent schedule",
      "Dahlia Properties to propose a contract",
    ],
  },
  {
    title: "Pay the move-in monies",
    status: "progress",
    next: [
      "Dahlia Properties to propose a rent schedule",
      "Dahlia Properties to set the amount of the move-in monies",
    ],
  },
  {
    title: "Move in",
    status: "pending",
    next: [],
  },
];

const history = [
  {
    title: "Manager reviewed application form",
    date: "24/06/26 11:00",
  },
  {
    title: "Applicant completed application form",
    date: "23/06/26 15:00",
  },
  {
    title: "Manager received holding deposit",
    date: "23/06/26 14:00",
  },
  {
    title: "Applicant sent holding deposit",
    date: "22/06/26 16:30",
  },
  {
    title: "Onboarding started",
    date: "22/06/26 16:24",
  },
];

export default function Page() {
  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-5xl px-4">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">
            My Onboardings
          </h1>

          <p className="mt-2 text-slate-500">
            Track your move-in progress.
          </p>
        </div>

        {/* Property Card */}
        <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-200">

          <div className="flex flex-col gap-6 md:flex-row md:justify-between">

            <div>
              <div className="flex items-center gap-2">
                <Home className="h-5 w-5 text-indigo-600" />

                <h2 className="text-xl font-bold">
                  34 Harvington Avenue
                </h2>
              </div>

              <p className="mt-1 text-slate-500">
                Room 6
              </p>
            </div>

            <span className="inline-flex h-fit rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-700">
              Onboarding Active
            </span>

          </div>

          {/* Info */}
          <div className="mt-8 grid gap-5 md:grid-cols-3">

            <div className="rounded-2xl border p-5">
              <CalendarDays className="mb-3 h-7 w-7 text-indigo-600" />

              <p className="text-sm text-slate-500">
                Move-in Date
              </p>

              <h3 className="mt-1 font-semibold">
                Monday, July 20, 2026
              </h3>
            </div>

            <div className="rounded-2xl border p-5">
              <PoundSterling className="mb-3 h-7 w-7 text-green-600" />

              <p className="text-sm text-slate-500">
                Rent
              </p>

              <h3 className="mt-1 font-semibold">
                £665/month
              </h3>

              <p className="text-sm text-slate-400">
                Including bills
              </p>
            </div>

            <div className="rounded-2xl border p-5">
              <ShieldCheck className="mb-3 h-7 w-7 text-amber-500" />

              <p className="text-sm text-slate-500">
                Deposit
              </p>

              <h3 className="mt-1 font-semibold">
                £800
              </h3>
            </div>

          </div>
        </div>

        {/* Progress */}
        <div className="mt-8 rounded-3xl border bg-white p-6 shadow-sm">

          <h2 className="mb-8 text-xl font-bold">
            Onboarding Progress
          </h2>

          <div className="space-y-8">

            {steps.map((step, index) => (
              <div
                key={index}
                className="relative flex gap-4"
              >
                {/* Timeline */}

                <div className="flex flex-col items-center">

                  {step.status === "completed" ? (
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  ) : step.status === "progress" ? (
                    <Clock3 className="h-8 w-8 text-amber-500" />
                  ) : (
                    <Circle className="h-8 w-8 text-slate-300" />
                  )}

                  {index !== steps.length - 1 && (
                    <div className="mt-2 h-full w-px bg-slate-200"></div>
                  )}
                </div>

                {/* Content */}

                <div className="flex-1 pb-6">

                  <div className="flex flex-wrap items-center justify-between gap-3">

                    <h3 className="font-semibold text-lg">
                      {step.title}
                    </h3>

                    {step.status === "completed" && (
                      <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                        Completed
                      </span>
                    )}

                    {step.status === "progress" && (
                      <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-700">
                        In Progress
                      </span>
                    )}

                    {step.status === "pending" && (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
                        Not Started
                      </span>
                    )}
                  </div>

                  {step.next.length > 0 && (
                    <div className="mt-5 rounded-2xl bg-slate-50 p-4">

                      <div className="flex items-center gap-2 font-medium">
                        <FileText className="h-5 w-5 text-indigo-600" />
                        What happens next?
                      </div>

                      <ul className="mt-3 space-y-2 text-sm text-slate-600">

                        {step.next.map((item, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2"
                          >
                            <span className="mt-2 h-2 w-2 rounded-full bg-indigo-500"></span>

                            {item}
                          </li>
                        ))}
                      </ul>

                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* History */}

        <div className="mt-8 rounded-3xl border bg-white p-6 shadow-sm">

          <div className="mb-6 flex items-center gap-2">

            <History className="h-6 w-6 text-indigo-600" />

            <h2 className="text-xl font-bold">
              History
            </h2>

          </div>

          <div className="space-y-4">

            {history.map((item, index) => (
              <div
                key={index}
                className="flex items-start gap-4 rounded-xl border p-4 hover:bg-slate-50 transition"
              >
                <div className="rounded-full bg-indigo-100 p-2">
                  <CreditCard className="h-5 w-5 text-indigo-600" />
                </div>

                <div className="flex-1">

                  <p className="font-medium">
                    {item.title}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {item.date}
                  </p>

                </div>
              </div>
            ))}

          </div>

        </div>

      </div>
    </div>
  );
}