"use client";

import TenantCasesBoard from "../../Shared/TenantCasesBoard";
import { PageHeader } from "../../Shared/ui";

export default function AdminTenantCases() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Tenant Cases"
        subtitle="Complaints, disputes and issues with individual tenants — assigned, evidenced and tracked to close"
      />
      <TenantCasesBoard />
    </div>
  );
}
