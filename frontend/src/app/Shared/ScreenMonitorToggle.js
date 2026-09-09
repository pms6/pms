"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MonitorUp, MonitorOff, Loader2, ShieldAlert, X } from "lucide-react";
import api from "../api/api";
import uploadToCloudinary from "../utils/uploadToCloudinary";

/* ---------------------------------------------------------------------------
 * The staff member's monitored-shift switch.
 *
 * What a browser will and will not do, because it shapes everything here:
 * a web page CANNOT take a screenshot of a computer silently. The only route is
 * getDisplayMedia(), which needs a click, opens a picker where the person
 * chooses what to share, and keeps a screen-sharing indicator visible for as
 * long as the capture runs. There is no way around that from a web app, and a
 * covert version would need a desktop agent installed on each machine.
 *
 * So the shift is started by the member and the screenshots are random after
 * that: once sharing is on, the server decides each next capture time inside
 * the policy's interval range, and this component simply grabs a frame when it
 * comes due. The member can stop at any point, and revoking the browser share
 * ends the session too.
 * ------------------------------------------------------------------------- */

// How often to ask the server whether a capture is due.
//
// Once a minute, not three times: screenshots are 10-30 minutes apart, so a
// tighter poll buys nothing and this is the app's most frequent request. With a
// presence heartbeat also going out every minute, every monitored member costs
// two requests a minute before they do any work at all — which is what put the
// shared rate-limit budget within reach of a full office.
const TICK_MS = 60 * 1000;

// A capture can fail for reasons a retry will not fix — a blocked upload host,
// a rejected preset, the API down. Retrying every tick then means an endless
// loop of failing uploads nobody is told about, and an orphaned image left
// behind each time the upload half succeeds. So failures back off, and after
// this many in a row the shift stops and says why.
const MAX_CAPTURE_FAILURES = 4;
const FAILURE_BACKOFF_MS = 2 * 60 * 1000;

// A single due capture gets a few quick goes before it counts as a failure —
// a screenshot upload that trips over a momentary network blip or a Cloudinary
// hiccup almost always succeeds on the next try seconds later, and surfacing a
// red "could not be saved" warning for something that self-heals is what made
// the feature look broken on some machines.
const CAPTURE_ATTEMPTS = 3;
const CAPTURE_RETRY_MS = 4000;

// Clear a transient capture warning on its own after a while, so a blip that
// has since recovered does not leave the message sitting in the header.
const ERROR_AUTOCLEAR_MS = 45 * 1000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const JPEG_QUALITY = 0.7;
// Screenshots are evidence of activity, not design review material. Capping the
// long edge keeps them readable while cutting upload size by roughly an order
// of magnitude.
const MAX_EDGE = 1280;

export default function ScreenMonitorToggle() {
  const [state, setState] = useState(null); // { policy, session, withinWorkingHours }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showNotice, setShowNotice] = useState(false);
  const [capturing, setCapturing] = useState(false);
  // Whether a shift is running, as STATE — the ref below cannot drive the
  // render, so reading it here would leave the button showing the wrong label
  // until something else happened to re-render.
  const [running, setRunning] = useState(false);

  const streamRef = useRef(null);
  const videoRef = useRef(null);
  const tickRef = useRef(null);
  // Guards a capture that resolves after the member has switched off. Mirrors
  // `running`, but readable from async callbacks that closed over a stale one.
  const activeRef = useRef(false);
  // Consecutive capture failures, and the moment it is worth trying again.
  const failuresRef = useRef(0);
  const retryAfterRef = useRef(0);

  const clearTick = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const releaseStream = useCallback(() => {
    activeRef.current = false;
    setRunning(false);
    failuresRef.current = 0;
    retryAfterRef.current = 0;
    clearTick();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/screen-monitor/me");
      setState(res.data.data);
      return res.data.data;
    } catch {
      setState(null);
      return null;
    }
  }, []);

  useEffect(() => {
    load();
    return () => releaseStream();
  }, [load, releaseStream]);

  // A reload destroys the shared stream and the browser will not hand it back
  // without a new click — so after a refresh the server still has an ACTIVE
  // session while this page is capturing nothing. Warning on the way out is
  // the only chance to stop that happening silently.
  useEffect(() => {
    if (!running) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  // Pull one frame off the shared display and hand it back as a JPEG blob.
  const grabFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return null;

    // A display change — a resolution switch, a monitor unplugged, the laptop
    // waking from sleep — can briefly leave the element reporting 0×0. Give it a
    // moment rather than encoding a black 0-pixel frame that then fails to save.
    for (let i = 0; i < 10 && (!video.videoWidth || !video.videoHeight); i++) {
      await sleep(300);
    }
    if (!video.videoWidth || !video.videoHeight) return null;

    const scale = Math.min(1, MAX_EDGE / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    return blob ? { blob, width: canvas.width, height: canvas.height } : null;
  }, []);

  // Grab a frame, upload it, and record it — one attempt. Throws on failure so
  // the retry wrapper can decide whether to try again. Returns "skipped" when
  // there is simply no frame to send (a 0-pixel display mid-change), which is
  // not a failure.
  const captureOnce = async () => {
    const frame = await grabFrame();
    if (!frame) return { skipped: true };

    const file = new File([frame.blob], `screen-${Date.now()}.jpg`, { type: "image/jpeg" });
    const up = await uploadToCloudinary(file);

    const res = await api.post("/screen-monitor/capture", {
      url: up.url,
      publicId: up.publicId,
      width: frame.width,
      height: frame.height,
      bytes: frame.blob.size,
    });
    return { res };
  };

  const takeCapture = useCallback(async () => {
    if (!activeRef.current) return;
    setCapturing(true);
    try {
      // Try the due capture a few times before treating it as a real failure —
      // most "could not be saved" errors are a one-off blip that clears on the
      // next attempt seconds later. A 409 is never retried: it means the server
      // deliberately closed the session.
      let outcome = null;
      let lastErr = null;
      for (let attempt = 1; attempt <= CAPTURE_ATTEMPTS; attempt++) {
        if (!activeRef.current) return;
        try {
          outcome = await captureOnce();
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          if (err.response?.status === 409) break;
          if (attempt < CAPTURE_ATTEMPTS) await sleep(CAPTURE_RETRY_MS);
        }
      }

      if (!lastErr) {
        if (outcome?.skipped) return; // nothing to send this time, not a failure
        setState((s) =>
          s ? { ...s, session: { ...s.session, ...outcome.res.data.data } } : s
        );
        failuresRef.current = 0;
        retryAfterRef.current = 0;
        setError("");
        return;
      }

      // 409 — the server ended the session (out of hours, or monitoring turned
      // off). Stop sharing rather than keep a dead capture loop running.
      if (lastErr.response?.status === 409) {
        releaseStream();
        setError(lastErr.response?.data?.message || "The monitored shift was closed.");
        await load();
        return;
      }

      // A genuine run of failures. The due time never advances on a failure, so
      // without this the next tick just tries again forever. Back off, and stop
      // the shift once it is clearly not recoverable.
      failuresRef.current += 1;
      retryAfterRef.current = Date.now() + FAILURE_BACKOFF_MS * failuresRef.current;

      if (failuresRef.current >= MAX_CAPTURE_FAILURES) {
        releaseStream();
        try {
          await api.post("/screen-monitor/stop", { reason: "STOPPED" });
        } catch { /* the shift is over locally either way */ }
        setError(
          "Screenshots kept failing to save, so the monitored shift was stopped. Start it again once you are back online."
        );
        await load();
        return;
      }

      // The first failed capture is left silent — the backoff already handles
      // it and it usually recovers on its own. Only speak up once it is a
      // pattern, and clear the message by itself if things settle.
      if (failuresRef.current >= 2) {
        const msg = `A screenshot could not be saved (${failuresRef.current} of ${MAX_CAPTURE_FAILURES}). Retrying automatically.`;
        setError(msg);
        setTimeout(() => setError((e) => (e === msg ? "" : e)), ERROR_AUTOCLEAR_MS);
      }
    } finally {
      setCapturing(false);
    }
    // captureOnce closes over grabFrame; the rest is covered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grabFrame, releaseStream, load]);

  // Poll for "is a capture due yet". The server owns the schedule, so the
  // client cannot pick a convenient moment to be photographed.
  const startTicking = useCallback(() => {
    clearTick();
    tickRef.current = setInterval(async () => {
      if (!activeRef.current) return;

      const fresh = await load();
      if (!fresh?.session) {
        releaseStream();
        return;
      }

      // An admin switching monitoring off mid-shift has to stop the capturing,
      // not just hide the button. The server refuses the next screenshot too,
      // but there is no reason to take one first.
      if (!fresh.policy?.enabled) {
        releaseStream();
        setError("Screen monitoring was switched off for your organisation.");
        try {
          await api.post("/screen-monitor/stop", { reason: "STOPPED" });
        } catch { /* the shift is over locally either way */ }
        await load();
        return;
      }

      if (Date.now() < retryAfterRef.current) return;

      const due = fresh.session.nextCaptureAt;
      if (due && new Date(due) <= new Date()) await takeCapture();
    }, TICK_MS);
  }, [load, releaseStream, takeCapture]);

  const start = async () => {
    setBusy(true);
    setError("");
    try {
      // The browser prompt is the real gate — it must come from this click.
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 1 },
        audio: false,
      });

      // Stopping the share from the browser's own bar ends the shift.
      stream.getVideoTracks()[0].addEventListener("ended", async () => {
        releaseStream();
        try {
          await api.post("/screen-monitor/stop", { reason: "SHARE_REVOKED" });
        } catch { /* the session is closed either way */ }
        await load();
      });

      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      await video.play();

      streamRef.current = stream;
      videoRef.current = video;

      await api.post("/screen-monitor/start", { acknowledged: true });

      activeRef.current = true;
      setRunning(true);
      setShowNotice(false);
      await load();
      startTicking();
    } catch (err) {
      releaseStream();
      if (err?.name === "NotAllowedError") {
        setError("Screen sharing was not allowed, so the shift did not start.");
      } else {
        setError(err.response?.data?.message || err.message || "Could not start the monitored shift.");
      }
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    releaseStream();
    try {
      await api.post("/screen-monitor/stop", { reason: "STOPPED" });
    } catch { /* nothing useful to do if this fails */ }
    await load();
    setBusy(false);
  };

  // Hiding the whole control when the policy is off is right for everyone who
  // is not mid-shift. It is wrong for someone whose shift is still running:
  // taking their stop button away while the capture loop winds down leaves them
  // being photographed with no way to end it. So the control stays until the
  // shift is actually over.
  if (!state?.policy?.enabled && !running && !state?.session) return null;

  const live = running && Boolean(state.session);
  // The server still has a session open but this page is not sharing — almost
  // always a reload. Nothing is being captured, so say so and offer the one
  // thing that fixes it, rather than showing "Start" as if nothing is running.
  const needsResume = Boolean(state.session) && !running;

  return (
    <>
      <div className="relative flex items-center gap-2">
        {live ? (
          <>
            {/* Just a live dot. The screenshot count and last-capture time used
                to sit here, but they read as "0 screenshots · last —" for the
                first stretch of every shift, which looks broken; and the counts
                belong on the admin board, not in the monitored person's header. */}
            <span className="flex items-center" title="Monitored shift running">
              {capturing ? (
                <Loader2 size={12} className="animate-spin text-[#F47C3C]" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </span>
            <button
              onClick={stop}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 disabled:opacity-50 transition-all"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <MonitorOff size={14} />}
              <span className="hidden sm:inline">End monitored shift</span>
            </button>
          </>
        ) : needsResume ? (
          <>
            <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-bold text-amber-600">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Paused — not capturing
            </span>
            <button
              onClick={start}
              disabled={busy}
              title="Reloading the page stopped screen sharing. Resume to carry on the same shift."
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 text-amber-700 text-xs font-bold hover:bg-amber-100 disabled:opacity-50 transition-all"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <MonitorUp size={14} />}
              <span className="hidden sm:inline">Resume monitored shift</span>
            </button>
            <button
              onClick={stop}
              disabled={busy}
              className="px-2 py-2 rounded-xl text-[11px] font-bold text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all"
            >
              End
            </button>
          </>
        ) : (
          <button
            onClick={() => setShowNotice(true)}
            disabled={busy || !state.withinWorkingHours}
            title={
              state.withinWorkingHours
                ? "Start a monitored shift"
                : `Monitoring only runs ${state.policy.workStart}–${state.policy.workEnd} UK time`
            }
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-50 text-[#0F253B] text-xs font-bold hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <MonitorUp size={14} />
            <span className="hidden sm:inline">Start monitored shift</span>
          </button>
        )}

        {/* Below the row, not in it — an error must not make the header taller. */}
        {error && (
          <p className="absolute top-full right-0 mt-1 text-[10px] font-bold text-red-600 max-w-[220px] text-right pointer-events-none">
            {error}
          </p>
        )}
      </div>

      {/* The notice. Shown every time a shift starts, and the acknowledgement is
          recorded against the exact wording the member saw. */}
      {showNotice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowNotice(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-7"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4 gap-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#F47C3C] flex items-center justify-center shrink-0">
                  <ShieldAlert size={20} />
                </div>
                <h3 className="text-lg font-bold text-[#0F253B]">Before you start</h3>
              </div>
              <button onClick={() => setShowNotice(false)} className="text-gray-300 hover:text-gray-500">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-gray-600 font-medium leading-relaxed whitespace-pre-line">
              {state.policy.noticeText}
            </p>

            <ul className="mt-4 space-y-1.5 text-xs font-medium text-gray-500">
              <li>
                · Screenshots are taken at random, roughly every{" "}
                <strong className="text-[#0F253B]">
                  {state.policy.minIntervalMinutes}–{state.policy.maxIntervalMinutes} minutes
                </strong>
                .
              </li>
              <li>
                · Only between{" "}
                <strong className="text-[#0F253B]">
                  {state.policy.workStart} and {state.policy.workEnd}
                  {state.policy.overnight ? " the next day" : ""}
                </strong>{" "}
                UK time. Outside those hours the shift closes itself.
              </li>
              <li>
                · Kept for{" "}
                <strong className="text-[#0F253B]">{state.policy.retentionDays} days</strong>, then
                deleted.
              </li>
              <li>· Visible to your organisation&apos;s admins only, and it is logged when they look.</li>
              <li>· You choose what to share, and you can stop at any time.</li>
            </ul>

            <div className="mt-6 flex gap-3">
              <button
                onClick={start}
                disabled={busy}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold rounded-xl transition-all disabled:opacity-50"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <MonitorUp size={16} />}
                I understand — start sharing
              </button>
              <button
                onClick={() => setShowNotice(false)}
                className="px-6 py-3 bg-gray-50 hover:bg-gray-100 border border-gray-100 text-[#0F253B] font-bold rounded-xl transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
