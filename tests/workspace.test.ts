import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyLocal,
  dayKey,
  emptyWorkspace,
  matchScore,
  safeLink,
  streak,
  templatePlan,
  type Skill,
} from "../lib/workspace.ts";
import { learningContext } from "../lib/learning-context.ts";
import { avatarLimit, avatarType } from "../lib/profile-avatar.ts";
import {
  scenePose,
  objectPose,
  logoTilt,
  chapterEase,
  chapterTarget,
} from "../lib/intro-motion.ts";

test("profile picture validation reads the file signature instead of trusting its label", async () => {
  assert.equal(
    await avatarType(
      new Blob(["GIF89a"], { type: "application/octet-stream" }),
    ),
    "image/gif",
  );
  assert.equal(
    await avatarType(
      new Blob([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])]),
    ),
    "image/png",
  );
  assert.equal(
    await avatarType(new Blob([Uint8Array.from([255, 216, 255])])),
    "image/jpeg",
  );
  assert.equal(await avatarType(new Blob(["RIFF0000WEBP"])), "image/webp");
  assert.equal(
    await avatarType(new Blob(["<svg/>"], { type: "image/gif" })),
    null,
  );
});

test("GIFs have a larger avatar limit than photos", () => {
  assert.equal(avatarLimit("image/gif"), 12 * 1024 * 1024);
  for (const type of ["image/jpeg", "image/png", "image/webp"])
    assert.equal(avatarLimit(type), 3 * 1024 * 1024);
});

test("chapter scrolling eases without overshooting and advances one reading stop", () => {
  let previous = 0;
  for (let i = 0; i <= 1000; i++) {
    const value = chapterEase(i / 1000);
    assert.ok(value >= previous && value <= 1);
    previous = value;
  }
  assert.equal(chapterEase(-1), 0);
  assert.equal(chapterEase(2), 1);
  assert.ok(chapterEase(0.1) < 0.01);
  assert.ok(chapterEase(0.9) > 0.99);
  assert.equal(chapterTarget(0, -120), 0);
  assert.equal(chapterTarget(0, 12000), 1);
  assert.equal(chapterTarget(1, 12000), 2);
  assert.equal(chapterTarget(3, 120), 3);
  assert.equal(chapterTarget(2, -120), 1);
});

test("intro transitions keep the camera outside the object space", () => {
  for (let i = 0; i <= 300; i++) {
    const p = scenePose(i / 100);
    assert.ok(p.cameraZ > 8, "camera must not cross the logo or skill tiles");
    for (let chapter = 0; chapter < 4; chapter++) {
      const o = objectPose(chapter, p.progress);
      assert.ok(o.opacity >= 0 && o.opacity <= 1);
      if (o.visible) assert.ok(o.scale > 0.8);
    }
  }
  assert.equal(scenePose(Number.NaN).progress, 0);
});
test("the brand mark only tilts gently and cannot spin edge-on", () => {
  for (let seconds = 0; seconds < 600; seconds++) {
    assert.ok(Math.abs(logoTilt(seconds)) < 0.4);
    assert.ok(Math.abs(logoTilt(seconds + 0.016) - logoTilt(seconds)) < 0.002);
  }
});

test("new workspaces contain no invented activity, people or proofs", () => {
  const d = emptyWorkspace();
  assert.equal(d.proofs.length, 0);
  assert.equal(d.people.length, 0);
  assert.equal(d.personal.activity.length, 0);
  assert.equal(streak(d.personal.activity), 0);
});
test("tasks persist completion and create real activity without changing the previous state", () => {
  const before = applyLocal(emptyWorkspace(), {
    type: "task.add",
    title: "Practice React",
  });
  const after = applyLocal(before, {
    type: "task.toggle",
    id: before.tasks[0].id,
  });
  assert.equal(before.tasks[0].done, false);
  assert.equal(after.tasks[0].done, true);
  assert.equal(after.personal.activity.length, 1);
  assert.equal(streak(after.personal.activity), 1);
  const reopened = applyLocal(after, {
    type: "task.toggle",
    id: after.tasks[0].id,
  });
  assert.equal(reopened.tasks[0].done, false);
  assert.equal(reopened.personal.activity.length, 1);
});
test("streak counts calendar days, tolerates an unfinished today, and stops at gaps", () => {
  const now = new Date(2026, 10, 6, 0, 5);
  const activity = (days: number[]) =>
    days.map((day) => ({
      id: String(day),
      label: "Study",
      date: new Date(2026, 10, day, 22).toISOString(),
    }));
  assert.equal(streak(activity([5, 4, 3, 1]), now), 3);
  assert.equal(streak(activity([6, 5, 4, 2]), now), 3);
  assert.equal(streak(activity([4, 3]), now), 0);
  assert.equal(dayKey(now), "2026-11-06");
});
test("proofs reject executable links and accept submitted evidence honestly", () => {
  assert.equal(safeLink("javascript:alert(1)"), null);
  assert.equal(safeLink("data:text/html,x"), null);
  assert.throws(() =>
    applyLocal(emptyWorkspace(), {
      type: "proof.add",
      value: {
        title: "Project",
        description: "A real project",
        category: "Technology",
        evidence_url: "javascript:alert(1)",
      },
    }),
  );
  const d = applyLocal(emptyWorkspace(), {
    type: "proof.add",
    value: {
      title: "Project",
      description: "A real project",
      category: "Technology",
      evidence_url: "https://example.com/project",
    },
  });
  assert.equal(d.proofs.length, 1);
  assert.equal(d.personal.activity.length, 1);
  assert.equal("verified" in d.proofs[0], false);
});
test("classroom creation joins the host and messages require membership", () => {
  const d = applyLocal(emptyWorkspace(), {
    type: "room.create",
    value: {
      name: "Study room",
      topic: "React",
      description: "Learning together",
      visibility: "private",
    },
  });
  assert.match(d.rooms[0].code, /^SKILL-[A-F0-9]{10}$/);
  assert.equal(d.rooms[0].joined, true);
  const posted = applyLocal(d, {
    type: "room.message",
    roomId: d.rooms[0].id,
    body: "Hello",
  });
  assert.equal(posted.messages[0].body, "Hello");
  assert.throws(() =>
    applyLocal(d, { type: "room.message", roomId: "unknown", body: "Hello" }),
  );
  assert.throws(
    () => applyLocal(d, { type: "room.join", code: "SKILL-0000000000" }),
    /not found/,
  );
});
test("offline plans are clearly sourced and checkpoints count as progress", () => {
  const plan = templatePlan("Learn Python", 20);
  assert.equal(plan.source, "template");
  assert.ok(plan.steps[0].description.includes("20 minutes"));
  const d = applyLocal(emptyWorkspace(), { type: "plan.add", value: plan });
  const finished = applyLocal(d, {
    type: "plan.toggle",
    id: plan.id,
    index: 0,
  });
  assert.equal(finished.personal.plans[0].steps[0].done, true);
  assert.equal(finished.personal.activity.length, 1);
  assert.throws(
    () => applyLocal(d, { type: "plan.toggle", id: plan.id, index: 13 }),
    /no longer exists/,
  );
});
test("personalization is explicit and preserves private study data", () => {
  const d = applyLocal(emptyWorkspace(), {
    type: "preferences",
    value: {
      goal: "Learn React",
      interests: "Music",
      level: "beginner",
      style: "Step by step",
      minutes: 20,
      memory: "Give hints first",
      shareContext: false,
      weeklyGoal: 4,
    },
  });
  assert.equal(d.personal.shareContext, false);
  assert.equal(d.personal.memory, "Give hints first");
  assert.equal(d.personal.activity.length, 0);
  assert.throws(() =>
    applyLocal(d, {
      type: "preferences",
      value: { ...d.personal, minutes: 0 },
    }),
  );
});
test("matching distinguishes requested skills from reciprocal learning", () => {
  let d = emptyWorkspace();
  d = applyLocal(d, {
    type: "skill.add",
    value: { name: "Python", kind: "learn", level: "beginner" },
  });
  d = applyLocal(d, {
    type: "skill.add",
    value: { name: "Figma", kind: "teach", level: "advanced" },
  });
  const peer: Skill = {
    id: "peer-skill",
    student_id: "peer",
    name: "python",
    kind: "teach",
    level: "advanced",
    created_at: new Date().toISOString(),
  };
  assert.equal(matchScore(peer, d), 2);
  d.skills.push({ ...peer, id: "peer-want", name: "figma", kind: "learn" });
  assert.equal(matchScore(peer, d), 3);
});
test("a local workspace cannot send fake community requests", () => {
  assert.throws(
    () =>
      applyLocal(emptyWorkspace(), {
        type: "exchange.request",
        value: {
          receiver_id: "peer",
          skill_name: "Python",
          offering: "Figma",
          message: "Let us learn",
        },
      }),
    /Sign in/,
  );
});
test("finished focus sessions count minutes and activity, invalid durations do not", () => {
  const d = applyLocal(emptyWorkspace(), {
    type: "focus.complete",
    minutes: 25,
    label: "Learn React",
  });
  assert.equal(d.personal.focus[0].minutes, 25);
  assert.equal(d.personal.activity.length, 1);
  assert.throws(() =>
    applyLocal(d, { type: "focus.complete", minutes: 0, label: "Invalid" }),
  );
});
test("AI personalization excludes identity, peer data and disabled memory", () => {
  const d = emptyWorkspace();
  d.profile.full_name = "Private name";
  d.personal.memory = "Use music examples";
  d.personal.goal = "Learn React";
  d.messages.push({
    id: "message",
    classroom_id: "room",
    sender_id: "peer",
    body: "Private classroom content",
    created_at: new Date().toISOString(),
  });
  const context = JSON.stringify(learningContext(d));
  assert.ok(context.includes("Use music examples"));
  assert.ok(!context.includes("Private name"));
  assert.ok(!context.includes("Private classroom content"));
  d.personal.shareContext = false;
  assert.deepEqual(learningContext(d), { shareContext: false });
});
