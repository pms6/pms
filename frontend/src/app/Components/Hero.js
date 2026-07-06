import { ArrowRight, Search } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

const STATS = [
  { value: "12k+", label: "Rooms managed" },
  { value: "3.5k", label: "Landlords & agents" },
  { value: "99.9%", label: "Uptime" },
  { value: "£40m", label: "Rent collected" },
];

const Hero = () => {
    const img = (seed) => `https://picsum.photos/seed/${seed}/800/600`;
  return (
      <section id="home" className="relative overflow-hidden bg-[#0F253B] text-white">
        {/* decorative glows */}
        <div className="pointer-events-none absolute -top-32 -right-24 w-96 h-96 rounded-full bg-[#F47C3C]/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 w-96 h-96 rounded-full bg-[#F47C3C]/10 blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 md:py-28 grid lg:grid-cols-2 gap-12 items-center">
          {/* copy */}
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-xs font-semibold text-white/80 mb-6">
              <span className="w-2 h-2 rounded-full bg-[#F47C3C] animate-pulse" />
              Built for landlords, agents & HMO managers
            </span>

            <h1 className="text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-tight">
              Manage every property,
              <span className="text-[#F47C3C]"> room & tenant</span> in one place.
            </h1>

            <p className="mt-6 text-lg text-white/70 max-w-xl">
              The all-in-one property management suite with a dedicated HMO module — lettings,
              rent, compliance and maintenance, beautifully connected.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#F47C3C] text-white font-bold hover:brightness-105 shadow-lg shadow-[#F47C3C]/30 transition"
              >
                Get started free <ArrowRight size={18} />
              </Link>
              <a
                href="#properties"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/15 transition"
              >
                Browse properties
              </a>
            </div>

            {/* search bar */}
            <div className="mt-8 bg-white rounded-2xl p-2 flex items-center shadow-2xl max-w-md">
              <Search size={18} className="text-gray-400 ml-3" />
              <input
                type="text"
                placeholder="Search by city, area or postcode…"
                className="flex-1 px-3 py-2.5 text-sm outline-none bg-transparent"
              />
              <button className="px-5 py-2.5 rounded-xl bg-[#0F253B] text-white text-sm font-bold hover:brightness-125 transition">
                Search
              </button>
            </div>
          </div>

          {/* hero stats card */}
          <div className="relative">
            <div className="rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10">
              <img src={img("hero-building")} alt="Property" className="w-full h-72 md:h-96 object-cover" />
            </div>
            <div className="absolute -bottom-6 -left-4 sm:left-6 bg-white text-[#0F253B] rounded-2xl shadow-xl p-4 grid grid-cols-2 gap-4 w-[85%]">
              {STATS.map((s) => (
                <div key={s.label}>
                  <p className="text-2xl font-extrabold">{s.value}</p>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
  )
}

export default Hero
