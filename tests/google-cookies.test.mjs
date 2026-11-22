import { test } from "node:test";
import assert from "node:assert/strict";
import { authRouteClient } from "../lib/auth-route-client.ts";
test("Google PKCE and callback session cookies are attached to the returned response", async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
    previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    previousFetch = globalThis.fetch;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-public-key";
  const jar = [],
    headers = new Headers();
  const response = {
    cookies: {
      set: (name, value, options) => jar.push({ name, value, options }),
    },
    headers,
  };
  try {
    const start = authRouteClient({ cookies: { getAll: () => [] } });
    const { data, error } = await start.client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "http://127.0.0.1:3000/auth/callback",
        skipBrowserRedirect: true,
      },
    });
    assert.equal(error, null);
    const url = new URL(data.url);
    assert.equal(url.searchParams.get("provider"), "google");
    assert.equal(
      url.searchParams.get("redirect_to"),
      "http://127.0.0.1:3000/auth/callback",
    );
    assert.ok(url.searchParams.get("code_challenge"));
    assert.equal(start.respond(response), response);
    assert.ok(jar.some((c) => c.name.includes("code-verifier") && c.value));
    assert.equal(headers.get("Cache-Control"), "no-store");
    const encode = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
    const accessToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: "00000000-0000-4000-8000-000000000001", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.test-signature`;
    globalThis.fetch = async (input, init) => {
      assert.ok(
        String(input).startsWith(
          "https://example.supabase.co/auth/v1/token?grant_type=pkce",
        ),
      );
      const body = JSON.parse(init.body);
      assert.equal(body.auth_code, "test-authorization-code");
      assert.ok(body.code_verifier);
      return new Response(
        JSON.stringify({
          access_token: accessToken,
          refresh_token: "test-refresh-token",
          token_type: "bearer",
          expires_in: 3600,
          user: {
            id: "00000000-0000-4000-8000-000000000001",
            aud: "authenticated",
            role: "authenticated",
            email: "test@example.test",
            app_metadata: {},
            user_metadata: {},
            created_at: new Date().toISOString(),
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };
    const callback = authRouteClient({
      cookies: {
        getAll: () => jar.map(({ name, value }) => ({ name, value })),
      },
    });
    const exchanged = await callback.client.auth.exchangeCodeForSession(
      "test-authorization-code",
    );
    assert.equal(exchanged.error, null);
    const callbackCookies = [],
      callbackResponse = {
        cookies: {
          set: (name, value, options) =>
            callbackCookies.push({ name, value, options }),
        },
        headers: new Headers(),
      };
    callback.respond(callbackResponse);
    assert.ok(
      callbackCookies.some(
        (c) =>
          c.name.includes("auth-token") &&
          !c.name.includes("code-verifier") &&
          c.value,
      ),
      "session cookies must be on the callback redirect",
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;
  }
});
