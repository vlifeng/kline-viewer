-- Continuous aggregates, each computed directly from klines_1m (UTC-aligned buckets)
DO $$
DECLARE iv text; nm text;
BEGIN
  FOR iv, nm IN VALUES ('5 minutes','5m'),('15 minutes','15m'),('1 hour','1h'),('4 hours','4h'),('1 day','1d')
  LOOP
    IF NOT EXISTS (SELECT 1 FROM timescaledb_information.continuous_aggregates WHERE view_name = 'klines_'||nm) THEN
      EXECUTE format($f$
        CREATE MATERIALIZED VIEW klines_%s WITH (timescaledb.continuous) AS
        SELECT symbol,
               time_bucket(INTERVAL %L, ts) AS ts,
               first(open, ts)  AS open,
               max(high)        AS high,
               min(low)         AS low,
               last(close, ts)  AS close,
               sum(volume)      AS volume,
               sum(quote_volume) AS quote_volume,
               sum(trades)::bigint AS trades,
               count(*)         AS n_1m
        FROM klines_1m
        GROUP BY symbol, time_bucket(INTERVAL %L, ts)
        WITH NO DATA
      $f$, nm, iv, iv);
    END IF;
  END LOOP;
END $$;
