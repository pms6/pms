"use client";

import LeadsBoard from "../../Shared/LeadsBoard";

// The board itself lives in Shared/LeadsBoard so add / edit / move behave the
// same in every staff portal.
export default function OperationLeads() {
  return <LeadsBoard subtitle="Your enquiry pipeline" />;
}
