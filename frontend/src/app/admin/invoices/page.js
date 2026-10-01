"use client";

import InvoicesBoard from "../../Shared/InvoicesBoard";
import { PageHeader } from "../../Shared/ui";

export default function AdminInvoices() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Invoices"
        subtitle="Customised invoices to tenants, landlords and others — numbered automatically, with PDF, payments and history"
      />
      <InvoicesBoard />
    </div>
  );
}
