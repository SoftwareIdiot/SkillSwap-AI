import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
// PKCE verifier/session cookies must travel on the exact response being returned.
export function authRouteClient(request: NextRequest) {
  const writes: { name: string; value: string; options: CookieOptions }[] = [];
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (
          items: { name: string; value: string; options: CookieOptions }[],
        ) => {
          writes.push(...items);
        },
      },
    },
  );
  return {
    client,
    respond: (response: NextResponse) => {
      for (const item of writes)
        response.cookies.set(item.name, item.value, item.options);
      response.headers.set("Cache-Control", "no-store");
      return response;
    },
  };
}
