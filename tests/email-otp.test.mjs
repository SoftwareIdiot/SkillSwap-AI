import { test } from "node:test";
import assert from "node:assert/strict";
import { authRouteClient } from "../lib/auth-route-client.ts";
test("email signup stays unverified until OTP succeeds and writes the session cookie", async () => {
  const old = {
    fetch: globalThis.fetch,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-public-key";
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    email: "learner@example.test",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const encode = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.test`;
  try {
    globalThis.fetch = async (input, init) => {
      const url = String(input),
        body = JSON.parse(init.body);
      if (url.includes("/signup")) {
        assert.equal(body.email, user.email);
        assert.equal(body.password, "test-password-42");
        return Response.json(user);
      }
      assert.ok(url.endsWith("/verify"));
      assert.equal(body.type, "email");
      assert.equal(body.token, "123456");
      return Response.json({
        access_token: token,
        refresh_token: "test-refresh-token",
        expires_in: 3600,
        token_type: "bearer",
        user,
      });
    };
    const writes = [];
    const { client, respond } = authRouteClient({
      cookies: { getAll: () => [] },
    });
    const signup = await client.auth.signUp({
      email: user.email,
      password: "test-password-42",
    });
    assert.equal(signup.error, null);
    assert.equal(signup.data.session, null);
    const verified = await client.auth.verifyOtp({
      email: user.email,
      token: "123456",
      type: "email",
    });
    assert.equal(verified.error, null);
    assert.ok(verified.data.session);
    respond({
      headers: new Headers(),
      cookies: { set: (name, value) => writes.push({ name, value }) },
    });
    assert.ok(writes.some((c) => c.name.includes("auth-token") && c.value));
  } finally {
    globalThis.fetch = old.fetch;
    for (const [key, value] of Object.entries({
      NEXT_PUBLIC_SUPABASE_URL: old.url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: old.key,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
