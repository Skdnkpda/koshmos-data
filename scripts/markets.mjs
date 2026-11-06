// Pure helpers for the daily market wrap (tested in markets.test.mjs).

/** The series shown in the app, in order. `nse` names match the NSE index file (case-insensitive). */
export const SERIES = [
  { id: "nifty50", name: "Nifty 50", region: "in", nse: "Nifty 50" },
  { id: "niftybank", name: "Nifty Bank", region: "in", nse: "Nifty Bank" },
  { id: "niftyit", name: "Nifty IT", region: "in", nse: "Nifty IT" },
  { id: "midcap150", name: "Nifty Midcap 150", region: "in", nse: "Nifty Midcap 150" },
  { id: "smallcap250", name: "Nifty Smallcap 250", region: "in", nse: "Nifty Smallcap 250" },
  { id: "indiavix", name: "India VIX", region: "in", nse: "India VIX" },
  { id: "sp500", name: "S&P 500", region: "us" },
  { id: "nasdaq", name: "Nasdaq Composite", region: "us" },
  { id: "nasdaq100", name: "Nasdaq-100", region: "us" },
  { id: "usdinr", name: "US dollar", region: "fx", unit: "₹" },
  { id: "gold", name: "Gold (GOLDBEES)", region: "metal", unit: "₹" },
  { id: "silver", name: "Silver (SILVERBEES)", region: "metal", unit: "₹" },
];

/** NSE "ind_close_all_DDMMYYYY.csv" → { lowercased name: { date: YYYY-MM-DD, close } } */
export function parseNseIndices(csv) {
  const lines = csv.trim().split(/\r?\n/);
  const head = lines.shift().split(",").map((h) => h.trim().toLowerCase());
  const iName = head.indexOf("index name"), iDate = head.indexOf("index date"), iClose = head.indexOf("closing index value");
  if (iName < 0 || iDate < 0 || iClose < 0) throw new Error("NSE index file header changed: " + head.join("|"));
  const out = {};
  for (const line of lines) {
    const c = line.split(",");
    const close = Number(c[iClose]);
    const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec((c[iDate] ?? "").trim());
    if (!m || !(close > 0)) continue;
    out[c[iName].trim().toLowerCase()] = { date: `${m[3]}-${m[2]}-${m[1]}`, close };
  }
  return out;
}

/** Nasdaq historical JSON → [[YYYY-MM-DD, close]] */
export function parseNasdaqHistory(json) {
  const rows = json?.data?.tradesTable?.rows ?? [];
  return rows.map((r) => {
    const [mm, dd, yyyy] = String(r.date).split("/");
    return [`${yyyy}-${mm}-${dd}`, Number(String(r.close).replace(/,/g, ""))];
  }).filter(([d, c]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && c > 0);
}

/** Cboe historical JSON → last `keep` [[YYYY-MM-DD, close]] */
export function parseCboeHistory(json, keep = 400) {
  return (json?.data ?? []).map((r) => [String(r.date), Number(r.close)]).filter(([d, c]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && c > 0).slice(-keep);
}

/** Add points to a { date: close } history and keep the newest `keep` days. */
export function mergeHistory(hist = {}, points = [], keep = 400) {
  const all = { ...hist };
  for (const [d, c] of points) if (c > 0) all[d] = Math.round(c * 100) / 100;
  return Object.fromEntries(Object.entries(all).sort(([a], [b]) => a.localeCompare(b)).slice(-keep));
}

const pct = (a, b) => (b > 0 ? Math.round(((a - b) / b) * 10000) / 100 : null);
const minusDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

/** Close, change vs previous close, 1 week, 1 month and 1 year, plus a 30-point sparkline. */
export function summarise(hist) {
  const pts = Object.entries(hist ?? {}).sort(([a], [b]) => a.localeCompare(b));
  if (!pts.length) return null;
  const [date, close] = pts.at(-1);
  const before = (iso) => { for (let i = pts.length - 1; i >= 0; i--) if (pts[i][0] <= iso) return pts[i][1]; return null; };
  const prev = pts.length > 1 ? pts.at(-2)[1] : null;
  const at = (n) => { const v = before(minusDays(date, n)); return v == null ? null : pct(close, v); };
  return {
    date, close,
    d1: prev == null ? null : pct(close, prev),
    w1: at(7), m1: at(30), y1: pts[0][0] <= minusDays(date, 365) ? at(365) : null,
    spark: pts.slice(-30).map(([, c]) => c),
  };
}
