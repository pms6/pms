"use client";

import MaintenanceBooklet from "../../Shared/MaintenanceBooklet";

// The booklet itself lives in Shared/MaintenanceBooklet so add / edit / delete
// behave the same in every staff portal.
export default function AdminMaintenance() {
  return <MaintenanceBooklet subtitle="Repair issues, suppliers, costs and the solution taken" />;
}
