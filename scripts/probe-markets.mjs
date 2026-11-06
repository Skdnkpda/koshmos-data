// One-off: check which market sources answer from GitHub Actions. Logs only.
const UA = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36", Accept: "*/*" };
const day = (d) => `${String(d.getUTCDate()).padStart(2, "0")}${String(d.getUTCMonth() + 1).padStart(2, "0")}${d.getUTCFullYear()}`;
const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() - 1);
const urls = [
  [`https://nsearchives.nseindia.com/content/indices/ind_close_all_${day(d)}.csv`, { Referer: "https://www.nseindia.com/" }],
  ["https://stooq.com/q/d/l/?s=^spx&i=d", {}], ["https://stooq.com/q/d/l/?s=^nkx&i=d", {}], ["https://stooq.com/q/d/l/?s=^hsi&i=d", {}],
  ["https://stooq.com/q/d/l/?s=^ukx&i=d", {}], ["https://stooq.com/q/d/l/?s=xauusd&i=d", {}], ["https://stooq.com/q/d/l/?s=cb.f&i=d", {}],
  ["https://stooq.com/q/l/?s=^spx+^nkx+^hsi+^ukx+xauusd+cb.f+usdinr&f=sd2t2ohlc&h&e=csv", {}],
  ["https://api.nasdaq.com/api/quote/SPX/historical?assetclass=index&fromdate=2026-09-20&limit=60", { Origin: "https://www.nasdaq.com", Referer: "https://www.nasdaq.com/" }],
  ["https://api.nasdaq.com/api/quote/COMP/historical?assetclass=index&fromdate=2026-09-20&limit=60", { Origin: "https://www.nasdaq.com", Referer: "https://www.nasdaq.com/" }],
  ["https://api.nasdaq.com/api/quote/INDU/historical?assetclass=index&fromdate=2026-09-20&limit=60", { Origin: "https://www.nasdaq.com", Referer: "https://www.nasdaq.com/" }],
  ["https://api.nasdaq.com/api/quote/DJIA/info?assetclass=index", { Origin: "https://www.nasdaq.com", Referer: "https://www.nasdaq.com/" }],
  ["https://api.bseindia.com/BseIndiaAPI/api/GetSensexData/w", { Referer: "https://www.bseindia.com/", Origin: "https://www.bseindia.com" }],
  ["https://api.bseindia.com/BseIndiaAPI/api/ProduceCSVForDate/w?strIndex=SENSEX&dtFromDate=01/10/2026&dtToDate=06/11/2026", { Referer: "https://www.bseindia.com/" }],
  ["https://query1.finance.yahoo.com/v8/finance/chart/%5EBSESN?range=3mo&interval=1d", {}],
];
for (const [u, h] of urls) {
  try {
    const r = await fetch(u, { headers: { ...UA, ...h }, signal: AbortSignal.timeout(20000) });
    const t = await r.text();
    console.log("\n###", r.status, u, "bytes", t.length, "\n", t.slice(0, 500).replace(/\s+/g, " "));
  } catch (e) { console.log("\n### ERR", u, e.message); }
}
