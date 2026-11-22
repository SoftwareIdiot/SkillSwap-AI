import { test } from "node:test";
import assert from "node:assert/strict";
const base = process.env.SKILLSWAP_TEST_URL || "http://127.0.0.1:3000";
test("study group routes require authentication and reject foreign writes", async () => {
  assert.equal((await fetch(base + "/api/groups")).status, 401);
  const id = "00000000-0000-4000-8000-000000000001";
  assert.equal(
    (await fetch(base + "/api/groups/community?community=" + id)).status,
    401,
  );
  assert.equal(
    (
      await fetch(base + "/api/groups", {
        method: "POST",
        headers: {
          Origin: "https://untrusted.example",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "room.join", code: "SKILL-A1B2C3D4E5" }),
      })
    ).status,
    403,
  );
});
test("profile pictures require authentication and reject foreign writes", async () => {
  const url = base + "/api/profile/avatar";
  assert.equal((await fetch(url)).status, 401);
  for (const method of ["POST", "DELETE"]) {
    assert.equal(
      (
        await fetch(url, {
          method,
          headers: { Origin: "https://another-site.example" },
        })
      ).status,
      403,
    );
    assert.equal(
      (await fetch(url, { method, headers: { Origin: new URL(base).origin } }))
        .status,
      401,
    );
  }
});
test("Study Circle posts and clips require a signed-in learner and same-origin writes", async () => {
  const feed = base + "/api/groups/feed";
  const clip = feed + "?id=00000000-0000-4000-8000-000000000201";
  assert.equal((await fetch(feed + "?kind=clip")).status, 401);
  assert.equal((await fetch(feed + "?kind=invalid")).status, 400);
  for (const [url, method] of [
    [feed, "POST"],
    [clip, "DELETE"],
  ]) {
    assert.equal(
      (
        await fetch(url, {
          method,
          headers: { Origin: "https://another-site.example" },
        })
      ).status,
      403,
    );
    assert.equal(
      (await fetch(url, { method, headers: { Origin: new URL(base).origin } }))
        .status,
      401,
    );
  }
});
test("discussion actions and the report queue require a signed-in learner", async () => {
  const discussion = base + "/api/groups/discussion";
  assert.equal((await fetch(discussion + "?view=moderation")).status, 401);
  assert.equal(
    (await fetch(discussion, { method: "POST", headers: { Origin: base } }))
      .status,
    401,
  );
  assert.equal(
    (
      await fetch(discussion, {
        method: "POST",
        headers: { Origin: "https://another-site.example" },
      })
    ).status,
    403,
  );
});
test("AI web discovery requires authentication and a same-origin request", async () => {
  const url = base + "/api/discovery";
  assert.equal(
    (await fetch(url, { method: "POST", headers: { Origin: base } })).status,
    401,
  );
  assert.equal(
    (
      await fetch(url, {
        method: "POST",
        headers: { Origin: "https://another-site.example" },
      })
    ).status,
    403,
  );
});
test("workspace entry points respond without credentials", async () => {
  for (const path of ["/", "/student", "/teacher", "/recruiter", "/auth"]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("content-type"), /text\/html/);
  }
});
test("the entrance introduces SkillSwap and auth opens the sign-in chapter", async () => {
  const home = await (await fetch(base + "/")).text();
  assert.ok(home.includes("Welcome to SkillSwap"));
  assert.ok(home.includes("Learn new skills."));
  assert.ok(home.includes("Explore SkillSwap"));
  assert.ok(home.includes('data-panel="1" hidden=""'));
  assert.ok(!home.includes("SCROLL TO EXPLORE"));
  assert.ok(home.includes('class="intro-sign-in"'));
  assert.ok(!home.includes('aria-label="Explore SkillSwap"'));
  const auth = await (await fetch(base + "/auth")).text();
  assert.ok(auth.includes("Sign in to SkillSwap"));
  assert.ok(auth.includes("Continue with Google"));
});
test("Google sign-in starts the provider flow or reports unavailable account services", async () => {
  const response = await fetch(base + "/auth/google", {
    method: "POST",
    headers: { Origin: base },
    redirect: "manual",
  });
  assert.equal(response.status, 303);
  const location = new URL(response.headers.get("location"));
  if (location.origin === new URL(base).origin) {
    assert.equal(location.pathname, "/auth");
    assert.ok(
      ["google-setup", "google-provider", "google-connection"].includes(
        location.searchParams.get("error"),
      ),
    );
  } else {
    assert.equal(location.protocol, "https:");
    assert.equal(location.pathname, "/auth/v1/authorize");
    assert.equal(location.searchParams.get("provider"), "google");
    assert.equal(
      location.searchParams.get("redirect_to"),
      base + "/auth/callback",
    );
    assert.ok(response.headers.get("set-cookie")?.includes("code-verifier"));
  }
});
test("owner setup instructions are not exposed in the web app", async () => {
  for (const path of ["/setup", "/api/auth/status"]) {
    assert.equal((await fetch(base + path)).status, 404, path);
  }
  for (const path of [
    "/auth",
    "/auth?error=google-setup",
    "/auth?error=google-provider",
    "/auth?error=google-connection",
    "/student?tab=settings",
  ]) {
    const page = await (await fetch(base + path)).text();
    assert.ok(!page.includes('href="/setup"'), path);
    assert.ok(!page.includes("setup guide"), path);
    assert.ok(!page.includes("npm run setup:auth"), path);
  }
});
test("cancelled Google consent returns to sign-in with useful feedback", async () => {
  const response = await fetch(base + "/auth/callback?error=access_denied", {
    redirect: "manual",
  });
  assert.equal(response.status, 307);
  const target = new URL(response.headers.get("location"));
  assert.equal(target.origin, new URL(base).origin);
  assert.equal(target.searchParams.get("error"), "google-cancelled");
  const page = await (await fetch(target)).text();
  assert.ok(page.includes("Google sign-in was cancelled."));
  assert.ok(page.includes("Continue with Google"));
});
test("AI configuration is honest and missing configuration fails without a fake reply", async () => {
  const status = await (await fetch(base + "/api/ai")).json();
  assert.equal(typeof status.configured, "boolean");
  assert.ok(Array.isArray(status.models));
  if (!status.configured) {
    const r = await fetch(base + "/api/ai", {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "coach", prompt: "Explain React" }),
    });
    assert.equal(r.status, 503);
    assert.ok((await r.json()).error.includes("API key"));
  }
});
test("cross-origin writes are rejected before authentication or provider requests", async () => {
  for (const path of [
    "/api/workspace",
    "/api/ai",
    "/api/groups/community",
    "/api/groups/voice",
    "/auth/signout",
    "/auth/google",
  ]) {
    const r = await fetch(base + path, {
      method: "POST",
      headers: {
        Origin: "https://another-site.example",
        "Content-Type": "application/json",
      },
      body: "{}",
      redirect: "manual",
    });
    assert.equal(r.status, 403, path);
  }
});
test("workspace input rejects unknown operations and executable evidence URLs", async () => {
  for (const payload of [
    { type: "table.delete", table: "profiles" },
    {
      type: "journey.enroll",
      divisionId: "invalid",
      curriculum: { title: "Broken curriculum", sections: [] },
      goal: "Learn a skill",
      minutes: 25,
      days: 5,
    },
    {
      type: "checkin.save",
      date: "2026-02-30",
      mood: 6,
      journal: "Invalid date and mood",
    },
    {
      type: "profile.extras",
      value: {
        headline: "Learner",
        links: [{ label: "Unsafe link", url: "javascript:alert(1)" }],
        achievements: [],
      },
    },
    {
      type: "proof.add",
      value: {
        title: "Project",
        description: "Test proof",
        category: "Technology",
        evidence_url: "javascript:alert(1)",
      },
    },
  ]) {
    const r = await fetch(base + "/api/workspace", {
      method: "POST",
      headers: { Origin: base, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    assert.equal(r.status, 400);
  }
});
test("invalid auth callbacks cannot redirect to external websites", async () => {
  const r = await fetch(
    base + "/auth/callback?next=https://another-site.example",
    { redirect: "manual" },
  );
  assert.equal(r.status, 307);
  assert.equal(new URL(r.headers.get("location")).origin, new URL(base).origin);
});
