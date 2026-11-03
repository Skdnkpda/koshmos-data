// Pure parsers for public end-of-day price files. No network here; see update-prices.mjs.

/**
 * AMFI NAVAll.txt: section headings, blank lines and rows like
 * "Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date"
 * Both ISIN columns map to the same NAV. Returns { ISIN: [nav, "YYYY-MM-DD"] }.
 */
export function parseAmfi(text) {
  const out = {};
  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  const lines = text.split(/\r?\n/);
  // Columns are found from the header (AMFI has added "Plan" and "Option" before; it may again).
  const header = (lines.find((l) => /scheme\s*code/i.test(l)) ?? "").split(";").map((h) => h.trim().toLowerCase());
  const find = (re, fallback) => { const i = header.findIndex((h) => re.test(h)); return i >= 0 ? i : fallback; };
  const iNav = find(/net\s*asset\s*value|^nav$/, 4), iDate = find(/^date$/, 5);
  const iIsins = header.map((h, i) => (/isin/.test(h) ? i : -1)).filter((i) => i >= 0);
  const isinCols = iIsins.length ? iIsins : [1, 2];
  for (const line of lines) {
    const c = line.split(";");
    if (c.length <= Math.max(iNav, iDate) || !/^\d+$/.test((c[0] ?? "").trim())) continue;
    const nav = Number((c[iNav] ?? "").trim());
    const m = (c[iDate] ?? "").trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
    if (!Number.isFinite(nav) || nav <= 0 || !m) continue;
    const date = `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    for (const isin of isinCols.map((i) => (c[i] ?? "").trim().toUpperCase()))
      if (/^IN[A-Z0-9]{10}$/.test(isin)) out[isin] = [nav, date];
  }
  return out;
}

/** Split a CSV line (no embedded newlines in these files). */
function cells(line) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ",") { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

/**
 * Exchange bhavcopy in the common (UDiFF) CSV layout used by NSE and BSE:
 * TradDt, ..., FinInstrmTp, ..., ISIN, TckrSymb, SctySrs, ..., ClsPric, ...
 * Keeps equity-like series (stocks, ETFs, SGBs). Returns { ISIN: [close, "YYYY-MM-DD", symbol] }.
 */
export function parseBhavcopy(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return {};
  const head = cells(lines[0]).map((h) => h.toLowerCase());
  const col = (...names) => names.map((n) => head.indexOf(n.toLowerCase())).find((i) => i >= 0) ?? -1;
  const iIsin = col("ISIN"), iClose = col("ClsPric", "CLOSE_PRICE", "CLOSE"), iDate = col("TradDt", "TRADE_DATE", "DATE1");
  const iSym = col("TckrSymb", "SYMBOL", "SC_CODE"), iSeries = col("SctySrs", "SERIES"), iType = col("FinInstrmTp");
  if (iIsin < 0 || iClose < 0) throw new Error("Bhavcopy columns not found: " + lines[0].slice(0, 200));
  const out = {};
  for (const line of lines.slice(1)) {
    const c = cells(line);
    const isin = (c[iIsin] ?? "").toUpperCase();
    const close = Number(c[iClose]);
    if (!/^IN[A-Z0-9]{10}$/.test(isin) || !Number.isFinite(close) || close <= 0) continue;
    if (iType >= 0 && c[iType] && !/^STK$/i.test(c[iType])) continue; // derivatives etc.
    if (iSeries >= 0 && c[iSeries] && !/^(EQ|BE|BZ|SM|ST|GB|E1|A|B|T|X|XT|M|MT|Z|IF)$/i.test(c[iSeries])) continue;
    const date = toIso(c[iDate] ?? "");
    out[isin] = [close, date, c[iSym] ?? ""];
  }
  return out;
}
function toIso(v) {
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = v.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
  if (m) return `${m[3]}-${String(MONTHS[m[2].toLowerCase()]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return "";
}
/** Merge exchange maps: NSE first, BSE fills ISINs NSE didn't have. */
export function mergeEquity(nse, bse) {
  return { ...bse, ...nse };
}
