"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, MapPin, DoorOpen, Building2 } from "lucide-react";
import api from "../api/api";
import PropertyCard from "../Shared/PropertyCard";
import {
  roomImage,
  formatMoney,
  RENTAL_TYPE_LABEL,
} from "../utils/listings";

/* ------------------------------------------------------------------ */
/* Available room card (for the "all available rooms" grid)            */
/* ------------------------------------------------------------------ */

function RoomCard({ room }) {
  const property = room.propertyId || {};
  const city = property?.address?.city;

  return (
    <Link
      href={`/property/${property._id || ""}`}
      className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition"
    >
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={roomImage(room)}
          alt={room.title || room.roomName}
          className="w-full h-44 object-cover group-hover:scale-105 transition duration-500"
        />
        <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-[11px] font-bold bg-[#F47C3C] text-white">
          {RENTAL_TYPE_LABEL[property.rentalType] || "Room"}
        </span>
        <span className="absolute top-3 right-3 px-3 py-1 rounded-full text-[11px] font-bold bg-white/90 text-[#0F253B]">
          {room.status === "AVAILABLE_SOON" ? "Available soon" : "Available now"}
        </span>
      </div>
      <div className="p-4">
        <p className="font-bold leading-tight">{room.title || room.roomName}</p>
        <p className="flex items-center gap-1 text-sm text-gray-400 mt-1">
          <Building2 size={13} /> {property.name}
          {city ? ` · ${city}` : ""}
        </p>
        <p className="mt-3 font-extrabold text-[#0F253B]">
          {formatMoney(room.monthlyRent)}
          <span className="text-[11px] font-medium text-gray-400">/mo</span>
        </p>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* Loading skeleton                                                    */
/* ------------------------------------------------------------------ */

function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
      <div className="h-48 bg-gray-100" />
      <div className="p-5 space-y-3">
        <div className="h-4 bg-gray-100 rounded w-2/3" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
        <div className="h-3 bg-gray-100 rounded w-1/3" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Section                                                             */
/* ------------------------------------------------------------------ */

const PropertiesSection = () => {
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [propRes, roomRes] = await Promise.all([
          api.get("/public/properties", { params: { limit: 6 } }),
          api.get("/public/rooms", { params: { limit: 6 } }),
        ]);
        if (!active) return;
        setProperties(propRes.data?.data || []);
        setRooms(roomRes.data?.data || []);
      } catch (err) {
        if (active) setError("Could not load listings right now. Please try again shortly.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section id="properties" className="max-w-7xl mx-auto px-4 sm:px-6 py-20 md:py-24">
      {/* ---------------- Properties ---------------- */}
      <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F47C3C]">Featured</p>
          <h2 className="text-3xl md:text-4xl font-extrabold mt-2">Explore available properties</h2>
          <p className="text-gray-500 mt-2 max-w-xl">
            A snapshot of live listings across HMO rooms, single lets and blocks.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-8 p-4 rounded-2xl bg-red-50 border border-red-100 text-red-700 text-sm font-semibold">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : properties.length === 0 ? (
        !error && (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-12 text-center">
            <Building2 className="mx-auto text-gray-300" size={40} />
            <p className="mt-3 font-bold text-[#0F253B]">No live listings yet</p>
            <p className="text-sm text-gray-400 mt-1">
              New properties will appear here as operators publish them.
            </p>
          </div>
        )
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((p) => (
            <PropertyCard key={p._id} p={p} />
          ))}
        </div>
      )}

      {/* ---------------- Available rooms ---------------- */}
      {(loading || rooms.length > 0) && (
        <>
          <div className="flex items-end justify-between flex-wrap gap-4 mt-20 mb-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F47C3C]">Rooms</p>
              <h2 className="text-3xl md:text-4xl font-extrabold mt-2 flex items-center gap-2">
                <DoorOpen className="text-[#F47C3C]" /> All available rooms
              </h2>
              <p className="text-gray-500 mt-2 max-w-xl">
                Move-in ready rooms across our HMO house shares and co-living spaces.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {rooms.map((r) => (
                <RoomCard key={r._id} room={r} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default PropertiesSection;
