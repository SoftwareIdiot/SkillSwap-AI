import { z } from "zod";
import {
  findCheckpoint,
  nextCheckpointQuestion,
  type CheckpointAttempt,
  type CheckpointRef,
} from "./checkpoints.ts";
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const id = text(1, 100);
export const moduleSchema = z.object({
  id,
  title: text(2, 160),
  lesson: text(10, 6000),
  exercise: text(5, 2000),
  check: text(5, 1000),
  minutes: z.number().int().min(5).max(180),
});
export const sectionSchema = z.object({
  id,
  title: text(2, 160),
  modules: z.array(moduleSchema).min(1).max(12),
});
export const curriculumSchema = z
  .object({
    title: text(2, 160),
    summary: text(10, 1000),
    category: text(2, 60),
    level: z.enum(["beginner", "intermediate", "advanced"]),
    sections: z.array(sectionSchema).min(1).max(8),
  })
  .superRefine((value, ctx) => {
    const ids = value.sections.flatMap((s) => s.modules.map((m) => m.id));
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: "custom",
        message: "Every module needs a unique ID.",
      });
  });
export type Curriculum = z.infer<typeof curriculumSchema>;
export type LearningModule = z.infer<typeof moduleSchema>;
export type Division = Curriculum & {
  id: string;
  visibility: "private" | "public";
  source: "starter" | "user" | "ai";
  draft?: boolean;
  author?: string;
};
export type Enrollment = Curriculum & {
  id: string;
  divisionId: string;
  goal: string;
  minutes: number;
  days: number;
  completed: string[];
  reflections: Record<string, string>;
  enrolledAt: string;
};
export type LearningState = {
  journeys: Enrollment[];
  checkpointAttempts: CheckpointAttempt[];
  divisions: Division[];
  habits: {
    id: string;
    title: string;
    kind?: "build" | "quit";
    days: number[];
    completed: string[];
  }[];
  taskMinutes: Record<string, number>;
  taskQuizTopics: Record<string, string>;
  taskCheckpoints: Record<string, CheckpointRef>;
  studyNudges: { channel: "off" | "email" | "whatsapp"; phone: string };
  learningMemory: {
    id: string;
    title: string;
    note: string;
    source: "note" | "quiz" | "exchange";
    date: string;
    share: boolean;
  }[];
  checkins: { date: string; mood: number; journal: string }[];
  profileExtras: {
    headline: string;
    links: { label: string; url: string }[];
    achievements: {
      id: string;
      title: string;
      description: string;
      url: string;
    }[];
  };
  experience: {
    accent: "mint" | "violet" | "blue" | "peach" | "rose";
    aiModel: string;
  };
};
export const learningDefaults: LearningState = {
  journeys: [],
  checkpointAttempts: [],
  divisions: [],
  habits: [],
  taskMinutes: {},
  taskQuizTopics: {},
  taskCheckpoints: {},
  studyNudges: { channel: "off", phone: "" },
  learningMemory: [],
  checkins: [],
  profileExtras: { headline: "", links: [], achievements: [] },
  experience: { accent: "mint", aiModel: "" },
};
const localDay = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const timeZone = z
  .string()
  .max(80)
  .refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v }).format();
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid timezone.")
  .optional();
function todayInZone(zone?: string) {
  if (!zone) return localDay();
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T12:00:00");
    return !Number.isNaN(+d) && localDay(d) === v;
  }, "Use a valid calendar date.");
const link = z
  .string()
  .max(1500)
  .refine((v) => {
    if (!v) return true;
    try {
      return ["http:", "https:"].includes(new URL(v).protocol);
    } catch {
      return false;
    }
  }, "Use an http or https link.");
export const divisionSchema = z.object({
  id: z.string().uuid(),
  curriculum: curriculumSchema,
  visibility: z.enum(["private", "public"]),
  source: z.enum(["user", "ai"]),
  draft: z.boolean().optional(),
});
export const nudgeSettingsSchema = z
  .object({
    channel: z.enum(["off", "email", "whatsapp"]),
    phone: z.string().regex(/^$|^\+[1-9]\d{7,14}$/),
  })
  .refine((value) => value.channel !== "whatsapp" || !!value.phone);
export const learningOperations = [
  z.object({
    type: z.literal("checkpoint.answer"),
    id: z.string().uuid(),
    journeyId: id,
    moduleId: id,
    question: z.number().int().min(0).max(2),
    choice: z.number().int().min(0).max(2),
    reasoning: text(0, 600),
  }),
  z.object({ type: z.literal("nudges.settings"), value: nudgeSettingsSchema }),
  z.object({
    type: z.literal("memory.add"),
    value: z.object({
      id: z.string().uuid(),
      title: text(2, 200),
      note: text(5, 1500),
      source: z.enum(["note", "quiz", "exchange"]),
    }),
  }),
  z.object({ type: z.literal("memory.share"), id, share: z.boolean() }),
  z.object({ type: z.literal("memory.delete"), id }),
  z.object({ type: z.literal("division.save"), value: divisionSchema }),
  z.object({
    type: z.literal("division.visibility"),
    id,
    visibility: z.enum(["private", "public"]),
  }),
  z.object({ type: z.literal("division.delete"), id }),
  z.object({
    type: z.literal("journey.enroll"),
    divisionId: id,
    curriculum: curriculumSchema,
    goal: text(3, 400),
    minutes: z.number().int().min(5).max(120),
    days: z.number().int().min(1).max(7),
  }),
  z.object({
    type: z.literal("journey.complete"),
    id,
    moduleId: id,
    reflection: text(8, 2000),
  }),
  z.object({
    type: z.literal("journey.reforge"),
    id,
    curriculum: curriculumSchema,
  }),
  z.object({ type: z.literal("journey.remove"), id }),
  z.object({
    type: z.literal("journey.prerequisite"),
    id,
    moduleId: id,
    topic: text(3, 120),
  }),
  z.object({
    type: z.literal("habit.add"),
    kind: z.enum(["build", "quit"]).optional(),
    title: text(2, 120),
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  }),
  z.object({ type: z.literal("habit.toggle"), id, date: day, timeZone }),
  z.object({ type: z.literal("habit.delete"), id }),
  z.object({
    type: z.literal("task.budget"),
    id,
    minutes: z.number().int().min(1).max(240),
  }),
  z.object({
    type: z.literal("checkin.save"),
    timeZone,
    date: day,
    mood: z.number().int().min(1).max(5),
    journal: text(0, 6000),
  }),
  z.object({
    type: z.literal("profile.extras"),
    value: z.object({
      headline: text(0, 160),
      links: z
        .array(z.object({ label: text(1, 50), url: link.refine((v) => !!v) }))
        .max(8),
      achievements: z
        .array(
          z.object({
            id,
            title: text(2, 160),
            description: text(0, 1000),
            url: link,
          }),
        )
        .max(30),
    }),
  }),
  z.object({
    type: z.literal("experience.settings"),
    value: z.object({
      accent: z.enum(["mint", "violet", "blue", "peach", "rose"]),
      aiModel: text(0, 100),
    }),
  }),
] as const;
export type LearningOperation = z.infer<(typeof learningOperations)[number]>;
export function modulesOf(c: Curriculum) {
  return c.sections.flatMap((s) => s.modules);
}
export function applyLearning(
  state: LearningState,
  op: { type: string },
): LearningState {
  const p = structuredClone(state);
  const value = op as LearningOperation;
  switch (value.type) {
    case "checkpoint.answer": {
      if (p.checkpointAttempts.some((attempt) => attempt.id === value.id)) break;
      const journey = p.journeys.find((item) => item.id === value.journeyId);
      const check = journey && findCheckpoint(journey.divisionId, value.moduleId);
      const modules = journey ? modulesOf(journey) : [];
      const index = modules.findIndex((module) => module.id === value.moduleId);
      if (!journey || !check || index < 0 || modules.slice(0, index).some((module) => !journey.completed.includes(module.id))) {
        throw new Error("Open an available checkpoint from your skill map.");
      }
      const attempts = p.checkpointAttempts.filter(
        (attempt) => attempt.journeyId === journey.id && attempt.moduleId === value.moduleId,
      );
      const question = nextCheckpointQuestion(check, attempts);
      if (!question || value.question !== attempts.length)
        throw new Error("This question is already answered. Reopen the checkpoint to continue.");
      const { type: _type, ...response } = value;
      p.checkpointAttempts.push({
        ...response,
        correct: value.choice === question.correct,
        date: new Date().toISOString(),
      });
      break;
    }
    case "nudges.settings":
      p.studyNudges = value.value;
      break;
    case "memory.add":
      if (p.learningMemory.some((entry) => entry.id === value.value.id)) break;
      if (p.learningMemory.length >= 100)
        throw new Error("Remove an old learning note before adding another.");
      p.learningMemory.unshift({
        ...value.value,
        date: new Date().toISOString(),
        share: false,
      });
      break;
    case "memory.share": {
      const entry = p.learningMemory.find((item) => item.id === value.id);
      if (entry) entry.share = value.share;
      break;
    }
    case "memory.delete":
      p.learningMemory = p.learningMemory.filter(
        (entry) => entry.id !== value.id,
      );
      break;
    case "task.budget":
      p.taskMinutes[value.id] = value.minutes;
      break;
    case "division.save": {
      const d: Division = {
        ...value.value.curriculum,
        id: value.value.id,
        visibility: value.value.visibility,
        source: value.value.source,
        ...(value.value.draft && value.value.visibility === "private"
          ? { draft: true }
          : {}),
      };
      p.divisions = [d, ...p.divisions.filter((x) => x.id !== d.id)];
      break;
    }
    case "division.visibility": {
      const d = p.divisions.find((x) => x.id === value.id);
      if (!d) throw new Error("Draft not found.");
      d.visibility = value.visibility;
      delete d.draft;
      break;
    }
    case "division.delete":
      p.divisions = p.divisions.filter((x) => x.id !== value.id);
      break;
    case "journey.enroll": {
      if (p.divisions.some((d) => d.id === value.divisionId && d.draft))
        throw new Error("Finish the draft before enrolling in this skill.");
      if (p.journeys.some((x) => x.divisionId === value.divisionId))
        throw new Error("You are already enrolled in this skill.");
      if (p.journeys.length >= 30)
        throw new Error(
          "Keep up to 30 enrolled skills. Archive one before adding another.",
        );
      p.journeys.unshift({
        ...value.curriculum,
        id: crypto.randomUUID(),
        divisionId: value.divisionId,
        goal: value.goal,
        minutes: value.minutes,
        days: value.days,
        completed: [],
        reflections: {},
        enrolledAt: new Date().toISOString(),
      });
      break;
    }
    case "journey.complete": {
      const j = p.journeys.find((x) => x.id === value.id);
      if (!j) throw new Error("Enrolled skill not found.");
      const mods = modulesOf(j),
        index = mods.findIndex((x) => x.id === value.moduleId);
      if (
        index < 0 ||
        mods.slice(0, index).some((x) => !j.completed.includes(x.id))
      )
        throw new Error("Finish the preceding modules first.");
      if (!j.completed.includes(value.moduleId))
        j.completed.push(value.moduleId);
      j.reflections[value.moduleId] = value.reflection;
      break;
    }
    case "journey.prerequisite": {
      const journey = p.journeys.find((item) => item.id === value.id);
      const next =
        journey &&
        modulesOf(journey).find(
          (module) => !journey.completed.includes(module.id),
        );
      if (!journey || next?.id !== value.moduleId)
        throw new Error("Choose your next checkpoint first.");
      const section = journey.sections.find((item) =>
        item.modules.some((module) => module.id === next.id),
      );
      if (!section || section.modules.length >= 12)
        throw new Error("This section has no room for another checkpoint.");
      const index = section.modules.indexOf(next);
      section.modules.splice(index, 0, {
        id: crypto.randomUUID(),
        title: `Practice: ${value.topic}`,
        minutes: 10,
        lesson: `Break down ${value.topic} before tackling ?${next.title}?. Find one worked example in your course material or ask the coach to walk you through one. Explain why each step works.`,
        exercise:
          "Try a similar example on your own and compare it with the worked example.",
        check:
          "Explain the concept in your own words and describe what would change in a second example.",
      });
      break;
    }
    case "journey.reforge": {
      const j = p.journeys.find((x) => x.id === value.id);
      if (!j) throw new Error("Enrolled skill not found.");
      const original = modulesOf(j),
        revised = modulesOf(value.curriculum);
      // Keep only an unchanged, consecutive completed prefix. Edited modules need a fresh check-in.
      const completed: string[] = [];
      for (const m of revised) {
        if (
          !j.completed.includes(m.id) ||
          JSON.stringify(original.find((x) => x.id === m.id)) !==
            JSON.stringify(m)
        )
          break;
        completed.push(m.id);
      }
      Object.assign(j, value.curriculum, {
        completed,
        reflections: Object.fromEntries(
          Object.entries(j.reflections).filter(([id]) =>
            completed.includes(id),
          ),
        ),
      });
      break;
    }
    case "journey.remove":
      p.journeys = p.journeys.filter((x) => x.id !== value.id);
      p.checkpointAttempts = p.checkpointAttempts.filter((item) => item.journeyId !== value.id);
      for (const [taskId, checkpoint] of Object.entries(p.taskCheckpoints)) {
        if (checkpoint.journeyId === value.id) delete p.taskCheckpoints[taskId];
      }
      break;
    case "habit.add":
      p.habits.push({
        id: crypto.randomUUID(),
        title: value.title,
        kind: value.kind,
        days: [...new Set(value.days)],
        completed: [],
      });
      break;
    case "habit.toggle": {
      if (value.date !== todayInZone(value.timeZone))
        throw new Error(
          "Check habits for today. Previous days remain a record.",
        );
      const h = p.habits.find((x) => x.id === value.id);
      if (!h) throw new Error("Habit not found.");
      if (!h.days.includes(new Date(value.date + "T12:00:00").getDay()))
        throw new Error("This habit is not scheduled today.");
      h.completed = h.completed.includes(value.date)
        ? h.completed.filter((x) => x !== value.date)
        : [...h.completed, value.date];
      break;
    }
    case "habit.delete":
      p.habits = p.habits.filter((x) => x.id !== value.id);
      break;
    case "checkin.save":
      if (value.date > todayInZone(value.timeZone))
        throw new Error("You cannot record a future check-in.");
      p.checkins = [
        { date: value.date, mood: value.mood, journal: value.journal },
        ...p.checkins.filter((x) => x.date !== value.date),
      ]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 730);
      break;
    case "profile.extras":
      p.profileExtras = value.value;
      break;
    case "experience.settings":
      p.experience = value.value;
      break;
  }
  return p;
}
export function normalizeLearning(
  raw: Partial<LearningState> & {
    plans?: {
      id: string;
      title: string;
      created_at: string;
      steps: { title: string; description: string; done: boolean }[];
    }[];
  },
): LearningState {
  const p = { ...structuredClone(learningDefaults), ...raw };
  if (!raw.journeys && raw.plans?.length)
    p.journeys = raw.plans.map((plan) => ({
      id: plan.id,
      divisionId: `legacy-${plan.id}`,
      title: plan.title,
      summary: "Your saved study plan, preserved as a guided skill.",
      category: "My skills",
      level: "beginner",
      goal: plan.title,
      minutes: 25,
      days: 5,
      enrolledAt: plan.created_at,
      reflections: {},
      completed: plan.steps
        .filter((s) => s.done)
        .map((s) => `legacy-${plan.id}-${plan.steps.indexOf(s)}`),
      sections: [
        {
          id: `section-${plan.id}`,
          title: "Your saved checkpoints",
          modules: plan.steps.map((s, i) => ({
            id: `legacy-${plan.id}-${i}`,
            title: s.title,
            lesson: s.description,
            exercise: s.description,
            check: "Explain what you practiced and what you can now do.",
            minutes: 25,
          })),
        },
      ],
    }));
  return p;
}

// Kept deliberately separate from personal progress, identity, and journal data.
export const aiCurriculumSchema = z.object({
  title: text(2, 160),
  summary: text(10, 1000),
  category: text(2, 60),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  sections: z
    .array(
      z.object({
        title: text(2, 160),
        modules: z
          .array(moduleSchema.omit({ id: true }))
          .min(3)
          .max(5),
      }),
    )
    .min(3)
    .max(4),
});
export function fromAiCurriculum(raw: unknown): Curriculum {
  const c = aiCurriculumSchema.parse(raw);
  return {
    ...c,
    sections: c.sections.map((s) => ({
      ...s,
      id: crypto.randomUUID(),
      modules: s.modules.map((m) => ({ ...m, id: crypto.randomUUID() })),
    })),
  };
}
