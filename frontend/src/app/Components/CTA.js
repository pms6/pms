import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

const CTA = () => {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-[#F47C3C] px-8 py-14 md:px-16 md:py-16 text-white">
          <div className="pointer-events-none absolute -top-16 -right-10 w-72 h-72 rounded-full bg-white/15 blur-2xl" />
          <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold">Ready to simplify your lettings?</h2>
              <p className="mt-2 text-white/85 max-w-lg">
                Join thousands of landlords and agents managing their portfolios with PMS.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white text-[#0F253B] font-bold hover:bg-gray-50 shadow-lg transition whitespace-nowrap"
            >
              Create your account <ArrowRight size={18} />
            </Link>
          </div>
        </div>
    </section>
  )
}

export default CTA
