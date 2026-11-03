# koshmos-data

Public data the Koshmos app downloads. **No user data is ever stored or sent here.**

- `prices/mf.json` — mutual fund NAVs by ISIN, from AMFI: `{ "ISIN": [nav, "YYYY-MM-DD"] }`
- `prices/eq.json` — stock/ETF closing prices by ISIN, from NSE (BSE fills gaps): `{ "ISIN": [close, "YYYY-MM-DD", "SYMBOL"] }`
- `prices/us.json` — US stock/ETF closing prices in USD by ticker (S&P 500 + popular ETFs), from Stooq: `{ "AAPL": [close, "YYYY-MM-DD"] }`
- `prices/fx.json` — rupees per unit of each currency, from the ECB reference rates: `{ "USD": [85.1, "YYYY-MM-DD"] }`
- `prices/meta.json` — dates, counts and sources of the latest update
- `revoked.json` — random IDs of licence keys that are no longer active (for example after a refund). No names, emails or payment details.

Updated by the "Daily prices" GitHub Action (weekdays ~22:10 IST, and daily ~08:40 IST). Prices are end-of-day, for information only.
