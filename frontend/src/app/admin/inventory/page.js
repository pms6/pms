"use client";

import { useEffect, useState } from "react";
import { Package, ClipboardList } from "lucide-react";
import InventoryBoard from "../../Components/InventoryBoard";
import InventoryReportsPanel from "../../Components/InventoryReportsPanel";
import { PageHeader } from "../../Shared/ui";

// Two views of a property's inventory, side by side:
//   Item List — the running asset list (quantity, condition, value) the
//               property and room forms edit.
//   Reports   — dated Check-In / Check-Out inventory reports, the professional
//               room-by-room document with photos, signatures and a PDF.
const TABS = [
  { key: "items", label: "Item List", icon: Package },
  { key: "reports", label: "Inventory Reports", icon: ClipboardList },
];

export default function AdminInventory() {
  const [tab, setTab] = useState("items");

  // ?tab=reports lands on the reports (the editor's back link uses it).
  // Read after mount (the server render has no URL), deferred the same way the
  // registers read ?open=.
  useEffect(() => {
    (async () => {
      if (new URLSearchParams(window.location.search).get("tab") === "reports") setTab("reports");
    })();
  }, []);

  const pick = (key) => {
    setTab(key);
    const url = key === "reports" ? `${window.location.pathname}?tab=reports` : window.location.pathname;
    window.history.replaceState(null, "", url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => pick(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                active ? "bg-[#0F253B] text-white" : "bg-white border border-gray-100 text-gray-500 hover:bg-gray-50"
              }`}
            >
              <t.icon size={14} className={active ? "text-[#F47C3C]" : "text-gray-300"} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "items" ? (
        <InventoryBoard />
      ) : (
        <div className="space-y-5">
          <PageHeader
            title="Inventory Reports"
            subtitle="Professional check-in and check-out inventories, room by room, with photos, signatures and PDF"
          />
          <InventoryReportsPanel />
        </div>
      )}
    </div>
  );
}
