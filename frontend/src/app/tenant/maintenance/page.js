

import React from "react";
import MaintenanceForm from "./component/MaintenanceForm";

const Page = () => {
  return (
    <div>
      
      {/* Top Header */}
      <div className="w-full border-b border-[#E8E4DF] bg-white">
        <div className="max-w-[1440px] mx-auto px-0.5 md:px-15 py-5 flex items-center gap-3">
          
          {/* Icon */}
          <span className="text-2xl">🛠️</span>

          {/* Text */}
          <div>
            <h1 className="text-lg md:text-xl font-bold text-[#0F253B]">
              Maintenance
            </h1>
            <p className="text-xs md:text-sm text-[#6B7280]">
              Report maintenance issue
            </p>
          </div>

        </div>
      </div>

      {/* Form */}
      <MaintenanceForm />

    </div>
  );
};

export default Page;