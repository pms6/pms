"use client";

import { useEffect, useRef } from "react";
import api from "../api/api";

/* ---------------------------------------------------------------------------
 * Tells the server this person is at their desk, once a minute, for as long as
 * a staff portal is open. Renders nothing.
 *
 * A heartbeat rather than a login/logout pair, because the pair is the version
 * that lies: a closed lid, a crashed tab or a killed browser never sends the
 * "I left" half, and the board would then show someone online for hours after
 * they went home. Going quiet is the signal.
 *
 * Beating is paused while the tab is hidden, so a window left open on a second
 * monitor overnight does not report a full night at the desk.
 * ------------------------------------------------------------------------- */

const BEAT_MS = 60 * 1000;

export default function PresenceHeartbeat({ portal }) {
  const timerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const beat = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        await api.post("/presence/ping", { portal });
      } catch {
        /* a missed beat just shows as "last seen a minute ago" */
      }
    };

    beat();
    timerRef.current = setInterval(beat, BEAT_MS);

    // Coming back to the tab should show up immediately rather than at the
    // next scheduled beat.
    const onVisible = () => {
      if (document.visibilityState === "visible") beat();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [portal]);

  return null;
}
