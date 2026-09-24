// Safe to import from client and server code.
export const TICKER_RE = /^[A-Z0-9.\-^=]{1,15}$/;

export function formatPrice(n: number | null | undefined, currency = "USD") {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

export function formatPct(n: number | null | undefined) {
  if (n == null) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}
