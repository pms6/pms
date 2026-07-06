import Link from "next/link";
import { ArrowRight, MapPin, Bed, Bath } from "lucide-react";

export default function PropertyCard({ p }) {
  const badge =
    p.tone === "orange"
      ? "bg-[#F47C3C] text-white"
      : "bg-[#0F253B] text-white";

  return (
    <div className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition">
      <div className="relative">
        <img
          src={`https://picsum.photos/seed/${p.seed}/800/600`}
          alt={p.title}
          className="w-full h-52 object-cover group-hover:scale-105 transition duration-500"
        />

        <span
          className={`absolute top-3 left-3 px-3 py-1 rounded-full text-[11px] font-bold ${badge}`}
        >
          {p.type}
        </span>

        <span className="absolute top-3 right-3 px-3 py-1 rounded-full text-[11px] font-bold bg-white/90 text-[#0F253B] backdrop-blur">
          {p.status}
        </span>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-lg leading-tight">{p.title}</h3>

            <p className="flex items-center gap-1 text-sm text-gray-500 mt-1">
              <MapPin size={14} />
              {p.location}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
          <span className="flex items-center gap-1.5">
            <Bed size={16} />
            {p.beds} beds
          </span>

          <span className="flex items-center gap-1.5">
            <Bath size={16} />
            {p.baths} baths
          </span>
        </div>

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
          <p className="font-extrabold text-lg text-[#0F253B]">
            {p.price}
            <span className="text-xs font-medium text-gray-400">
              {p.period}
            </span>
          </p>

          <Link
            href={`/listings/${p.id}`}
            className="inline-flex items-center gap-1 text-sm font-bold text-[#F47C3C] hover:gap-2 transition-all"
          >
            View <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}