const B = "https://app.koshmos.in";
const html = await (await fetch(B + "/")).text();
const refs = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]);
console.log("HTML script/preload refs:", refs.length); for (const r of refs) console.log("  ", r);
const seen = new Map();
async function load(p) { if (seen.has(p)) return seen.get(p); const t = await (await fetch(B + p)).text(); seen.set(p, t); return t; }
// Who statically imports the chart chunk?
for (const r of refs) {
  const t = await load(r);
  const imps = [...t.matchAll(/(?:import|from)\s*["'](\.\/[^"']+\.js)["']/g)].map((m) => m[1]);
  const chart = imps.filter((i) => /generateCategoricalChart/.test(i));
  if (chart.length) console.log("STATIC chart import in", r);
  for (const i of imps) { const p = "/assets/" + i.slice(2); if (!seen.has(p)) { const tt = await load(p); if (/generateCategoricalChart/.test([...tt.matchAll(/(?:import|from)\s*["'](\.\/[^"']+\.js)["']/g)].map((m) => m[1]).join(" "))) console.log("  level2:", p, "imports chart; imported by", r); } }
}
const chartName = [...seen.keys()].find((k) => /generateCategoricalChart/.test(k)) || refs.find((r) => /generateCategoricalChart/.test(r));
console.log("chart chunk:", chartName);
if (chartName) { const c = await load(chartName); for (const w of ["Salary Autopsy", "recharts", "d3-", "HealthCheck", "Net worth", "assumption", "Recharts"]) console.log(`  contains "${w}":`, c.includes(w)); console.log("  exports tail:", c.slice(-600).replace(/\s+/g, " ")); }
