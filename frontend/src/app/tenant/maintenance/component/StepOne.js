"use client";

import { useState } from "react";
import { issuesFor, emergencyFor } from "./issueGuide";

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
  // The tenant tried the tips and the problem went away — nothing to report.
  const [selfFixed, setSelfFixed] = useState(false);

  const issues = issuesFor(formData.categoryId);
  const issue = issues.find((i) => i.label === formData.issue) || null;
  const emergency = formData.categoryId ? emergencyFor(formData.categoryId, issue) : null;
  // "Other" has nothing to choose between, so it needs no issue picked.
  const needsIssue = issues.length > 1;
  const ready = !!formData.category && (!needsIssue || !!formData.issue);

  const pickCategory = (cat) => {
    const list = issuesFor(cat.id);
    setFormData((prev) => ({
      ...prev,
      category: cat.label,
      categoryId: cat.id,
      // A single choice (the emergencies, "Other") is picked for them.
      issue: list.length === 1 ? list[0].label : "",
      ...(emergencyFor(cat.id, null) ? { priority: "Urgent" } : {}),
    }));
  };

  const pickIssue = (it) =>
    setFormData((prev) => ({
      ...prev,
      issue: it.label,
      ...(emergencyFor(prev.categoryId, it) ? { priority: "Urgent" } : {}),
    }));

  if (selfFixed) {
    return (
      <div className="max-w-md mx-auto text-center bg-white border border-[#E8E4DF] rounded-2xl p-8 shadow-sm">
        <span className="text-4xl">🎉</span>
        <h2 className="mt-3 text-xl font-bold text-[#0F253B]">Glad that&apos;s sorted</h2>
        <p className="mt-2 text-sm text-[#6B7280]">
          Nothing has been reported. If the problem comes back, you can report it at any time.
        </p>
        <button
          type="button"
          onClick={() => {
            setSelfFixed(false);
            setFormData((prev) => ({ ...prev, category: "", categoryId: "", issue: "" }));
          }}
          className="mt-6 w-full py-3 bg-[#F47C3C] hover:bg-[#e85e2f] text-white font-bold rounded-xl transition"
        >
          Report a different problem
        </button>
      </div>
    );
  }

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
            onClick={() => pickCategory(cat)}
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

      {/* The specific problem, then tips or an emergency warning */}
      {formData.category && (
        <div className="mb-8 md:mb-10 space-y-5">
          {emergency && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="text-sm font-bold text-red-700">⚠️ {emergency.title}</p>
              <ol className="mt-3 space-y-1.5 list-decimal list-inside text-sm text-red-700">
                {emergency.steps.map((step) => <li key={step}>{step}</li>)}
              </ol>
            </div>
          )}

          {needsIssue && (
            <div>
              <h3 className="text-sm font-bold text-[#0F253B] mb-3">
                {formData.category}: which best describes it?
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {issues.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => pickIssue(it)}
                    className={`text-left px-4 py-3 rounded-xl border text-sm font-medium transition
                    ${formData.issue === it.label
                      ? "border-[#F47C3C] bg-[#F47C3C0F] text-[#0F253B]"
                      : "border-[#E8E4DF] text-[#0F253B] hover:border-orange-300"}`}
                  >
                    {it.emergency && <span className="mr-1">⚠️</span>}
                    {it.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!emergency && issue?.tips?.length > 0 && (
            <div className="rounded-2xl border border-[#FDEEE3] bg-[#FFF9F5] p-5">
              <p className="text-sm font-bold text-[#0F253B]">💡 Before you report it, try these</p>
              <ul className="mt-3 space-y-1.5 list-disc list-inside text-sm text-[#475569]">
                {issue.tips.map((tip) => <li key={tip}>{tip}</li>)}
              </ul>
              <button
                type="button"
                onClick={() => setSelfFixed(true)}
                className="mt-4 px-4 py-2.5 rounded-xl border border-green-200 bg-white text-green-700 text-xs font-bold hover:bg-green-50 transition"
              >
                ✓ That fixed it, no need to report
              </button>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between md:pt-6 md:border-t border-t-[#E8E4DF]">
  
        <p className="text-[13px] font-sans text-[#6B7280] hidden md:block">
          {formData.category
            ? `Selected: ${[formData.category, formData.issue].filter(Boolean).join(" — ")}`
            : "No category selected"}
        </p>

        <button
          disabled={!ready}
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