// Downloads public end-of-day prices and writes compact JSON for the Koshmos app.
// Runs in GitHub Actions. Each source is independent: a failure keeps that source's previous file.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseAmfi, parseBhavcopy, mergeEquity, parseEcbToInr, parseNasdaqScreener, usCloseDate } from "./parse.mjs";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const OUT = new URL("../prices/", import.meta.url).pathname;
const log = (...a) => console.log(new Date().toISOString(), ...a);

async function get(url, headers = {}) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*", ...headers }, redirect: "follow" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}
/** Last few calendar days in India (UTC+05:30), newest first: exchanges are closed on holidays. */
function recentDays(n = 7) {
  const now = new Date(Date.now() + 5.5 * 3600 * 1000);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    return d.toISOString().slice(0, 10).replace(/-/g, "");
  });
}
function unzipFirst(buf) {
  const dir = mkdtempSync(join(tmpdir(), "bhav-"));
  const zip = join(dir, "f.zip");
  writeFileSync(zip, buf);
  return execFileSync("unzip", ["-p", zip], { maxBuffer: 256 * 1024 * 1024 }).toString("utf8");
}

async function amfi() {
  for (const url of ["https://portal.amfiindia.com/spages/NAVAll.txt", "https://www.amfiindia.com/spages/NAVAll.txt"]) {
    try {
      const text = (await get(url)).toString("utf8");
      const map = parseAmfi(text, new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10));
      if (Object.keys(map).length > 1000) return { map, source: url };
      const rows = text.split(/\r?\n/).filter((l) => l.includes(";"));
      log("AMFI file too small from", url, "bytes", text.length, "parsed", Object.keys(map).length, "sample:", JSON.stringify(rows.slice(0, 3)).slice(0, 600), "start:", JSON.stringify(text.slice(0, 200)));
    } catch (e) { log("AMFI failed:", e.message); }
  }
  return null;
}
async function nse() {
  for (const day of recentDays()) {
    const url = `https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_${day}_F_0000.csv.zip`;
    try {
      const map = parseBhavcopy(unzipFirst(await get(url, { Referer: "https://www.nseindia.com/" })));
      if (Object.keys(map).length > 500) return { map, source: url };
    } catch (e) { log("NSE", day, e.message); }
  }
  return null;
}
async function bse() {
  for (const day of recentDays()) {
    const url = `https://www.bseindia.com/download/BhavCopy/Equity/BhavCopy_BSE_CM_0_0_0_${day}_F_0000.CSV`;
    try {
      const map = parseBhavcopy((await get(url, { Referer: "https://www.bseindia.com/" })).toString("utf8"));
      if (Object.keys(map).length > 500) return { map, source: url };
    } catch (e) { log("BSE", day, e.message); }
  }
  return null;
}
async function fx() {
  try {
    const map = parseEcbToInr((await get("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml")).toString("utf8"));
    if (map.USD) return { map, source: "ECB" };
  } catch (e) { log("FX failed:", e.message); }
  return null;
}
/** Every US-listed stock and ETF with its last price (Nasdaq screener), taken only after the close. */
async function us() {
  const probe = process.env.US_PROBE === "true"; // test the source anytime; logs only, never publishes
  const date = usCloseDate() ?? (probe ? "probe" : null);
  if (!date) { log("US market open; keeping the previous US prices"); return null; }
  const headers = { Accept: "application/json, text/plain, */*", Origin: "https://www.nasdaq.com", Referer: "https://www.nasdaq.com/" };
  const out = {};
  for (const url of [
    "https://api.nasdaq.com/api/screener/stocks?tableonly=true&download=true",
    "https://api.nasdaq.com/api/screener/etf?tableonly=true&download=true",
  ]) {
    try {
      const got = parseNasdaqScreener(JSON.parse((await get(url, headers)).toString("utf8")), date);
      log("US", url.includes("etf") ? "ETFs" : "stocks", Object.keys(got).length);
      Object.assign(out, got);
    } catch (e) { log("US failed:", url, e.message); }
  }
  if (probe) { log("US probe sample:", JSON.stringify(Object.entries(out).filter(([k]) => ["AAPL", "MSFT", "VOO", "BRK.B", "QQQ"].includes(k)))); return null; }
  return Object.keys(out).length > 1000 ? { map: out, source: "Nasdaq screener", date } : null;
}
const read = (f) => (existsSync(OUT + f) ? JSON.parse(readFileSync(OUT + f, "utf8")) : null);
const latestDate = (map) => Object.values(map).map((v) => v[1]).filter(Boolean).sort().at(-1) ?? "";

const [mf, n, b, rates, usq] = await Promise.all([amfi(), nse(), bse(), fx(), us()]);
const meta = read("meta.json") ?? {};
const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
if (mf) {
  writeFileSync(OUT + "mf.json", JSON.stringify(mf.map));
  meta.mf = { date: latestDate(mf.map), count: Object.keys(mf.map).length, source: "AMFI" };
}
if (n || b) {
  const eq = mergeEquity(n?.map ?? {}, b?.map ?? {});
  writeFileSync(OUT + "eq.json", JSON.stringify(eq));
  meta.eq = { date: latestDate(eq), count: Object.keys(eq).length, source: [n && "NSE", b && "BSE"].filter(Boolean).join(" + ") };
}
if (rates) {
  writeFileSync(OUT + "fx.json", JSON.stringify(rates.map));
  meta.fx = { date: latestDate(rates.map), count: Object.keys(rates.map).length, source: rates.source };
}
if (usq) {
  writeFileSync(OUT + "us.json", JSON.stringify(usq.map));
  meta.us = { date: usq.date, count: Object.keys(usq.map).length, source: usq.source };
}
meta.checked = today;
meta.note = "Public end-of-day data only, the same for everyone. mf/eq: [price, YYYY-MM-DD(, symbol)] by ISIN; us: [close USD, date] by ticker; fx: [rupees per unit, date] by currency. No user data.";
writeFileSync(OUT + "meta.json", JSON.stringify(meta, null, 2) + "\n");
log("mf:", meta.mf, "eq:", meta.eq);
if (!mf && !n && !b && !rates && !usq) {
  console.error("Every price source failed; previous files kept.");
  process.exit(1);
}
