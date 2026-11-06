import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNseIndices, parseNasdaqHistory, parseCboeHistory, mergeHistory, summarise, parseEcbUsdInrHistory } from "./markets.mjs";

test("NSE index file", () => {
  const csv = "Index Name,Index Date,Open Index Value,High Index Value,Low Index Value,Closing Index Value,Points Change,Change(%)\nNifty 50,05-11-2026,24378.05,24579.9,24296.3,24536.6,576.0,2.4\nIndia VIX,05-11-2026,1,1,1,14.2,0,0\nBad,xx,1,1,1,-,0,0";
  assert.deepEqual(parseNseIndices(csv), { "nifty 50": { date: "2026-11-05", close: 24536.6 }, "india vix": { date: "2026-11-05", close: 14.2 } });
  assert.throws(() => parseNseIndices("a,b\n1,2"));
});
test("Nasdaq and Cboe history", () => {
  assert.deepEqual(parseNasdaqHistory({ data: { tradesTable: { rows: [{ date: "11/05/2026", close: "24,315.00" }] } } }), [["2026-11-05", 24315]]);
  assert.deepEqual(parseNasdaqHistory({ data: null }), []);
  assert.deepEqual(parseCboeHistory({ data: [{ date: "2026-11-04", close: "7353.73" }, { date: "2026-11-05", close: "7428.05" }] }, 1), [["2026-11-05", 7428.05]]);
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
