"use client";

import CourtClaimsBoard from "../../Shared/CourtClaimsBoard";

// The board itself lives in Shared/CourtClaimsBoard so add / edit / delete
// behave the same in every staff portal.
export default function AdminCourtClaims() {
  return (
    <CourtClaimsBoard subtitle="Claims, the amounts involved, response deadlines and the paperwork behind them" />
  );
}
