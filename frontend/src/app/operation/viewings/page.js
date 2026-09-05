"use client";

import ViewingsBoard from "../../Shared/ViewingsBoard";

// The board lives in Shared/ViewingsBoard so scheduling, completing and
// re-opening a finished viewing behave the same in every staff portal.
export default function OperationViewings() {
  return <ViewingsBoard subtitle="Scheduled property viewings" />;
}
