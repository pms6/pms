// utils/pdf/inventoryReportPdf.js
//
// The Inventory Report as a PDF, laid out like the office's reference report:
//
//   cover (company, date, address, job type, ref, prepared/instructed by, type
//   of property, general notes) → contents → schedule of condition → meter
//   readings → one table per area, each followed by its photos → key exchange
//   and signatures → keys → disclaimer
//
// Every page carries the running header the reference has:
//   "Check Out - Ref: C7953                                   Page 18 of 118"
//   "COMPANY            53 Rowsley Ave London NW4 1AP            07/07/26"
//
// Tables repeat their header row on every page and never split a row across a
// page break, so long areas and long comments paginate cleanly.

import {
  renderPdf,
  fetchImages,
  fmtDate,
  fmtShortDate,
  NAVY,
  ORANGE,
  GREY,
  RULE,
  SHADE,
} from "./common.js";

const CONDITION_LABEL = { GOOD: "Good", FAIR: "Fair", POOR: "Poor/Damaged" };

const isImage = (f) => f?.url && (f.type === "image" || f.type === "video" || !f.type);

// Ref numbers run continuously through the whole report, in row order.
export const numberRows = (sections = []) => {
  let n = 0;
  return sections.map((s) => {
    const normal = (s.rows || []).filter((r) => !r.additional);
    const extra = (s.rows || []).filter((r) => r.additional);
    return { ...s, ordered: [...normal, ...extra].map((r) => ({ ...r, ref: ++n })) };
  });
};

const tableLayout = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => RULE,
  vLineColor: () => RULE,
  paddingLeft: () => 4,
  paddingRight: () => 4,
  paddingTop: () => 3,
  paddingBottom: () => 3,
  fillColor: (rowIndex) => (rowIndex === 0 ? NAVY : null),
};

const th = (text) => ({ text, bold: true, color: "#FFFFFF", fontSize: 8 });
const cell = (text, extra = {}) => ({ text: text || "", fontSize: 8, ...extra });

const heading = (text, { toc = true, pageBreak = "before" } = {}) => ({
  text,
  style: "h1",
  tocItem: toc,
  pageBreak,
});

// 3-across photo grid, each captioned — the reference's six-to-a-page photo
// pages.
const photoGrid = (photos, images) => {
  const cells = photos
    .map((p) => {
      const data = images.get(p.key);
      if (!data) return null;
      return {
        stack: [
          { image: data, fit: [165, 150], alignment: "center" },
          { text: p.caption || "", fontSize: 7, color: GREY, alignment: "center", margin: [0, 3, 0, 0] },
        ],
        margin: [0, 0, 0, 10],
      };
    })
    .filter(Boolean);
  if (!cells.length) return null;
  const rows = [];
  for (let i = 0; i < cells.length; i += 3) {
    const r = cells.slice(i, i + 3);
    while (r.length < 3) r.push({ text: "" });
    rows.push(r);
  }
  return {
    table: { widths: ["*", "*", "*"], body: rows, dontBreakRows: true },
    layout: "noBorders",
  };
};

// Non-image attachments can't go in a grid, so they are listed by name with a
// link to the file.
const fileList = (files) => {
  const docs = files.filter((f) => f?.url && !isImage(f));
  if (!docs.length) return null;
  return {
    margin: [0, 6, 0, 0],
    stack: [
      { text: "Attached documents", bold: true, fontSize: 8, margin: [0, 0, 0, 2] },
      ...docs.map((f) => ({ text: f.name || f.url, link: f.url, color: ORANGE, fontSize: 8, decoration: "underline" })),
    ],
  };
};

/**
 * @param {object} report  an InventoryReport (lean)
 * @param {object} company { name, phone, email, address, logo }
 * @returns {Promise<Buffer>}
 */
export const buildInventoryReportPdf = async (report, company = {}) => {
  const sections = numberRows(report.sections || []);
  const allRows = sections.flatMap((s) => s.ordered);

  const showCheckIn =
    report.jobType === "Check In" || allRows.some((r) => (r.checkInComments || "").trim());
  const showCheckOut =
    report.jobType === "Check Out" || allRows.some((r) => (r.checkOutComments || "").trim());

  // ---- gather every image first so they load in parallel ----
  const jobs = [];
  const add = (key, url, opts) => url && jobs.push({ key, url, opts });
  if (company.logo) add("logo", company.logo, { size: 500, png: true });
  for (const s of sections) {
    for (const r of s.ordered) {
      (r.photos || []).filter(isImage).forEach((p, i) => add(`r:${s._id}:${r.ref}:${i}`, p.url, { kind: p.type }));
    }
    (s.photos || []).filter(isImage).forEach((p, i) => add(`s:${s._id}:${i}`, p.url, { kind: p.type }));
  }
  (report.meterReadings || []).forEach((m, mi) =>
    (m.photos || []).filter(isImage).forEach((p, i) => add(`m:${mi}:${i}`, p.url, { kind: p.type }))
  );
  (report.keys?.photos || []).filter(isImage).forEach((p, i) => add(`k:${i}`, p.url, { kind: p.type }));
  (report.signatures || []).forEach((sg) => sg.imageUrl && add(`sig:${sg.role}`, sg.imageUrl, { size: 600, png: true }));
  const images = await fetchImages(jobs);

  const companyName = company.name || "";
  const address = report.propertyAddress || report.property || "";
  const shortDate = fmtShortDate(report.inspectionDate);

  const content = [];

  // ================= Cover =================
  const coverDetails = [
    ["Date of Inspection", fmtDate(report.inspectionDate)],
    ["Address", address],
    ["Job Type", report.jobType],
    ["Reference Number", report.reference],
    ["Prepared By", report.preparedBy],
    ["Instructed By", report.instructedBy],
    ["Type of Property", report.propertyType],
    ...(report.room ? [["Room", report.room]] : []),
    ...(report.tenantName ? [["Tenant", report.tenantName]] : []),
    ["General Notes", report.generalNotes],
  ];

  content.push(
    {
      columns: [
        images.get("logo") ? { image: images.get("logo"), fit: [170, 80] } : { text: "" },
        {
          stack: [
            { text: companyName, bold: true, fontSize: 13, color: NAVY, alignment: "right" },
            company.address ? { text: company.address, alignment: "right", color: GREY } : null,
            company.phone ? { text: company.phone, alignment: "right", color: GREY } : null,
            company.email ? { text: company.email, alignment: "right", color: GREY } : null,
          ].filter(Boolean),
        },
      ],
      margin: [0, 10, 0, 40],
    },
    { text: `${report.jobType} Report`, fontSize: 24, bold: true, color: NAVY, margin: [0, 0, 0, 4] },
    { text: address, fontSize: 12, color: GREY, margin: [0, 0, 0, 24] },
    {
      table: {
        widths: [130, "*"],
        body: coverDetails.map(([k, v]) => [
          { text: k, bold: true, fillColor: SHADE, fontSize: 9 },
          { text: v || "", fontSize: 9 },
        ]),
      },
      layout: { ...tableLayout, fillColor: () => null },
    }
  );

  // ================= Contents =================
  content.push({
    toc: {
      title: { text: "Contents", style: "h1" },
      numberStyle: { bold: true },
      textStyle: { fontSize: 10 },
    },
    pageBreak: "before",
  });

  // ================= Schedule of condition =================
  const soc = (report.scheduleOfCondition || []).filter((r) => r.subject);
  if (soc.length || report.scheduleSubject) {
    content.push(heading("Schedule of Condition"));
    const body = [];
    if (report.scheduleSubject) {
      body.push([
        { text: "Subject", bold: true, fillColor: SHADE },
        { text: report.scheduleSubject, bold: true, fillColor: SHADE },
      ]);
    }
    let group = "";
    for (const r of soc) {
      if (r.group && r.group !== group) {
        body.push([{ text: r.group, bold: true, colSpan: 2, fillColor: SHADE }, {}]);
      }
      group = r.group || "";
      body.push([{ text: r.subject, bold: !r.group }, { text: r.comment || "" }]);
    }
    if (body.length) {
      content.push({
        table: { widths: [130, "*"], body, dontBreakRows: true },
        layout: { ...tableLayout, fillColor: () => null },
      });
    }
    if (report.scheduleNote) {
      content.push({ text: report.scheduleNote, fontSize: 8, color: GREY, margin: [0, 12, 0, 0] });
    }
  }

  // ================= Meter readings =================
  const meters = (report.meterReadings || []).filter((m) => m.type || m.reading || m.serialNumber);
  if (meters.length) {
    content.push(heading("Meter Readings"));
    content.push({
      table: {
        headerRows: 1,
        widths: [70, 80, "*", "*", "*"],
        body: [
          [th("Type"), th("Reading"), th("Serial Numbers"), th("Meter Location"), th("Type of Key for access (if applicable)")],
          ...meters.map((m) => [cell(m.type, { bold: true }), cell(m.reading), cell(m.serialNumber), cell(m.location), cell(m.keyType)]),
        ],
      },
      layout: tableLayout,
    });
    const meterPhotos = [];
    (report.meterReadings || []).forEach((m, mi) =>
      (m.photos || []).filter(isImage).forEach((_, i) => meterPhotos.push({ key: `m:${mi}:${i}`, caption: `${m.type} meter` }))
    );
    const grid = photoGrid(meterPhotos, images);
    if (grid) content.push({ text: "", margin: [0, 10, 0, 0] }, grid);
  }

  // ================= Areas =================
  const widths = [24, 70, "*", "*", ...(showCheckIn ? ["*"] : []), ...(showCheckOut ? ["*"] : [])];

  for (const s of sections) {
    content.push(heading(s.title));
    if (s.notes) content.push({ text: s.notes, fontSize: 8, color: GREY, margin: [0, 0, 0, 6] });

    const header = [
      th("Ref"),
      th("Item"),
      th("Description"),
      th("Condition + Comments"),
      ...(showCheckIn ? [th("Check In Comments")] : []),
      ...(showCheckOut ? [th("Check Out Comments")] : []),
    ];

    let additionalLabelDone = false;
    const body = s.ordered.map((r) => {
      let itemCell;
      let desc = r.description || "";
      if (r.additional) {
        itemCell = cell(additionalLabelDone ? "" : "Additional Items Not Present at Inventory", { bold: true });
        additionalLabelDone = true;
        desc = [r.item, r.description].filter(Boolean).join("\n");
      } else {
        itemCell = cell(r.item, { bold: true });
      }
      const cond = CONDITION_LABEL[r.condition];
      const condCell = {
        fontSize: 8,
        text: [
          ...(cond ? [{ text: `${cond}. `, bold: true, color: r.condition === "POOR" ? "#B91C1C" : NAVY }] : []),
          r.conditionComments || "",
        ],
      };
      const photoCount = (r.photos || []).filter((p) => p?.url).length;
      return [
        cell(`${r.ref}.`),
        itemCell,
        cell(desc + (photoCount ? `\n(${photoCount} photo${photoCount === 1 ? "" : "s"})` : "")),
        condCell,
        ...(showCheckIn ? [cell(r.checkInComments)] : []),
        ...(showCheckOut ? [cell(r.checkOutComments)] : []),
      ];
    });

    content.push({
      table: {
        headerRows: 1,
        widths,
        body: body.length ? [header, ...body] : [header, [{ text: "No items recorded.", colSpan: widths.length, italics: true, color: GREY, fontSize: 8 }, ...widths.slice(1).map(() => ({}))]],
      },
      layout: tableLayout,
    });

    // Per-item documents (not photos) are listed under the table.
    const rowDocs = s.ordered.flatMap((r) => (r.photos || []).filter((f) => f?.url && !isImage(f)).map((f) => ({ ...f, name: `Ref ${r.ref} – ${f.name || "document"}` })));
    const docs = fileList([...rowDocs, ...(s.photos || [])]);
    if (docs) content.push(docs);

    // The area's photos: each item's first, captioned with its ref, then the
    // general photos of the area.
    const photos = [];
    for (const r of s.ordered) {
      (r.photos || []).filter(isImage).forEach((_, i) =>
        photos.push({ key: `r:${s._id}:${r.ref}:${i}`, caption: `Ref ${r.ref} – ${r.item || r.description || ""}`.trim() })
      );
    }
    (s.photos || []).filter(isImage).forEach((_, i) => photos.push({ key: `s:${s._id}:${i}`, caption: s.title }));
    const grid = photoGrid(photos, images);
    if (grid) {
      content.push(heading(`${s.title} Photos`), grid);
    }
  }

  // ================= Key exchange & signatures =================
  content.push(heading("Key Exchange"));
  if (report.keyExchangeNote) content.push({ text: report.keyExchangeNote, fontSize: 8, color: GREY, margin: [0, 0, 0, 8] });
  content.push({
    table: {
      widths: ["*", "*"],
      body: [
        [
          { text: [{ text: "Sets of Keys: ", bold: true }, report.keys?.sets || ""] },
          { text: [{ text: "Number of Keys: ", bold: true }, report.keys?.count || ""] },
        ],
        ...(report.keys?.notes ? [[{ text: report.keys.notes, colSpan: 2 }, {}]] : []),
      ],
    },
    layout: { ...tableLayout, fillColor: () => null },
    margin: [0, 0, 0, 14],
  });

  content.push({ text: "Signatures", style: "h2" });
  if (report.signatureNote) content.push({ text: report.signatureNote, fontSize: 8, color: GREY, margin: [0, 0, 0, 10] });
  for (const role of ["Tenant", "Landlord", "Clerk"]) {
    const sg = (report.signatures || []).find((x) => x.role === role) || {};
    const img = images.get(`sig:${role}`);
    content.push({
      unbreakable: true,
      margin: [0, 0, 0, 14],
      stack: [
        { text: role, bold: true, fontSize: 10, color: NAVY, margin: [0, 0, 0, 4] },
        {
          columns: [
            { text: [{ text: "Name: ", bold: true }, sg.name || "...................................................."] },
            { text: [{ text: "Date: ", bold: true }, sg.date ? fmtShortDate(sg.date) : "......................"], width: 150 },
          ],
        },
        img
          ? { columns: [{ text: "Signature:", bold: true, width: 60 }, { image: img, fit: [180, 60] }], margin: [0, 6, 0, 0] }
          : { text: [{ text: "Signature: ", bold: true }, ".................................................."], margin: [0, 10, 0, 0] },
      ],
    });
  }
  if (companyName) {
    content.push({
      text: `This report is stored online and can be requested. This report remains the property of ${companyName} and cannot be used or duplicated without written permission.`,
      fontSize: 7,
      color: GREY,
      margin: [0, 6, 0, 0],
    });
  }

  // ================= Keys =================
  const keyGrid = photoGrid(
    (report.keys?.photos || []).filter(isImage).map((_, i) => ({ key: `k:${i}`, caption: "Keys" })),
    images
  );
  if (keyGrid) content.push(heading("Keys"), keyGrid);

  // ================= Disclaimer =================
  if (report.disclaimer) {
    content.push(heading("Disclaimer"));
    content.push({ text: report.disclaimer, fontSize: 8, lineHeight: 1.25 });
  }

  const docDefinition = {
    pageSize: "A4",
    pageMargins: [36, 62, 36, 36],
    info: { title: `${report.jobType} - ${report.reference} - ${address}`, author: companyName },
    header: (currentPage, pageCount) => ({
      margin: [36, 18, 36, 0],
      stack: [
        {
          columns: [
            { text: `${report.jobType} - Ref: ${report.reference}`, bold: true, fontSize: 8 },
            { text: `Page ${currentPage} of ${pageCount}`, alignment: "right", fontSize: 8 },
          ],
        },
        {
          columns: [
            { text: (companyName || "").toUpperCase(), bold: true, color: ORANGE, fontSize: 8, width: "30%" },
            { text: address, alignment: "center", fontSize: 8, width: "*" },
            { text: shortDate, alignment: "right", fontSize: 8, width: 60 },
          ],
          margin: [0, 2, 0, 0],
        },
        { canvas: [{ type: "line", x1: 0, y1: 4, x2: 523, y2: 4, lineWidth: 0.5, lineColor: RULE }] },
      ],
    }),
    content,
    styles: {
      h1: { fontSize: 14, bold: true, color: NAVY, margin: [0, 0, 0, 8] },
      h2: { fontSize: 11, bold: true, color: NAVY, margin: [0, 0, 0, 4] },
    },
  };

  return renderPdf(docDefinition);
};
