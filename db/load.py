#!/usr/bin/env python3
"""Load merged 1m kline CSV.gz files (microsecond timestamps) into klines_1m."""
import gzip, sys, psycopg, os
DSN = os.environ.get("KLINE_DSN", "host=127.0.0.1 port=5433 user=kline dbname=klines")
FILES = {
  "UNIUSDT": "/workspace/uniusdt/klines_1m_merged.csv.gz",
  "BTCUSDT": "/workspace/btcusdt/btcusdt_klines_1m_merged.csv.gz",
  "ETHUSDT": "/workspace/ethusdt/ethusdt_klines_1m_merged.csv.gz",
}
with psycopg.connect(DSN) as conn, conn.cursor() as cur:
    cur.execute("CREATE TEMP TABLE stg (open_time bigint, open float8, high float8, low float8, close float8, volume float8, close_time bigint, quote_volume float8, trades int, tb float8, tq float8, ign text)")
    for sym, path in FILES.items():
        cur.execute("TRUNCATE stg")
        with gzip.open(path, "rt") as f:
            next(f)  # header
            with cur.copy("COPY stg FROM STDIN WITH (FORMAT csv)") as cp:
                for line in f:
                    cp.write(line)
        cur.execute("""INSERT INTO klines_1m(symbol,ts,open,high,low,close,volume,quote_volume,trades)
            SELECT %s, to_timestamp(open_time/1e6), open,high,low,close,volume,quote_volume,trades FROM stg
            ON CONFLICT (symbol,ts) DO NOTHING""", (sym,))
        print(sym, "inserted", cur.rowcount)
    conn.commit()
