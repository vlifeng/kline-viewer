export const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:8000").replace(/\/+$/, "");

export async function fetchKlines(symbol, interval, params = {}) {
  const q = new URLSearchParams({ symbol, interval, ...params });
  const r = await fetch(`${API_BASE}/api/klines?${q}`);
  if (!r.ok) throw new Error(`${symbol}: HTTP ${r.status}`);
  return r.json();
}
