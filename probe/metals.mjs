// One-off probe: can the runner read IBJA and MCX daily? Prints status and snippets only.
const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36", accept: "text/html,application/json,*/*" };
async function show(label, url, init = {}) {
  try {
    const r = await fetch(url, { ...init, headers: { ...UA, ...(init.headers || {}) }, signal: AbortSignal.timeout(20000) });
    const t = await r.text();
    console.log(`\n=== ${label} ${r.status} ${r.headers.get("content-type")} len=${t.length}`);
    return t;
  } catch (e) { console.log(`\n=== ${label} ERROR ${e.message}`); return ""; }
}
const ibja = await show("IBJA home", "https://ibjarates.com/");
for (const m of ibja.matchAll(/id="(lbl[^"]*|[^"]*(?:rate|Rate|gold|Gold|silver|Silver)[^"]*)"[^>]*>([^<]{1,40})</g)) console.log("ibja", m[1], "=>", m[2].trim());
const idx = ibja.search(/999/); if (idx > 0) console.log("ibja near 999:", ibja.slice(idx - 300, idx + 600).replace(/\s+/g, " "));
const mw = await show("MCX market watch", "https://www.mcxindia.com/backpage.aspx/GetMarketWatch", { method: "POST", headers: { "content-type": "application/json", referer: "https://www.mcxindia.com/market-data/market-watch" }, body: "{}" });
try { const j = JSON.parse(mw); const rows = (j.d?.Data ?? []).filter((x) => /^(GOLD|SILVER)$/.test(x.Symbol)); console.log("mcx rows", JSON.stringify(rows.slice(0, 4))); } catch { console.log("mcx body:", mw.slice(0, 400)); }
const bc = await show("MCX bhavcopy page", "https://www.mcxindia.com/market-data/bhavcopy");
console.log("bhav snippet:", bc.slice(0, 300).replace(/\s+/g, " "));
