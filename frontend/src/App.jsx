import React, { useCallback, useEffect, useRef, useState } from "react";
import ChartPane from "./ChartPane.jsx";
import { API_BASE, fetchKlines } from "./api.js";

const SYMBOLS = ["UNIUSDT", "BTCUSDT", "ETHUSDT"];
const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"];
const FIRST = 1500, PAGE = 5000;

export default function App() {
  const [interval, setIv] = useState(() => localStorage.getItem("interval") || "1h");
  const [counts, setCounts] = useState({});
  const [msg, setMsg] = useState("loading…");
  const [exhausted, setExhausted] = useState(false);

  const panes = useRef({});            // symbol -> ChartPane handle
  const charts = useRef({});           // symbol -> IChartApi
  const bars = useRef({});             // symbol -> bars[]
  const syncing = useRef(false);
  const loadingOlder = useRef(false);
  const done = useRef(false);
  const token = useRef(0);

  const onReady = useCallback((sym, chart) => { charts.current[sym] = chart; }, []);

  const setAll = (fn) => { syncing.current = true; try { fn(); } finally { syncing.current = false; } };

  const loadOlder = useCallback(async () => {
    loadingOlder.current = true;
    const my = token.current;
    try {
      const first = bars.current[SYMBOLS[0]][0].time;
      const older = await Promise.all(SYMBOLS.map(s => fetchKlines(s, intervalRef.current, { to: first - 1, limit: PAGE })));
      if (my !== token.current) return;
      const added = older[0].length;
      if (added < PAGE) { done.current = true; setExhausted(true); }
      if (added) {
        const range = charts.current[SYMBOLS[0]].timeScale().getVisibleLogicalRange();
        setAll(() => {
          SYMBOLS.forEach((s, i) => { bars.current[s] = older[i].concat(bars.current[s]); panes.current[s].setBars(bars.current[s]); });
          if (range) SYMBOLS.forEach(s => charts.current[s].timeScale().setVisibleLogicalRange({ from: range.from + added, to: range.to + added }));
        });
        setCounts(Object.fromEntries(SYMBOLS.map(s => [s, bars.current[s].length])));
      }
    } catch (e) { setMsg("error: " + e.message); }
    finally { loadingOlder.current = false; }
  }, []);

  // Logical-range sync between charts (all symbols share the same time grid, so indices line up)
  const onRange = useCallback((src, range) => {
    if (syncing.current) return;
    setAll(() => SYMBOLS.forEach(s => { if (s !== src) charts.current[s]?.timeScale().setVisibleLogicalRange(range); }));
    if (range.from < 50 && !loadingOlder.current && !done.current && bars.current[src]?.length) loadOlder();
  }, [loadOlder]);

  const intervalRef = useRef(interval);
  intervalRef.current = interval;

  useEffect(() => {
    const my = ++token.current;
    done.current = false; setExhausted(false); setMsg("loading…");
    (async () => {
      try {
        const all = await Promise.all(SYMBOLS.map(s => fetchKlines(s, interval, { limit: FIRST })));
        if (my !== token.current) return;
        setAll(() => {
          SYMBOLS.forEach((s, i) => { bars.current[s] = all[i]; panes.current[s].setBars(all[i]); });
          const n = Math.min(all[0].length, interval === "1d" ? 91 : 200);
          SYMBOLS.forEach(s => charts.current[s].timeScale().setVisibleLogicalRange({ from: all[0].length - n - 0.5, to: all[0].length + 5 }));
        });
        if (all[0].length < FIRST) { done.current = true; setExhausted(true); }
        setCounts(Object.fromEntries(SYMBOLS.map((s, i) => [s, all[i].length])));
        setMsg("");
      } catch (e) { setMsg("error: " + e.message + ` (API: ${API_BASE})`); }
    })();
  }, [interval]);

  return (
    <>
      <header>
        <h1>Binance Spot K-lines</h1>
        <div className="btns">
          {INTERVALS.map(iv => (
            <button key={iv} className={iv === interval ? "active" : ""} onClick={() => { localStorage.setItem("interval", iv); setIv(iv); }}>{iv}</button>
          ))}
        </div>
        <div id="status">
          {msg || `${interval} · ` + SYMBOLS.map(s => `${s}: ${counts[s] ?? 0} bars`).join(" · ") + (exhausted ? " · (start of data)" : "")}
        </div>
      </header>
      <main>
        {SYMBOLS.map(s => (
          <ChartPane key={s} symbol={s} ref={h => { panes.current[s] = h; }} onReady={onReady} onRange={onRange} />
        ))}
      </main>
    </>
  );
}
