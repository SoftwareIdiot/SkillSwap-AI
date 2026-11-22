import { z } from "zod";
import {
  rewardOperations,
  rewardsDefaults,
  normalizeRewards,
  applyReward,
  type Rewards,
  type RewardOperation,
} from "./rewards.ts";
import {
  welcomeDefaults,
  welcomeOperations,
  normalizeWelcome,
  applyWelcome,
  type WelcomeState,
} from "./welcome.ts";
import {
  learningDefaults,
  learningOperations,
  applyLearning,
  normalizeLearning,
  type LearningState,
  type Division,
} from "./skill-paths.ts";

export type Profile = {
  id: string;
  full_name: string;
  username: string;
  bio: string;
  institution: string;
};
export type Skill = {
  id: string;
  student_id: string;
  name: string;
  kind: "teach" | "learn";
  level: "beginner" | "intermediate" | "advanced";
  created_at: string;
};
export type Proof = {
  id: string;
  author_id: string;
  title: string;
  description: string;
  category: string;
  evidence_url: string;
  created_at: string;
};
export type Room = {
  id: string;
  host_id: string;
  name: string;
  topic: string;
  description: string;
  visibility: "public" | "private";
  code: string;
  joined: boolean;
};
export type Message = {
  id: string;
  classroom_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};
export type Task = {
  id: string;
  title: string;
  done: boolean;
  created_at: string;
};
export type Exchange = {
  id: string;
  sender_id: string;
  receiver_id: string;
  skill_name: string;
  offering: string;
  message: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  created_at: string;
};
export type Activity = { id: string; label: string; date: string };
export type ChatMessage = { role: "user" | "assistant"; content: string };
export type Plan = {
  id: string;
  title: string;
  source: "ai" | "template";
  steps: { title: string; description: string; done: boolean }[];
  created_at: string;
};
export type Personal = LearningState &
  WelcomeState & {
    goal: string;
    interests: string;
    level: "beginner" | "intermediate" | "advanced";
    style:
      | "Practical examples"
      | "Step by step"
      | "Socratic questions"
      | "Concise explanations";
    minutes: number;
    memory: string;
    shareContext: boolean;
    activity: Activity[];
    focus: { id: string; minutes: number; date: string; label: string }[];
    plans: Plan[];
    chat: ChatMessage[];
    saved: string[];
    weeklyGoal: number;
    rewards: Rewards;
  };
export type WorkspaceData = {
  communityDivisions?: Division[];
  communityNotice?: string;
  userId: string;
  profile: Profile;
  people: Profile[];
  skills: Skill[];
  proofs: Proof[];
  rooms: Room[];
  messages: Message[];
  tasks: Task[];
  exchanges: Exchange[];
  personal: Personal;
};
export const defaultPersonal: Personal = {
  ...welcomeDefaults,
  ...learningDefaults,
  goal: "",
  interests: "",
  level: "beginner",
  style: "Practical examples",
  minutes: 25,
  memory: "",
  shareContext: true,
  activity: [],
  focus: [],
  plans: [],
  chat: [],
  saved: [],
  weeklyGoal: 5,
  rewards: rewardsDefaults,
};
export function emptyWorkspace(userId = "local-learner"): WorkspaceData {
  return {
    userId,
    profile: {
      id: userId,
      full_name: "",
      username: "",
      bio: "",
      institution: "",
    },
    people: [],
    skills: [],
    proofs: [],
    rooms: [],
    messages: [],
    tasks: [],
    exchanges: [],
    personal: { ...defaultPersonal },
  };
}
export const uid = () => globalThis.crypto.randomUUID();
export const iso = () => new Date().toISOString();
export function dayKey(value: Date | string = new Date()) {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function streak(activity: Activity[], now = new Date()) {
  const days = new Set(activity.map((a) => dayKey(a.date)));
  const d = new Date(now);
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
export const safeLink = (value: string) => {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
};
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const id = z.string().min(1).max(100);
const preferences = z.object({
  goal: text(0, 400),
  interests: text(0, 400),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  style: z.enum([
    "Practical examples",
    "Step by step",
    "Socratic questions",
    "Concise explanations",
  ]),
  minutes: z.number().int().min(5).max(120),
  memory: text(0, 1500),
  shareContext: z.boolean(),
  weeklyGoal: z.number().int().min(1).max(7),
});
const planSchema = z.object({
  id,
  title: text(2, 160),
  source: z.enum(["ai", "template"]),
  steps: z
    .array(
      z.object({
        title: text(2, 200),
        description: text(1, 1800),
        done: z.boolean(),
      }),
    )
    .min(1)
    .max(14),
  created_at: z.string().datetime(),
});
export const operationSchema = z.discriminatedUnion("type", [
  ...rewardOperations,
  ...welcomeOperations,
  ...learningOperations,
  z.object({
    type: z.literal("profile"),
    value: z.object({
      full_name: text(2, 100),
      username: z
        .string()
        .regex(
          /^[a-z0-9_]{3,24}$/,
          "Use 3–24 lowercase letters, numbers, or underscores.",
        ),
      bio: text(0, 400),
      institution: text(0, 150),
    }),
  }),
  z.object({ type: z.literal("preferences"), value: preferences }),
  z.object({
    type: z.literal("skill.add"),
    value: z.object({
      name: text(2, 80),
      kind: z.enum(["teach", "learn"]),
      level: z.enum(["beginner", "intermediate", "advanced"]),
    }),
  }),
  z.object({ type: z.literal("skill.delete"), id }),
  z.object({
    type: z.literal("task.add"),
    title: text(2, 200),
    quizTopic: text(8, 400).optional(),
    minutes: z.number().int().min(1).max(120).optional(),
    checkpoint: z.object({ journeyId: id, moduleId: id }).optional(),
  }),
  z.object({ type: z.literal("task.toggle"), id }),
  z.object({ type: z.literal("task.delete"), id }),
  z.object({
    type: z.literal("proof.add"),
    value: z.object({
      title: text(3, 140),
      description: text(3, 2500),
      category: text(2, 80),
      evidence_url: z
        .string()
        .max(1500)
        .refine(
          (v) => v === "" || !!safeLink(v),
          "Enter an http or https link.",
        ),
    }),
  }),
  z.object({ type: z.literal("proof.delete"), id }),
  z.object({
    type: z.literal("room.create"),
    value: z.object({
      name: text(3, 120),
      topic: text(2, 100),
      description: text(0, 500),
      visibility: z.enum(["public", "private"]),
    }),
  }),
  z.object({
    type: z.literal("room.join"),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(
        /^SKILL-[A-F0-9]{10}$/,
        "Use a classroom code such as SKILL-A1B2C3D4E5.",
      ),
  }),
  z.object({
    type: z.literal("room.message"),
    roomId: id,
    body: text(1, 2000),
  }),
  z.object({
    type: z.literal("exchange.request"),
    value: z.object({
      receiver_id: id,
      skill_name: text(2, 80),
      offering: text(2, 80),
      message: text(3, 1000),
    }),
  }),
  z.object({
    type: z.literal("exchange.respond"),
    id,
    status: z.enum(["accepted", "declined", "cancelled"]),
  }),
  z.object({ type: z.literal("plan.add"), value: planSchema }),
  z.object({
    type: z.literal("plan.toggle"),
    id,
    index: z.number().int().min(0).max(13),
  }),
  z.object({ type: z.literal("plan.delete"), id }),
  z.object({
    type: z.literal("chat.save"),
    value: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: text(1, 12000),
        }),
      )
      .max(40),
  }),
  z.object({
    type: z.literal("focus.complete"),
    minutes: z.number().int().min(1).max(120),
    label: text(1, 200),
  }),
  z.object({ type: z.literal("skill.save"), id }),
]);
export type Operation = z.infer<typeof operationSchema>;
export function normalizePersonal(value: Partial<Personal> = {}): Personal {
  return {
    ...defaultPersonal,
    ...value,
    ...normalizeLearning(value),
    ...normalizeWelcome(value),
    rewards: normalizeRewards(value.rewards),
  };
}
export function applyPersonal(p: Personal, op: Operation): Personal {
  const next: Personal = applyWelcome(
    {
      ...normalizePersonal(p),
      ...applyLearning(normalizePersonal(p), op),
    },
    op,
  );
  if (
    op.type === "journey.complete" &&
    !p.journeys?.find((j) => j.id === op.id)?.completed.includes(op.moduleId)
  )
    log(next, "Completed a skill module");
  if (
    op.type === "habit.toggle" &&
    next.habits.find((h) => h.id === op.id)?.completed.includes(op.date)
  )
    log(next, "Completed a daily habit");
  if (op.type === "preferences") Object.assign(next, op.value);
  if (op.type === "plan.add") next.plans.unshift(op.value);
  if (op.type === "plan.delete")
    next.plans = next.plans.filter((p) => p.id !== op.id);
  if (op.type === "plan.toggle") {
    const step = next.plans.find((p) => p.id === op.id)?.steps[op.index];
    if (!step) throw new Error("This plan step no longer exists.");
    step.done = !step.done;
    if (step.done) log(next, "Completed a study checkpoint");
  }
  if (op.type === "task.delete") {
    delete next.taskMinutes[op.id];
    delete next.taskQuizTopics[op.id];
    delete next.taskCheckpoints[op.id];
  }
  if (op.type === "chat.save") next.chat = op.value;
  if (op.type === "focus.complete") {
    next.focus.unshift({
      id: uid(),
      minutes: op.minutes,
      date: iso(),
      label: op.label,
    });
    log(next, `Completed ${op.minutes} minutes of focus`);
  }
  if (op.type === "skill.save")
    next.saved = next.saved.includes(op.id)
      ? next.saved.filter((s) => s !== op.id)
      : [...next.saved, op.id];
  if (op.type.startsWith("reward."))
    next.rewards = applyReward(
      next.activity,
      next.rewards,
      op as RewardOperation,
    );
  return next;
}
export function log(p: Personal, label: string) {
  p.activity = [{ id: uid(), label, date: iso() }, ...p.activity].slice(
    0,
    2000,
  );
}
export function applyLocal(data: WorkspaceData, input: unknown): WorkspaceData {
  const op = operationSchema.parse(input);
  if (
    (op.type === "division.visibility" && op.visibility === "public") ||
    (op.type === "division.save" && op.value.visibility === "public")
  )
    throw new Error(
      "Sign in to publish a skill to the community. Your private draft stays on this device.",
    );
  const d = structuredClone(data);
  d.personal = applyPersonal(d.personal, op);
  switch (op.type) {
    case "profile":
      d.profile = { ...d.profile, ...op.value };
      break;
    case "skill.add":
      d.skills.unshift({
        id: uid(),
        student_id: d.userId,
        created_at: iso(),
        ...op.value,
      });
      break;
    case "skill.delete":
      d.skills = d.skills.filter(
        (s) => s.id !== op.id || s.student_id !== d.userId,
      );
      break;
    case "task.add":
      d.tasks.unshift({
        id: uid(),
        title: op.title,
        done: false,
        created_at: iso(),
      });
      d.personal.taskMinutes[d.tasks[0].id] = op.minutes || 25;
      if (op.quizTopic) d.personal.taskQuizTopics[d.tasks[0].id] = op.quizTopic;
      if (op.checkpoint) d.personal.taskCheckpoints[d.tasks[0].id] = op.checkpoint;
      break;
    case "task.toggle": {
      const t = d.tasks.find((t) => t.id === op.id);
      if (!t) throw new Error("Task not found.");
      t.done = !t.done;
      if (t.done) log(d.personal, "Completed: " + t.title);
      break;
    }
    case "task.delete":
      d.tasks = d.tasks.filter((t) => t.id !== op.id);
      break;
    case "proof.add":
      d.proofs.unshift({
        id: uid(),
        author_id: d.userId,
        created_at: iso(),
        ...op.value,
      });
      log(d.personal, "Published: " + op.value.title);
      break;
    case "proof.delete":
      d.proofs = d.proofs.filter(
        (p) => p.id !== op.id || p.author_id !== d.userId,
      );
      break;
    case "room.create":
      d.rooms.unshift({
        id: uid(),
        host_id: d.userId,
        code: "SKILL-" + uid().replaceAll("-", "").slice(0, 10).toUpperCase(),
        joined: true,
        ...op.value,
      });
      break;
    case "room.join": {
      const r = d.rooms.find((r) => r.code === op.code);
      if (!r)
        throw new Error(
          "Room not found on this device. Sign in to join shared classrooms.",
        );
      r.joined = true;
      break;
    }
    case "room.message":
      if (!d.rooms.some((r) => r.id === op.roomId && r.joined))
        throw new Error("Join this classroom before posting.");
      d.messages.push({
        id: uid(),
        classroom_id: op.roomId,
        sender_id: d.userId,
        body: op.body,
        created_at: iso(),
      });
      break;
    case "exchange.request":
      throw new Error("Sign in to connect with other learners.");
    case "exchange.respond":
      throw new Error("Sign in to manage shared exchanges.");
  }
  return d;
}
export function matchScore(skill: Skill, data: WorkspaceData) {
  const mine = data.skills.filter((s) => s.student_id === data.userId);
  const wants = mine.filter((s) => s.kind === "learn");
  const teaches = mine.filter((s) => s.kind === "teach");
  const wanted = wants.some(
    (s) => s.name.toLowerCase() === skill.name.toLowerCase(),
  );
  const reciprocal = data.skills.some(
    (s) =>
      s.student_id === skill.student_id &&
      s.kind === "learn" &&
      teaches.some((t) => t.name.toLowerCase() === s.name.toLowerCase()),
  );
  return (wanted ? 2 : 0) + (reciprocal ? 1 : 0);
}
export const learningPaths = [
  {
    title: "Build your first web app",
    tag: "DEVELOPMENT",
    skill: "Web development",
    color: "mint",
    icon: "code",
    description: "From a blank page to something people can use.",
    topics: [
      "HTML & CSS foundations",
      "JavaScript interactions",
      "Build and share a small app",
    ],
  },
  {
    title: "Make ideas look incredible",
    tag: "DESIGN",
    skill: "UI/UX design",
    color: "violet",
    icon: "design",
    description: "Design thoughtful interfaces, one screen at a time.",
    topics: [
      "Visual hierarchy & spacing",
      "Design a screen in Figma",
      "Prototype and ask for feedback",
    ],
  },
  {
    title: "Turn data into a story",
    tag: "DATA & AI",
    skill: "Python",
    color: "peach",
    icon: "data",
    description: "Explore Python and find meaning in everyday data.",
    topics: [
      "Python fundamentals",
      "Explore a small dataset",
      "Visualize and explain one insight",
    ],
  },
  {
    title: "Speak with confidence",
    tag: "COMMUNICATION",
    skill: "Public speaking",
    color: "blue",
    icon: "speak",
    description: "Share what you know with clarity and confidence.",
    topics: [
      "Structure a two-minute story",
      "Practice with a recording",
      "Present and reflect on feedback",
    ],
  },
];
export function templatePlan(
  goal: string,
  minutes: number,
  topics?: string[],
): Plan {
  return {
    id: uid(),
    title: goal,
    source: "template",
    created_at: iso(),
    steps: (
      topics || [
        "Map your starting point",
        "Learn one small concept",
        "Put it into practice",
        "Explain it in your own words",
        "Build a small proof of learning",
      ]
    ).map((title, i) => ({
      title,
      description: [
        `Spend ${minutes} minutes listing what you already know about ${goal} and one question you want to answer.`,
        `Choose one reliable introductory resource for ${goal}. Take three notes and write one question.`,
        `Use your ${minutes}-minute session to make a small example. Record where you got stuck.`,
        `Without looking at your notes, explain the concept. Check the gaps and try again.`,
        `Create a small project or write-up about ${goal}. Add an evidence link to your proof ledger.`,
      ][Math.min(i, 4)],
      done: false,
    })),
  };
}
