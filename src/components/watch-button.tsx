"use client";

import { useOptimistic, useTransition } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleWatchlist } from "@/app/actions";

export function WatchButton({ ticker, name, watching }: { ticker: string; name: string; watching: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(watching);
  const [pending, start] = useTransition();

  return (
    <Button
      variant={optimistic ? "secondary" : "outline"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          setOptimistic(!optimistic);
          await toggleWatchlist(ticker, name, optimistic);
        })
      }
    >
      <Star className={optimistic ? "fill-primary text-primary" : ""} />
      {optimistic ? "Watching" : "Add to watchlist"}
    </Button>
  );
}
