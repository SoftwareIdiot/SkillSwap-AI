import { z } from "zod";
import type { Activity } from "./workspace.ts";

export const rewardItems = {
  aurora: {
    name: "Aurora",
    cost: 40,
    description: "A soft violet and green workspace glow.",
  },
  sunset: {
    name: "Sunset",
    cost: 40,
    description: "Warm amber and rose workspace lighting.",
  },
  orbit: {
    name: "Orbit frame",
    cost: 60,
    description: "An accent ring around your account picture.",
  },
} as const;
export type RewardItem = keyof typeof rewardItems;
export type Rewards = {
  zone: string;
  days: string[];
  protectedDays: string[];
  owned: RewardItem[];
  spent: number;
  theme: "default" | "aurora" | "sunset";
  frame: boolean;
};
export const rewardsDefaults: Rewards = {
  zone: "",
  days: [],
  protectedDays: [],
  owned: [],
  spent: 0,
  theme: "default",
  frame: false,
};
const zone = z
  .string()
  .max(80)
  .refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid timezone.");
export const rewardOperations = [
  z.object({ type: z.literal("reward.collect"), zone }),
  z.object({
    type: z.literal("reward.buy"),
    item: z.enum(["aurora", "sunset", "orbit", "save"]),
  }),
  z.object({
    type: z.literal("reward.equip"),
    item: z.enum(["default", "aurora", "sunset", "orbit", "no-frame"]),
  }),
] as const;
export type RewardOperation = z.infer<(typeof rewardOperations)[number]>;
export function normalizeRewards(value?: Partial<Rewards>): Rewards {
  return {
    ...rewardsDefaults,
    ...value,
    days: [...(value?.days || [])],
    protectedDays: [...(value?.protectedDays || [])],
    owned: [...(value?.owned || [])],
  };
}
export function rewardDay(date: Date | string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(date));
  const get = (key: string) => parts.find((p) => p.type === key)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function previousDay(day: string) {
  return new Date(Date.parse(day + "T12:00:00Z") - 86400000)
    .toISOString()
    .slice(0, 10);
}
export function meaningfulActivity(a: Activity) {
  return (
    a.label === "Completed a skill module" ||
    a.label === "Completed a study checkpoint" ||
    a.label.startsWith("Completed: ") ||
    /^Completed ([5-9]|[1-9]\d+) minutes of focus$/.test(a.label)
  );
}
export function rewardStatus(
  activity: Activity[],
  rewards: Rewards,
  now = new Date(),
  fallbackZone = "UTC",
) {
  const zone = rewards.zone || fallbackZone;
  const today = rewardDay(now, zone);
  const learned = new Set(
    activity
      .filter(meaningfulActivity)
      .map((a) => rewardDay(a.date, zone))
      .filter((day) => day <= today),
  );
  rewards.days.forEach((day) => learned.add(day));
  const covered = new Set([...learned, ...rewards.protectedDays]);
  let cursor = covered.has(today) ? today : previousDay(today),
    streak = 0;
  while (covered.has(cursor)) {
    streak++;
    cursor = previousDay(cursor);
  }
  const yesterday = previousDay(today);
  return {
    today,
    zone,
    streak,
    balance: rewards.days.length * 10 - rewards.spent,
    learnedDays: learned.size,
    eligible: learned.has(today) && !rewards.days.includes(today),
    protectedToday: rewards.protectedDays.includes(today),
    canSave: !covered.has(yesterday) && covered.has(previousDay(yesterday)),
    yesterday,
  };
}
export function applyReward(
  activity: Activity[],
  value: Rewards,
  operation: RewardOperation,
  now = new Date(),
): Rewards {
  const r = normalizeRewards(value);
  if (operation.type === "reward.collect" && !r.zone) r.zone = operation.zone;
  const status = rewardStatus(activity, r, now);
  if (operation.type === "reward.collect") {
    if (r.days.includes(status.today)) return r;
    if (!status.eligible)
      throw new Error(
        "Complete a task, module, checkpoint, or at least five minutes of focus first.",
      );
    r.days.push(status.today);
  } else if (operation.type === "reward.buy") {
    const cost =
      operation.item === "save" ? 30 : rewardItems[operation.item].cost;
    if (operation.item !== "save" && r.owned.includes(operation.item)) return r;
    if (operation.item === "save" && !status.canSave)
      throw new Error(
        "A streak save can protect yesterday when it follows an active day.",
      );
    if (status.balance < cost)
      throw new Error("You need more Sparks for this reward.");
    r.spent += cost;
    if (operation.item === "save") r.protectedDays.push(status.yesterday);
    else r.owned.push(operation.item);
  } else {
    if (operation.item === "no-frame") r.frame = false;
    else if (operation.item === "default") r.theme = "default";
    else {
      if (!r.owned.includes(operation.item))
        throw new Error("Unlock this reward first.");
      if (operation.item === "orbit") r.frame = true;
      else r.theme = operation.item;
    }
  }
  return r;
}
