import { Building2, Mail, MapPin, Phone, Users } from 'lucide-react'
import Link from 'next/link'
import React from 'react'

const Footer = () => {
  return (
    <footer id="contact" className="bg-[#0F253B] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#F47C3C] flex items-center justify-center">
                <Building2 size={18} />
              </div>
              <p className="font-extrabold text-lg">PMS</p>
            </div>
            <p className="mt-4 text-sm text-white/60 max-w-sm">
              Cloud property management software for landlords, letting agencies and HMO
              managers. Lettings, finance, compliance & maintenance — all in one.
            </p>
            <div className="mt-5 space-y-2 text-sm text-white/70">
              <p className="flex items-center gap-2"><Mail size={15} /> hello@pms.app</p>
              <p className="flex items-center gap-2"><Phone size={15} /> +44 20 7946 0000</p>
              <p className="flex items-center gap-2"><MapPin size={15} /> London, United Kingdom</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/40">Product</p>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              <li><a href="#features" className="hover:text-white">Features</a></li>
              <li><a href="#pricing" className="hover:text-white">Pricing</a></li>
              <li><a href="#properties" className="hover:text-white">Properties</a></li>
              <li><Link href="/login" className="hover:text-white">Sign in</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-white/40">Company</p>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              <li><a href="#" className="hover:text-white">About</a></li>
              <li><a href="#" className="hover:text-white">Careers</a></li>
              <li><a href="#" className="hover:text-white">Privacy</a></li>
              <li><a href="#" className="hover:text-white">Terms</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 text-xs text-white/50 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>© 2026 PMS Property Suite. All rights reserved.</p>
            <p className="flex items-center gap-1.5">
              <Users size={13} /> Trusted by 3,500+ landlords & agents
            </p>
          </div>
        </div>
    </footer>
  )
}

export default Footer
