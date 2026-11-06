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

import { parseEcbToInr, parseStooq } from "./parse.mjs";
test("ECB rates become rupees per unit", () => {
  const xml = `<gesmes:Envelope><Cube><Cube time='2026-11-03'><Cube currency='USD' rate='1.0800'/><Cube currency='GBP' rate='0.8400'/><Cube currency='INR' rate='91.8000'/></Cube></Cube></gesmes:Envelope>`;
  assert.deepEqual(parseEcbToInr(xml), { EUR: [91.8, "2026-11-03"], USD: [85, "2026-11-03"], GBP: [109.2857, "2026-11-03"] });
  assert.throws(() => parseEcbToInr("<Cube time='2026-11-03'><Cube currency='USD' rate='1.08'/></Cube>"), /without INR/);
});
test("Stooq quotes: ticker suffix removed, missing data skipped", () => {
  const csv = "Symbol,Date,Time,Open,High,Low,Close,Volume\nAAPL.US,2026-11-03,22:00:09,230,233,229,232.15,1000\nMSFT.US,2026-11-03,22:00:10,400,410,399,405.5,900\nZZZZ.US,N/D,N/D,N/D,N/D,N/D,N/D,N/D";
  assert.deepEqual(parseStooq(csv), { AAPL: [232.15, "2026-11-03"], MSFT: [405.5, "2026-11-03"] });
});

import { parseNasdaqScreener, usCloseDate } from "./parse.mjs";
test("Nasdaq screener rows (stocks and ETF shapes)", () => {
  const stocks = { data: { rows: [{ symbol: "AAPL", name: "Apple", lastsale: "$232.15" }, { symbol: "BRK/B", lastsale: "$470.10" }, { symbol: "XX", lastsale: "NA" }] } };
  const etfs = { data: { data: { rows: [{ symbol: "VOO", companyName: "Vanguard S&P 500", lastSalePrice: "$545.20" }] } } };
  assert.deepEqual(parseNasdaqScreener(stocks, "2026-11-03"), { AAPL: [232.15, "2026-11-03"], "BRK.B": [470.1, "2026-11-03"] });
  assert.deepEqual(parseNasdaqScreener(etfs, "2026-11-03"), { VOO: [545.2, "2026-11-03"] });
});
test("US close date: none while the market is open; previous trading day before the open", () => {
  assert.equal(usCloseDate(new Date("2026-11-03T16:40:00Z")), null); // Tue 11:40 New York
  assert.equal(usCloseDate(new Date("2026-11-04T03:10:00Z")), "2026-11-03"); // Tue 22:10 New York
  assert.equal(usCloseDate(new Date("2026-11-04T12:00:00Z")), "2026-11-03"); // Wed 07:00, before the open
  assert.equal(usCloseDate(new Date("2026-11-09T12:00:00Z")), "2026-11-06"); // Mon 07:00 → Friday
});

test("AMFI NAVs dated in the future are skipped", () => {
  const text = "Scheme Code;ISIN Div Payout/ ISIN Growth;ISIN Div Reinvestment;Scheme Name;Net Asset Value;Date\n1;INF000000001;-;A;10.5;05-Nov-2026\n2;INF000000002;-;B;11;08-Nov-2026";
  assert.deepEqual(parseAmfi(text, "2026-11-06"), { INF000000001: [10.5, "2026-11-05"] });
});
