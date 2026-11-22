import { dayKey } from "./workspace.ts";
export function habitRun(
  h: { days: number[]; completed: string[] },
  now = new Date(),
) {
  const d = new Date(now);
  const completed = new Set(h.completed);
  const scheduled = new Set(h.days);
  let count = 0;
  if (!completed.has(dayKey(d))) d.setDate(d.getDate() - 1);
  for (let i = 0; i < 3660; i++) {
    if (scheduled.has(d.getDay())) {
      if (!completed.has(dayKey(d))) break;
      count++;
    }
    d.setDate(d.getDate() - 1);
  }
  return count;
}
