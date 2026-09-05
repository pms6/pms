"use client";

import LiveLocationBoard from "../../Shared/LiveLocationBoard";

// The board lives in Shared/LiveLocationBoard so every staff seat sees the
// same thing. Only OPERATION shares a location (the toggle lives in their
// header); everyone else, including finance, is read-only here. Tenants have
// no access at all; the API refuses them.
export default function FinanceLiveLocation() {
  return <LiveLocationBoard subtitle="Operation team members currently sharing their position" />;
}
