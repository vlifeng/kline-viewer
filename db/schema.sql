CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS klines_1m (
  symbol       text             NOT NULL,
  ts           timestamptz      NOT NULL,
  open         double precision NOT NULL,
  high         double precision NOT NULL,
  low          double precision NOT NULL,
  close        double precision NOT NULL,
  volume       double precision NOT NULL,
  quote_volume double precision NOT NULL,
  trades       integer          NOT NULL,
  PRIMARY KEY (symbol, ts)
);
SELECT create_hypertable('klines_1m', 'ts', chunk_time_interval => INTERVAL '7 days', if_not_exists => TRUE);
