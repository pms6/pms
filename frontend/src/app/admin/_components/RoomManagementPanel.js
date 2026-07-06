"use client";

import {
  X, FileText, ShieldCheck, Wallet, ClipboardList, LayoutTemplate, CalendarClock,
  CalendarDays, UserPlus, BookOpen, Lock, TrendingUp, Clock, BedDouble, Pencil, Ban,
  Plus, Upload, Check, AlertCircle,
} from "lucide-react";
import { Badge } from "../../Shared/ui";
import { viewings, leads, welcomePack, money } from "../_data/dummy";

const AMENITIES = ["Wi-Fi", "Desk & chair", "Wardrobe", "En-suite", "Smart TV"];

function Section({ icon: Icon, title, badge, action, children }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-50 text-[#F47C3C] flex items-center justify-center"><Icon size={16} /></div>
          <h3 className="font-bold text-[#0F253B]">{title}</h3>
          {badge}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
function Field({ label, value }) {
  return <div><p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p><p className="text-sm font-bold text-[#0F253B] mt-0.5 break-words">{value}</p></div>;
}
function Empty({ text }) {
  return <p className="text-sm text-gray-400 font-medium bg-gray-50 rounded-xl p-3 text-center">{text}</p>;
}
const ghost = "flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-100 hover:bg-gray-100 text-[#0F253B] text-xs font-bold rounded-lg transition-all";
const primary = "flex items-center gap-1.5 px-3 py-1.5 bg-[#F47C3C] hover:bg-[#e06d30] text-white text-xs font-bold rounded-lg";

export default function RoomManagementPanel({ room, property, onEdit, onClose }) {
  const act = (label) => () => alert(`${label} (demo)`);
  const rn = (room.name || "").toLowerCase();
  const roomViewings = viewings.filter((v) => (v.room || "").toLowerCase() === rn);
  const roomLeads = leads.filter((l) => (l.interestedIn || "").toLowerCase().includes(rn));
  const LETTING_TONE = { Available: "green", "Available Soon": "amber", Occupied: "orange" };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-3xl bg-[#F8FAFC] h-full overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Tenancy &amp; Room Management</p>
            <h2 className="text-lg font-bold text-[#0F253B]">{property.name} · {room.name}</h2>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={22} /></button>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          {/* Contract */}
          <Section icon={FileText} title="Contract" action={<button onClick={act("Open contract panel")} className={primary}>Open Panel</button>}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Contract Start" value="05 Jul 2026" />
              <Field label="Fixed Term End" value="04 Jul 2027" />
              <Field label="Type" value="AST (Fixed Term)" />
            </div>
          </Section>

          {/* Right to Rent */}
          <Section icon={ShieldCheck} title="Right to Rent" badge={<Badge tone="green">Verified</Badge>} action={<button onClick={act("Manage Right to Rent")} className={ghost}>Manage</button>}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Document" value="Passport" />
              <Field label="Expiry" value="01 Jan 2030" />
              <Field label="Checked" value="05 Jul 2026" />
            </div>
          </Section>

          {/* Deposit Management */}
          <Section icon={Wallet} title="Deposit Management" badge={<Badge tone="green">Protected</Badge>} action={<button onClick={act("Update deposit")} className={ghost}>Update</button>}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field label="Method" value="Protection Scheme" />
              <Field label="Scheme" value="DPS (Custodial)" />
              <Field label="Amount" value={money(room.moneyHeld || 0)} />
              <Field label="Status" value="Protected" />
            </div>
          </Section>

          {/* Inventory */}
          <Section icon={ClipboardList} title="Inventory" action={<div className="flex gap-2"><button onClick={act("Create inventory")} className={primary}><Plus size={13} /> Create</button><button onClick={act("Upload inventory")} className={ghost}><Upload size={13} /> Upload</button></div>}>
            <Empty text="No inventory created for this tenancy yet." />
          </Section>

          {/* Inventory Builder */}
          <Section icon={LayoutTemplate} title="Inventory Builder" action={<button onClick={act("Create inventory template")} className={primary}><Plus size={13} /> New Template</button>}>
            <Empty text="No room-specific or property-wide templates exist." />
          </Section>

          {/* Viewings */}
          <Section icon={CalendarClock} title="Viewings" action={<button onClick={act("Schedule viewing")} className={primary}><Plus size={13} /> Schedule</button>}>
            {roomViewings.length === 0 ? <Empty text="No viewings booked for this room." /> : (
              <ul className="space-y-2">
                {roomViewings.map((v) => (
                  <li key={v.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                    <div><p className="text-sm font-bold text-[#0F253B]">{v.lead}</p><p className="text-[11px] text-gray-400 font-medium">{v.date} at {v.time} · {v.agent}</p></div>
                    <Badge tone={v.status === "scheduled" ? "blue" : v.status === "done" ? "green" : "gray"}>{v.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Availabilities */}
          <Section icon={CalendarDays} title="Availabilities">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Current Status" value={room.status} />
              <Field label="Available From" value={room.availableFrom || (room.status === "Occupied" ? "Occupied" : "Now")} />
              <Field label="Next Vacancy" value="—" />
            </div>
          </Section>

          {/* Leads */}
          <Section icon={UserPlus} title="Leads">
            {roomLeads.length === 0 ? <Empty text="No prospective enquiries for this room." /> : (
              <ul className="space-y-2">
                {roomLeads.map((l) => (
                  <li key={l.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                    <div><p className="text-sm font-bold text-[#0F253B]">{l.name}</p><p className="text-[11px] text-gray-400 font-medium">{l.source} · {l.assignedTo}</p></div>
                    <Badge tone={l.status === "converted" ? "orange" : l.status === "qualified" ? "green" : l.status === "lost" ? "gray" : "blue"}>{l.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Welcome Pack */}
          <Section icon={BookOpen} title="Welcome Pack" action={<button onClick={act("Manage Welcome Pack")} className={ghost}>Manage</button>}>
            {welcomePack.quickInfo.length === 0 ? <Empty text="No welcome pack information available." /> : (
              <div className="flex flex-wrap gap-2">
                {welcomePack.quickInfo.map((q) => <span key={q.id} className="text-[11px] font-semibold text-gray-600 bg-gray-100 rounded-full px-2.5 py-1">{q.label}: {q.value}</span>)}
              </div>
            )}
          </Section>

          {/* Room Information (private) */}
          <Section icon={Lock} title="Room Information" badge={<Badge tone="gray">Staff only</Badge>} action={<button onClick={act("Add private note")} className={ghost}><Plus size={13} /> Note</button>}>
            <p className="text-sm text-gray-500 font-medium bg-gray-50 rounded-xl p-3">{room.notes || "Private notes, quick info and internal cards visible only to managers and staff."}</p>
          </Section>

          {/* Rent Review */}
          <Section icon={TrendingUp} title="Rent Review" badge={<Badge tone="red">Overdue</Badge>} action={<button onClick={act("Review tenancy rent")} className={primary}>Review Rent</button>}>
            <div className="flex items-center gap-2 text-sm text-red-600 font-semibold"><AlertCircle size={15} /> This tenancy has an overdue rent review.</div>
          </Section>

          {/* Previous Tenancies */}
          <Section icon={Clock} title="Previous Tenancies">
            <Empty text="No previous tenancy records for this room." />
          </Section>

          {/* Room Details */}
          <Section
            icon={BedDouble}
            title="Room Details"
            action={
              <div className="flex gap-2">
                <button onClick={() => { onClose(); onEdit && onEdit(); }} className={primary}><Pencil size={13} /> Edit Room</button>
                <button onClick={act("Deactivate room")} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 text-xs font-bold rounded-lg"><Ban size={13} /> Deactivate</button>
              </div>
            }
          >
            {room.image && (
              <div className="mb-4 h-40 rounded-xl overflow-hidden bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={room.image} alt={room.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Room Name" value={room.name} />
              <Field label="Room Type" value={room.roomType || "Standard"} />
              <Field label="Gender Preference" value="Any" />
              <Field label="Deposit Requirement" value={money(room.moneyHeld || 0)} />
              <Field label="Guarantor Requirement" value={room.guarantor || "Not Required"} />
              <Field label="Monthly Rent" value={`${money(room.rent || 0)}/mo`} />
            </div>
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Amenities</p>
              <div className="flex flex-wrap gap-1.5">{AMENITIES.map((a) => <span key={a} className="text-[11px] font-semibold text-gray-600 bg-gray-100 rounded-full px-2.5 py-1">{a}</span>)}</div>
            </div>
            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Description</p>
              <p className="text-sm text-gray-500 font-medium">{room.notes || "No description added."}</p>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Listing Status</p>
              <Badge tone={LETTING_TONE[room.status] || "gray"}>{room.status}</Badge>
            </div>
          </Section>

          <button onClick={onClose} className="w-full py-3 bg-white border border-gray-200 hover:bg-gray-50 text-[#0F253B] font-bold rounded-xl transition-all">Close</button>
        </div>
      </div>
    </div>
  );
}
