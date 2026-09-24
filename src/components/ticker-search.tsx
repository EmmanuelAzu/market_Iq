"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Result {
  ticker: string;
  name: string;
}

export function TickerSearch({ autoFocus = false }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const json = await res.json();
        setResults(json.results ?? []);
      } catch {
        // aborted or offline
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function go(ticker: string) {
    setOpen(false);
    setQuery("");
    router.push(`/stocks/${encodeURIComponent(ticker)}`);
  }

  return (
    <form
      className="relative"
      onSubmit={(e) => {
        e.preventDefault();
        const t = results[0]?.ticker ?? query.trim().toUpperCase();
        if (t) go(t);
      }}
    >
      <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
      <Input
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search ticker or company"
        className="pl-8"
        aria-label="Search stocks"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-border bg-background shadow-lg">
          {results.map((r) => (
            <li key={r.ticker}>
              <button
                type="button"
                onClick={() => go(r.ticker)}
                className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="font-mono font-semibold">{r.ticker}</span>
                <span className="truncate text-muted-foreground">{r.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
