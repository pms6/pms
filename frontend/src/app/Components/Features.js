import { Building2, CreditCard, FileText, Shield, TrendingUp, Wrench } from 'lucide-react';
import React from 'react'

const FEATURES = [
  {
    icon: Building2,
    title: "HMO Room Management",
    desc: "Track rooms, beds, tenants and availability across your whole HMO portfolio in one place.",
  },
  {
    icon: Shield,
    title: "Compliance & Licensing",
    desc: "Never miss an EPC, Gas, EICR or HMO licence renewal with automated expiry alerts.",
  },
  {
    icon: CreditCard,
    title: "Rent & Payments",
    desc: "Collect rent, protect deposits and settle owner payouts securely with Stripe.",
  },
  {
    icon: Wrench,
    title: "Maintenance",
    desc: "Let tenants report issues with photos and route jobs straight to your trusted suppliers.",
  },
  {
    icon: FileText,
    title: "Documents & Agreements",
    desc: "Generate tenancy agreements, receipts and inventories — stored safely in the cloud.",
  },
  {
    icon: TrendingUp,
    title: "Reports & Insights",
    desc: "Live dashboards for occupancy, arrears, revenue and portfolio performance.",
  },
];

const Features = () => {
  return (
    <section id="features" className="bg-white border-y border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 md:py-24">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F47C3C]">Why PMS</p>
            <h2 className="text-3xl md:text-4xl font-extrabold mt-2">Everything you need to run lettings</h2>
            <p className="text-gray-500 mt-3">
              From the first lead to the final owner settlement — one connected platform.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-gray-100 p-6 hover:border-[#F47C3C]/40 hover:shadow-lg hover:shadow-[#F47C3C]/5 transition"
              >
                <div className="w-12 h-12 rounded-xl bg-[#0F253B] text-white flex items-center justify-center group-hover:bg-[#F47C3C] transition">
                  <f.icon size={22} />
                </div>
                <h3 className="mt-4 font-bold text-lg">{f.title}</h3>
                <p className="mt-2 text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
    </section>
  )
}

export default Features
