"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, MapPin, Search, UserRound } from "lucide-react";
import { PageHeader, Badge } from "../Shared/ui";
import { RENTAL_TYPES, img, rentalTypeLabel } from "../admin/_data/dummy";
import api from "@/app/api/api";

const typeMeta = (v) => RENTAL_TYPES.find((t) => t.v === v);
const typeTone = (v) => typeMeta(v)?.tone || "gray";

// API Service
const apiService = {
  async getProperties(params = {}) {
    try {
      const queryParams = new URLSearchParams({
        page: params.page || 1,
        limit: params.limit || 100,
        search: params.search || "",
        ...(params.rentalType && { rentalType: params.rentalType }),
        ...(params.tenantType && { tenantType: params.tenantType }),
        ...(params.status && { status: params.status }),
      });

      const response = await api.get(`/properties?${queryParams}`);
      return response.data;
    } catch (error) {
      console.error('API Error:', error);
      throw error.response?.data || error;
    }
  },

  async getPropertyById(id) {
    try {
      const response = await api.get(`/properties/${id}`);
      return response.data;
    } catch (error) {
      console.error('Get property by ID error:', error);
      throw error.response?.data || error;
    }
  }
};

/**
 * Reusable properties board — the full admin properties surface.
 * @param {string} basePath - route prefix for a property's detail page
 *                            (e.g. "/admin/properties" or "/manager/properties").
 */
export default function PropertiesBoard({ basePath = "/admin/properties" }) {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchProperties = async (search = "") => {
    try {
      setLoading(true);
      setError("");
      const response = await apiService.getProperties({ search });

      // Transform API data to match frontend format
      const transformedData = (response.data || []).map(property => ({
        id: property._id,
        name: property.name,
        addressLine1: property.address?.line1 || property.name,
        area: property.address?.area || "",
        city: property.address?.city || "",
        postcode: property.address?.postcode || "",
        image: property.coverImage || img(property.name),
        images: property.gallery || [],
        type: rentalTypeLabel(property.rentalType),
        tenantType: property.tenantType || "Any",
        owner: property.ownerName || "Unassigned",
        status: property.status?.toLowerCase() || "active",
        totalRooms: property.roomStats?.total || 0,
        occupied: property.roomStats?.occupied || 0,
        _apiData: property // Keep original data
      }));

      setItems(transformedData);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch properties on mount
  useEffect(() => {
    fetchProperties();
  }, []);

  const handleSearch = (e) => {
    const value = e.target.value;
    setQ(value);
    // Debounce search
    const timeoutId = setTimeout(() => {
      fetchProperties(value);
    }, 300);
    return () => clearTimeout(timeoutId);
  };

  const list = items.filter(
    (p) => p.name?.toLowerCase().includes(q.toLowerCase()) || (p.area || p.city || "").toLowerCase().includes(q.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader
          title="Properties"
          subtitle="Your portfolio — rooms, rent and occupancy"
          action={
            <button className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] text-white font-bold text-sm rounded-xl opacity-50 cursor-not-allowed">
              <Plus size={18} /> Add Property
            </button>
          }
        />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-[#F47C3C] border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="mt-4 text-gray-600 font-medium">Loading properties...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Properties"
        subtitle="Your portfolio — rooms, rent and occupancy"
        action={
          <Link
            href={`${basePath}/new`}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
          >
            <Plus size={18} /> Add Property
          </Link>
        }
      />

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
        <input
          value={q}
          onChange={handleSearch}
          placeholder="Search properties…"
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          <p className="font-bold">Error loading properties</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={() => fetchProperties(q)}
            className="mt-2 px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-sm font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {!error && list.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-2xl">
          <p className="text-gray-500 font-medium">No properties found</p>
          <p className="text-sm text-gray-400 mt-1">Try adjusting your search or add a new property</p>
          <Link
            href={`${basePath}/new`}
            className="inline-block mt-4 px-6 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all"
          >
            Add Your First Property
          </Link>
        </div>
      )}

      {!error && list.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {list.map((p) => {
            const occ = p.totalRooms ? Math.round((p.occupied / p.totalRooms) * 100) : 0;
            const isHMO = p.type === "HMO";
            const isSingle = p.type === "Single Let";
            return (
              <Link key={p.id} href={`${basePath}/${p.id}`} className="group bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all">
                <div className="relative h-44 bg-gradient-to-br from-[#0F253B] to-[#1c3e5e]">
                  <img src={p.image} alt={p.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  <div className="absolute top-3 left-3 flex gap-2">
                    <Badge tone={typeTone(p.type)}>{p.type}</Badge>
                    <Badge tone="gray">{p.tenantType}</Badge>
                  </div>
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                    <p className="text-white font-bold text-lg leading-tight">{p.name}</p>
                    <p className="text-white/80 text-xs flex items-center gap-1"><MapPin size={11} />{[p.area, p.city].filter(Boolean).join(", ") || "No area"}</p>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{isHMO ? "Total Rooms" : "Status"}</p>
                      <p className="text-xl font-bold text-[#0F253B]">
                        {isHMO ? `${p.totalRooms} rooms` : p.status}
                      </p>
                    </div>
                    {isHMO ? (
                      <div className="text-right">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 flex items-center gap-1 justify-end">Occupied</p>
                        <p className="text-xl font-bold text-[#0F253B]">{p.occupied}/{p.totalRooms}</p>
                      </div>
                    ) : (
                      <Badge tone={isSingle ? "gray" : "gray"}>
                        {isSingle ? "Single Let" : p.type}
                      </Badge>
                    )}
                  </div>
                  {isHMO && p.totalRooms > 0 && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                        <span className="text-gray-400 uppercase tracking-widest">Occupancy</span>
                        <span className="text-[#0F253B]">{occ}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full bg-[#F47C3C] rounded-full" style={{ width: `${occ}%` }} />
                      </div>
                    </div>
                  )}
                  {p.owner && p.owner !== "Unassigned" && (
                    <p className="text-[11px] text-gray-500 font-semibold mt-3 flex items-center gap-1.5">
                      <UserRound size={12} className="text-[#F47C3C]" />
                      {p.owner}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
