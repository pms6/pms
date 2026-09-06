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

// How often to ask the server whether a capture is due. Short enough that a
// due time lands promptly, long enough to be nearly free.
const TICK_MS = 20 * 1000;

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

  const clearTick = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const releaseStream = useCallback(() => {
    activeRef.current = false;
    setRunning(false);
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
    if (!video || !video.videoWidth) return null;

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

  const takeCapture = useCallback(async () => {
    if (!activeRef.current) return;
    setCapturing(true);
    try {
      const frame = await grabFrame();
      if (!frame) return;

      const file = new File([frame.blob], `screen-${Date.now()}.jpg`, { type: "image/jpeg" });
      const up = await uploadToCloudinary(file);

      const res = await api.post("/screen-monitor/capture", {
        url: up.url,
        publicId: up.publicId,
        width: frame.width,
        height: frame.height,
        bytes: frame.blob.size,
      });

      setState((s) => (s ? { ...s, session: { ...s.session, ...res.data.data } } : s));
    } catch (err) {
      // 409 means the working-hours window closed and the server ended the
      // session — stop sharing rather than keep a dead capture loop running.
      if (err.response?.status === 409) {
        releaseStream();
        setError(err.response?.data?.message || "Working hours have ended.");
        await load();
      }
    } finally {
      setCapturing(false);
    }
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

  if (!state?.policy?.enabled) return null;

  const live = running && Boolean(state.session);
  // The server still has a session open but this page is not sharing — almost
  // always a reload. Nothing is being captured, so say so and offer the one
  // thing that fixes it, rather than showing "Start" as if nothing is running.
  const needsResume = Boolean(state.session) && !running;

  return (
    <>
      <div className="flex items-center gap-2">
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
              End monitored shift
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
              Resume monitored shift
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
            Start monitored shift
          </button>
        )}
      </div>

      {error && (
        <p className="text-[11px] font-bold text-red-600 mt-1 max-w-xs">{error}</p>
      )}

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
