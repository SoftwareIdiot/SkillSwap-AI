import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyLocal,
  emptyWorkspace,
  normalizePersonal,
  dayKey,
} from "../lib/workspace.ts";
import { starterDivisions, blankCurriculum } from "../lib/skill-catalog.ts";
import { curriculumSchema, modulesOf } from "../lib/skill-paths.ts";
import { learningContext } from "../lib/learning-context.ts";
import { habitRun } from "../lib/planner.ts";

test("checkpoint retry records a new example and keeps the original miss", () => {
  const python = starterDivisions.find((division) => division.id === "starter-python")!;
  let data = applyLocal(emptyWorkspace(), {
    type: "journey.enroll", divisionId: python.id, curriculum: python,
    goal: "Practice beginner Python", minutes: 20, days: 4,
  });
  const journey = data.personal.journeys[0];
  const first = {
    type: "checkpoint.answer", id: crypto.randomUUID(), journeyId: journey.id,
    moduleId: "python-s0-m0", question: 0, choice: 2, reasoning: "Both values contain digits.",
  };
  assert.throws(() => applyLocal(data, { ...first, moduleId: "python-s0-m1" }), /available checkpoint/);
  data = applyLocal(data, first);
  data = applyLocal(data, first);
  assert.equal(data.personal.checkpointAttempts.length, 1);
  assert.equal(data.personal.checkpointAttempts[0].correct, false);
  const context = learningContext(data);
  assert.equal(context.shareContext, true);
  assert.deepEqual(context.recentChecks, [{ concept: "Text and numeric values", result: "needs practice" }]);
  assert.ok(!JSON.stringify(context).includes(first.reasoning));
  assert.throws(() => applyLocal(data, { ...first, id: crypto.randomUUID() }), /already answered/);
  data = applyLocal(data, { ...first, id: crypto.randomUUID(), question: 1, choice: 0, reasoning: "Convert both values first." });
  assert.deepEqual(data.personal.checkpointAttempts.map((attempt) => attempt.correct), [false, true]);
  assert.equal(data.personal.journeys[0].completed.length, 0);
  data = applyLocal(data, { type: "task.add", title: "Practice numeric values", minutes: 5, checkpoint: { journeyId: journey.id, moduleId: first.moduleId } });
  assert.equal(data.personal.taskCheckpoints[data.tasks[0].id].moduleId, first.moduleId);
  data = applyLocal(data, { type: "task.delete", id: data.tasks[0].id });
  assert.deepEqual(data.personal.taskCheckpoints, {});
});

test("task budgets and both habit intentions survive workspace operations", () => {
  let d = applyLocal(emptyWorkspace(), {
    type: "task.add",
    title: "Practice loops",
    minutes: 40,
  });
  const task = d.tasks[0];
  assert.equal(d.personal.taskMinutes[task.id], 40);
  d = applyLocal(d, { type: "task.budget", id: task.id, minutes: 15 });
  assert.equal(d.personal.taskMinutes[task.id], 15);
  d = applyLocal(d, {
    type: "habit.add",
    title: "Avoid late scrolling",
    kind: "quit",
    days: [0, 1, 2, 3, 4, 5, 6],
  });
  assert.equal(d.personal.habits[0].kind, "quit");
  assert.equal(normalizePersonal(d.personal).taskMinutes[task.id], 15);
});
test("individual habit streaks allow today's pending check-in and reset after missed days", () => {
  const today = new Date(2026, 10, 8, 12);
  const h = {
    days: [0, 1, 2, 3, 4, 5, 6],
    completed: ["2026-11-06", "2026-11-07"],
  };
  assert.equal(habitRun(h, today), 2);
  assert.equal(
    habitRun({ ...h, completed: [...h.completed, "2026-11-08"] }, today),
    3,
  );
  assert.equal(habitRun({ ...h, completed: ["2026-11-06"] }, today), 0);
  assert.equal(
    habitRun({ days: [1, 2, 3, 4, 5], completed: ["2026-11-06"] }, today),
    1,
  );
});
const enroll = () =>
  applyLocal(emptyWorkspace(), {
    type: "journey.enroll",
    divisionId: starterDivisions[0].id,
    curriculum: starterDivisions[0],
    goal: "Build my own accessible portfolio",
    minutes: 25,
    days: 5,
  });
test("starter catalog has distinct, valid, guided curricula", () => {
  assert.equal(starterDivisions.length, 6);
  assert.equal(new Set(starterDivisions.map((d) => d.title)).size, 6);
  for (const d of starterDivisions) {
    curriculumSchema.parse(d);
    assert.equal(d.sections.length, 3);
    assert.equal(modulesOf(d).length, 9);
    assert.ok(
      modulesOf(d).every(
        (m) =>
          m.lesson.length > 90 && m.exercise.length > 25 && m.check.length > 25,
      ),
    );
  }
});
test("enrollment copies the curriculum and prevents duplicate enrollments", () => {
  const d = enroll(),
    j = d.personal.journeys[0];
  assert.equal(j.completed.length, 0);
  assert.equal(j.minutes, 25);
  assert.equal(j.goal, "Build my own accessible portfolio");
  j.sections[0].modules[0].title = "My edited title";
  assert.notEqual(
    starterDivisions[0].sections[0].modules[0].title,
    "My edited title",
  );
  assert.throws(
    () =>
      applyLocal(d, {
        type: "journey.enroll",
        divisionId: starterDivisions[0].id,
        curriculum: starterDivisions[0],
        goal: "Learn again",
        minutes: 25,
        days: 5,
      }),
    /already enrolled/,
  );
});
test("module completion is ordered, records reflection, and logs activity once", () => {
  let d = enroll();
  const j = d.personal.journeys[0],
    mods = modulesOf(j);
  assert.throws(
    () =>
      applyLocal(d, {
        type: "journey.complete",
        id: j.id,
        moduleId: mods[1].id,
        reflection: "I completed the practice.",
      }),
    /preceding/,
  );
  assert.throws(() =>
    applyLocal(d, {
      type: "journey.complete",
      id: j.id,
      moduleId: mods[0].id,
      reflection: "done",
    }),
  );
  d = applyLocal(d, {
    type: "journey.complete",
    id: j.id,
    moduleId: mods[0].id,
    reflection: "Built semantic sections and tested keyboard navigation.",
  });
  d = applyLocal(d, {
    type: "journey.complete",
    id: j.id,
    moduleId: mods[0].id,
    reflection: "Updated reflection with more detail.",
  });
  assert.equal(d.personal.journeys[0].completed.length, 1);
  assert.equal(d.personal.activity.length, 1);
});
test("reforging preserves only an unchanged completed prefix and never edits the catalog", () => {
  let d = enroll();
  const id = d.personal.journeys[0].id,
    mods = modulesOf(d.personal.journeys[0]);
  for (const m of mods.slice(0, 2))
    d = applyLocal(d, {
      type: "journey.complete",
      id,
      moduleId: m.id,
      reflection: "Practiced and explained the result.",
    });
  const c = structuredClone(d.personal.journeys[0]);
  c.sections[0].modules[1].lesson = "A revised explanation for my needs.";
  const next = applyLocal(d, { type: "journey.reforge", id, curriculum: c });
  assert.deepEqual(next.personal.journeys[0].completed, [mods[0].id]);
  assert.equal(Object.keys(next.personal.journeys[0].reflections).length, 1);
  assert.notEqual(
    starterDivisions[0].sections[0].modules[1].lesson,
    c.sections[0].modules[1].lesson,
  );
});
test("private drafts save locally while publishing requires a connected account", () => {
  const id = crypto.randomUUID(),
    curriculum = blankCurriculum();
  let d = applyLocal(emptyWorkspace(), {
    type: "division.save",
    value: { id, curriculum, visibility: "private", source: "user" },
  });
  assert.equal(d.personal.divisions[0].visibility, "private");
  assert.throws(
    () =>
      applyLocal(d, { type: "division.visibility", id, visibility: "public" }),
    /Sign in/,
  );
  assert.throws(
    () =>
      applyLocal(d, {
        type: "division.save",
        value: { id, curriculum, visibility: "public", source: "user" },
      }),
    /Sign in/,
  );
});
test("AI drafts survive reload and revision and can become a private skill", () => {
  const id = crypto.randomUUID();
  const curriculum = blankCurriculum("Study Python with projects");
  const value = {
    id,
    curriculum,
    visibility: "private",
    source: "ai",
    draft: true,
  } as const;
  let data = applyLocal(emptyWorkspace(), { type: "division.save", value });
  data.personal = normalizePersonal(JSON.parse(JSON.stringify(data.personal)));
  assert.equal(data.personal.divisions[0].draft, true);
  assert.throws(
    () =>
      applyLocal(data, {
        type: "journey.enroll",
        divisionId: id,
        curriculum,
        goal: "Build projects",
        minutes: 25,
        days: 5,
      }),
    /Finish the draft/,
  );
  const revision = { ...curriculum, title: "Python through small projects" };
  data = applyLocal(data, {
    type: "division.save",
    value: { ...value, curriculum: revision },
  });
  assert.equal(data.personal.divisions.length, 1);
  assert.equal(data.personal.divisions[0].title, revision.title);
  assert.equal(data.personal.divisions[0].draft, true);
  data = applyLocal(data, {
    type: "division.visibility",
    id,
    visibility: "private",
  });
  assert.equal(data.personal.divisions[0].draft, undefined);
});
test("habits toggle on a scheduled local date and journals upsert without leaking to AI", () => {
  let d = applyLocal(emptyWorkspace(), {
    type: "habit.add",
    title: "Practice for 15 minutes",
    days: [0, 1, 2, 3, 4, 5, 6],
  });
  const id = d.personal.habits[0].id,
    date = dayKey(),
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  d = applyLocal(d, { type: "habit.toggle", id, date, timeZone });
  assert.deepEqual(d.personal.habits[0].completed, [date]);
  d = applyLocal(d, { type: "habit.toggle", id, date, timeZone });
  assert.deepEqual(d.personal.habits[0].completed, []);
  d = applyLocal(d, {
    type: "checkin.save",
    date,
    timeZone,
    mood: 2,
    journal: "PRIVATE JOURNAL SENTINEL",
  });
  d = applyLocal(d, {
    type: "checkin.save",
    date,
    timeZone,
    mood: 4,
    journal: "PRIVATE JOURNAL SENTINEL revised",
  });
  assert.equal(d.personal.checkins.length, 1);
  assert.equal(d.personal.checkins[0].mood, 4);
  assert.ok(!JSON.stringify(learningContext(d)).includes("PRIVATE JOURNAL"));
  assert.throws(() =>
    applyLocal(d, {
      type: "checkin.save",
      date: "2026-02-30",
      mood: 3,
      journal: "",
    }),
  );
});
test("profile URLs reject scripts and accent/model preferences survive serialization", () => {
  let d = emptyWorkspace();
  assert.throws(() =>
    applyLocal(d, {
      type: "profile.extras",
      value: {
        headline: "Learner",
        links: [{ label: "Site", url: "javascript:alert(1)" }],
        achievements: [],
      },
    }),
  );
  d = applyLocal(d, {
    type: "experience.settings",
    value: { accent: "violet", aiModel: "owner-enabled-model" },
  });
  assert.equal(
    normalizePersonal(JSON.parse(JSON.stringify(d.personal))).experience.accent,
    "violet",
  );
});
test("legacy checkpoints migrate into enrolled skills without dropping completion", () => {
  const p = normalizePersonal({
    plans: [
      {
        id: "legacy",
        title: "My saved plan",
        source: "template",
        created_at: new Date().toISOString(),
        steps: [
          {
            title: "First checkpoint",
            description: "Practice a useful small exercise.",
            done: true,
          },
          {
            title: "Next checkpoint",
            description: "Build on the earlier work.",
            done: false,
          },
        ],
      },
    ],
  });
  assert.equal(p.journeys.length, 1);
  assert.equal(p.journeys[0].completed.length, 1);
  assert.equal(modulesOf(p.journeys[0]).length, 2);
  assert.equal(p.plans.length, 1);
});
