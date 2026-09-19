"use client";

import StayDurationBoard from "../../Shared/StayDurationBoard";

// Same section as the admin portal; the basePath keeps its links to the client
// register and the tenants board inside /manager.
export default function ManagerStayDuration() {
  return <StayDurationBoard basePath="/manager" />;
}
