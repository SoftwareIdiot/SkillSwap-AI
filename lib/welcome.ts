import { z } from "zod";
import { starterDivisions } from "./skill-catalog.ts";
import { applyLearning } from "./skill-paths.ts";
import type { Personal } from "./workspace.ts";

export const studyStyles = [
  "Practical examples",
  "Step by step",
  "Socratic questions",
  "Concise explanations",
] as const;
export const welcomeAnswersSchema = z.object({
  displayName: z.string().trim().min(2).max(60),
  studying: z.string().trim().min(2).max(180),
  age: z.number().int().min(5).max(120).nullable(),
  gender: z.string().trim().max(60),
  style: z.enum(studyStyles),
  minutes: z.number().int().min(5).max(120),
});
export type WelcomeAnswers = z.infer<typeof welcomeAnswersSchema>;
export const tourSteps = [
  {
    view: "overview",
    target: "dashboard",
    title: "Your learning starts here",
    text: "My learning keeps your enrolled skills and progress together. Continue a skill to pick up at your next unfinished module.",
  },
  {
    view: "plans",
    target: "studio",
    title: "Find or build your next skill",
    text: "Skill studio has starter skills and community curricula. Preview the sections before enrolling, or create a private skill and publish it when you're ready.",
  },
  {
    view: "overview",
    target: "module",
    title: "Make progress through practice",
    text: "Each module moves through Learn, Practice, and Check & reflect. Complete the practice and save a reflection to unlock the next module. Your progress is self-reported, not a verified qualification.",
  },
  {
    view: "coach",
    target: "coach",
    title: "Get help in the way you learn",
    text: "With AI connected, ask for explanations, examples, quizzes, and feedback. Your study preferences guide the coach; age, gender, mood, and journal entries are excluded.",
  },
  {
    view: "productivity",
    target: "planner",
    title: "Build a routine that fits your day",
    text: "Planner combines tasks, focus sessions, scheduled habits, and a private mood and journal check-in. Completed study activities also build your learning streak.",
  },
  {
    view: "profile",
    target: "profile",
    title: "Collect your progress in your profile",
    text: "Add social links and outside achievements. SkillSwap milestones appear as you complete modules, finish skills, and build a steady routine.",
  },
  {
    view: "settings",
    target: "settings",
    title: "Make this workspace yours",
    text: "Choose light or dark mode, an accent color, and an available AI model. Open Help & shortcuts anytime to replay this tour or contact the creator by email or WhatsApp.",
  },
] as const;
export type TourView = (typeof tourSteps)[number]["view"];
export type WelcomeState = {
  onboarding: {
    status: "pending" | "completed" | "skipped";
    step: number;
    answers: WelcomeAnswers | null;
  };
  tour: { status: "new" | "active" | "completed" | "skipped"; step: number };
};
export const welcomeDefaults: WelcomeState = {
  onboarding: { status: "pending", step: 0, answers: null },
  tour: { status: "new", step: 0 },
};
export const welcomeOperations = [
  z.object({
    type: z.literal("welcome.answers"),
    value: welcomeAnswersSchema,
    step: z.number().int().min(0).max(2),
  }),
  z.object({
    type: z.literal("welcome.finish"),
    value: welcomeAnswersSchema,
    divisionId: z.string().max(100),
    goal: z.string().trim().min(3).max(400),
    days: z.number().int().min(1).max(7),
  }),
  z.object({ type: z.literal("welcome.skip") }),
  z.object({
    type: z.literal("tour.progress"),
    status: z.enum(["active", "completed", "skipped"]),
    step: z
      .number()
      .int()
      .min(0)
      .max(tourSteps.length - 1),
  }),
] as const;
type WelcomeOperation = z.infer<(typeof welcomeOperations)[number]>;
export function normalizeWelcome(raw: Partial<Personal>): WelcomeState {
  const legacy =
    !raw.onboarding &&
    !!(
      raw.journeys?.length ||
      raw.plans?.length ||
      raw.activity?.length ||
      raw.goal
    );
  return {
    onboarding: {
      ...welcomeDefaults.onboarding,
      ...(legacy ? { status: "completed" as const } : {}),
      ...raw.onboarding,
    },
    tour: {
      ...welcomeDefaults.tour,
      ...(legacy ? { status: "skipped" as const } : {}),
      ...raw.tour,
    },
  };
}
export function applyWelcome(
  p: Personal,
  operation: { type: string },
): Personal {
  const next = structuredClone(p),
    op = operation as WelcomeOperation;
  if (op.type === "welcome.answers")
    next.onboarding = { status: "pending", step: op.step, answers: op.value };
  if (op.type === "welcome.skip") {
    next.onboarding.status = "skipped";
    next.tour = { status: "active", step: 0 };
  }
  if (op.type === "welcome.finish") {
    const division = starterDivisions.find((d) => d.id === op.divisionId);
    if (!division)
      throw new Error("Choose one of the starter skills to begin.");
    if (!next.journeys.some((j) => j.divisionId === division.id))
      Object.assign(
        next,
        applyLearning(next, {
          type: "journey.enroll",
          divisionId: division.id,
          curriculum: division,
          goal: op.goal,
          minutes: op.value.minutes,
          days: op.days,
        } as Parameters<typeof applyLearning>[1]),
      );
    next.onboarding = { status: "completed", step: 2, answers: op.value };
    next.style = op.value.style;
    next.minutes = op.value.minutes;
    next.interests = op.value.studying;
    next.goal = op.goal;
    next.weeklyGoal = op.days;
    next.tour = { status: "active", step: 0 };
  }
  if (op.type === "tour.progress")
    next.tour = { status: op.status, step: op.step };
  return next;
}
export function suggestedStarters(studying: string) {
  const words = studying.toLowerCase();
  const relevance: Record<string, string[]> = {
    "starter-web": [
      "computer",
      "web",
      "software",
      "engineering",
      "frontend",
      "coding",
    ],
    "starter-python": [
      "python",
      "computer",
      "data",
      "science",
      "math",
      "programming",
    ],
    "starter-design": ["design", "creative", "art", "ux", "ui"],
    "starter-speaking": [
      "business",
      "communication",
      "speaking",
      "management",
      "language",
    ],
    "starter-sql": ["data", "business", "analytics", "database", "computer"],
    "starter-research": [
      "school",
      "study",
      "research",
      "science",
      "university",
      "college",
      "law",
    ],
  };
  return starterDivisions
    .map((skill, index) => ({
      skill,
      index,
      score: (relevance[skill.id] || []).filter((word) => words.includes(word))
        .length,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
}
export const supportEmail = "softwareguy26@gmail.com";
export const supportWhatsApp = "917679027976";
export const supportLinks = {
  email: `mailto:${supportEmail}?subject=${encodeURIComponent("SkillSwap help")}&body=${encodeURIComponent("Hi, I need help with SkillSwap.\n\n")}`,
  whatsapp: `https://wa.me/${supportWhatsApp}?text=${encodeURIComponent("Hi, I need help with SkillSwap.")}`,
};
