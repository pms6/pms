import { Check, Star } from 'lucide-react';
import Link from 'next/link';
import React from 'react'

const PLANS = [
  {
    name: "Free",
    price: "£0",
    period: "/mo",
    tagline: "For getting started",
    features: ["Up to 5 units", "Tenant & lead tracking", "Basic maintenance", "Community support"],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "£29",
    period: "/mo",
    tagline: "For growing portfolios",
    features: [
      "Unlimited units",
      "HMO room management",
      "Compliance alerts",
      "Rent & deposit protection",
      "Owner settlements",
    ],
    cta: "Go Pro",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    tagline: "For agencies at scale",
    features: ["Everything in Pro", "Dedicated success manager", "Custom integrations", "SLA & priority support"],
    cta: "Talk to sales",
    highlight: false,
  },
];


const Pricing = () => {
  return (
    <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 py-20 md:py-24">
            <div className="text-center max-w-2xl mx-auto mb-14">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F47C3C]">Pricing</p>
              <h2 className="text-3xl md:text-4xl font-extrabold mt-2">Simple, transparent plans</h2>
              <p className="text-gray-500 mt-3">Start free. Upgrade as your portfolio grows.</p>
            </div>
    
            <div className="grid md:grid-cols-3 gap-6 items-stretch">
              {PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative rounded-3xl p-8 flex flex-col ${
                    plan.highlight
                      ? "bg-[#0F253B] text-white shadow-2xl md:-translate-y-3"
                      : "bg-white border border-gray-100"
                  }`}
                >
                  {plan.highlight && (
                    <span className="absolute top-6 right-6 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#F47C3C] text-white text-[11px] font-bold">
                      <Star size={12} /> Popular
                    </span>
                  )}
                  <p className={`text-sm font-bold uppercase tracking-widest ${plan.highlight ? "text-white/60" : "text-gray-400"}`}>
                    {plan.name}
                  </p>
                  <div className="mt-3 flex items-end gap-1">
                    <span className="text-4xl font-extrabold">{plan.price}</span>
                    {plan.period && (
                      <span className={`text-sm font-medium pb-1 ${plan.highlight ? "text-white/60" : "text-gray-400"}`}>
                        {plan.period}
                      </span>
                    )}
                  </div>
                  <p className={`mt-1 text-sm ${plan.highlight ? "text-white/70" : "text-gray-500"}`}>{plan.tagline}</p>
    
                  <ul className="mt-6 space-y-3 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <span
                          className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                            plan.highlight ? "bg-[#F47C3C] text-white" : "bg-[#F47C3C]/10 text-[#F47C3C]"
                          }`}
                        >
                          <Check size={12} />
                        </span>
                        <span className={plan.highlight ? "text-white/85" : "text-gray-600"}>{f}</span>
                      </li>
                    ))}
                  </ul>
    
                  <Link
                    href="/login"
                    className={`mt-8 text-center px-5 py-3 rounded-xl font-bold transition ${
                      plan.highlight
                        ? "bg-[#F47C3C] text-white hover:brightness-105"
                        : "bg-[#0F253B] text-white hover:brightness-125"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>
    </section>
  )
}

export default Pricing
