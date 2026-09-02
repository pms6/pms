"use client";

import AdminClientDatabase from "../../admin/client-database/page";

// Same screen as the owner portal, rendered under the manager routes. The
// basePath keeps its cross-links inside /manager — following one into /admin
// would just bounce the manager back out through the role guard.
export default function ManagerClientDatabase() {
  return <AdminClientDatabase basePath="/manager" />;
}
