// One-off: check which market sources answer from GitHub Actions. Logs only.
const UA = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36", Accept: "*/*" };
const day = (d) => `${String(d.getUTCDate()).padStart(2, "0")}${String(d.getUTCMonth() + 1).padStart(2, "0")}${d.getUTCFullYear()}`;
const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() - 1);
const N = { Origin: "https://www.nasdaq.com", Referer: "https://www.nasdaq.com/" };
const urls = [
  ["https://fred.stlouisfed.org/graph/fredgraph.csv?id=SP500,DJIA,NASDAQCOM,NIKKEI225,DCOILBRENTEU,DEXINUS", {}],
  ["https://api.nasdaq.com/api/quote/NDX/historical?assetclass=index&fromdate=2026-09-20&limit=60", N],
  ["https://api.nasdaq.com/api/quote/SPX/info?assetclass=index", N],
  ["https://api.nasdaq.com/api/quote/GC%3ACMX/historical?assetclass=commodities&fromdate=2026-09-20&limit=60", N],
  ["https://api.nasdaq.com/api/quote/CL%3ANMX/historical?assetclass=commodities&fromdate=2026-09-20&limit=60", N],
  ["https://api.nasdaq.com/api/quote/HSI/historical?assetclass=index&fromdate=2026-09-20&limit=60", N],
  ["https://api.nasdaq.com/api/quote/UKX/historical?assetclass=index&fromdate=2026-09-20&limit=60", N],
  ["https://www.bseindia.com/Indices/IndexArchiveData.html", { Referer: "https://www.bseindia.com/" }],
  ["https://www.bseindia.com/download/BhavCopy/Index/Indices_06112026.csv", { Referer: "https://www.bseindia.com/" }],
  ["https://query2.finance.yahoo.com/v8/finance/chart/%5EBSESN?range=3mo&interval=1d", {}],
];
for (const [u, h] of urls) {
  try {
    const r = await fetch(u, { headers: { ...UA, ...h }, signal: AbortSignal.timeout(20000) });
    const t = await r.text();
    console.log("\n###", r.status, u, "bytes", t.length, "\n", t.slice(0, 500).replace(/\s+/g, " "));
  } catch (e) { console.log("\n### ERR", u, e.message); }
}
