"""Kline viewer API (FastAPI). K-lines only: reads klines_1m and the continuous aggregates."""
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from psycopg_pool import ConnectionPool

DSN = os.environ.get("KLINE_DSN", "host=127.0.0.1 port=5433 user=kline dbname=klines")
TABLES = {"1m": "klines_1m", "5m": "klines_5m", "15m": "klines_15m",
          "1h": "klines_1h", "4h": "klines_4h", "1d": "klines_1d"}
DEFAULT_LIMIT, MAX_LIMIT = 1500, 5000

pool = ConnectionPool(DSN, min_size=1, max_size=8, kwargs={"options": "-c timezone=UTC"}, open=True)
app = FastAPI(title="Kline Viewer API")
# CORS: default allows any origin. To restrict, set KLINE_CORS_ORIGINS="https://foo.github.io,https://bar.example"
# (comma separated; entries may use a * wildcard, e.g. "https://*.github.io").
_origins = [o.strip() for o in os.environ.get("KLINE_CORS_ORIGINS", "*").split(",") if o.strip()]
if _origins == ["*"]:
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
else:
    import re
    rx = "|".join(re.escape(o).replace(r"\*", "[^/]+") for o in _origins)
    app.add_middleware(CORSMiddleware, allow_origin_regex=rf"^(?:{rx})$", allow_methods=["*"], allow_headers=["*"])


def parse_time(v: Optional[str], name: str) -> Optional[float]:
    """Accept unix seconds (or ms/us, auto-detected) or an ISO-8601 string; returns unix seconds."""
    if v is None or v == "":
        return None
    try:
        x = float(v)
        if x > 1e14: x /= 1e6      # microseconds
        elif x > 1e11: x /= 1e3    # milliseconds
        return x
    except ValueError:
        pass
    try:
        d = datetime.fromisoformat(v.replace("Z", "+00:00"))
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return d.timestamp()
    except ValueError:
        raise HTTPException(400, f"invalid {name}: {v!r}")


@app.get("/api/symbols")
def symbols():
    with pool.connection() as c:
        rows = c.execute("SELECT symbol, min(ts), max(ts), count(*) FROM klines_1m GROUP BY symbol ORDER BY symbol").fetchall()
    return [{"symbol": s, "first": int(a.timestamp()), "last": int(b.timestamp()), "bars_1m": n} for s, a, b, n in rows]


@app.get("/api/klines")
def klines(symbol: str = Query(...), interval: str = Query("1m"),
           from_: Optional[str] = Query(None, alias="from"), to: Optional[str] = None,
           limit: int = Query(DEFAULT_LIMIT, ge=1)):
    """Ascending bars. If `from` is given: the first `limit` bars with time >= from (and <= to if given).
    Otherwise: the latest `limit` bars with time <= to (or the newest bars overall)."""
    table = TABLES.get(interval)
    if not table:
        raise HTTPException(400, f"interval must be one of {list(TABLES)}")
    symbol = symbol.upper()
    limit = min(limit, MAX_LIMIT)
    f, t = parse_time(from_, "from"), parse_time(to, "to")
    where, params = ["symbol = %s"], [symbol]
    if f is not None: where.append("ts >= to_timestamp(%s)"); params.append(f)
    if t is not None: where.append("ts <= to_timestamp(%s)"); params.append(t)
    order = "ASC" if f is not None else "DESC"
    sql = (f"SELECT extract(epoch FROM ts)::bigint, open, high, low, close, volume FROM {table} "
           f"WHERE {' AND '.join(where)} ORDER BY ts {order} LIMIT %s")
    with pool.connection() as c:
        rows = c.execute(sql, params + [limit]).fetchall()
    if order == "DESC":
        rows.reverse()
    return [{"time": r[0], "open": r[1], "high": r[2], "low": r[3], "close": r[4], "volume": r[5]} for r in rows]


@app.get("/api/health")
def health():
    with pool.connection() as c:
        c.execute("SELECT 1")
    return {"ok": True}
