import type { MyDayDailyLog } from "./types";
import { getLocalDateStr } from "./datetime";

/**
 * Calculate the current streak — consecutive days ending today (or yesterday)
 * where status === "COMPLETED".
 *
 * Uses the user's timezone to determine what "today" means.
 */
export function calculateStreak(logs: MyDayDailyLog[], now: Date, timezone: string): number {
  const completedLogs = logs.filter((l) => l.status === "COMPLETED");
  if (completedLogs.length === 0) return 0;

  // Build a set of date strings (YYYY-MM-DD) for O(1) lookup
  const dateSet = new Set(
    completedLogs.map((l) => l.localDate.toISOString().split("T")[0])
  );

  let streak = 0;
  let checkDate = new Date(now);

  // Use user's local date, not UTC
  const todayStr = getLocalDateStr(now, timezone);
  if (!dateSet.has(todayStr)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const dateStr = getLocalDateStr(checkDate, timezone);
    if (dateSet.has(dateStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Calculate the maximum ever streak from a list of logs.
 */
export function calculateMaxStreak(logs: MyDayDailyLog[]): number {
  if (logs.length === 0) return 0;

  const sorted = [...logs].sort(
    (a, b) => a.localDate.getTime() - b.localDate.getTime()
  );

  let maxStreak = 0;
  let currentStreak = 0;

  for (const log of sorted) {
    if (log.status === "COMPLETED") {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  return maxStreak;
}

/**
 * Calculate average value for a field across completed logs.
 */
export function calculateAverage<T extends { [key: string]: unknown }>(
  logs: T[],
  field: keyof T,
  fallback: number = 3
): number | null {
  const completedLogs = logs.filter((l) => l.status === "COMPLETED");
  if (completedLogs.length === 0) return null;

  const total = completedLogs.reduce((sum, log) => {
    const val = log[field];
    return sum + (typeof val === "number" && !isNaN(val) ? val : fallback);
  }, 0);

  return Math.round((total / completedLogs.length) * 10) / 10;
}
