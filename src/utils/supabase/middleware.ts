import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfigured } from "@/lib/supabase-config";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Supabase not connected yet (env vars missing): show the setup page instead of
  // letting every page that queries the database crash.
  if (!supabaseConfigured) {
    const { pathname } = request.nextUrl;
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Database not connected" }, { status: 503 });
    }
    if (pathname !== "/setup") {
      return NextResponse.rewrite(new URL("/setup", request.url));
    }
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refreshes the auth token. Do not remove.
  await supabase.auth.getUser();

  return response;
}
