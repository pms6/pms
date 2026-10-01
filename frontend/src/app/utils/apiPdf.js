import api from "@/app/api/api";

// PDFs the API generates (inventory reports, invoices) sit behind the session
// cookie, so a plain <a href> to the API would work only on the same origin.
// These fetch the file through the authenticated client and hand the browser a
// blob URL instead.

const fetchPdf = async (path) => {
  const res = await api.get(path, { responseType: "blob" });
  return URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
};

// The error body of a failed blob request is itself a Blob — read the message
// out of it so the caller can show something useful.
export const pdfError = async (err, fallback = "Failed to generate the PDF.") => {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      return JSON.parse(await data.text()).message || fallback;
    } catch {
      return fallback;
    }
  }
  return data?.message || err?.message || fallback;
};

/** Open the PDF in a new tab (where it can be read, printed or saved). */
export const openPdf = async (path) => {
  // Opened before the request so a popup blocker sees it as the user's click.
  const win = window.open("", "_blank");
  try {
    const url = await fetchPdf(path);
    if (win) win.location.href = url;
    else window.location.href = url;
  } catch (err) {
    win?.close();
    throw err;
  }
};

/** Save the PDF straight to disk under `filename`. */
export const downloadPdf = async (path, filename = "document.pdf") => {
  const url = await fetchPdf(path);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
};

/** Print the PDF from a hidden frame, without leaving the page. */
export const printPdf = async (path) => {
  const url = await fetchPdf(path);
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.src = url;
  frame.onload = () => {
    try {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } catch {
      window.open(url, "_blank");
    }
    setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 60000);
  };
  document.body.appendChild(frame);
};
