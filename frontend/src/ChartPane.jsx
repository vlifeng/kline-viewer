import React, { useEffect, useRef } from "react";
import { createChart, CandlestickSeries, HistogramSeries, CrosshairMode } from "lightweight-charts";

const UP = "#26a69a", DOWN = "#ef5350";

/** One candlestick chart + volume histogram. Exposes its chart via onReady(symbol, chart) and data via ref.setBars. */
const ChartPane = React.forwardRef(function ChartPane({ symbol, onReady, onRange }, ref) {
  const el = useRef(null);
  const info = useRef(null);
  const s = useRef({});

  useEffect(() => {
    const chart = createChart(el.current, {
      autoSize: true,
      layout: { background: { color: "#0d1117" }, textColor: "#c9d1d9" },
      grid: { vertLines: { color: "#1c2128" }, horzLines: { color: "#1c2128" } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#30363d" },
      timeScale: { borderColor: "#30363d", timeVisible: true, secondsVisible: false },
    });
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: UP, downColor: DOWN, borderUpColor: UP, borderDownColor: DOWN, wickUpColor: UP, wickDownColor: DOWN,
    });
    candles.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.28 } });
    const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "vol" });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
    chart.subscribeCrosshairMove(p => {
      const b = p.time ? p.seriesData.get(candles) : null;
      if (b && info.current) info.current.textContent = `O ${b.open}  H ${b.high}  L ${b.low}  C ${b.close}`;
    });
    chart.timeScale().subscribeVisibleLogicalRangeChange(r => r && onRange(symbol, r));
    s.current = { chart, candles, vol };
    onReady(symbol, chart);
    return () => chart.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useImperativeHandle(ref, () => ({
    setBars(bars) {
      s.current.candles.setData(bars.map(b => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close })));
      s.current.vol.setData(bars.map(b => ({ time: b.time, value: b.volume, color: b.close >= b.open ? "#26a69a80" : "#ef535080" })));
    },
    chart: () => s.current.chart,
  }));

  return (
    <div className="pane">
      <div className="chart" ref={el} data-symbol={symbol} />
      <div className="label">{symbol}<span ref={info} /></div>
    </div>
  );
});

export default ChartPane;
