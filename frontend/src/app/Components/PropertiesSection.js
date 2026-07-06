import { ArrowRight } from 'lucide-react';
import React from 'react'
import PropertyCard from '../Shared/PropertyCard';

const PROPERTIES = [
  {
    id: 1,
    title: "Maple House HMO",
    location: "Shoreditch, London",
    price: "£750",
    period: "/room · mo",
    type: "HMO",
    tone: "orange",
    beds: 6,
    baths: 3,
    status: "3 rooms left",
    seed: "maple",
  },
  {
    id: 2,
    title: "Riverside Apartment",
    location: "Salford Quays, Manchester",
    price: "£1,450",
    period: "/mo",
    type: "Single Let",
    tone: "navy",
    beds: 2,
    baths: 1,
    status: "Available now",
    seed: "riverside",
  },
  {
    id: 3,
    title: "The Old Print Works",
    location: "Digbeth, Birmingham",
    price: "£680",
    period: "/room · mo",
    type: "HMO",
    tone: "orange",
    beds: 8,
    baths: 4,
    status: "Fully licensed",
    seed: "printworks",
  },
  {
    id: 4,
    title: "Harbour View Studio",
    location: "Leith, Edinburgh",
    price: "£995",
    period: "/mo",
    type: "Short Let",
    tone: "navy",
    beds: 1,
    baths: 1,
    status: "Available now",
    seed: "harbour",
  },
  {
    id: 5,
    title: "Kingsgate Block",
    location: "Headingley, Leeds",
    price: "£2,100",
    period: "/mo",
    type: "Block",
    tone: "navy",
    beds: 4,
    baths: 2,
    status: "2 units left",
    seed: "kingsgate",
  },
  {
    id: 6,
    title: "Willow Court HMO",
    location: "Fallowfield, Manchester",
    price: "£620",
    period: "/room · mo",
    type: "HMO",
    tone: "orange",
    beds: 5,
    baths: 2,
    status: "New listing",
    seed: "willow",
  },
];

const PropertiesSection = () => {
  return (
    <section id="properties" className="max-w-7xl mx-auto px-4 sm:px-6 py-20 md:py-24">
        <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
            <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F47C3C]">Featured</p>
                <h2 className="text-3xl md:text-4xl font-extrabold mt-2">Explore available properties</h2>
                <p className="text-gray-500 mt-2 max-w-xl">
                  A snapshot of live listings across HMO rooms, single lets and blocks.
                </p>
              </div>
              <a href="#properties" className="inline-flex items-center gap-2 text-sm font-bold text-[#0F253B] hover:text-[#F47C3C] transition">
                View all listings <ArrowRight size={16} />
              </a>
            </div>
    
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {PROPERTIES.map((p) => (
                <PropertyCard key={p.id} p={p} />
              ))}
        </div>
    </section>
  )
}

export default PropertiesSection