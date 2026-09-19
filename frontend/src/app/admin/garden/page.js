"use client";

import GardenBoard from "../../Shared/GardenBoard";

// The board itself lives in Shared/GardenBoard so add / edit / delete behave
// the same in every staff portal.
export default function AdminGarden() {
  return <GardenBoard subtitle="Garden cuttings and the garden machines at each property" />;
}
