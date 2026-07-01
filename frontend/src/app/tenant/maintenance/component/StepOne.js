"use client";

import { useState } from "react";

const categories = [
  { id: "bathroom", label: "Bathroom and Toilet", icon: "🚿" },
  { id: "kitchen", label: "Kitchen", icon: "🍳" },
  { id: "heating", label: "Heating and Boiler", icon: "🔥" },
  { id: "water", label: "Water and Leaks", icon: "💧" },
  { id: "doors", label: "Doors, Garages and Locks", icon: "🚪" },
  { id: "floors", label: "Internal Floors, Walls and Ceilings", icon: "🧱" },

  { id: "lighting", label: "Lighting", icon: "💡" },
  { id: "window", label: "Window", icon: "🖼️" },
  { id: "garden", label: "Exterior and Garden", icon: "🌿" },
  { id: "laundry", label: "Laundry", icon: "🧺" },
  { id: "furniture", label: "Furniture", icon: "🪑" },
  { id: "electricity", label: "Electricity", icon: "⚡" },

  { id: "internet", label: "Internet", icon: "📶" },
  { id: "alarm", label: "Alarms and Smoke Detectors", icon: "🔔" },
  { id: "pests", label: "Pests/Vermin", icon: "🐀" },
  { id: "roof", label: "Roof", icon: "🏠" },
  { id: "shared", label: "Communal/Shared Facilities", icon: "🏢" },
  { id: "meters", label: "Utility Meters", icon: "📊" },

  { id: "stairs", label: "Stairs", icon: "目" },
  { id: "services", label: "Property Services", icon: "🏡" },
  { id: "gas", label: "Smell Gas?", icon: "⚠️" },
  { id: "oil", label: "Smell Oil?", icon: "🛢️" },
  { id: "fire", label: "Fire", icon: "🧯" },
  { id: "other", label: "Other", icon: "❓" },
];

export default function StepOne({ formData, setFormData, onNext }) {
  const [search, setSearch] = useState("");

  const filteredCategories = categories.filter((cat) =>
    cat.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      
      {/* Title */}
      <h2 className="hidden md:block text-lg font-bold font-sans text-[#0F253B] mb-1">
        What is the problem?
      </h2>

      <p className="hidden md:block text-[#6B7280] text-sm md:mb-6">
        Please select the relevant category below
      </p>

      {/* Search */}
      <div className="mb-6 md:mb-8 relative">
  
        {/* Search Icon */}
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
          🔍
        </span>

        {/* Input */}
        <input
          type="text"
          placeholder="Search your problem..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-[#E8E4DF] rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
        />

      </div>

      <p className="md:hidden text-xs font-semibold uppercase font-sans text-[#6B7280] mb-3 tracking-wide">
        SELECT A CATEGORY
      </p>

      {/* Categories Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-4 mb-8 md:mb-10">
        {filteredCategories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() =>
              setFormData((prev) => ({
                ...prev,
                category: cat.label,
              }))
            }
            className={`h-23.75 p-3 rounded-xl md:rounded-[14px] border flex flex-col items-center justify-center gap-2 text-center transition
            ${
              formData.category === cat.label
                ? "border-[#F47C3C] bg-[#F47C3C0F]"
                : "border-[#E8E4DF] hover:border-orange-300"
            }`}
          >
            <span className="text-2xl">{cat.icon}</span>

            <span className="text-xs font-medium font-sans text-[#0F253B] leading-tight">
              {cat.label}
            </span>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between md:pt-6 md:border-t border-t-[#E8E4DF]">
  
        <p className="text-[13px] font-sans text-[#6B7280] hidden md:block">
          {formData.category
            ? `Selected: ${formData.category}`
            : "No category selected"}
        </p>

        <button
          disabled={!formData.category}
          onClick={onNext}
          className="w-full md:w-[212px] h-[46px] py-[13px] px-[28px] bg-[#F47C3C] hover:bg-[#e85e2f] text-white text-sm font-semibold rounded-[10px] shadow-[0_6px_20px_#FF6B354D] transition disabled:opacity-40 disabled:shadow-none flex items-center justify-center"
        >
          NEXT: ADD DETAILS
          <svg 
            width="14" 
            height="14" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="3" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="ml-1"
          >
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>

      </div>
    </div>
  );
}