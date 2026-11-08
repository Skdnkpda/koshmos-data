const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36", accept: "*/*" };
async function show(label, url, init = {}) {
  try {
    const r = await fetch(url, { ...init, headers: { ...UA, ...(init.headers || {}) }, signal: AbortSignal.timeout(20000) });
    const t = await r.text();
    console.log(`\n=== ${label} ${r.status} len=${t.length}\n${t.slice(0, 500).replace(/\s+/g, " ")}`);
  } catch (e) { console.log(`\n=== ${label} ERROR ${e.message}`); }
}
for (const s of ["^dji", "^nkx", "^ukx", "^hsi", "^bsx", "^sensex"]) await show(`stooq ${s}`, `https://stooq.com/q/d/l/?s=${encodeURIComponent(s)}&i=d`);
await show("BSE sensex api", "https://api.bseindia.com/BseIndiaAPI/api/GetSensexData/w", { headers: { referer: "https://www.bseindia.com/", origin: "https://www.bseindia.com" } });
await show("BSE index archive", "https://api.bseindia.com/BseIndiaAPI/api/ProduceCSVForDate/w?strIndex=SENSEX&dtFromDate=01/11/2026&dtToDate=07/11/2026", { headers: { referer: "https://www.bseindia.com/", origin: "https://www.bseindia.com" } });
await show("Dow (Nasdaq api)", "https://api.nasdaq.com/api/quote/DJIA/historical?assetclass=index&fromdate=2026-10-20&limit=10", { headers: { accept: "application/json" } });
