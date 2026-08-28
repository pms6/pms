"use client";

import LeadsBoard from "../../Shared/LeadsBoard";

// The board itself lives in Shared/LeadsBoard so add / edit / move behave the
// same in every staff portal. Tenants have no leads page.
export default function ManagerLeads() {
  return <LeadsBoard subtitle="Your team's enquiry pipeline" />;
}
