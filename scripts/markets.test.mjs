import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNseIndices, parseNasdaqHistory, parseCboeHistory, mergeHistory, summarise, fillChanges, parseEcbUsdInrHistory } from "./markets.mjs";

test("NSE index file", () => {
  const csv = "Index Name,Index Date,Open Index Value,High Index Value,Low Index Value,Closing Index Value,Points Change,Change(%)\nNifty 50,05-11-2026,24378.05,24579.9,24296.3,24536.6,576.0,2.4\nIndia VIX,05-11-2026,1,1,1,14.2,0,0\nBad,xx,1,1,1,-,0,0";
  assert.deepEqual(parseNseIndices(csv), { "nifty 50": { date: "2026-11-05", close: 24536.6 }, "india vix": { date: "2026-11-05", close: 14.2 } });
  assert.throws(() => parseNseIndices("a,b\n1,2"));
});
test("Nasdaq and Cboe history", () => {
  assert.deepEqual(parseNasdaqHistory({ data: { tradesTable: { rows: [{ date: "11/05/2026", close: "24,315.00" }] } } }), [["2026-11-05", 24315]]);
  assert.deepEqual(parseNasdaqHistory({ data: null }), []);
  assert.deepEqual(parseCboeHistory({ data: [{ date: "2026-11-04", close: "7353.73" }, { date: "2026-11-05", close: "7428.05" }] }, 1), [["2026-11-05", 7428.05]]);
  // Dow from DJX (1/100 of the index)
  assert.deepEqual(mergeHistory({}, parseCboeHistory({ data: [{ date: "2026-11-12", close: "522.970000" }] }, 400, 100)), { "2026-11-12": 52297 });
});
test("history merge and summary", () => {
  let h = mergeHistory({}, [["2025-11-05", 80], ["2026-10-06", 90], ["2026-10-29", 95], ["2026-11-04", 98]]);
  h = mergeHistory(h, [["2026-11-05", 100]]);
  const s = summarise(h);
  assert.equal(s.date, "2026-11-05"); assert.equal(s.close, 100);
  assert.equal(s.d1, 2.04); assert.equal(s.w1, 5.26); assert.equal(s.m1, 11.11); assert.equal(s.y1, 25);
  assert.equal(summarise({ "2026-11-05": 10 }).d1, null);
  assert.equal(Object.keys(mergeHistory(h, [], 2)).length, 2);
});

test("ECB history to rupees per dollar", () => {
  const xml = "<Cube><Cube time='2026-11-05'><Cube currency='USD' rate='1.08'/><Cube currency='INR' rate='97.2'/></Cube><Cube time='2026-11-04'><Cube currency='USD' rate='1.10'/><Cube currency='INR' rate='96.8'/></Cube></Cube>";
  assert.deepEqual(parseEcbUsdInrHistory(xml), [["2026-11-04", 88], ["2026-11-05", 90]]);
});

test("IBJA closing rates", async () => {
  const { parseIbja } = await import("./markets.mjs");
  const page = `<div>Purity AM PM</div><p>Previous 30 Days</p><table><tr><th>999</th><th>995</th><th>916</th><th>750</th><th>585</th><th>Silver 999</th><th>Platinum 999</th></tr>
  <tr><td>06/11/2026</td><td>141023</td><td>140458</td><td>129177</td><td>105767</td><td>82498</td><td>181863</td><td>56650</td></tr></table>
  <table><tr><th>999</th><th>995</th><th>916</th><th>750</th><th>585</th><th>Silver 999</th><th>Platinum 999</th></tr>
  <tr><td>06/11/2026</td><td>141452</td><td>140886</td><td>129570</td><td>106089</td><td>82749</td><td>182868</td><td>55707</td></tr>
  <tr><td>05/11/2026</td><td>144129</td><td>143552</td><td>132022</td><td>108097</td><td>84315</td><td>187300</td><td>56863</td></tr></table>
  <p>*Gold rates per 10gm &amp; Silver rate per 1kg</p><p>04/11/2026 1 2 3 4 5 6 7</p>`;
  const r = parseIbja(page);
  assert.deepEqual(r.gold10g, [["2026-11-05", 144129], ["2026-11-06", 141452]]);
  assert.deepEqual(r.silverkg, [["2026-11-05", 187300], ["2026-11-06", 182868]]);
  assert.throws(() => parseIbja("<p>maintenance</p>"), /not found/);
});

test("BSE Sensex CSV", async () => {
  const { parseBseIndexCsv } = await import("./markets.mjs");
  const csv = "Date,Open,High,Low,Close\n2-November-2026,75178.24,75692.78,74978.12,75692.78\n6-November-2026,79413.66,81028.02,79016.05,81028.02\nbad,line\n";
  assert.deepEqual(parseBseIndexCsv(csv), [["2026-11-02", 75692.78], ["2026-11-06", 81028.02]]);
});

test("IBJA rows borrow the ETF's change only where their own history is too short", () => {
  const own = { date: "2026-11-12", close: 137692, d1: -2.07, w1: -4.47, m1: null, y1: null, spark: [] };
  const etf = { date: "2026-11-12", close: 110, d1: -2, w1: -4.2, m1: 3.1, y1: 41.5, spark: [] };
  assert.deepEqual(fillChanges(own, etf), { ...own, m1: 3.1, y1: 41.5, proxied: ["m1", "y1"] });
  assert.equal(fillChanges(etf, own), etf);
  assert.equal(fillChanges(own, null), own);
});
