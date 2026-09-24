import { NextResponse } from "next/server";
import { searchSymbols } from "@/lib/market";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1 || q.length > 50) return NextResponse.json({ results: [] });
  try {
    return NextResponse.json({ results: await searchSymbols(q) });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Search unavailable" }, { status: 502 });
  }
}
