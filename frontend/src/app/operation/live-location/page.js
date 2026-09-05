"use client";

import LiveLocationBoard from "../../Shared/LiveLocationBoard";

// Operation staff both broadcast (the toggle in the header, from
// OperationLayout) and read this board, so the whole team can see where every
// operation team member currently is.
export default function OperationLiveLocation() {
  return <LiveLocationBoard subtitle="Operation team members currently sharing their position" />;
}
