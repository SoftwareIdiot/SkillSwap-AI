import type { WorkspaceData } from "./workspace";
import { streak } from "./workspace.ts";
import { findCheckpoint } from "./checkpoints.ts";
// Explicit allow-list: private identity, classroom messages and other learners never enter the prompt.
export function learningContext(
  data: Pick<WorkspaceData, "userId" | "personal" | "skills" | "tasks" | "proofs">,
) {
  if (!data.personal.shareContext) return { shareContext: false as const };
  const p = data.personal;
  const recentChecks = new Map<string, { concept: string; result: "needs practice" | "answered correctly" }>();
  for (const attempt of [...(p.checkpointAttempts ?? [])].reverse()) {
    const journey = p.journeys.find((item) => item.id === attempt.journeyId);
    const checkpoint = journey && findCheckpoint(journey.divisionId, attempt.moduleId);
    if (!checkpoint || recentChecks.has(checkpoint.concept)) continue;
    recentChecks.set(checkpoint.concept, {
      concept: checkpoint.concept,
      result: attempt.correct ? "answered correctly" : "needs practice",
    });
    if (recentChecks.size === 6) break;
  }
  return {
    shareContext: true as const,
    preferences: {
      goal: p.goal,
      interests: p.interests,
      level: p.level,
      style: p.style,
      minutes: p.minutes,
      memory: p.memory,
      studying: p.onboarding.answers?.studying || "",
    },
    routine: {
      learningStreak: streak(p.activity),
      weeklyGoal: p.weeklyGoal,
      completedFocusMinutes: p.focus.reduce((sum, s) => sum + s.minutes, 0),
      recentActivity: p.activity
        .slice(0, 10)
        .map((a) => ({ date: a.date, label: a.label })),
    },
    skills: data.skills
      .filter((s) => s.student_id === data.userId)
      .slice(0, 50)
      .map((s) => ({ name: s.name, kind: s.kind, level: s.level })),
    completedTasks: data.tasks
      .filter((t) => t.done)
      .slice(0, 10)
      .map((t) => t.title),
    recentChecks: [...recentChecks.values()],
    plans: p.journeys?.length
      ? p.journeys.slice(0, 30).map((j) => ({
          title: j.title,
          completed: j.completed.length,
          total: j.sections.reduce((n, s) => n + s.modules.length, 0),
          nextModule:
            j.sections
              .flatMap((s) => s.modules)
              .find((m) => !j.completed.includes(m.id))?.title || "Completed",
        }))
      : p.plans.slice(0, 3).map((plan) => ({
          title: plan.title,
          completed: plan.steps.filter((s) => s.done).length,
          total: plan.steps.length,
        })),
    learningMemory: p.learningMemory
      .filter((entry) => entry.share)
      .slice(0, 6)
      .map(({ title, note, source }) => ({ title, note, source })),
    recentProof: data.proofs
      .filter((proof) => proof.author_id === data.userId)
      .slice(0, 3)
      .map((proof) => proof.title),
  };
}
