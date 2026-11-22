import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase";
import { authRouteClient } from "@/lib/auth-route-client";
import { requestOrigin } from "@/lib/request-origin";
export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.has("error"))
    return NextResponse.redirect(
      new URL(
        request.nextUrl.searchParams.get("error") === "access_denied"
          ? "/auth?error=google-cancelled"
          : "/auth?error=google",
        requestOrigin(request),
      ),
    );
  const code = request.nextUrl.searchParams.get("code");
  const next =
    request.nextUrl.searchParams.get("next") === "/auth/update-password"
      ? "/auth/update-password"
      : "/student";
  if (code && isSupabaseConfigured()) {
    try {
      const { client, respond } = authRouteClient(request);
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (!error)
        return respond(
          NextResponse.redirect(new URL(next, requestOrigin(request))),
        );
    } catch {
      /* Return a retryable sign-in state without exposing provider details. */
    }
  }
  return NextResponse.redirect(
    new URL("/auth?error=verification", requestOrigin(request)),
  );
}
