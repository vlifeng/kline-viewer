# Kline Viewer (Binance spot 1m K-lines: UNIUSDT, BTCUSDT, ETHUSDT)

K-lines only (no trades/aggTrades). Data: 131,040 1m bars per symbol, 2026-07-02 00:00 -> 2026-09-30 23:59 UTC.
Source timestamps are **microseconds**; they are converted with `to_timestamp(open_time/1e6)`.

## Layout
- `db/schema.sql` - `klines_1m(symbol, ts timestamptz, open, high, low, close, volume, quote_volume, trades)`, PK `(symbol, ts)`, TimescaleDB hypertable (7-day chunks)
- `db/caggs.sql` - continuous aggregates `klines_5m, _15m, _1h, _4h, _1d`, UTC-aligned
- `db/load.py` - loads the three `*_klines_1m_merged.csv.gz` files
- `db/verify.sql` - recomputes every aggregate independently and compares
- `api/main.py` - FastAPI (`/api/symbols`, `/api/klines`, `/api/health`), CORS enabled
- `frontend/` - static Vite + React build (lightweight-charts v5), own `package.json`
- `.github/workflows/deploy.yml` - GitHub Pages deploy of `frontend/`
- `start.sh` / `stop.sh`

## Frontend config (build-time env)
- `VITE_BASE` - public path (default `./`; for Pages project sites `/<repo>/`)
- `VITE_API_BASE` - API URL, default `http://localhost:8000` (set to an https tunnel URL for the Pages build)

```
cd frontend && npm install && VITE_API_BASE=https://my-tunnel.example npm run build   # -> frontend/dist
```
GitHub Actions: set repo variable `VITE_API_BASE` (and optionally `VITE_BASE`), and enable Pages -> Source: GitHub Actions.
An https Pages site calling an http API is blocked as mixed content; use an https tunnel.

## API
`GET /api/klines?symbol=BTCUSDT&interval=1m|5m|15m|1h|4h|1d&from=&to=&limit=` returns ascending `[{time, open, high, low, close, volume}]` (time = unix seconds). `limit` default 1500, max 5000.
`GET /api/symbols`.
CORS: any origin by default; restrict with `KLINE_CORS_ORIGINS="https://*.github.io"`.
