const B = "https://app.koshmos.in";
const html = await (await fetch(B + "/")).text();
const refs = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.js)"/g)].map((m) => m[1]))];
for (const r of refs) {
  const t = await (await fetch(B + r)).text();
  const i = t.indexOf("generateCategoricalChart");
  if (i >= 0 && !/generateCategoricalChart/.test(r)) console.log("MENTIONS", r, "::", t.slice(Math.max(0, i - 160), i + 60).replace(/\s+/g, " "));
}
const routeChunks = refs.filter((r) => /\/(plan|cash-flow|tax|family|routes|index)-/.test(r));
for (const r of routeChunks) { const t = await (await fetch(B + r)).text(); console.log("HEAD", r, t.length, "::", t.slice(0, 260).replace(/\s+/g, " ")); }
