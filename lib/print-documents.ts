export type PrintColumn = { key: string; label: string; align?: "left" | "right" };

function escapeHtml(value: unknown) {
  return String(value ?? "—")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function printBusinessDocument(input: {
  title: string;
  reference?: string | null;
  subtitle?: string;
  details?: Array<[string, unknown]>;
  columns: PrintColumn[];
  rows: Array<Record<string, unknown>>;
  summary?: Array<[string, unknown]>;
  footer?: string;
}) {
  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) return false;

  const details = (input.details ?? [])
    .map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");
  const headers = input.columns
    .map((column) => `<th class="${column.align === "right" ? "right" : ""}">${escapeHtml(column.label)}</th>`)
    .join("");
  const rows = input.rows
    .map((row, index) => `<tr><td>${index + 1}</td>${input.columns.map((column) => `<td class="${column.align === "right" ? "right" : ""}">${escapeHtml(row[column.key])}</td>`).join("")}</tr>`)
    .join("");
  const summary = (input.summary ?? [])
    .map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`)
    .join("");

  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(input.title)}</title><style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { color: #111827; font: 12px Arial, sans-serif; margin: 0; }
    header { border-bottom: 3px solid #14532d; padding-bottom: 10px; text-align: center; }
    h1 { font-size: 20px; margin: 0; text-transform: uppercase; }
    h2 { font-size: 13px; font-weight: 500; margin: 5px 0 0; }
    .reference { font-weight: 700; margin-top: 5px; }
    .details, .summary { display: grid; gap: 6px 20px; grid-template-columns: repeat(2, 1fr); margin: 14px 0; }
    .details div, .summary div { display: flex; justify-content: space-between; gap: 15px; border-bottom: 1px dotted #9ca3af; padding-bottom: 3px; }
    table { border-collapse: collapse; table-layout: fixed; width: 100%; }
    th, td { border: 1px solid #9ca3af; overflow-wrap: anywhere; padding: 6px; vertical-align: top; }
    th { background: #e5e7eb; text-align: left; }
    th:first-child, td:first-child { text-align: center; width: 34px; }
    .right { text-align: right; }
    .summary { border: 1px solid #9ca3af; margin-left: auto; padding: 10px; width: min(100%, 430px); }
    footer { color: #4b5563; font-size: 10px; margin-top: 18px; text-align: center; }
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 35px; margin-top: 45px; text-align: center; }
    .signatures div { border-top: 1px solid #111827; padding-top: 5px; }
  </style></head><body>
    <header><h1>${escapeHtml(input.title)}</h1><h2>${escapeHtml(input.subtitle ?? "AIG Digital Restaurant")}</h2>${input.reference ? `<div class="reference">${escapeHtml(input.reference)}</div>` : ""}</header>
    ${details ? `<section class="details">${details}</section>` : ""}
    <table><thead><tr><th>No.</th>${headers}</tr></thead><tbody>${rows || `<tr><td colspan="${input.columns.length + 1}">No records</td></tr>`}</tbody></table>
    ${summary ? `<section class="summary">${summary}</section>` : ""}
    <section class="signatures"><div>Prepared by</div><div>Checked by</div><div>Approved by</div></section>
    <footer>${escapeHtml(input.footer ?? `Generated ${new Date().toLocaleString()}`)}</footer>
    <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()};<\/script>
  </body></html>`);
  win.document.close();
  return true;
}
