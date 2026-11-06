// One-off: check which market sources answer from GitHub Actions. Logs only.
const UA = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36", Accept: "*/*" };
const day = (d) => `${String(d.getUTCDate()).padStart(2, "0")}${String(d.getUTCMonth() + 1).padStart(2, "0")}${d.getUTCFullYear()}`;
const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() - 1);
const N = { Origin: "https://www.nasdaq.com", Referer: "https://www.nasdaq.com/" };
const urls = [
  ["https://fred.stlouisfed.org/graph/fredgraph.csv?id=SP500", {}],
  ["https://fred.stlouisfed.org/graph/fredgraph.csv?id=NIKKEI225", {}],
  ["https://fred.stlouisfed.org/graph/fredgraph.csv?id=DJIA", {}],
  ["https://cdn.cboe.com/api/global/delayed_quotes/charts/historical/_SPX.json", {}],
  ["https://cdn.cboe.com/api/global/delayed_quotes/charts/historical/_DJI.json", {}],
  ["https://cdn.cboe.com/api/global/delayed_quotes/quotes/_SPX.json", {}],
];
for (const [u, h] of urls) {
  try {
    const r = await fetch(u, { headers: { ...UA, ...h }, signal: AbortSignal.timeout(60000) });
    const t = await r.text();
    console.log("\n###", r.status, u, "bytes", t.length, "\n", t.slice(0, 500).replace(/\s+/g, " "));
  } catch (e) { console.log("\n### ERR", u, e.message); }
}
