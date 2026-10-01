// utils/pdf/invoicePdf.js
//
// A customised invoice as a PDF: company header with logo, bill-to block,
// line items, totals with VAT and discount, payments received, and the
// payment details the payer needs.

import { renderPdf, fetchImages, fmtDate, fmtMoney, NAVY, ORANGE, GREY, RULE, SHADE } from "./common.js";

const STAMP_COLOR = { Paid: "#059669", Cancelled: "#B91C1C", Overdue: "#B91C1C", "Partially Paid": "#D97706" };

const lineNet = (li) => (Number(li.quantity) || 0) * (Number(li.unitPrice) || 0);

/**
 * @param {object} invoice  an Invoice (lean), with `effectiveStatus`
 * @param {object} issuer   company + payment details (invoice.issuer, or the
 *                          organisation's current settings for a draft)
 */
export const buildInvoicePdf = async (invoice, issuer = {}) => {
  const images = await fetchImages(issuer.logo ? [{ key: "logo", url: issuer.logo, opts: { size: 500, png: true } }] : []);
  const status = invoice.effectiveStatus || invoice.status;

  const fromLines = [
    issuer.legalName && issuer.legalName !== issuer.name ? issuer.legalName : null,
    issuer.address,
    issuer.phone,
    issuer.email,
    issuer.website,
    issuer.vatNumber ? `VAT No: ${issuer.vatNumber}` : null,
    issuer.companyNumber ? `Company No: ${issuer.companyNumber}` : null,
  ].filter(Boolean);

  const billLines = [invoice.billTo?.name, invoice.billTo?.address, invoice.billTo?.email].filter(Boolean);

  const meta = [
    ["Invoice No.", invoice.number],
    ["Invoice Date", fmtDate(invoice.invoiceDate)],
    ...(invoice.dueDate ? [["Due Date", fmtDate(invoice.dueDate)]] : []),
    ...(invoice.property ? [["Property", invoice.property]] : []),
  ];

  const items = [
    [
      { text: "Description", bold: true, color: "#FFFFFF" },
      { text: "Qty", bold: true, color: "#FFFFFF", alignment: "right" },
      { text: "Unit Price", bold: true, color: "#FFFFFF", alignment: "right" },
      { text: "VAT", bold: true, color: "#FFFFFF", alignment: "right" },
      { text: "Amount", bold: true, color: "#FFFFFF", alignment: "right" },
    ],
    ...(invoice.lineItems || []).map((li) => [
      { text: li.description || "" },
      { text: String(li.quantity ?? ""), alignment: "right" },
      { text: fmtMoney(li.unitPrice), alignment: "right" },
      { text: li.vatRate ? `${li.vatRate}%` : "—", alignment: "right" },
      { text: fmtMoney(lineNet(li)), alignment: "right" },
    ]),
  ];

  const totals = [
    ["Subtotal", fmtMoney(invoice.subtotal)],
    ...(invoice.discountAmount
      ? [[`Discount${invoice.discountType === "percent" ? ` (${invoice.discountValue}%)` : ""}`, `-${fmtMoney(invoice.discountAmount)}`]]
      : []),
    ...(invoice.vatTotal ? [["VAT", fmtMoney(invoice.vatTotal)]] : []),
    ["Total", fmtMoney(invoice.total)],
    ...(invoice.amountPaid ? [["Paid", `-${fmtMoney(invoice.amountPaid)}`]] : []),
    ["Balance Due", fmtMoney(invoice.balance)],
  ];

  const bank = [
    ["Bank", issuer.bankName],
    ["Account Name", issuer.accountName],
    ["Sort Code", issuer.sortCode],
    ["Account No.", issuer.accountNumber],
    ["IBAN", issuer.iban],
    ["SWIFT/BIC", issuer.swift],
  ].filter(([, v]) => v);

  const content = [
    {
      columns: [
        images.get("logo") ? { image: images.get("logo"), fit: [160, 70] } : { text: issuer.name || "", fontSize: 16, bold: true, color: NAVY },
        {
          stack: [
            { text: "INVOICE", fontSize: 26, bold: true, color: NAVY, alignment: "right" },
            STAMP_COLOR[status]
              ? { text: status.toUpperCase(), bold: true, fontSize: 12, color: STAMP_COLOR[status], alignment: "right", margin: [0, 2, 0, 0] }
              : status === "Draft"
                ? { text: "DRAFT", bold: true, fontSize: 12, color: GREY, alignment: "right", margin: [0, 2, 0, 0] }
                : null,
          ].filter(Boolean),
        },
      ],
      margin: [0, 0, 0, 20],
    },
    {
      columns: [
        {
          width: "*",
          stack: [
            { text: "FROM", fontSize: 8, bold: true, color: ORANGE, margin: [0, 0, 0, 3] },
            { text: issuer.name || "", bold: true, fontSize: 10 },
            ...fromLines.map((l) => ({ text: l, color: GREY })),
          ],
        },
        {
          width: "*",
          stack: [
            { text: "BILL TO", fontSize: 8, bold: true, color: ORANGE, margin: [0, 0, 0, 3] },
            ...(billLines.length ? billLines.map((l, i) => ({ text: l, bold: i === 0, fontSize: i === 0 ? 10 : 9, color: i ? GREY : undefined })) : [{ text: "—" }]),
          ],
        },
        {
          width: 170,
          table: {
            widths: [70, "*"],
            body: meta.map(([k, v]) => [{ text: k, bold: true, fillColor: SHADE }, { text: v || "" }]),
          },
          layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => RULE, vLineColor: () => RULE },
        },
      ],
      columnGap: 16,
      margin: [0, 0, 0, 20],
    },
    {
      table: { headerRows: 1, widths: ["*", 40, 70, 45, 75], body: items, dontBreakRows: true },
      layout: {
        hLineWidth: (i) => (i === 0 ? 0 : 0.5),
        vLineWidth: () => 0,
        hLineColor: () => RULE,
        fillColor: (i) => (i === 0 ? NAVY : null),
        paddingTop: () => 5,
        paddingBottom: () => 5,
      },
    },
    {
      columns: [
        { width: "*", text: "" },
        {
          width: 220,
          table: {
            widths: ["*", 90],
            body: totals.map(([k, v]) => {
              const strong = k === "Total" || k === "Balance Due";
              return [
                { text: k, bold: strong, fillColor: k === "Balance Due" ? SHADE : null },
                { text: v, bold: strong, alignment: "right", fillColor: k === "Balance Due" ? SHADE : null },
              ];
            }),
          },
          layout: { hLineWidth: () => 0.5, vLineWidth: () => 0, hLineColor: () => RULE },
        },
      ],
      margin: [0, 10, 0, 16],
      unbreakable: true,
    },
  ];

  if (invoice.payments?.length) {
    content.push(
      { text: "Payments received", bold: true, color: NAVY, margin: [0, 0, 0, 4] },
      {
        table: {
          widths: [80, "*", "*", 80],
          body: [
            ["Date", "Method", "Reference", "Amount"].map((t, i) => ({ text: t, bold: true, fillColor: SHADE, alignment: i === 3 ? "right" : "left" })),
            ...invoice.payments.map((p) => [
              fmtDate(p.date),
              p.method || "",
              p.reference || "",
              { text: fmtMoney(p.amount), alignment: "right" },
            ]),
          ],
        },
        layout: { hLineWidth: () => 0.5, vLineWidth: () => 0, hLineColor: () => RULE },
        margin: [0, 0, 0, 16],
      }
    );
  }

  if (bank.length || issuer.paymentInstructions) {
    content.push({
      unbreakable: true,
      table: {
        widths: ["*"],
        body: [
          [
            {
              fillColor: SHADE,
              margin: [6, 6, 6, 6],
              stack: [
                { text: "PAYMENT DETAILS", fontSize: 8, bold: true, color: ORANGE, margin: [0, 0, 0, 4] },
                ...bank.map(([k, v]) => ({ text: [{ text: `${k}: `, bold: true }, v] })),
                { text: [{ text: "Payment reference: ", bold: true }, invoice.number], margin: [0, 2, 0, 0] },
                ...(issuer.paymentInstructions ? [{ text: issuer.paymentInstructions, margin: [0, 4, 0, 0], color: GREY }] : []),
              ],
            },
          ],
        ],
      },
      layout: "noBorders",
      margin: [0, 0, 0, 14],
    });
  }

  if (invoice.notes) content.push({ text: "Notes", bold: true, color: NAVY }, { text: invoice.notes, margin: [0, 2, 0, 10] });
  if (invoice.terms) content.push({ text: "Terms", bold: true, color: NAVY }, { text: invoice.terms, margin: [0, 2, 0, 10], color: GREY });

  return renderPdf({
    pageSize: "A4",
    pageMargins: [40, 40, 40, 50],
    info: { title: `Invoice ${invoice.number}`, author: issuer.name || "" },
    content,
    footer: (currentPage, pageCount) => ({
      margin: [40, 10, 40, 0],
      columns: [
        { text: issuer.footer || issuer.name || "", fontSize: 7, color: GREY },
        { text: `${invoice.number} · Page ${currentPage} of ${pageCount}`, fontSize: 7, color: GREY, alignment: "right", width: 150 },
      ],
    }),
  });
};
