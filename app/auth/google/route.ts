import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { googleProviderState } from "@/lib/google-provider";
import { authRouteClient } from "@/lib/auth-route-client";
import { isSameOrigin, requestOrigin } from "@/lib/request-origin";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request))
    return NextResponse.json(
      { error: "Invalid request origin." },
      { status: 403 },
    );
  const origin = requestOrigin(request);
  const failed = (reason: string) =>
    NextResponse.redirect(new URL(`/auth?error=${reason}`, origin), 303);
  if (!isSupabaseConfigured()) return failed("google-setup");
  try {
    const state = await googleProviderState({
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });
    if (state === "disabled") return failed("google-provider");
    if (state !== "ready") return failed("google-connection");
    const { client, respond } = authRouteClient(request);
    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
        skipBrowserRedirect: true,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error || !data.url) return failed("google");
    return respond(NextResponse.redirect(data.url, 303));
  } catch {
    return failed("google");
  }
}
