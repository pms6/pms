"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Search, Send, Plus, X, ArrowLeft, Loader2, ClipboardList, Mail } from "lucide-react";
import api from "@/app/api/api";
import { PageHeader } from "./ui";
import { guardModalClose } from "./modalGuard";

/* ------------------------------------------------------------------ *
 * Tenant Messages — the office's side of Tenant Chat. Every conversation
 * with a tenant on the left, the open one on the right. Backed by
 * /messages/threads (see backend/controllers/tenantMessage.controller.js).
 *
 * The tenant's side is app/tenant/messages/page.js.
 * ------------------------------------------------------------------ */

// How often the open conversation and the list refresh while the page is
// open. Polling rather than a socket: the API has no push channel, and a few
// seconds' delay is fine for property management messages.
const THREAD_POLL_MS = 8000;
const LIST_POLL_MS = 20000;

const MAX_LENGTH = 4000;

export const fmtTime = (d) =>
  new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export const fmtDay = (d) => {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};

const fmtListTime = (d) => {
  const date = new Date(d);
  return date.toDateString() === new Date().toDateString()
    ? fmtTime(date)
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

// Messages grouped under a day heading.
export const groupByDay = (messages) => {
  const groups = [];
  for (const m of messages) {
    const day = fmtDay(m.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(m);
    else groups.push({ day, items: [m] });
  }
  return groups;
};

// A chat shows people by name, never by email address. Staff have no name on
// record and older messages were signed with the address itself, so anything
// that is an email is read back as a name: "saima.khan@agency.co.uk" →
// "Saima Khan". A real name passes through untouched.
export const nameOnly = (value) => {
  const text = String(value || "").trim();
  if (!text.includes("@")) return text;
  return text
    .split("@")[0]
    .split(/[._\-+]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const initials = (name) =>
  String(name || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

const unitOf = (t) => (t?.unit && t.unit !== "—" ? t.unit : "");

/** One chat bubble. `mine` = sent by the side viewing it. */
export function Bubble({ m, mine, showSender = true }) {
  const senderName = nameOnly(m.senderName);
  if (m.kind === "access_notice") {
    return (
      <div className="flex justify-center my-2">
        <div className="max-w-[85%] rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <p className="flex items-center gap-1.5 font-bold mb-1">
            <ClipboardList size={13} /> Access notice
          </p>
          <p className="whitespace-pre-line leading-relaxed">{m.body}</p>
          <p className="mt-1.5 text-[10px] text-amber-700/70">
            {senderName ? `${senderName} · ` : ""}
            {fmtTime(m.createdAt)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} my-1`}>
      <div className={`max-w-[80%] sm:max-w-[70%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
        {showSender && !mine && senderName && (
          <span className="text-[10px] font-bold text-gray-400 mb-0.5 px-1">{senderName}</span>
        )}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
            mine ? "bg-[#F47C3C] text-white rounded-br-md" : "bg-white border border-gray-100 text-[#0F253B] rounded-bl-md"
          }`}
        >
          {m.body}
        </div>
        <span className="text-[10px] text-gray-400 mt-0.5 px-1">
          {mine && showSender && senderName ? `${senderName} · ` : ""}
          {fmtTime(m.createdAt)}
        </span>
      </div>
    </div>
  );
}

/** Text box + send button. Enter sends, Shift+Enter is a new line. */
export function Composer({ onSend, disabled, placeholder = "Write a message…", footer }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    const body = text.trim();
    if (!body || sending || disabled) return;
    setSending(true);
    try {
      await onSend(body);
      setText("");
    } catch {
      // The caller reports the error; keep the text so nothing is lost.
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-t border-gray-100 bg-white p-3">
      <div className="flex items-end gap-2">
        <textarea
          rows={2}
          value={text}
          maxLength={MAX_LENGTH}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={placeholder}
          className="flex-1 resize-none px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium text-[#0F253B] outline-none focus:ring-2 focus:ring-[#F47C3C] focus:bg-white disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending || disabled}
          title="Send (Enter)"
          className="h-11 w-11 shrink-0 flex items-center justify-center rounded-xl bg-[#F47C3C] hover:bg-[#e06d30] text-white transition-all disabled:opacity-40"
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3 text-[10px] text-gray-400 font-medium">
        <span>Enter to send · Shift+Enter for a new line</span>
        {footer}
      </div>
    </div>
  );
}

// Picking a tenant to start (or jump to) a conversation with.
function NewConversationModal({ tenancies, onPick, onClose }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const list = tenancies.filter((t) =>
    needle
      ? [t.tenant, t.tenantEmail, t.property, t.unit].some((v) => String(v || "").toLowerCase().includes(needle))
      : true
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={guardModalClose(onClose)}>
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-[#0F253B]">New message</h3>
            <p className="text-xs text-gray-400 font-medium">Choose a current tenant</p>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={20} /></button>
        </div>
        <div className="relative mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tenant, email or property…"
            className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
          />
        </div>
        <div className="overflow-y-auto -mx-2">
          {list.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-400">No tenants match.</p>
          ) : (
            list.map((t) => (
              <button
                key={t._id}
                onClick={() => onPick(t)}
                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-gray-50 flex items-center gap-3"
              >
                <span className="h-9 w-9 shrink-0 rounded-full bg-orange-50 text-[#F47C3C] text-xs font-bold flex items-center justify-center">
                  {initials(nameOnly(t.tenant || t.tenantEmail))}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-[#0F253B] truncate">{nameOnly(t.tenant || t.tenantEmail)}</span>
                  <span className="block text-[11px] text-gray-400 truncate">
                    {[t.property, unitOf(t)].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function TenantMessagesBoard() {
  const [threads, setThreads] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const [q, setQ] = useState("");

  // The open conversation: { tenantEmail, tenantName, property, room, active }.
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadError, setThreadError] = useState("");
  const [notifyByEmail, setNotifyByEmail] = useState(true);
  const [sendNote, setSendNote] = useState("");

  const [tenancies, setTenancies] = useState([]);
  const [picking, setPicking] = useState(false);

  const scrollRef = useRef(null);
  const activeEmail = active?.tenantEmail || "";

  const loadThreads = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoadingList(true);
    try {
      const res = await api.get("/messages/threads");
      setThreads(res.data?.data || []);
      setListError("");
    } catch (err) {
      if (!silent) setListError(err.response?.data?.message || "Failed to load conversations");
    } finally {
      if (!silent) setLoadingList(false);
    }
  }, []);

  const loadThread = useCallback(async (email, { silent = false } = {}) => {
    if (!email) return;
    if (!silent) setLoadingThread(true);
    try {
      const res = await api.get(`/messages/threads/${encodeURIComponent(email)}`);
      setMessages(res.data?.data || []);
      setActive((prev) => (prev?.tenantEmail === email ? { ...prev, ...res.data.tenant } : prev));
      setThreadError("");
      // Opening it read the tenant's messages — clear the badge locally.
      setThreads((prev) => prev.map((t) => (t.tenantEmail === email ? { ...t, unread: 0 } : t)));
    } catch (err) {
      if (err.response?.status === 404) {
        // A brand-new conversation with nothing in it yet.
        setMessages([]);
        setThreadError("");
      } else if (!silent) {
        setThreadError(err.response?.data?.message || "Failed to load the conversation");
      }
    } finally {
      if (!silent) setLoadingThread(false);
    }
  }, []);

  // First load: the list, the tenants who can be messaged, and — when a
  // notification click brought us here — the conversation it was about.
  useEffect(() => {
    (async () => {
      await loadThreads();
      let rows = [];
      try {
        const res = await api.get("/tenancies");
        rows = (res.data?.data || []).filter((t) => t.tenantEmail);
        // A renewal is a second tenancy for the same person; the list comes
        // newest first, so the first one per email is the current one.
        const seen = new Set();
        setTenancies(rows.filter((t) => (seen.has(t.tenantEmail) ? false : seen.add(t.tenantEmail))));
      } catch {
        /* the "New message" picker just stays empty */
      }

      const tenancyId = new URLSearchParams(window.location.search).get("tenancy");
      if (tenancyId) {
        const t = rows.find((r) => r._id === tenancyId);
        if (t) {
          setActive({ tenantEmail: t.tenantEmail, tenantName: t.tenant, property: t.property, room: unitOf(t), active: true });
        }
      }
    })();
  }, [loadThreads]);

  useEffect(() => {
    if (!activeEmail) return;
    (async () => {
      await loadThread(activeEmail);
    })();
    const id = setInterval(() => loadThread(activeEmail, { silent: true }), THREAD_POLL_MS);
    return () => clearInterval(id);
  }, [activeEmail, loadThread]);

  useEffect(() => {
    const id = setInterval(() => loadThreads({ silent: true }), LIST_POLL_MS);
    return () => clearInterval(id);
  }, [loadThreads]);

  // Keep the newest message in view.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, activeEmail]);

  const openThread = (t) => {
    setSendNote("");
    setMessages([]);
    setActive({
      tenantEmail: t.tenantEmail,
      tenantName: t.tenantName,
      property: t.property,
      room: t.room,
      active: t.active !== false,
    });
  };

  const startWith = (tenancy) => {
    setPicking(false);
    const existing = threads.find((t) => t.tenantEmail === tenancy.tenantEmail);
    openThread(
      existing || {
        tenantEmail: tenancy.tenantEmail,
        tenantName: tenancy.tenant,
        property: tenancy.property,
        room: unitOf(tenancy),
        active: true,
      }
    );
  };

  const send = async (body) => {
    setSendNote("");
    try {
      const res = await api.post(`/messages/threads/${encodeURIComponent(activeEmail)}`, { body, notifyByEmail });
      setMessages((prev) => [...prev, res.data.data]);
      if (notifyByEmail) {
        setSendNote(res.data.emailed ? "Tenant emailed about this message." : "Sent. (The tenant already has an unread message, so no new email was sent.)");
      }
      loadThreads({ silent: true });
    } catch (err) {
      setSendNote(err.response?.data?.message || "Failed to send the message");
      throw err;
    }
  };

  const needle = q.trim().toLowerCase();
  const visible = useMemo(
    () =>
      threads.filter((t) =>
        needle
          ? [t.tenantName, t.tenantEmail, t.property, t.room].some((v) => String(v || "").toLowerCase().includes(needle))
          : true
      ),
    [threads, needle]
  );
  const totalUnread = threads.reduce((sum, t) => sum + (t.unread || 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tenant Messages"
        subtitle={`Message tenants directly through the PMS${totalUnread ? ` · ${totalUnread} unread` : ""}`}
        action={
          <button
            onClick={() => setPicking(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
          >
            <Plus size={18} /> New Message
          </button>
        }
      />

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm flex h-[calc(100vh-220px)] min-h-[480px]">
        {/* Conversation list */}
        <aside className={`${active ? "hidden md:flex" : "flex"} w-full md:w-80 shrink-0 flex-col border-r border-gray-100`}>
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search conversations…"
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-[#F47C3C]"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingList ? (
              <p className="p-6 text-center text-sm text-gray-400">Loading…</p>
            ) : listError ? (
              <p className="p-6 text-center text-sm text-red-600">{listError}</p>
            ) : visible.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare size={28} className="mx-auto text-gray-200" />
                <p className="mt-2 text-sm font-bold text-gray-400">
                  {threads.length ? "No conversations match" : "No conversations yet"}
                </p>
                {!threads.length && (
                  <p className="text-xs text-gray-400 mt-1">Start one with &quot;New Message&quot;.</p>
                )}
              </div>
            ) : (
              visible.map((t) => {
                const selected = t.tenantEmail === activeEmail;
                return (
                  <button
                    key={t.tenantEmail}
                    onClick={() => openThread(t)}
                    className={`w-full text-left px-3 py-3 flex gap-3 border-b border-gray-50 transition-colors ${
                      selected ? "bg-orange-50/70" : "hover:bg-gray-50"
                    }`}
                  >
                    <span className="h-10 w-10 shrink-0 rounded-full bg-[#0F253B] text-white text-xs font-bold flex items-center justify-center">
                      {initials(nameOnly(t.tenantName))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={`text-sm truncate ${t.unread ? "font-bold text-[#0F253B]" : "font-semibold text-[#0F253B]"}`}>
                          {nameOnly(t.tenantName)}
                        </span>
                        <span className="text-[10px] text-gray-400 shrink-0">{fmtListTime(t.lastMessage.createdAt)}</span>
                      </span>
                      <span className="block text-[10px] text-gray-400 truncate">
                        {[t.property, t.room].filter(Boolean).join(" · ")}
                      </span>
                      <span className="flex items-center justify-between gap-2 mt-0.5">
                        <span className={`text-xs truncate ${t.unread ? "text-[#0F253B] font-semibold" : "text-gray-500"}`}>
                          {t.lastMessage.sender === "staff" ? "You: " : ""}
                          {t.lastMessage.kind === "access_notice" ? "📋 Access notice" : t.lastMessage.body}
                        </span>
                        {t.unread > 0 && (
                          <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-[#F47C3C] text-white text-[10px] font-bold flex items-center justify-center">
                            {t.unread}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Open conversation */}
        <section className={`${active ? "flex" : "hidden md:flex"} flex-1 min-w-0 flex-col bg-[#F8FAFC]`}>
          {!active ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <MessageSquare size={36} className="text-gray-200" />
              <p className="mt-3 text-sm font-bold text-gray-400">Select a conversation</p>
              <p className="text-xs text-gray-400 mt-1">or start a new one with a tenant.</p>
            </div>
          ) : (
            <>
              <header className="px-4 py-3 bg-white border-b border-gray-100 flex items-center gap-3">
                <button onClick={() => setActive(null)} className="md:hidden text-gray-400" title="Back">
                  <ArrowLeft size={18} />
                </button>
                <span className="h-10 w-10 shrink-0 rounded-full bg-orange-50 text-[#F47C3C] text-xs font-bold flex items-center justify-center">
                  {initials(nameOnly(active.tenantName))}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[#0F253B] truncate">{nameOnly(active.tenantName)}</p>
                  <p className="text-[11px] text-gray-400 truncate">
                    {[active.property, active.room].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {active.active === false && (
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2.5 py-1">
                    No current tenancy
                  </span>
                )}
              </header>

              <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
                {loadingThread && messages.length === 0 ? (
                  <p className="text-center text-sm text-gray-400 mt-10">Loading…</p>
                ) : threadError ? (
                  <p className="text-center text-sm text-red-600 mt-10">{threadError}</p>
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-gray-400 mt-10">
                    No messages yet — say hello to {nameOnly(active.tenantName)}.
                  </p>
                ) : (
                  groupByDay(messages).map((g) => (
                    <div key={g.day}>
                      <div className="flex justify-center my-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-white border border-gray-100 rounded-full px-3 py-1">
                          {g.day}
                        </span>
                      </div>
                      {g.items.map((m) => (
                        <Bubble key={m._id} m={m} mine={m.sender === "staff"} />
                      ))}
                    </div>
                  ))
                )}
              </div>

              <Composer
                onSend={send}
                disabled={active.active === false}
                placeholder={
                  active.active === false
                    ? "This tenant has no current tenancy — messages can't be sent"
                    : `Message ${nameOnly(active.tenantName)}…`
                }
                footer={
                  <span className="flex items-center gap-3">
                    {sendNote && <span className="text-gray-500">{sendNote}</span>}
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={notifyByEmail}
                        onChange={(e) => setNotifyByEmail(e.target.checked)}
                        className="accent-[#F47C3C]"
                      />
                      <Mail size={11} /> Email the tenant
                    </label>
                  </span>
                }
              />
            </>
          )}
        </section>
      </div>

      {picking && (
        <NewConversationModal tenancies={tenancies} onPick={startWith} onClose={() => setPicking(false)} />
      )}
    </div>
  );
}
