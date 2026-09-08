"use client";

import LiveLocationBoard from "../../Shared/LiveLocationBoard";

// The board lives in Shared/LiveLocationBoard so admin, manager and finance all
// see the same thing. Only the operation seat shares a position — they have the
// toggle in their header. Tenants have no access at all; the API refuses them.
export default function AdminLiveLocation() {
  return <LiveLocationBoard subtitle="Operation team members currently sharing their position" />;
}
