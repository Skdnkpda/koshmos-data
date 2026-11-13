// Probe: which free, public end-of-day sources for Dow, Nikkei 225, FTSE 100 and Hang Seng answer
// from a GitHub runner (roadmap #37). Logs only; publishes nothing.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const mdY = (iso) => { const [y, m, d] = iso.split("-"); return `${m}/${d}/${y}`; };
const tries = {
  dow: [
    "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DJIA",
    "https://cdn.cboe.com/api/global/delayed_quotes/charts/historical/_DJX.json",
    "https://api.nasdaq.com/api/quote/INDU/historical?assetclass=index&limit=5",
    "https://stooq.com/q/d/l/?s=^dji&i=d",
    `https://www.wsj.com/market-data/quotes/index/DJIA/historical-prices/download?num_rows=30&range_days=30&startDate=${mdY(day(30))}&endDate=${mdY(day(0))}`,
    "https://query1.finance.yahoo.com/v8/finance/chart/%5EDJI?range=1mo&interval=1d",
  ],
  nikkei: [
    "https://indexes.nikkei.co.jp/nkave/historical/nikkei_stock_average_daily_en.csv",
    "https://fred.stlouisfed.org/graph/fredgraph.csv?id=NIKKEI225",
    "https://stooq.com/q/d/l/?s=^nkx&i=d",
    `https://www.wsj.com/market-data/quotes/index/JP/NIK/historical-prices/download?num_rows=30&range_days=30&startDate=${mdY(day(30))}&endDate=${mdY(day(0))}`,
    "https://query1.finance.yahoo.com/v8/finance/chart/%5EN225?range=1mo&interval=1d",
  ],
  ftse: [
    "https://stooq.com/q/d/l/?s=^ukx&i=d",
    `https://www.wsj.com/market-data/quotes/index/UK/UKX/historical-prices/download?num_rows=30&range_days=30&startDate=${mdY(day(30))}&endDate=${mdY(day(0))}`,
    "https://api.londonstockexchange.com/api/gw/lse/instruments/alldata/UKX",
    `https://www.marketwatch.com/investing/index/ukx/downloaddatapartial?startdate=${mdY(day(30))}%2000:00:00&enddate=${mdY(day(0))}%2000:00:00&daterange=d30&frequency=p1d&csvdownload=true&downloadpartial=false&newdates=false&countrycode=uk`,
    "https://query1.finance.yahoo.com/v8/finance/chart/%5EFTSE?range=1mo&interval=1d",
    "https://cdn.cboe.com/api/global/delayed_quotes/charts/historical/_UKX.json",
  ],
  hsi: [
    "https://www.hsi.com.hk/data/eng/rt/index-series/hsi/performance.do",
    "https://www.hsi.com.hk/data/eng/indexes/00001.00/chart.json",
    "https://stooq.com/q/d/l/?s=^hsi&i=d",
    `https://www.wsj.com/market-data/quotes/index/HK/HSI/historical-prices/download?num_rows=30&range_days=30&startDate=${mdY(day(30))}&endDate=${mdY(day(0))}`,
    "https://query1.finance.yahoo.com/v8/finance/chart/%5EHSI?range=1mo&interval=1d",
  ],
};
for (const [name, urls] of Object.entries(tries)) {
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*", "Accept-Language": "en-US,en;q=0.9" }, signal: AbortSignal.timeout(30000) });
      const t = await res.text();
      console.log(`${name} ${res.status} ${t.length}B ${url}\n   ${t.slice(0, 220).replace(/\s+/g, " ")}\n   …${t.slice(-160).replace(/\s+/g, " ")}`);
    } catch (e) { console.log(`${name} ERR ${e.message} ${url}`); }
  }
}
