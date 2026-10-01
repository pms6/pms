"use client";

import { useState } from "react";
import { ClipboardList, Receipt, ChevronDown } from "lucide-react";
import InventoryReportsPanel from "./InventoryReportsPanel";
import InvoicesBoard from "../Shared/InvoicesBoard";

// A property's inventory reports and invoices, on its detail page. Collapsed
// until opened so the page does not make these requests for every visit.
export default function PropertyRecordsSection({ propertyId }) {
  const [tab, setTab] = useState(null);

  const tabs = [
    { key: "inventory", label: "Inventory reports", icon: ClipboardList },
    { key: "invoices", label: "Invoices", icon: Receipt },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-lg font-bold text-[#0F253B] mr-2">Records</h2>
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(active ? null : t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                active ? "bg-[#0F253B] text-white" : "bg-white border border-gray-100 text-gray-500 hover:bg-gray-50"
              }`}
            >
              <t.icon size={14} className={active ? "text-[#F47C3C]" : "text-gray-300"} />
              {t.label}
              <ChevronDown size={13} className={active ? "rotate-180" : ""} />
            </button>
          );
        })}
      </div>
      {tab === "inventory" && <InventoryReportsPanel propertyId={propertyId} />}
      {tab === "invoices" && <InvoicesBoard propertyId={propertyId} compact preset={{ propertyId }} />}
    </div>
  );
}
