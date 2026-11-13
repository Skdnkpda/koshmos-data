// Pure helpers for the daily market wrap (tested in markets.test.mjs).

/** The series shown in the app, in order. `nse` names match the NSE index file (case-insensitive). */
export const SERIES = [
  { id: "nifty50", name: "Nifty 50", region: "in", nse: "Nifty 50" },
  { id: "sensex", name: "Sensex", region: "in" },
  { id: "niftybank", name: "Nifty Bank", region: "in", nse: "Nifty Bank" },
  { id: "niftyit", name: "Nifty IT", region: "in", nse: "Nifty IT" },
  { id: "midcap150", name: "Nifty Midcap 150", region: "in", nse: "Nifty Midcap 150" },
  { id: "smallcap250", name: "Nifty Smallcap 250", region: "in", nse: "Nifty Smallcap 250" },
  { id: "indiavix", name: "India VIX", region: "in", nse: "India VIX" },
  { id: "sp500", name: "S&P 500", region: "us" },
  // Dow Jones Industrial Average, from Cboe's DJX (exactly 1/100 of the Dow), scaled back up.
  { id: "dow", name: "Dow Jones", region: "us" },
  { id: "nasdaq", name: "Nasdaq Composite", region: "us" },
  { id: "nasdaq100", name: "Nasdaq-100", region: "us" },
  { id: "usdinr", name: "US dollar", region: "fx", unit: "₹" },
  // IBJA closing rates (₹ per 10 g of 24K gold, ₹ per kg of silver 999). The ETF rows below are
  // published only when IBJA can't be read, so the app always has gold and silver.
  { id: "gold10g", name: "Gold 24K, per 10 g", region: "metal", unit: "₹" },
  { id: "silverkg", name: "Silver 999, per kg", region: "metal", unit: "₹" },
  { id: "gold", name: "Gold (GOLDBEES)", region: "metal", unit: "₹", fallbackFor: "gold10g" },
  { id: "silver", name: "Silver (SILVERBEES)", region: "metal", unit: "₹", fallbackFor: "silverkg" },
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
export function parseCboeHistory(json, keep = 400, scale = 1) {
  return (json?.data ?? []).map((r) => [String(r.date), Number(r.close) * scale]).filter(([d, c]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && c > 0).slice(-keep);
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

/** Fill the w1/m1/y1 changes a series can't work out yet from a stand-in series (e.g. an ETF that tracks it); `proxied` lists which. */
export function fillChanges(sum, stand) {
  if (!sum || !stand) return sum;
  const proxied = ["w1", "m1", "y1"].filter((k) => sum[k] == null && stand[k] != null);
  if (!proxied.length) return sum;
  return { ...sum, ...Object.fromEntries(proxied.map((k) => [k, stand[k]])), proxied };
}

/** ECB 90-day history XML → [[YYYY-MM-DD, rupees per US dollar]] */
export function parseEcbUsdInrHistory(xml) {
  const out = [];
  for (const m of xml.matchAll(/<Cube time=['"](\d{4}-\d{2}-\d{2})['"]>([\s\S]*?)<\/Cube>/g)) {
    const usd = Number(/currency=['"]USD['"]\s+rate=['"]([\d.]+)['"]/.exec(m[2])?.[1]);
    const inr = Number(/currency=['"]INR['"]\s+rate=['"]([\d.]+)['"]/.exec(m[2])?.[1]);
    if (usd > 0 && inr > 0) out.push([m[1], Math.round((inr / usd) * 10000) / 10000]);
  }
  return out.sort(([a], [b]) => a.localeCompare(b));
}

/**
 * IBJA home page → closing (PM) rates for the last 30 days: { gold10g: [[date, ₹/10 g]], silverkg: [[date, ₹/kg]] }.
 * The page shows two "previous 30 days" tables, AM then PM, each row: date, gold 999/995/916/750/585, silver 999, platinum 999.
 * We read the page's text, so markup changes don't matter while the table keeps its column order.
 */
export function parseIbja(html) {
  const text = String(html).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const head = /999 995 916 750 585 Silver 999 Platinum 999/g;
  const starts = [...text.matchAll(head)].map((m) => m.index + m[0].length);
  if (!starts.length) throw new Error("IBJA table header not found");
  const block = text.slice(starts.at(-1), starts.at(-1) + 6000).split(/\*|999 995 916/)[0];
  const gold10g = [], silverkg = [];
  for (const m of block.matchAll(/(\d{2})\/(\d{2})\/(\d{4})((?:\s+[\d.]+){7})/g)) {
    const n = m[4].trim().split(/\s+/).map(Number);
    const date = `${m[3]}-${m[2]}-${m[1]}`;
    // Sanity bands keep a column shift from ever publishing nonsense.
    if (n[0] > 10000 && n[0] < 10000000) gold10g.push([date, n[0]]);
    if (n[5] > 10000 && n[5] < 10000000) silverkg.push([date, n[5]]);
  }
  if (!gold10g.length) throw new Error("IBJA rows not found");
  const asc = (a) => a.sort(([x], [y]) => x.localeCompare(y));
  return { gold10g: asc(gold10g), silverkg: asc(silverkg) };
}

/** BSE index CSV ("Date,Open,High,Low,Close" with dates like 6-November-2026) → [[YYYY-MM-DD, close]]. */
export function parseBseIndexCsv(text) {
  const M = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  const out = [];
  for (const line of String(text).split(/\r?\n/).slice(1)) {
    const [d, , , , c] = line.split(",");
    const m = /^(\d{1,2})-([a-z]+)-(\d{4})$/i.exec((d ?? "").trim());
    const close = Number(c);
    const mi = m ? M.indexOf(m[2].toLowerCase()) : -1;
    if (!m || mi < 0 || !(close > 0)) continue;
    out.push([`${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`, close]);
  }
  return out.sort(([a], [b]) => a.localeCompare(b));
}
