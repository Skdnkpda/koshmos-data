// Daily market wrap: index closes and 1D/1W/1M/1Y changes, published as prices/markets.json.
// Public data only, the same for everyone. Each source is independent; a failure keeps its history.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { SERIES, parseNseIndices, parseNasdaqHistory, parseCboeHistory, mergeHistory, summarise } from "./markets.mjs";

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

// India: NSE's daily index file. First run backfills about 6 weeks of weekdays.
{
  const now = new Date(Date.now() + 5.5 * 3600 * 1000);
  const haveDays = Object.keys(hist.nifty50 ?? {}).length;
  const span = haveDays < 20 ? 45 : 6;
  let got = 0;
  for (let i = 0; i < span; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    if ([0, 6].includes(d.getUTCDay())) continue;
    const url = `https://nsearchives.nseindia.com/content/indices/ind_close_all_${nseDay(d)}.csv`;
    try {
      const rows = parseNseIndices(await (await get(url, { Referer: "https://www.nseindia.com/" })).text());
      for (const s of SERIES.filter((x) => x.nse)) {
        const r = rows[s.nse.toLowerCase()];
        if (r) hist[s.id] = mergeHistory(hist[s.id], [[r.date, r.close]]);
        else if (got === 0) log("NSE: no row for", s.nse, "names include:", Object.keys(rows).slice(0, 80).join(" | "));
      }
      got++; sources.in = "NSE";
    } catch (e) { if (i < 4) log("NSE", nseDay(d), e.message); }
  }
  log("NSE files read:", got);
}

// US: Cboe (S&P 500) and Nasdaq (Composite, Nasdaq-100), each with recent history.
try {
  hist.sp500 = mergeHistory(hist.sp500, parseCboeHistory(await (await get("https://cdn.cboe.com/api/global/delayed_quotes/charts/historical/_SPX.json")).json()));
  sources.sp500 = "Cboe";
} catch (e) { log("Cboe SPX:", e.message); }
const from = new Date(Date.now() - 400 * 86400000).toISOString().slice(0, 10);
for (const [id, sym] of [["nasdaq", "COMP"], ["nasdaq100", "NDX"]]) {
  try {
    const pts = parseNasdaqHistory(await (await get(`https://api.nasdaq.com/api/quote/${sym}/historical?assetclass=index&fromdate=${from}&limit=400`, { Origin: "https://www.nasdaq.com", Referer: "https://www.nasdaq.com/" })).json());
    if (!pts.length) throw new Error("no rows");
    hist[id] = mergeHistory(hist[id], pts);
    sources[id] = "Nasdaq";
  } catch (e) { log("Nasdaq", sym, e.message); }
}

// Rupee and metals from today's own price files (written by update-prices.mjs just before).
const fx = readJson(OUT + "fx.json", {}), eq = readJson(OUT + "eq.json", {});
if (fx.USD) { hist.usdinr = mergeHistory(hist.usdinr, [[fx.USD[1], fx.USD[0]]]); sources.usdinr = "ECB"; }
for (const [id, isin] of [["gold", "INF204KB17I5"], ["silver", "INF204KC1402"]]) if (eq[isin]) { hist[id] = mergeHistory(hist[id], [[eq[isin][1], eq[isin][0]]]); sources[id] = "NSE/BSE"; }

const series = SERIES.map((s) => { const sum = summarise(hist[s.id]); return sum ? { id: s.id, name: s.name, region: s.region, ...(s.unit ? { unit: s.unit } : {}), ...sum } : null; }).filter(Boolean);
writeFileSync(HIST, JSON.stringify(hist));
if (series.length) {
  writeFileSync(OUT + "markets.json", JSON.stringify({
    updated: new Date().toISOString().slice(0, 10),
    note: "Public end-of-day index levels and changes (%), the same for everyone. Sources: NSE, Cboe, Nasdaq, ECB. No user data.",
    sources, series,
  }));
  log("markets.json:", series.map((s) => `${s.id} ${s.date} ${s.close} ${s.d1}%`).join(" · "));
} else log("No market series; markets.json unchanged");
