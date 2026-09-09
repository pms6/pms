"use client";

import EmptyRoomStatusBoard from "../../Shared/EmptyRoomStatusBoard";

// The board itself lives in Shared/EmptyRoomStatusBoard so add / edit / delete
// behave the same in every staff portal.
export default function AdminEmptyRooms() {
  return <EmptyRoomStatusBoard subtitle="Empty rooms, where each is in the turnaround, and when it will be ready" />;
}
