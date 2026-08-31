"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, MapPinOff, Loader2 } from "lucide-react";
import api from "../api/api";

// How often a position is sent while sharing is on. The server calls a fix
// stale after 10 minutes, so this leaves room for one missed ping (a tunnel, a
// locked screen) before the team's board flags the agent as out of date.
const PING_INTERVAL_MS = 5 * 60 * 1000;

const GEO_OPTIONS = { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 };

/**
 * The agent's live-location switch, shown in the agent portal header.
 *
 * On: the browser is asked for a position now and every five minutes after,
 * and each one is posted to the server, where the rest of the team can see it.
 * Off: one call to the server, which clears the stored position — the team's
 * board drops the agent and the hourly email stops mentioning them.
 *
 * The browser permission prompt is the real gate. If the agent refuses it, or
 * revokes it later, sharing is switched back off rather than left showing "on"
 * with nothing behind it.
 */
export default function LiveLocationToggle() {
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [lastPingAt, setLastPingAt] = useState(null);

  const timerRef = useRef(null);
  // Guards against a ping that resolves after the agent has switched off — the
  // Geolocation callback can fire long after the request was made.
  const activeRef = useRef(false);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Ask the browser for one position and send it on.
  const sendPosition = useCallback(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        if (!activeRef.current) return;
        try {
          await api.post("/agent-location/ping", {
            lat: coords.latitude,
            lng: coords.longitude,
            accuracy: coords.accuracy,
          });
          setLastPingAt(new Date());
          setError("");
        } catch {
          // A failed ping is not worth alarming the agent about — the next one
          // is five minutes away and the board shows the fix going stale.
        }
      },
      (geoError) => {
        if (!activeRef.current) return;
        // Permission withdrawn mid-session: stop claiming to share.
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setError("Location permission denied — sharing turned off.");
          activeRef.current = false;
          stopTimer();
          setActive(false);
          api.patch("/agent-location/toggle", { active: false }).catch(() => {});
        } else {
          setError("Could not get a position. Retrying shortly.");
        }
      },
      GEO_OPTIONS
    );
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    sendPosition();
    timerRef.current = setInterval(sendPosition, PING_INTERVAL_MS);
  }, [sendPosition]);

  // Restore the switch on a page load, so a reload does not silently stop a
  // share the agent believes is still running.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await api.get("/agent-location/me");
        if (cancelled) return;
        const on = Boolean(res.data?.data?.active);
        setActive(on);
        activeRef.current = on;
        if (on) startTimer();
      } catch {
        // Not an agent, or the endpoint is unreachable — leave the switch off.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
      stopTimer();
    };
  }, [startTimer]);

  const toggle = async () => {
    const next = !active;
    setBusy(true);
    setError("");

    try {
      if (!next) {
        // Switching OFF goes to the server first: stopping must not depend on
        // the browser handing over a position.
        activeRef.current = false;
        stopTimer();
        await api.patch("/agent-location/toggle", { active: false });
        setActive(false);
        setLastPingAt(null);
        return;
      }

      if (!navigator.geolocation) {
        setError("This browser cannot share a location.");
        return;
      }

      await api.patch("/agent-location/toggle", { active: true });
      setActive(true);
      activeRef.current = true;
      startTimer();
    } catch (err) {
      setError(err.response?.data?.message || "Could not change live location.");
    } finally {
      setBusy(false);
    }
  };

  // Nothing until the current state is known, so the button cannot flash "off"
  // at an agent who is in fact sharing.
  if (!loaded) return null;

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={toggle}
        disabled={busy}
        title={
          active
            ? "Your team can see your location. Click to stop sharing."
            : "Share your live location with your team"
        }
        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.98] disabled:opacity-50 ${
          active
            ? "bg-emerald-500 hover:bg-emerald-600 text-white"
            : "bg-gray-100 hover:bg-gray-200 text-gray-500"
        }`}
      >
        {busy ? (
          <Loader2 size={15} className="animate-spin" />
        ) : active ? (
          <span className="relative flex items-center">
            <MapPin size={15} />
            <span className="absolute -right-1 -top-1 w-2 h-2 rounded-full bg-white animate-pulse" />
          </span>
        ) : (
          <MapPinOff size={15} />
        )}
        <span className="hidden sm:inline">
          {busy ? "…" : active ? "Live location on" : "Live location off"}
        </span>
      </button>

      {active && lastPingAt && (
        <span className="text-[10px] font-medium text-gray-400 mt-0.5 hidden sm:block">
          Sent {lastPingAt.toLocaleTimeString()}
        </span>
      )}

      {error && (
        <span className="text-[10px] font-bold text-red-500 mt-0.5 max-w-[220px] text-right">
          {error}
        </span>
      )}
    </div>
  );
}
