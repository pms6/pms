"use client";

import LiveLocationBoard from "../../Shared/LiveLocationBoard";

// Agents only READ this board — sharing itself belongs to OPERATION (see
// backend/controllers/agentLocation.controller.js). Same board as admin,
// manager and finance.
export default function AgentLiveLocation() {
  return <LiveLocationBoard subtitle="Operation team members currently sharing their position" />;
}
