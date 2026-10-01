"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Save,
  Loader2,
  Eye,
  Download,
  Printer,
  Lock,
  Unlock,
  Plus,
  Trash2,
  Copy,
  Camera,
  X,
  LogOut as CheckOutIcon,
  BookmarkPlus,
  ListPlus,
  PenLine,
  Gauge,
  KeyRound,
  ClipboardCheck,
  FileText,
  History,
} from "lucide-react";
import api from "@/app/api/api";
import { useAuth } from "@/app/Context/AuthContext";
import { Badge } from "@/app/Shared/ui";
import { FIELD, LABEL } from "@/app/Shared/registerParts";
import { MediaUploader, MediaViewerModal, uploadAttachment, previewKind, applyFiles } from "@/app/Shared/MediaAttachments";
import {
  JOB_TYPES,
  ROW_CONDITIONS,
  AREA_TYPES,
  STATUS_TONE,
  refNumbers,
  blankRow,
  withKeys,
  forSave,
  newKey,
  fmtDate,
} from "@/app/utils/inventoryReports";
import { openPdf, downloadPdf, printPdf, pdfError } from "@/app/utils/apiPdf";
import { usePortalBase } from "./InventoryReportsPanel";

const CELL =
  "w-full px-2 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-[#0F253B] outline-none focus:ring-2 focus:ring-[#F47C3C] resize-y disabled:bg-gray-50 disabled:text-gray-600";

const toInputDate = (d) => {
  if (!d) return "";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "";
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};

// Textarea that grows with its content, so long condition notes stay readable
// in the table without scrolling inside a tiny box.
function AutoText({ value, onChange, disabled, placeholder, rows = 1, className = CELL }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={rows}
      value={value || ""}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    />
  );
}

// A compact "add photo" control for one row: pick files, upload each to
// Cloudinary through the shared uploader, append as they land.
function PhotoButton({ onAdd, disabled }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(0);
  const pick = async (e) => {
    const list = Array.from(e.target.files || []);
    e.target.value = "";
    setBusy(list.length);
    for (const f of list) {
      try {
        onAdd(await uploadAttachment(f));
      } catch (err) {
        window.alert(err.message || "Upload failed");
      } finally {
        setBusy((n) => n - 1);
      }
    }
  };
  return (
    <>
      <input ref={input} type="file" multiple accept="image/*,video/*,application/pdf" className="hidden" onChange={pick} />
      <button
        type="button"
        disabled={disabled || busy > 0}
        onClick={() => input.current?.click()}
        title="Add photos or documents"
        className="p-1.5 text-gray-400 hover:text-[#F47C3C] hover:bg-orange-50 rounded-lg disabled:opacity-40"
      >
        {busy > 0 ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
      </button>
    </>
  );
}

function Thumbs({ files = [], onOpen, onRemove, disabled }) {
  if (!files.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {files.map((f, i) => (
        <div key={(f.url || "") + i} className="relative group">
          <button type="button" onClick={() => onOpen(i)} className="block">
            {previewKind(f) === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.url} alt="" className="h-11 w-11 rounded-lg object-cover border border-gray-100" />
            ) : (
              <span className="h-11 w-11 rounded-lg border border-gray-100 bg-gray-50 flex items-center justify-center text-gray-400">
                <FileText size={14} />
              </span>
            )}
          </button>
          {!disabled && (
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute -top-1.5 -right-1.5 hidden group-hover:flex w-4 h-4 rounded-full bg-red-500 text-white items-center justify-center"
              title="Remove"
            >
              <X size={10} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

const GRID = "grid grid-cols-[2.5rem_9rem_minmax(10rem,1fr)_minmax(11rem,1fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_5.5rem] gap-2";

// One inventory row. Memoised on the row object, so typing in one row does
// not re-render the other few hundred.
const ItemRow = memo(function ItemRow({ row, refNo, sectionKey, locked, labelAdditional, onChange, onMove, onRemove, onDuplicate, onViewFiles }) {
  const set = (k) => (v) => onChange(sectionKey, row._key, { [k]: v });
  return (
    <div className={`${GRID} px-3 py-2 border-b border-gray-50 items-start ${row.additional ? "bg-amber-50/40" : ""}`}>
      <div className="text-xs font-bold text-gray-500 pt-2">{refNo}.</div>
      <div>
        {labelAdditional && (
          <p className="text-[9px] font-bold uppercase tracking-widest text-amber-600 mb-1">Additional items not present at inventory</p>
        )}
        <AutoText value={row.item} onChange={set("item")} disabled={locked} placeholder={row.additional ? "e.g. 1x office chair" : "Item"} className={CELL + " font-bold"} />
      </div>
      <AutoText value={row.description} onChange={set("description")} disabled={locked} placeholder="Description" />
      <div className="space-y-1">
        <select
          value={row.condition || ""}
          onChange={(e) => set("condition")(e.target.value)}
          disabled={locked}
          className={`${CELL} ${row.condition === "POOR" ? "text-red-700" : row.condition === "FAIR" ? "text-amber-700" : row.condition === "GOOD" ? "text-emerald-700" : ""}`}
        >
          {ROW_CONDITIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <AutoText value={row.conditionComments} onChange={set("conditionComments")} disabled={locked} placeholder="Condition comments" />
      </div>
      <AutoText value={row.checkInComments} onChange={set("checkInComments")} disabled={locked} placeholder="Check-in comments" />
      <AutoText value={row.checkOutComments} onChange={set("checkOutComments")} disabled={locked} placeholder="Check-out comments" />
      <div>
        <div className="flex flex-wrap justify-end">
          <PhotoButton disabled={locked} onAdd={(f) => onChange(sectionKey, row._key, (r) => ({ photos: [...(r.photos || []), f] }))} />
          {!locked && (
            <>
              <button type="button" onClick={() => onMove(sectionKey, row._key, -1)} className="p-1.5 text-gray-400 hover:text-[#0F253B]" title="Move up"><ArrowUp size={14} /></button>
              <button type="button" onClick={() => onMove(sectionKey, row._key, 1)} className="p-1.5 text-gray-400 hover:text-[#0F253B]" title="Move down"><ArrowDown size={14} /></button>
              <button type="button" onClick={() => onDuplicate(sectionKey, row._key)} className="p-1.5 text-gray-400 hover:text-[#0F253B]" title="Duplicate"><Copy size={14} /></button>
              <button type="button" onClick={() => onRemove(sectionKey, row._key)} className="p-1.5 text-gray-400 hover:text-red-600" title="Remove"><Trash2 size={14} /></button>
            </>
          )}
        </div>
        <Thumbs
          files={row.photos}
          disabled={locked}
          onOpen={() => onViewFiles(`Ref ${refNo} – ${row.item || "item"}`, row.photos)}
          onRemove={(i) => onChange(sectionKey, row._key, (r) => ({ photos: r.photos.filter((_, j) => j !== i) }))}
        />
      </div>
    </div>
  );
});

// Draw-to-sign pad. The drawn signature is uploaded as a PNG and stored as a
// URL like any other photo.
function SignaturePad({ value, onChange, disabled }) {
  const canvas = useRef(null);
  const drawing = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const pos = (e) => {
    const r = canvas.current.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * canvas.current.width, ((e.clientY - r.top) / r.height) * canvas.current.height];
  };
  const down = (e) => {
    if (disabled) return;
    drawing.current = true;
    const ctx = canvas.current.getContext("2d");
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0F253B";
    ctx.beginPath();
    ctx.moveTo(...pos(e));
    canvas.current.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    if (!drawing.current) return;
    const ctx = canvas.current.getContext("2d");
    ctx.lineTo(...pos(e));
    ctx.stroke();
    setDirty(true);
  };
  const up = () => (drawing.current = false);
  const clear = () => {
    canvas.current?.getContext("2d").clearRect(0, 0, canvas.current.width, canvas.current.height);
    setDirty(false);
  };
  const save = () =>
    canvas.current.toBlob(async (blob) => {
      if (!blob) return;
      setSaving(true);
      try {
        const up = await uploadAttachment(new File([blob], `signature-${Date.now()}.png`, { type: "image/png" }));
        onChange({ imageUrl: up.url, imagePublicId: up.publicId || "" });
        clear();
      } catch (err) {
        window.alert(err.message || "Could not save the signature");
      } finally {
        setSaving(false);
      }
    }, "image/png");

  if (value) {
    return (
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={value} alt="Signature" className="h-16 bg-white border border-gray-100 rounded-lg px-2" />
        {!disabled && (
          <button type="button" onClick={() => onChange({ imageUrl: "", imagePublicId: "" })} className="text-xs font-bold text-red-600 hover:underline">
            Remove signature
          </button>
        )}
      </div>
    );
  }
  if (disabled) return <p className="text-xs text-gray-400 font-medium">Not signed</p>;
  return (
    <div>
      <canvas
        ref={canvas}
        width={600}
        height={160}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        className="w-full h-24 bg-white border border-dashed border-gray-300 rounded-xl touch-none cursor-crosshair"
      />
      <div className="flex gap-3 mt-1.5">
        <button type="button" onClick={clear} className="text-xs font-bold text-gray-500 hover:underline">Clear</button>
        <button type="button" onClick={save} disabled={!dirty || saving} className="text-xs font-bold text-[#F47C3C] hover:underline disabled:opacity-40">
          {saving ? "Saving…" : "Use this signature"}
        </button>
      </div>
    </div>
  );
}

function Panel({ id, title, icon: Icon, action, children }) {
  return (
    <section id={id} className="bg-white border border-gray-100 rounded-2xl scroll-mt-24">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100 flex-wrap">
        <p className="text-sm font-bold text-[#0F253B] flex items-center gap-2">
          {Icon && <Icon size={15} className="text-[#F47C3C]" />} {title}
        </p>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export default function InventoryReportEditor() {
  const { id } = useParams();
  const router = useRouter();
  const base = usePortalBase();
  const { user } = useAuth();
  const isAdmin = ["OWNER", "ADMIN"].includes(String(user?.organizationRole || "OWNER").toUpperCase());

  const [report, setReport] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [viewer, setViewer] = useState(null);
  const [addTemplateKey, setAddTemplateKey] = useState({});

  const locked = report?.status === "Final";

  useEffect(() => {
    (async () => {
      try {
        const [r, o] = await Promise.all([api.get(`/inventory-reports/${id}`), api.get("/inventory-reports/options")]);
        setReport(withKeys(r.data.data));
        setTemplates(o.data?.data?.templates || []);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load the report.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Leaving with unsaved edits asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const flash = (msg) => {
    setNotice(msg);
    setTimeout(() => setNotice(""), 4000);
  };

  const patch = useCallback((changes) => {
    setReport((r) => ({ ...r, ...(typeof changes === "function" ? changes(r) : changes) }));
    setDirty(true);
  }, []);

  const setField = (k) => (e) => patch({ [k]: e?.target ? e.target.value : e });

  // ---- sections & rows ----
  const updateSection = useCallback((sectionKey, fn) => {
    setReport((r) => ({ ...r, sections: r.sections.map((s) => (s._key === sectionKey ? { ...s, ...fn(s) } : s)) }));
    setDirty(true);
  }, []);

  const changeRow = useCallback(
    (sectionKey, rowKey, change) =>
      updateSection(sectionKey, (s) => ({
        rows: s.rows.map((r) => (r._key === rowKey ? { ...r, ...(typeof change === "function" ? change(r) : change) } : r)),
      })),
    [updateSection]
  );

  const moveRow = useCallback(
    (sectionKey, rowKey, d) =>
      updateSection(sectionKey, (s) => {
        const rows = [...s.rows];
        const i = rows.findIndex((r) => r._key === rowKey);
        let j = i + d;
        // Move within the same group (normal items / additional items).
        while (j >= 0 && j < rows.length && rows[j].additional !== rows[i].additional) j += d;
        if (i < 0 || j < 0 || j >= rows.length) return {};
        [rows[i], rows[j]] = [rows[j], rows[i]];
        return { rows };
      }),
    [updateSection]
  );

  const removeRow = useCallback(
    (sectionKey, rowKey) => updateSection(sectionKey, (s) => ({ rows: s.rows.filter((r) => r._key !== rowKey) })),
    [updateSection]
  );

  const duplicateRow = useCallback(
    (sectionKey, rowKey) =>
      updateSection(sectionKey, (s) => {
        const i = s.rows.findIndex((r) => r._key === rowKey);
        const { _id, ...copy } = s.rows[i];
        const rows = [...s.rows];
        rows.splice(i + 1, 0, { ...copy, _key: newKey(), photos: [] });
        return { rows };
      }),
    [updateSection]
  );

  const viewFiles = useCallback((title, files) => setViewer({ title, files }), []);

  const moveSection = (key, d) =>
    patch((r) => {
      const list = [...r.sections];
      const i = list.findIndex((s) => s._key === key);
      const j = i + d;
      if (j < 0 || j >= list.length) return {};
      [list[i], list[j]] = [list[j], list[i]];
      return { sections: list };
    });

  const addSection = () => {
    const key = addTemplateKey.__new || "builtin:BEDROOM";
    const t = templates.find((x) => x.key === key);
    patch((r) => ({
      sections: [
        ...r.sections,
        {
          _key: newKey(),
          title: t?.name || "Area",
          areaType: t?.areaType || "OTHER",
          notes: "",
          rows: (t?.items || []).map((i) => blankRow({ item: i.item, description: i.description })),
          photos: [],
        },
      ],
    }));
  };

  const addTemplateItems = (sectionKey) => {
    const t = templates.find((x) => x.key === addTemplateKey[sectionKey]);
    if (!t) return;
    updateSection(sectionKey, (s) => ({ rows: [...s.rows, ...t.items.map((i) => blankRow({ item: i.item, description: i.description }))] }));
  };

  const saveAsTemplate = async (s) => {
    const name = window.prompt("Save this area's items as a template called:", s.title);
    if (!name) return;
    try {
      const res = await api.post("/inventory-reports/templates", {
        name,
        areaType: s.areaType,
        items: s.rows.filter((r) => !r.additional).map((r) => ({ item: r.item, description: r.description })),
      });
      const t = res.data.data;
      setTemplates((l) => [...l, { key: `org:${t._id}`, _id: t._id, name: t.name, areaType: t.areaType, items: t.items, builtIn: false }]);
      flash(`Template "${name}" saved.`);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save the template.");
    }
  };

  const refs = useMemo(() => refNumbers(report?.sections || []), [report?.sections]);

  // ---- save / lifecycle ----
  const save = useCallback(async () => {
    if (!report || locked) return true;
    setBusy("save");
    setError("");
    try {
      const body = forSave(report);
      const res = await api.put(`/inventory-reports/${id}`, {
        jobType: body.jobType,
        inspectionDate: body.inspectionDate,
        preparedBy: body.preparedBy,
        instructedBy: body.instructedBy,
        propertyType: body.propertyType,
        propertyAddress: body.propertyAddress,
        generalNotes: body.generalNotes,
        scheduleSubject: body.scheduleSubject,
        scheduleOfCondition: body.scheduleOfCondition,
        scheduleNote: body.scheduleNote,
        meterReadings: body.meterReadings,
        sections: body.sections,
        keys: body.keys,
        keyExchangeNote: body.keyExchangeNote,
        signatureNote: body.signatureNote,
        signatures: body.signatures,
        disclaimer: body.disclaimer,
        files: body.files,
      });
      setReport(withKeys(res.data.data));
      setDirty(false);
      flash("Saved.");
      return true;
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save.");
      return false;
    } finally {
      setBusy("");
    }
  }, [report, locked, id]);

  // Ctrl/Cmd+S saves.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  const pdfAction = async (kind) => {
    if (dirty && !(await save())) return;
    setBusy(kind);
    try {
      const path = `/inventory-reports/${id}/pdf`;
      if (kind === "preview") await openPdf(path);
      else if (kind === "print") await printPdf(path);
      else await downloadPdf(`${path}?download=1`, `${report.jobType}-${report.reference}.pdf`);
    } catch (err) {
      setError(await pdfError(err));
    } finally {
      setBusy("");
    }
  };

  const finalise = async () => {
    if (!window.confirm("Finalise this report? It will be locked, its PDF generated and filed with the property's documents.")) return;
    if (dirty && !(await save())) return;
    setBusy("finalise");
    try {
      const res = await api.post(`/inventory-reports/${id}/finalise`);
      setReport(withKeys(res.data.data));
      flash(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to finalise.");
    } finally {
      setBusy("");
    }
  };

  const reopen = async () => {
    const reason = window.prompt("Why is this report being reopened? (kept in its history)");
    if (reason === null) return;
    setBusy("reopen");
    try {
      const res = await api.post(`/inventory-reports/${id}/reopen`, { reason });
      setReport(withKeys(res.data.data));
      flash("Reopened for editing.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to reopen.");
    } finally {
      setBusy("");
    }
  };

  const startCheckOut = async () => {
    if (dirty && !(await save())) return;
    setBusy("checkout");
    try {
      const res = await api.post(`/inventory-reports/${id}/check-out`);
      router.push(`${base}/inventory/reports/${res.data.data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to start the check-out report.");
      setBusy("");
    }
  };

  const remove = async () => {
    if (!window.confirm("Delete this report?")) return;
    try {
      await api.delete(`/inventory-reports/${id}`);
      setDirty(false);
      router.push(`${base}/inventory?tab=reports`);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#F47C3C]" />
      </div>
    );
  }
  if (!report) {
    return (
      <div className="space-y-3">
        <Link href={`${base}/inventory?tab=reports`} className="text-sm font-bold text-[#F47C3C]">← Inventory reports</Link>
        <div className="p-4 bg-red-50 text-red-700 rounded-xl font-bold">{error || "Report not found."}</div>
      </div>
    );
  }

  const signatureFor = (role) => report.signatures?.find((s) => s.role === role) || { role, name: "", date: null, imageUrl: "" };
  const setSignature = (role, change) =>
    patch((r) => {
      const list = ["Tenant", "Landlord", "Clerk"].map((ro) => r.signatures?.find((s) => s.role === ro) || { role: ro, name: "", date: null, imageUrl: "" });
      return { signatures: list.map((s) => (s.role === role ? { ...s, ...change } : s)) };
    });

  const btn = "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50";

  return (
    <div className="space-y-5 pb-24">
      {/* ---- header ---- */}
      <div className="flex flex-col gap-3">
        <Link href={`${base}/inventory?tab=reports`} className="text-xs font-bold text-gray-400 hover:text-[#F47C3C] flex items-center gap-1 w-fit">
          <ArrowLeft size={14} /> Inventory reports
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-[#0F253B]">{report.jobType} · {report.reference}</h1>
              <Badge tone={STATUS_TONE[report.status]}>{report.status}</Badge>
              {dirty && <Badge tone="amber">Unsaved changes</Badge>}
            </div>
            <p className="text-sm text-gray-400 font-medium">
              {report.propertyAddress || report.property}
              {report.room ? ` · ${report.room}` : ""}
              {report.tenantName ? ` · ${report.tenantName}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!locked && (
              <button onClick={save} disabled={busy === "save" || !dirty} className={`${btn} bg-[#0F253B] text-white`}>
                {busy === "save" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
              </button>
            )}
            <button onClick={() => pdfAction("preview")} disabled={!!busy} className={`${btn} bg-white border border-gray-200 text-[#0F253B]`}>
              {busy === "preview" ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} Preview PDF
            </button>
            <button onClick={() => pdfAction("download")} disabled={!!busy} className={`${btn} bg-white border border-gray-200 text-[#0F253B]`}>
              {busy === "download" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Download
            </button>
            <button onClick={() => pdfAction("print")} disabled={!!busy} className={`${btn} bg-white border border-gray-200 text-[#0F253B]`}>
              <Printer size={14} /> Print
            </button>
            {report.jobType !== "Check Out" && (
              <button onClick={startCheckOut} disabled={!!busy} className={`${btn} bg-white border border-gray-200 text-[#0F253B]`} title="Start a check-out report from this one">
                {busy === "checkout" ? <Loader2 size={14} className="animate-spin" /> : <CheckOutIcon size={14} />} Start check-out
              </button>
            )}
            {!locked ? (
              <button onClick={finalise} disabled={!!busy} className={`${btn} bg-[#F47C3C] text-white`}>
                {busy === "finalise" ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />} Finalise
              </button>
            ) : (
              isAdmin && (
                <button onClick={reopen} disabled={!!busy} className={`${btn} bg-white border border-gray-200 text-[#0F253B]`}>
                  <Unlock size={14} /> Reopen
                </button>
              )
            )}
          </div>
        </div>
        {error && <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">{error}</div>}
        {notice && <div className="p-3 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 text-xs font-bold rounded">{notice}</div>}
        {locked && (
          <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-medium text-gray-500 flex items-center gap-2 flex-wrap">
            <Lock size={13} /> Finalised {fmtDate(report.finalisedAt)} — locked.
            {report.pdf?.url && (
              <a href={report.pdf.url} target="_blank" rel="noopener noreferrer" className="font-bold text-[#F47C3C] hover:underline">
                Filed PDF
              </a>
            )}
            {!isAdmin && "An owner or admin can reopen it for correction."}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[13rem_minmax(0,1fr)] gap-5 items-start">
        {/* ---- contents ---- */}
        <nav className="hidden xl:block sticky top-20 bg-white border border-gray-100 rounded-2xl p-3 text-xs font-bold space-y-0.5 max-h-[80vh] overflow-y-auto">
          <p className="px-2 pb-2 text-[10px] uppercase tracking-widest text-gray-400">Contents</p>
          {[
            ["details", "Report details"],
            ["schedule", "Schedule of Condition"],
            ["meters", "Meter Readings"],
            ...report.sections.map((s) => [`area-${s._key}`, s.title]),
            ["keys", "Key Exchange & Signatures"],
            ["disclaimer", "Disclaimer"],
            ["history", "History"],
          ].map(([a, label]) => (
            <a key={a} href={`#${a}`} className="block px-2 py-1.5 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-[#0F253B] truncate">
              {label}
            </a>
          ))}
        </nav>

        <div className="space-y-5 min-w-0">
          {/* ---- details ---- */}
          <Panel id="details" title="Report details" icon={ClipboardCheck}>
            <fieldset disabled={locked} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className={LABEL}>Job type</label>
                <select className={FIELD} value={report.jobType} onChange={setField("jobType")}>
                  {JOB_TYPES.map((j) => <option key={j}>{j}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Date of inspection</label>
                <input type="date" className={FIELD} value={toInputDate(report.inspectionDate)} onChange={setField("inspectionDate")} />
              </div>
              <div>
                <label className={LABEL}>Reference number</label>
                <input className={FIELD} value={report.reference} disabled />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className={LABEL}>Address</label>
                <input className={FIELD} value={report.propertyAddress || ""} onChange={setField("propertyAddress")} />
              </div>
              <div>
                <label className={LABEL}>Prepared by</label>
                <input className={FIELD} value={report.preparedBy || ""} onChange={setField("preparedBy")} />
              </div>
              <div>
                <label className={LABEL}>Instructed by</label>
                <input className={FIELD} value={report.instructedBy || ""} onChange={setField("instructedBy")} />
              </div>
              <div>
                <label className={LABEL}>Type of property</label>
                <input className={FIELD} value={report.propertyType || ""} onChange={setField("propertyType")} placeholder="e.g. 5x Bedroom House" />
              </div>
              <div>
                <label className={LABEL}>Property</label>
                <input className={FIELD} value={report.property || ""} disabled />
              </div>
              <div>
                <label className={LABEL}>Room</label>
                <input className={FIELD} value={report.room || "Whole property"} disabled />
              </div>
              <div>
                <label className={LABEL}>Tenant</label>
                <input className={FIELD} value={report.tenantName || "—"} disabled />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className={LABEL}>General notes</label>
                <AutoText value={report.generalNotes} onChange={setField("generalNotes")} disabled={locked} rows={2} className={FIELD} />
              </div>
            </fieldset>
          </Panel>

          {/* ---- schedule of condition ---- */}
          <Panel
            id="schedule"
            title="Schedule of Condition"
            icon={ClipboardCheck}
            action={
              !locked && (
                <button
                  type="button"
                  onClick={() => patch((r) => ({ scheduleOfCondition: [...(r.scheduleOfCondition || []), { group: "", subject: "", comment: "" }] }))}
                  className="text-xs font-bold text-[#F47C3C] flex items-center gap-1"
                >
                  <Plus size={13} /> Add subject
                </button>
              )
            }
          >
            <fieldset disabled={locked} className="space-y-2">
              <div className="grid grid-cols-[8rem_1fr] gap-2 items-center">
                <label className={LABEL + " mb-0"}>Subject</label>
                <input className={CELL} value={report.scheduleSubject || ""} onChange={setField("scheduleSubject")} placeholder="End of Tenancy" />
              </div>
              {(report.scheduleOfCondition || []).map((row, i) => (
                <div key={i} className="grid grid-cols-[6rem_9rem_1fr_2rem] gap-2 items-start">
                  <input
                    className={CELL}
                    value={row.group}
                    placeholder="Group"
                    onChange={(e) => patch((r) => ({ scheduleOfCondition: r.scheduleOfCondition.map((x, j) => (j === i ? { ...x, group: e.target.value } : x)) }))}
                  />
                  <input
                    className={CELL + " font-bold"}
                    value={row.subject}
                    onChange={(e) => patch((r) => ({ scheduleOfCondition: r.scheduleOfCondition.map((x, j) => (j === i ? { ...x, subject: e.target.value } : x)) }))}
                  />
                  <AutoText
                    value={row.comment}
                    disabled={locked}
                    placeholder="e.g. Dirty and stained. Requiring clean."
                    onChange={(v) => patch((r) => ({ scheduleOfCondition: r.scheduleOfCondition.map((x, j) => (j === i ? { ...x, comment: v } : x)) }))}
                  />
                  {!locked && (
                    <button type="button" onClick={() => patch((r) => ({ scheduleOfCondition: r.scheduleOfCondition.filter((_, j) => j !== i) }))} className="p-1.5 text-gray-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              <div className="pt-2">
                <label className={LABEL}>Note printed under the schedule</label>
                <AutoText value={report.scheduleNote} onChange={setField("scheduleNote")} disabled={locked} rows={3} className={FIELD} />
              </div>
            </fieldset>
          </Panel>

          {/* ---- meters ---- */}
          <Panel
            id="meters"
            title="Meter Readings"
            icon={Gauge}
            action={
              !locked && (
                <button
                  type="button"
                  onClick={() => patch((r) => ({ meterReadings: [...(r.meterReadings || []), { type: "", reading: "", serialNumber: "", location: "", keyType: "", photos: [] }] }))}
                  className="text-xs font-bold text-[#F47C3C] flex items-center gap-1"
                >
                  <Plus size={13} /> Add meter
                </button>
              )
            }
          >
            <div className="overflow-x-auto">
              <div className="min-w-[760px] space-y-2">
                <div className="grid grid-cols-[7rem_7rem_1fr_1fr_1fr_4.5rem] gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  <span>Type</span><span>Reading</span><span>Serial numbers</span><span>Meter location</span><span>Type of key for access</span><span />
                </div>
                {(report.meterReadings || []).map((m, i) => {
                  const setM = (k) => (e) => patch((r) => ({ meterReadings: r.meterReadings.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)) }));
                  return (
                    <div key={i}>
                      <div className="grid grid-cols-[7rem_7rem_1fr_1fr_1fr_4.5rem] gap-2 items-start">
                        {["type", "reading", "serialNumber", "location", "keyType"].map((k) => (
                          <input key={k} className={CELL} value={m[k] || ""} onChange={setM(k)} disabled={locked} />
                        ))}
                        <div className="flex">
                          <PhotoButton disabled={locked} onAdd={(f) => patch((r) => ({ meterReadings: r.meterReadings.map((x, j) => (j === i ? { ...x, photos: [...(x.photos || []), f] } : x)) }))} />
                          {!locked && (
                            <button type="button" onClick={() => patch((r) => ({ meterReadings: r.meterReadings.filter((_, j) => j !== i) }))} className="p-1.5 text-gray-400 hover:text-red-600">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      <Thumbs
                        files={m.photos}
                        disabled={locked}
                        onOpen={() => viewFiles(`${m.type || "Meter"} meter`, m.photos)}
                        onRemove={(k) => patch((r) => ({ meterReadings: r.meterReadings.map((x, j) => (j === i ? { ...x, photos: x.photos.filter((_, n) => n !== k) } : x)) }))}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </Panel>

          {/* ---- areas ---- */}
          {report.sections.map((s, si) => {
            let seenAdditional = false;
            const normal = s.rows.filter((r) => !r.additional);
            const extra = s.rows.filter((r) => r.additional);
            return (
              <section key={s._key} id={`area-${s._key}`} className="bg-white border border-gray-100 rounded-2xl scroll-mt-24">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 flex-wrap">
                  <input
                    value={s.title}
                    disabled={locked}
                    onChange={(e) => updateSection(s._key, () => ({ title: e.target.value }))}
                    className="text-base font-bold text-[#0F253B] bg-transparent outline-none focus:bg-gray-50 rounded-lg px-2 py-1 min-w-0 flex-1"
                  />
                  <select
                    value={s.areaType}
                    disabled={locked}
                    onChange={(e) => updateSection(s._key, () => ({ areaType: e.target.value }))}
                    className="px-2 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-xs font-bold text-gray-600"
                  >
                    {AREA_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  <span className="text-[11px] font-bold text-gray-400">{s.rows.length} items</span>
                  {!locked && (
                    <div className="flex items-center">
                      <button type="button" onClick={() => moveSection(s._key, -1)} disabled={si === 0} className="p-1.5 text-gray-400 hover:text-[#0F253B] disabled:opacity-30" title="Move area up"><ArrowUp size={15} /></button>
                      <button type="button" onClick={() => moveSection(s._key, 1)} disabled={si === report.sections.length - 1} className="p-1.5 text-gray-400 hover:text-[#0F253B] disabled:opacity-30" title="Move area down"><ArrowDown size={15} /></button>
                      <button type="button" onClick={() => saveAsTemplate(s)} className="p-1.5 text-gray-400 hover:text-[#0F253B]" title="Save as template"><BookmarkPlus size={15} /></button>
                      <button
                        type="button"
                        onClick={() => window.confirm(`Remove "${s.title}" and its ${s.rows.length} items?`) && patch((r) => ({ sections: r.sections.filter((x) => x._key !== s._key) }))}
                        className="p-1.5 text-gray-400 hover:text-red-600"
                        title="Remove area"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <div className="min-w-[1100px]">
                    <div className={`${GRID} px-3 py-2 bg-[#0F253B] text-white text-[10px] font-bold uppercase tracking-widest`}>
                      <span>Ref</span><span>Item</span><span>Description</span><span>Condition + Comments</span><span>Check In Comments</span><span>Check Out Comments</span><span />
                    </div>
                    {[...normal, ...extra].map((row) => {
                      const label = row.additional && !seenAdditional;
                      if (row.additional) seenAdditional = true;
                      return (
                        <ItemRow
                          key={row._key}
                          row={row}
                          refNo={refs.get(row._key)}
                          sectionKey={s._key}
                          locked={locked}
                          labelAdditional={label}
                          onChange={changeRow}
                          onMove={moveRow}
                          onRemove={removeRow}
                          onDuplicate={duplicateRow}
                          onViewFiles={viewFiles}
                        />
                      );
                    })}
                    {s.rows.length === 0 && <p className="px-5 py-6 text-sm text-gray-400 font-medium">No items yet.</p>}
                  </div>
                </div>

                <div className="px-5 py-4 space-y-4 border-t border-gray-50">
                  {!locked && (
                    <div className="flex flex-wrap gap-2 items-center">
                      <button
                        type="button"
                        onClick={() => updateSection(s._key, (x) => ({ rows: [...x.rows.filter((r) => !r.additional), blankRow(), ...x.rows.filter((r) => r.additional)] }))}
                        className="px-3 py-2 rounded-xl bg-orange-50 text-[#F47C3C] text-xs font-bold flex items-center gap-1"
                      >
                        <Plus size={13} /> Add item
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSection(s._key, (x) => ({ rows: [...x.rows, blankRow({ additional: true })] }))}
                        className="px-3 py-2 rounded-xl bg-amber-50 text-amber-700 text-xs font-bold flex items-center gap-1"
                      >
                        <Plus size={13} /> Add item not present at inventory
                      </button>
                      <div className="flex gap-1.5 items-center">
                        <select
                          value={addTemplateKey[s._key] || ""}
                          onChange={(e) => setAddTemplateKey((m) => ({ ...m, [s._key]: e.target.value }))}
                          className="px-2 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-gray-600"
                        >
                          <option value="">Add items from a template…</option>
                          {templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
                        </select>
                        <button type="button" onClick={() => addTemplateItems(s._key)} disabled={!addTemplateKey[s._key]} className="p-2 rounded-xl bg-gray-100 text-[#0F253B] disabled:opacity-40" title="Add these items">
                          <ListPlus size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <label className={LABEL}>Area notes (printed above the table)</label>
                      <AutoText value={s.notes} disabled={locked} rows={2} className={FIELD} onChange={(v) => updateSection(s._key, () => ({ notes: v }))} />
                    </div>
                    {locked ? (
                      <div>
                        <label className={LABEL}>{s.title} photos ({s.photos?.length || 0})</label>
                        <Thumbs files={s.photos} disabled onOpen={() => viewFiles(`${s.title} photos`, s.photos)} />
                      </div>
                    ) : (
                      <MediaUploader
                        label={`${s.title} photos`}
                        hint="General photos of this area — printed after the item photos"
                        accept="image/*,video/*"
                        files={s.photos || []}
                        onChange={(u) => updateSection(s._key, (sec) => ({ photos: applyFiles(u, sec.photos) }))}
                      />
                    )}
                  </div>
                </div>
              </section>
            );
          })}

          {!locked && (
            <div className="flex flex-wrap gap-2 items-center bg-white border border-dashed border-gray-200 rounded-2xl p-4">
              <p className="text-sm font-bold text-[#0F253B] mr-2">Add a room or area</p>
              <select
                value={addTemplateKey.__new || "builtin:BEDROOM"}
                onChange={(e) => setAddTemplateKey((m) => ({ ...m, __new: e.target.value }))}
                className="px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-gray-600"
              >
                {templates.map((t) => <option key={t.key} value={t.key}>{t.name}{t.builtIn ? "" : " (saved)"}</option>)}
              </select>
              <button type="button" onClick={addSection} className="px-4 py-2 rounded-xl bg-[#F47C3C] text-white text-xs font-bold flex items-center gap-1">
                <Plus size={13} /> Add area
              </button>
            </div>
          )}

          {/* ---- keys & signatures ---- */}
          <Panel id="keys" title="Key Exchange & Signatures" icon={KeyRound}>
            <fieldset disabled={locked} className="space-y-4">
              <AutoText value={report.keyExchangeNote} onChange={setField("keyExchangeNote")} disabled={locked} rows={2} className={FIELD} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={LABEL}>Sets of keys</label>
                  <input className={FIELD} value={report.keys?.sets || ""} onChange={(e) => patch((r) => ({ keys: { ...r.keys, sets: e.target.value } }))} />
                </div>
                <div>
                  <label className={LABEL}>Number of keys</label>
                  <input className={FIELD} value={report.keys?.count || ""} onChange={(e) => patch((r) => ({ keys: { ...r.keys, count: e.target.value } }))} />
                </div>
                <div>
                  <label className={LABEL}>Key notes</label>
                  <input className={FIELD} value={report.keys?.notes || ""} onChange={(e) => patch((r) => ({ keys: { ...r.keys, notes: e.target.value } }))} placeholder="e.g. 2x Yale, 1x Chubb, 1x fob" />
                </div>
              </div>
              {!locked ? (
                <MediaUploader
                  label="Photos of the keys"
                  accept="image/*"
                  files={report.keys?.photos || []}
                  onChange={(u) => patch((r) => ({ keys: { ...r.keys, photos: applyFiles(u, r.keys?.photos) } }))}
                />
              ) : (
                <Thumbs files={report.keys?.photos} disabled onOpen={() => viewFiles("Keys", report.keys?.photos)} />
              )}

              <div className="pt-2 border-t border-gray-100">
                <p className="text-sm font-bold text-[#0F253B] flex items-center gap-2 mb-2"><PenLine size={15} className="text-[#F47C3C]" /> Signatures</p>
                <AutoText value={report.signatureNote} onChange={setField("signatureNote")} disabled={locked} rows={2} className={FIELD} />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
                  {["Tenant", "Landlord", "Clerk"].map((role) => {
                    const sg = signatureFor(role);
                    return (
                      <div key={role} className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-2">
                        <p className="text-xs font-bold uppercase tracking-widest text-[#F47C3C]">{role}</p>
                        <input className={CELL} placeholder="Name" value={sg.name || ""} onChange={(e) => setSignature(role, { name: e.target.value })} />
                        <input type="date" className={CELL} value={toInputDate(sg.date)} onChange={(e) => setSignature(role, { date: e.target.value || null })} />
                        <SignaturePad value={sg.imageUrl} disabled={locked} onChange={(c) => setSignature(role, c)} />
                      </div>
                    );
                  })}
                </div>
              </div>
            </fieldset>
          </Panel>

          {/* ---- disclaimer ---- */}
          <Panel id="disclaimer" title="Disclaimer" icon={FileText}>
            <AutoText value={report.disclaimer} onChange={setField("disclaimer")} disabled={locked} rows={8} className={FIELD + " text-xs"} />
          </Panel>

          {/* ---- supporting files & history ---- */}
          <Panel id="history" title="Supporting documents & history" icon={History}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {locked ? (
                <Thumbs files={report.files} disabled onOpen={() => viewFiles("Supporting documents", report.files)} />
              ) : (
                <MediaUploader label="Supporting documents" files={report.files || []} onChange={(u) => patch((r) => ({ files: applyFiles(u, r.files) }))} />
              )}
              <ul className="space-y-2">
                {(report.history || []).slice().reverse().map((h, i) => (
                  <li key={i} className="text-xs">
                    <span className="font-bold text-[#0F253B]">{h.action}</span>
                    {h.note && <span className="text-gray-500"> — {h.note}</span>}
                    <span className="block text-gray-400">{new Date(h.at).toLocaleString("en-GB")} · {h.byEmail}</span>
                  </li>
                ))}
              </ul>
            </div>
            {!locked && (
              <button type="button" onClick={remove} className="mt-5 text-xs font-bold text-red-600 hover:underline">
                Delete this report
              </button>
            )}
          </Panel>
        </div>
      </div>

      {/* Sticky save bar while there are unsaved edits. */}
      {dirty && !locked && (
        <div className="fixed bottom-4 right-4 z-40 flex items-center gap-3 bg-[#0F253B] text-white px-4 py-3 rounded-2xl shadow-2xl">
          <span className="text-xs font-bold">Unsaved changes</span>
          <button onClick={save} disabled={busy === "save"} className="px-3 py-1.5 rounded-lg bg-[#F47C3C] text-xs font-bold flex items-center gap-1">
            {busy === "save" ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save
          </button>
        </div>
      )}

      {viewer && <MediaViewerModal title={viewer.title} files={viewer.files || []} onClose={() => setViewer(null)} />}
    </div>
  );
}
