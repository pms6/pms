"use client";

import CleaningScheduleBoard from "../../Shared/CleaningScheduleBoard";

// The board itself lives in Shared/CleaningScheduleBoard so add / edit / delete
// behave the same in every staff portal.
export default function AdminCleaningSchedule() {
  return <CleaningScheduleBoard subtitle="Which property is cleaned, when, and whether it is done" />;
}
