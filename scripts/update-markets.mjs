// Daily market wrap: index closes and 1D/1W/1M/1Y changes, published as prices/markets.json.
// Public data only, the same for everyone. Each source is independent; a failure keeps its history.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SERIES, parseBseIndexCsv, parseIbja, parseNseIndices, parseNasdaqHistory, parseCboeHistory, mergeHistory, summarise, fillChanges, parseEcbUsdInrHistory } from "./markets.mjs";
import { parseBhavcopy } from "./parse.mjs";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const OUT = new URL("../prices/", import.meta.url).pathname;
const HIST = OUT + "markets-history.json";
const log = (...a) => console.log(new Date().toISOString(), ...a);
async function get(url, headers = {}) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*", ...headers }, signal: AbortSignal.timeout(45000) });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  return res;
}
const readJson = (f, fb) => { try { return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : fb; } catch { return fb; } };
const nseDay = (d) => `${String(d.getUTCDate()).padStart(2, "0")}${String(d.getUTCMonth() + 1).padStart(2, "0")}${d.getUTCFullYear()}`;

const hist = readJson(HIST, {});
const sources = {};

// India: NSE's daily index file. Until there is a year of history (so 1Y works), missing weekdays
// back to ~370 days are filled in, a few files at a time; after that only the last week is read.
const weekdaysBack = (span) => {
  const now = new Date(Date.now() + 5.5 * 3600 * 1000);
  const out = [];
  for (let i = 0; i < span; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    if (![0, 6].includes(d.getUTCDay())) out.push(d);
  }
  return out;
};
const needsYear = (id) => { const days = Object.keys(hist[id] ?? {}).sort(); return !days.length || days[0] > new Date(Date.now() - 360 * 86400000).toISOString().slice(0, 10); };
async function inBatches(items, size, fn) { for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn)); }
{
  const have = new Set(Object.keys(hist.nifty50 ?? {}));
  const days = needsYear("nifty50") ? weekdaysBack(372).filter((d, i) => i < 6 || !have.has(d.toISOString().slice(0, 10))) : weekdaysBack(8);
  let got = 0, warned = false;
  await inBatches(days, 6, async (d) => {
    const url = `https://nsearchives.nseindia.com/content/indices/ind_close_all_${nseDay(d)}.csv`;
    try {
      const rows = parseNseIndices(await (await get(url, { Referer: "https://www.nseindia.com/" })).text());
      for (const s of SERIES.filter((x) => x.nse)) {
        const r = rows[s.nse.toLowerCase()];
        if (r) hist[s.id] = mergeHistory(hist[s.id], [[r.date, r.close]]);
        else if (!warned) { warned = true; log("NSE: no row for", s.nse, "names include:", Object.keys(rows).slice(0, 80).join(" | ")); }
      }
      got++; sources.in = "NSE";
    } catch { /* holiday or not published yet */ }
  });
  log("NSE files read:", got, "of", days.length);
}

// India: Sensex from BSE's index CSV, a year at a time on the first run, then the last two weeks.
{
  const fmt = (d) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
  const days = Object.keys(hist.sensex ?? {}).length < 200 ? 380 : 14;
  try {
    const url = `https://api.bseindia.com/BseIndiaAPI/api/ProduceCSVForDate/w?strIndex=SENSEX&dtFromDate=${fmt(new Date(Date.now() - days * 86400000))}&dtToDate=${fmt(new Date())}`;
    const pts = parseBseIndexCsv(await (await get(url, { Referer: "https://www.bseindia.com/", Origin: "https://www.bseindia.com" })).text());
    if (!pts.length) throw new Error("no rows");
    hist.sensex = mergeHistory(hist.sensex, pts);
    sources.sensex = "BSE";
  } catch (e) { log("BSE Sensex:", e.message); }
}

// US: Cboe (S&P 500, Dow) and Nasdaq (Composite, Nasdaq-100), each with recent history.
try {
  hist.sp500 = mergeHistory(hist.sp500, parseCboeHistory(await (await get("https://cdn.cboe.com/api/global/delayed_quotes/charts/historical/_SPX.json")).json()));
  sources.sp500 = "Cboe";
} catch (e) { log("Cboe SPX:", e.message); }
try {
  const pts = parseCboeHistory(await (await get("https://cdn.cboe.com/api/global/delayed_quotes/charts/historical/_DJX.json")).json(), 400, 100);
  if (!pts.length) throw new Error("no rows");
  hist.dow = mergeHistory(hist.dow, pts);
  sources.dow = "Cboe (DJX × 100)";
} catch (e) { log("Cboe DJX:", e.message); }
const from = new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10);
for (const [id, sym] of [["nasdaq", "COMP"], ["nasdaq100", "NDX"]]) {
  try {
    const pts = parseNasdaqHistory(await (await get(`https://api.nasdaq.com/api/quote/${sym}/historical?assetclass=index&fromdate=${from}&limit=400`, { Origin: "https://www.nasdaq.com", Referer: "https://www.nasdaq.com/" })).json());
    if (!pts.length) throw new Error("no rows");
    hist[id] = mergeHistory(hist[id], pts);
    sources[id] = "Nasdaq";
  } catch (e) { log("Nasdaq", sym, e.message); }
}

// One-time backfills so 1D/1W/1M work from day one: ECB's 90-day rates, and ~6 weeks of NSE bhavcopies
// for the gold and silver ETFs. Skipped once enough history has built up.
if (needsYear("usdinr")) {
  // ECB's full history file (one download), trimmed to the last ~400 days by mergeHistory.
  try { hist.usdinr = mergeHistory(hist.usdinr, parseEcbUsdInrHistory((await (await get("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-hist.xml")).text())).slice(-400)); log("ECB backfill:", Object.keys(hist.usdinr).length); }
  catch (e) { log("ECB history:", e.message); }
}
if (needsYear("gold") || needsYear("silver")) {
  // A year of NSE bhavcopies for the gold and silver ETFs, read once; their changes stand in for
  // IBJA's where IBJA's own history is still too short (see below).
  const have = new Set(Object.keys(hist.gold ?? {}));
  const days = weekdaysBack(372).slice(1).filter((d) => !have.has(d.toISOString().slice(0, 10)));
  let read = 0;
  await inBatches(days, 4, async (d) => {
    const day = d.toISOString().slice(0, 10).replace(/-/g, "");
    try {
      const res = await get(`https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_${day}_F_0000.csv.zip`, { Referer: "https://www.nseindia.com/" });
      const dir = mkdtempSync(join(tmpdir(), "mk-")); const zip = join(dir, "f.zip");
      writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
      const map = parseBhavcopy(execFileSync("unzip", ["-p", zip], { maxBuffer: 256 * 1024 * 1024 }).toString("utf8"));
      for (const [id, isin] of [["gold", "INF204KB17I5"], ["silver", "INF204KC1402"]]) if (map[isin]) hist[id] = mergeHistory(hist[id], [[map[isin][1], map[isin][0]]]);
      read++;
    } catch { /* holiday or not published */ }
  });
  log("Bhavcopy backfill days:", read, "of", days.length);
}

// Rupee and metals from today's own price files (written by update-prices.mjs just before).
const fx = readJson(OUT + "fx.json", {}), eq = readJson(OUT + "eq.json", {});
if (fx.USD) { hist.usdinr = mergeHistory(hist.usdinr, [[fx.USD[1], fx.USD[0]]]); sources.usdinr = "ECB"; }
for (const [id, isin] of [["gold", "INF204KB17I5"], ["silver", "INF204KC1402"]]) if (eq[isin]) { hist[id] = mergeHistory(hist[id], [[eq[isin][1], eq[isin][0]]]); sources[id] = "NSE/BSE"; }

// Gold and silver in rupees: IBJA's published closing rates, 30 days per read (fills history from day one).
try {
  const { gold10g, silverkg } = parseIbja(await (await get("https://ibjarates.com/")).text());
  hist.gold10g = mergeHistory(hist.gold10g, gold10g); sources.gold10g = "IBJA";
  if (silverkg.length) { hist.silverkg = mergeHistory(hist.silverkg, silverkg); sources.silverkg = "IBJA"; }
  log("IBJA:", gold10g.at(-1), silverkg.at(-1));
} catch (e) { log("IBJA:", e.message); }

const fresh = (id) => sources[id] && hist[id];
const series = SERIES.filter((s) => !s.fallbackFor || !fresh(s.fallbackFor)).map((s) => {
  let sum = summarise(hist[s.id]);
  // IBJA rows: until IBJA's own history covers a period, use the matching ETF's change for it.
  const proxy = { gold10g: "gold", silverkg: "silver" }[s.id];
  if (sum && proxy) sum = fillChanges(sum, summarise(hist[proxy]));
  return sum ? { id: s.id, name: s.name, region: s.region, ...(s.unit ? { unit: s.unit } : {}), ...sum } : null;
}).filter(Boolean);
writeFileSync(HIST, JSON.stringify(hist));
if (series.length) {
  writeFileSync(OUT + "markets.json", JSON.stringify({
    updated: new Date().toISOString().slice(0, 10),
    note: "Public end-of-day index levels and changes (%), the same for everyone. Sources: NSE, BSE, Cboe (S&P 500; Dow from DJX × 100), Nasdaq, ECB, IBJA (gold and silver, without GST; 1M/1Y changes from the gold and silver ETFs until IBJA history covers them). No user data.",
    sources, series,
  }));
  log("markets.json:", series.map((s) => `${s.id} ${s.date} ${s.close} ${s.d1}%`).join(" · "));
} else log("No market series; markets.json unchanged");
