import Link from "next/link";
import { ArrowRight, MapPin, DoorOpen, Home } from "lucide-react";
import {
  RENTAL_TYPE_LABEL,
  RENTAL_TYPE_TONE,
  isHmo,
  propertyImage,
  propertyLocation,
  availabilityLabel,
  formatMoney,
} from "../utils/listings";

// Renders a single public property listing. `p` is a real property document
// from GET /public/properties (with roomStats + minRent attached).
export default function PropertyCard({ p }) {
  const hmo = isHmo(p);
  const tone = RENTAL_TYPE_TONE[p.rentalType] || "navy";
  const badge = tone === "orange" ? "bg-[#F47C3C] text-white" : "bg-[#0F253B] text-white";
  const typeLabel = RENTAL_TYPE_LABEL[p.rentalType] || p.rentalType || "Property";
  const status = availabilityLabel(p);

  const price = p.minRent != null ? formatMoney(p.minRent) : null;
  const period = hmo ? "/room · mo" : "/mo";

  return (
    <div className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={propertyImage(p)}
          alt={p.name}
          className="w-full h-52 object-cover group-hover:scale-105 transition duration-500"
        />

        <span className={`absolute top-3 left-3 px-3 py-1 rounded-full text-[11px] font-bold ${badge}`}>
          {typeLabel}
        </span>

        {status && (
          <span className="absolute top-3 right-3 px-3 py-1 rounded-full text-[11px] font-bold bg-white/90 text-[#0F253B] backdrop-blur">
            {status}
          </span>
        )}
      </div>

      <div className="p-5">
        <h3 className="font-bold text-lg leading-tight">{p.name}</h3>
        <p className="flex items-center gap-1 text-sm text-gray-500 mt-1">
          <MapPin size={14} />
          {propertyLocation(p)}
        </p>

        <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
          {hmo ? (
            <span className="flex items-center gap-1.5">
              <DoorOpen size={16} />
              {p.roomStats?.total || 0} rooms
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Home size={16} />
              Whole property
            </span>
          )}
        </div>

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
          <p className="font-extrabold text-lg text-[#0F253B]">
            {price ? (
              <>
                {hmo && <span className="text-xs font-medium text-gray-400">from </span>}
                {price}
                <span className="text-xs font-medium text-gray-400">{period}</span>
              </>
            ) : (
              <span className="text-sm font-semibold text-gray-400">Enquire for price</span>
            )}
          </p>

          <Link
            href={`/property/${p._id}`}
            className="inline-flex items-center gap-1 text-sm font-bold text-[#F47C3C] hover:gap-2 transition-all"
          >
            {hmo ? "View rooms" : "Show details"} <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}
