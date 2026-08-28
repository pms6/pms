"use client";

import LeadsBoard from "../../Shared/LeadsBoard";

// The board itself lives in Shared/LeadsBoard so add / edit / move behave the
// same in every staff portal. Tenants have no leads page.
export default function FinanceLeads() {
  return <LeadsBoard subtitle="Enquiry pipeline and expected income" />;
}
