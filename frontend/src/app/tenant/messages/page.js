"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, Building2 } from "lucide-react";
import api from "@/app/api/api";
import { Bubble, Composer, groupByDay } from "@/app/Shared/TenantMessagesBoard";

// How often the conversation refreshes while it is open.
const POLL_MS = 8000;

// The tenant's side of Tenant Chat: one conversation, with their property
// management team. The office's side is Shared/TenantMessagesBoard.
export default function TenantMessagesPage() {
  const [messages, setMessages] = useState([]);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");
  const scrollRef = useRef(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    try {
      const res = await api.get("/messages/my");
      setMessages(res.data?.data || []);
      setOrganization(res.data?.organization || null);
      setError("");
    } catch (err) {
      if (!silent) setError(err.response?.data?.message || "Failed to load messages.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await load();
    })();
    const id = setInterval(() => load({ silent: true }), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length]);

  const send = async (body) => {
    setSendError("");
    try {
      const res = await api.post("/messages/my", { body });
      setMessages((prev) => [...prev, res.data.data]);
    } catch (err) {
      setSendError(err.response?.data?.message || "Failed to send your message.");
      throw err;
    }
  };

  const orgName = organization?.name || "Property Management";

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0F253B]">Messages</h1>
        <p className="text-gray-500 mt-1 text-sm sm:text-base">
          Message your property management team directly.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col h-[calc(100vh-230px)] min-h-[440px]">
        <header className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
          <span className="h-10 w-10 rounded-full bg-orange-50 flex items-center justify-center overflow-hidden">
            {organization?.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={organization.logo} alt="" className="h-full w-full object-cover" />
            ) : (
              <Building2 size={18} className="text-[#F47C3C]" />
            )}
          </span>
          <div>
            <p className="text-sm font-bold text-[#0F253B]">{orgName}</p>
            <p className="text-[11px] text-gray-400">Your property management team</p>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 bg-[#F8FAFC]">
          {loading ? (
            <p className="text-center text-sm text-gray-400 mt-10">Loading messages…</p>
          ) : error ? (
            <p className="text-center text-sm text-red-600 mt-10">{error}</p>
          ) : messages.length === 0 ? (
            <div className="text-center mt-12">
              <div className="mx-auto mb-3 w-14 h-14 rounded-full bg-orange-50 flex items-center justify-center">
                <MessageSquare className="text-[#F47C3C]" size={24} />
              </div>
              <p className="text-gray-600 font-medium">No messages yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Send a message below and your property manager will reply here.
              </p>
            </div>
          ) : (
            groupByDay(messages).map((g) => (
              <div key={g.day}>
                <div className="flex justify-center my-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-white border border-gray-100 rounded-full px-3 py-1">
                    {g.day}
                  </span>
                </div>
                {g.items.map((m) => (
                  <Bubble key={m._id} m={m} mine={m.sender === "tenant"} />
                ))}
              </div>
            ))
          )}
        </div>

        {sendError && (
          <p className="px-4 py-2 text-xs font-bold text-red-600 bg-red-50 border-t border-red-100">{sendError}</p>
        )}
        <Composer onSend={send} disabled={loading || !!error} placeholder={`Message ${orgName}…`} />
      </div>
    </div>
  );
}
