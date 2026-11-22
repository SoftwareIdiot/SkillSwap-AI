import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyLocal,
  emptyWorkspace,
  normalizePersonal,
  operationSchema,
} from "../lib/workspace.ts";
import { learningContext } from "../lib/learning-context.ts";
import { suggestedStarters, tourSteps, supportLinks } from "../lib/welcome.ts";
import { googleProviderState } from "../lib/google-provider.ts";
const answers = {
  displayName: "Private display sentinel",
  studying: "Computer science",
  age: 23,
  gender: "Private gender sentinel",
  style: "Step by step" as const,
  minutes: 15,
};
test("new learners get a resumable welcome setup; established workspaces are preserved", () => {
  const fresh = emptyWorkspace();
  assert.equal(fresh.personal.onboarding.status, "pending");
  const saved = applyLocal(fresh, {
    type: "welcome.answers",
    value: answers,
    step: 1,
  });
  const restored = normalizePersonal(
    JSON.parse(JSON.stringify(saved.personal)),
  );
  assert.equal(restored.onboarding.step, 1);
  assert.equal(restored.onboarding.answers?.displayName, answers.displayName);
  const legacy = normalizePersonal({ goal: "An existing learning goal" });
  assert.equal(legacy.onboarding.status, "completed");
  assert.equal(legacy.tour.status, "skipped");
  assert.equal(legacy.goal, "An existing learning goal");
});
test("welcome enrollment saves preferences and a real independent starter curriculum atomically", () => {
  const op = {
    type: "welcome.finish",
    value: answers,
    divisionId: "starter-web",
    goal: "Build an accessible personal website",
    days: 4,
  };
  const next = applyLocal(emptyWorkspace(), op);
  assert.equal(next.personal.onboarding.status, "completed");
  assert.equal(next.personal.journeys.length, 1);
  assert.equal(next.personal.journeys[0].sections.length, 3);
  assert.equal(next.personal.journeys[0].completed.length, 0);
  assert.equal(next.personal.style, answers.style);
  assert.equal(next.personal.minutes, 15);
  assert.equal(next.personal.weeklyGoal, 4);
  assert.equal(next.personal.tour.status, "active");
  assert.equal(next.profile.full_name, "");
  assert.equal(
    applyLocal(next, op).personal.journeys.length,
    1,
    "revisiting personalization never duplicates an enrollment",
  );
  const before = emptyWorkspace();
  assert.throws(
    () => applyLocal(before, { ...op, divisionId: "unknown" }),
    /starter skill/,
  );
  assert.equal(before.personal.journeys.length, 0);
});
test("age and gender are optional, validated, and excluded from AI context", () => {
  operationSchema.parse({
    type: "welcome.answers",
    value: { ...answers, age: null, gender: "" },
    step: 1,
  });
  assert.throws(() =>
    operationSchema.parse({
      type: "welcome.answers",
      value: { ...answers, age: 1000 },
      step: 1,
    }),
  );
  const next = applyLocal(emptyWorkspace(), {
    type: "welcome.finish",
    value: answers,
    divisionId: "starter-web",
    goal: "Build a small web project",
    days: 5,
  });
  const context = JSON.stringify(learningContext(next));
  assert.ok(context.includes("Computer science"));
  assert.ok(context.includes("Step by step"));
  assert.ok(!context.includes("Private display sentinel"));
  assert.ok(!context.includes("Private gender sentinel"));
  assert.ok(!context.includes('"age"'));
});
test("recommendations always retain six real starter choices and depend only on study interests", () => {
  const results = suggestedStarters("Interface design and art");
  assert.equal(results.length, 6);
  assert.equal(results[0].skill.id, "starter-design");
  assert.equal(new Set(results.map((r) => r.skill.id)).size, 6);
  assert.equal(suggestedStarters("").length, 6);
});
test("tour progress, completion, skip, and replay persist with bounded dashboard stops", () => {
  let data = applyLocal(emptyWorkspace(), { type: "welcome.skip" });
  assert.equal(data.personal.onboarding.status, "skipped");
  assert.equal(data.personal.tour.status, "active");
  assert.equal(data.personal.journeys.length, 0);
  data = applyLocal(data, { type: "tour.progress", status: "active", step: 3 });
  assert.equal(
    normalizePersonal(JSON.parse(JSON.stringify(data.personal))).tour.step,
    3,
  );
  data = applyLocal(data, {
    type: "tour.progress",
    status: "skipped",
    step: 3,
  });
  assert.equal(data.personal.tour.status, "skipped");
  data = applyLocal(data, { type: "tour.progress", status: "active", step: 0 });
  assert.equal(data.personal.tour.step, 0);
  data = applyLocal(data, {
    type: "tour.progress",
    status: "completed",
    step: tourSteps.length - 1,
  });
  assert.equal(data.personal.tour.status, "completed");
  assert.throws(() =>
    applyLocal(data, { type: "tour.progress", status: "active", step: 99 }),
  );
  assert.equal(tourSteps.length, 7);
});
test("support links target the supplied email and WhatsApp number without auto-sending private data", () => {
  assert.ok(supportLinks.email.startsWith("mailto:softwareguy26@gmail.com?"));
  const wa = new URL(supportLinks.whatsapp);
  assert.equal(wa.hostname, "wa.me");
  assert.equal(wa.pathname, "/917679027976");
  assert.equal(wa.searchParams.get("text"), "Hi, I need help with SkillSwap.");
  assert.ok(!supportLinks.whatsapp.includes("journal"));
});
test("Google readiness distinguishes missing connection, disabled provider, readiness, and failures", async () => {
  let calls = 0;
  const config = { url: "https://example.supabase.co", key: "test-public-key" };
  const settings = (google: boolean) =>
    (async (_url: unknown, init?: RequestInit) => {
      calls++;
      assert.equal(
        (init?.headers as Record<string, string>).apikey,
        config.key,
      );
      return new Response(JSON.stringify({ external: { google } }), {
        status: 200,
      });
    }) as typeof fetch;
  assert.equal(await googleProviderState({}, settings(true)), "missing");
  assert.equal(calls, 0);
  assert.equal(await googleProviderState(config, settings(false)), "disabled");
  assert.equal(await googleProviderState(config, settings(true)), "ready");
  assert.equal(
    await googleProviderState(
      config,
      (async () => new Response("no", { status: 401 })) as typeof fetch,
    ),
    "unreachable",
  );
  assert.equal(
    await googleProviderState(config, (async () => {
      throw new Error("offline");
    }) as typeof fetch),
    "unreachable",
  );
});
