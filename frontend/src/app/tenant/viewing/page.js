"use client"
import React, { useState } from 'react';

const Page = () => {
  // 1. Defined dummy data for each section
  const allData = {
    'Questionnaire': [{ id: 1, created: '01/07/2026', when: 'Pending', property: 'Room 2, High St' }],
    'Arranging': [{ id: 2, created: '02/07/2026', when: '09/07/2026 11:09', property: '1b Streathbourne Road , Room 6' }],
    'Scheduled': [{ id: 3, created: '03/07/2026', when: '12/07/2026 14:00', property: 'Flat 4, Main Ave' }],
    'Post-viewing': [{ id: 4, created: '28/06/2026', when: 'Completed', property: 'Studio 1, Park Road' }],
  };

  const tabs = ['Questionnaire', 'Arranging', 'Scheduled', 'Post-viewing'];
  const [activeTab, setActiveTab] = useState('Arranging');

  return (
    <div className="p-8 max-w-6xl mx-auto font-sans text-gray-800">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
        <span role="img" aria-label="search">🔍</span> My Search & Viewings
      </h1>
      
      <div className="flex gap-6 mb-6 text-sm text-gray-600 border-b pb-4">
        <div>🐷 Any budget</div>
        <div>👥 Professional or Student houseshares - Early 20s and over - Any gender</div>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <button className="bg-pink-700 text-white px-6 py-2 rounded font-semibold">View available rooms</button>
        <button className="border border-gray-300 px-6 py-2 rounded hover:bg-gray-50">Change</button>
      </div>

      {/* 3. Status Tabs - Clickable to update state */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {tabs.map((tab) => {
          const count = allData[tab].length;
          const isActive = activeTab === tab;
          return (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)}
              className={`p-4 text-white font-semibold rounded transition-colors ${isActive ? 'bg-amber-600' : 'bg-gray-600'}`}
            >
              {count} {tab}
            </button>
          );
        })}
      </div>

      {/* 4. Data Table - Displays based on activeTab state */}
      <table className="w-full text-left">
        <thead className="border-b">
          <tr className="text-gray-500 text-sm">
            <th className="pb-2">Created</th>
            <th className="pb-2">When</th>
            <th className="pb-2">Property</th>
            <th className="pb-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {allData[activeTab].map((item) => (
            <tr key={item.id} className="border-b">
              <td className="py-4">{item.created}</td>
              <td className="py-4">{item.when}</td>
              <td className="py-4">{item.property}</td>
              <td className="py-4 text-right text-blue-600 underline cursor-pointer">View</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Page;