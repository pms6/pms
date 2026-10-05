'use client';
import { useState } from 'react';
import MaintenanceForm from './MaintenanceForm';
import MyRequests from './MyRequests';

const TABS = [
  { key: 'report', label: 'Report an issue' },
  { key: 'requests', label: 'My requests' },
];

// "Report an issue" and "My requests" share the page.
export default function MaintenanceTabs({ initialTab = 'report' }) {
  const [tab, setTab] = useState(initialTab);

  return (
    <div>
      <div className="max-w-[1440px] mx-auto px-4 md:px-15 pt-4">
        <div className="inline-flex rounded-xl border border-[#E8E4DF] bg-white p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-xs md:text-sm font-bold transition
              ${tab === t.key ? 'bg-[#F47C3C] text-white' : 'text-[#6B7280] hover:text-[#0F253B]'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'report' ? (
        <MaintenanceForm onViewRequests={() => setTab('requests')} />
      ) : (
        <div className="max-w-4xl mx-auto p-4 md:px-15 md:py-6">
          <MyRequests onReport={() => setTab('report')} />
        </div>
      )}
    </div>
  );
}
