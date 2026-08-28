"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Mail, Phone, PoundSterling, Trash2, Edit2, Eye } from "lucide-react";
import { PageHeader } from "./ui";
import { applicantEntries } from "./applicant";
import LeadDetailModal from "./LeadDetailModal";
import LostReasonModal from "./LostReasonModal";
import LeadFormModal, { LEAD_STAGES } from "./LeadFormModal";
import { AddedBy } from "./creator";
import api from "../api/api";

// One board, rendered by every staff portal (admin, manager, agent, finance).
// Leads are a team-wide pipeline: anyone on staff may add one, edit one and
// move it through the stages. Tenants have no leads page at all, and the API
// refuses them regardless of what the UI offers.

const COLUMNS = [
  { key: "new", label: "New", tone: "bg-blue-500" },
  { key: "qualified", label: "Qualified", tone: "bg-emerald-500" },
  { key: "viewing", label: "Viewing", tone: "bg-[#F47C3C]" },
  { key: "converted", label: "Converted", tone: "bg-[#0F253B]" },
  { key: "lost", label: "Lost", tone: "bg-gray-400" },
];

function initials(name) {
  return (name || "?").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

const getRoomDisplayName = (room) => {
  if (!room) return "";
  return room.roomName || room.title || room.name || "Unnamed Room";
};

export default function LeadsBoard({ title = "Leads", subtitle = "Your enquiry pipeline" }) {
  const [leads, setLeads] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);
  const [detailLead, setDetailLead] = useState(null);
  const [lostPrompt, setLostPrompt] = useState(null);

  // null = closed, { lead: null } = create, { lead } = edit.
  const [formState, setFormState] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [leadsRes, propsRes] = await Promise.all([
        api.get("/leads"),
        api.get("/properties", { params: { limit: 100 } }),
      ]);
      setLeads(leadsRes.data.data || []);
      setProperties(propsRes.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await load();
    })();
  }, [load]);

  const changeStatus = async (lead, status, lostReason = "") => {
    const prev = lead.status;
    const prevReason = lead.lostReason || "";
    setLeads((ls) =>
      ls.map((l) =>
        l._id === lead._id
          ? { ...l, status, lostReason: status === "lost" ? lostReason : "" }
          : l
      )
    );

    try {
      await api.patch(`/leads/${lead._id}/status`, { status, lostReason });
    } catch (err) {
      setLeads((ls) =>
        ls.map((l) =>
          l._id === lead._id ? { ...l, status: prev, lostReason: prevReason } : l
        )
      );
      alert(err.response?.data?.message || "Failed to move lead");
      return false;
    }

    return true;
  };

  // Losing a lead has to say why — the backend rejects "lost" with no reason —
  // so that one move goes through the prompt first.
  const requestStatusChange = (lead, status) => {
    if (status === "lost") setLostPrompt({ lead, status });
    else changeStatus(lead, status);
  };

  const handleDrop = (colKey) => {
    const lead = leads.find((l) => l._id === draggingId);
    setDragOverCol(null);
    setDraggingId(null);
    if (lead && lead.status !== colKey) requestStatusChange(lead, colKey);
  };

  const removeLead = async (lead) => {
    if (!confirm(`Delete lead "${lead.name}"?`)) return;

    const snapshot = [...leads];
    setLeads((ls) => ls.filter((l) => l._id !== lead._id));

    try {
      await api.delete(`/leads/${lead._id}`);
    } catch (err) {
      setLeads(snapshot);
      alert(err.response?.data?.message || "Failed to delete lead");
    }
  };

  // One handler for both modes: an edit replaces the row in place, a create
  // goes to the top of the board.
  const handleSaved = (saved, wasEdit) => {
    if (!saved) return load();
    setLeads((ls) =>
      wasEdit ? ls.map((l) => (l._id === saved._id ? saved : l)) : [saved, ...ls]
    );
    setDetailLead((d) => (d && d._id === saved._id ? saved : d));
    setFormState(null);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          <button
            onClick={() => setFormState({ lead: null })}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
          >
            <Plus size={18} /> New Lead
          </button>
        }
      />

      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm font-bold rounded">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 border-2 border-[#F47C3C]/30 border-t-[#F47C3C] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => {
            const cards = leads.filter((l) => l.status === col.key);

            return (
              <div key={col.key} className="w-72 shrink-0">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${col.tone}`} />
                    <span className="text-sm font-bold text-[#0F253B]">{col.label}</span>
                  </div>
                  <span className="text-xs font-bold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                    {cards.length}
                  </span>
                </div>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverCol !== col.key) setDragOverCol(col.key);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) setDragOverCol(null);
                  }}
                  onDrop={() => handleDrop(col.key)}
                  className={`space-y-3 min-h-[100px] rounded-2xl transition-all ${
                    dragOverCol === col.key ? "ring-2 ring-[#F47C3C]/50 bg-orange-50/40" : ""
                  }`}
                >
                  {cards.map((l) => {
                    const property = l.propertyId;
                    const room = l.roomId;

                    let roomDisplay = "";
                    if (room) {
                      roomDisplay = room.roomNumber
                        ? `Room ${room.roomNumber}`
                        : getRoomDisplayName(room);
                    }

                    const propertyName = property?.name || l.interestedIn || "Any Property";

                    const locationInfo = roomDisplay
                      ? `${roomDisplay} • ${propertyName}`
                      : propertyName;

                    // The card has room for a handful of chips; the rest live
                    // in the detail modal.
                    const answers = applicantEntries(l.applicant);
                    const chips = answers.filter((a) =>
                      ["age", "gender", "workStatus", "occupancy"].includes(a.key)
                    );

                    return (
                      <div
                        key={l._id}
                        draggable
                        onDragStart={(e) => {
                          setDraggingId(l._id);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", l._id);
                        }}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDragOverCol(null);
                        }}
                        className={`bg-white border border-gray-100 rounded-2xl p-4 hover:shadow-md transition-all group cursor-grab active:cursor-grabbing ${
                          draggingId === l._id ? "opacity-40 ring-2 ring-[#F47C3C]/40" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#0F253B] text-white flex items-center justify-center text-xs font-bold shrink-0">
                            {initials(l.name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-[#0F253B] text-sm truncate">{l.name}</p>
                            <p className="text-[11px] text-gray-400 font-medium">{l.source}</p>
                          </div>
                          <button
                            onClick={() => setDetailLead(l)}
                            title="View details"
                            className="text-gray-300 hover:text-[#F47C3C] opacity-0 group-hover:opacity-100 transition-all shrink-0"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            onClick={() => setFormState({ lead: l })}
                            title="Edit lead"
                            className="text-gray-300 hover:text-[#0F253B] opacity-0 group-hover:opacity-100 transition-all shrink-0"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => removeLead(l)}
                            title="Delete lead"
                            className="text-gray-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>

                        <p
                          className="text-xs text-gray-500 font-medium mt-3 truncate"
                          title={locationInfo}
                        >
                          {locationInfo}
                        </p>

                        <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400 font-medium">
                          {l.budget > 0 && (
                            <span className="flex items-center gap-1">
                              <PoundSterling size={11} />
                              {l.budget}/mo
                            </span>
                          )}
                        </div>

                        {chips.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2.5">
                            {chips.map((c) => (
                              <span
                                key={c.key}
                                title={`${c.label}: ${c.value}`}
                                className="text-[10px] font-bold text-gray-500 bg-gray-100 rounded-full px-2 py-0.5"
                              >
                                {c.value}
                              </span>
                            ))}
                            {answers.length > chips.length && (
                              <button
                                onClick={() => setDetailLead(l)}
                                className="text-[10px] font-bold text-[#F47C3C] bg-[#F47C3C]/10 rounded-full px-2 py-0.5 hover:bg-[#F47C3C]/20 transition-all"
                              >
                                +{answers.length - chips.length} more
                              </button>
                            )}
                          </div>
                        )}

                        {l.status === "lost" && l.lostReason && (
                          <p
                            title={l.lostReason}
                            className="mt-2.5 text-[11px] font-medium text-red-700 bg-red-50 border-l-2 border-red-300 rounded-r px-2 py-1.5 line-clamp-2"
                          >
                            {l.lostReason}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50 text-gray-300">
                          {l.email && (
                            <a href={`mailto:${l.email}`} title={l.email}>
                              <Mail size={14} className="hover:text-[#F47C3C] cursor-pointer" />
                            </a>
                          )}
                          {l.phone && (
                            <a href={`tel:${l.phone}`} title={l.phone}>
                              <Phone size={14} className="hover:text-[#F47C3C] cursor-pointer" />
                            </a>
                          )}
                          {l.assignedTo && (
                            <span className="ml-auto text-[10px] font-bold text-gray-400 truncate">
                              {l.assignedTo}
                            </span>
                          )}
                        </div>

                        <AddedBy record={l} className="mt-2" />

                        <select
                          value={l.status}
                          onChange={(e) => requestStatusChange(l, e.target.value)}
                          className="mt-3 w-full text-[11px] font-bold text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-[#F47C3C] outline-none cursor-pointer capitalize"
                        >
                          {LEAD_STAGES.map((s) => (
                            <option key={s} value={s}>
                              Move to: {s}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}

                  {cards.length === 0 && (
                    <div className="text-center text-xs text-gray-300 font-medium py-6 border-2 border-dashed border-gray-100 rounded-2xl">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lostPrompt && (
        <LostReasonModal
          lead={lostPrompt.lead}
          onCancel={() => setLostPrompt(null)}
          onConfirm={async (reason) => {
            // Keep the prompt open if the save failed, so the reason isn't lost.
            const ok = await changeStatus(lostPrompt.lead, lostPrompt.status, reason);
            if (ok) setLostPrompt(null);
          }}
        />
      )}

      {detailLead && (
        <LeadDetailModal
          lead={detailLead}
          onClose={() => setDetailLead(null)}
          onEdit={() => {
            setFormState({ lead: detailLead });
            setDetailLead(null);
          }}
        />
      )}

      {formState && (
        <LeadFormModal
          lead={formState.lead}
          properties={properties}
          onClose={() => setFormState(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
