"use client";

import LiveLocationBoard from "../../Shared/LiveLocationBoard";

// The board lives in Shared/LiveLocationBoard so admin, manager and finance all
// see the same thing. Agents don't get this page — they have the toggle in
// their header instead. Tenants have no access at all; the API refuses them.
export default function FinanceLiveLocation() {
  return <LiveLocationBoard subtitle="Agents currently sharing their position" />;
}
