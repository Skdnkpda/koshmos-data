import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAmfi, parseBhavcopy, mergeEquity } from "./parse.mjs";

test("AMFI NAVAll: both ISIN columns, section headings ignored", () => {
  const text = `Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date

Open Ended Schemes(Equity Scheme - Flexi Cap Fund)

Aditya Birla Sun Life AMC Limited

122639;INF879O01027;-;Parag Parikh Flexi Cap Fund - Direct Plan - Growth;87.1234;03-Nov-2026
100033;INF209K01AJ8;INF209K01AK6;Some Fund - IDCW;12.5;03-Nov-2026
100034;INF209K01ZZ1;-;Bad NAV Fund;N.A.;03-Nov-2026`;
  assert.deepEqual(parseAmfi(text), {
    INF879O01027: [87.1234, "2026-11-03"],
    INF209K01AJ8: [12.5, "2026-11-03"],
    INF209K01AK6: [12.5, "2026-11-03"],
  });
});

test("AMFI NAVAll with the newer Plan and Option columns", () => {
  const text = "Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Plan;Option;Net Asset Value;Date\r\n \r\nOpen Ended Schemes(Children\u2019s Fund)\r\n \r\nAxis Mutual Fund\r\n \r\n135762;INF846K01WO1;-;Axis Children's Fund;Direct Plan;Growth Option;29.8188;03-Nov-2026\r\n135765;INF846K01WP8;INF846K01WQ6;Axis Children's Fund;Direct Plan;IDCW Option;27.4685;03-Nov-2026";
  assert.deepEqual(parseAmfi(text), {
    INF846K01WO1: [29.8188, "2026-11-03"],
    INF846K01WP8: [27.4685, "2026-11-03"],
    INF846K01WQ6: [27.4685, "2026-11-03"],
  });
});

test("UDiFF bhavcopy: stocks/ETFs kept, derivatives and odd series skipped", () => {
  const text = `TradDt,BizDt,Sgmt,Src,FinInstrmTp,FinInstrmId,ISIN,TckrSymb,SctySrs,XpryDt,FininstrmActlXpryDt,StrkPric,OptnTp,FinInstrmNm,OpnPric,HghPric,LwPric,ClsPric,LastPric,PrvsClsgPric
2026-11-03,2026-11-03,CM,NSE,STK,11536,INE467B01029,TCS,EQ,,,,,TATA CONSULTANCY SERV LT,4080,4120,4060,4100.50,4101,4090
2026-11-03,2026-11-03,CM,NSE,STK,14,INF204KB14I2,NIFTYBEES,EQ,,,,,NIPPON NIFTY BEES,268,269,267,268.40,268.4,267
2026-11-03,2026-11-03,CM,NSE,STK,999,INE000X01011,BONDX,N1,,,,,SOME BOND,100,100,100,100,100,100
2026-11-03,2026-11-03,FO,NSE,STF,5,INE467B01029,TCS,,2026-11-27,,,,TCS FUT,4100,4100,4100,4150,4150,4100`;
  assert.deepEqual(parseBhavcopy(text), {
    INE467B01029: [4100.5, "2026-11-03", "TCS"],
    INF204KB14I2: [268.4, "2026-11-03", "NIFTYBEES"],
  });
});

test("unknown layouts fail loudly instead of publishing nothing silently", () => {
  assert.throws(() => parseBhavcopy("a,b,c\n1,2,3"), /columns not found/);
});

test("NSE wins over BSE for the same ISIN", () => {
  assert.deepEqual(mergeEquity({ X: [1, "d", "N"] }, { X: [2, "d", "B"], Y: [3, "d", "B"] }), { X: [1, "d", "N"], Y: [3, "d", "B"] });
});
