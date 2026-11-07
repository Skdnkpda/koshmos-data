const UA = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36" };
const r = await fetch("https://ibjarates.com/", { headers: UA });
const t = await r.text();
const flat = t.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ");
// Elements with ids and short text
for (const m of flat.matchAll(/<(\w+)[^>]*\bid="([^"]+)"[^>]*>\s*([^<]{1,60})</g)) if (/\d/.test(m[3])) console.log("ID", m[2], "=>", m[3].trim());
// Text around Silver and dates
const text = flat.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
for (const k of ["Silver", "SILVER", "Gold 999", "Rates for", "Date", "AM", "PM"]) { let i = -1, n = 0; while ((i = text.indexOf(k, i + 1)) >= 0 && n++ < 4) console.log("TXT", k, "::", text.slice(Math.max(0, i - 120), i + 200)); }
// Scripts that fetch rates
for (const m of t.matchAll(/(url\s*:\s*["'][^"']+["']|fetch\(["'][^"']+["']|\$\.(?:get|post|ajax)\(["'][^"']+["'])/g)) console.log("JS", m[1]);
