import type { MyDayDailyLog, InsightCondition } from "./types";
import { getLocalDateStr } from "./datetime";

/**
 * Evaluate an insight condition against a list of daily logs.
 * Used by both the Web API, Bot commands, and Cron jobs.
 */
export function evaluateCondition(
  condition: InsightCondition | null,
  logs: MyDayDailyLog[],
  timezone: string
): boolean {
  if (!condition) return false;

  const completedLogs = logs.filter((l) => l.status === "COMPLETED");

  switch (condition.type) {
    case "less_than":
      return evaluateLessThan(condition, completedLogs, timezone);
    case "greater_than":
      return evaluateGreaterThan(condition, completedLogs, timezone);
    case "streak":
      return evaluateStreak(condition, completedLogs, timezone);
    case "missed":
      return evaluateMissed(condition, completedLogs, timezone);
    case "mood_trend":
      return evaluateMoodTrend(condition, completedLogs);
    default:
      return false;
  }
}

function evaluateLessThan(
  condition: Extract<InsightCondition, { type: "less_than" }>,
  completedLogs: MyDayDailyLog[],
  timezone: string
): boolean {
  const field = condition.field as keyof MyDayDailyLog;
  const threshold = condition.threshold;
  const days = condition.days || 7;

  if (!field || threshold === undefined) return false;

  // Use user's local date for the window calculation
  const now = new Date();
  const sinceDateStr = getLocalDateStr(now, timezone);
  const since = new Date(sinceDateStr + "T00:00:00.000Z");
  const recentLogs = completedLogs.filter((l) => l.localDate >= since);

  if (recentLogs.length === 0) return false;

  const belowCount = recentLogs.filter(
    (l) => {
      const val = l[field];
      return val !== null && typeof val === "number" && val < threshold;
    }
  ).length;

  return belowCount >= (condition.minDays || 3);
}

function evaluateGreaterThan(
  condition: Extract<InsightCondition, { type: "greater_than" }>,
  completedLogs: MyDayDailyLog[],
  timezone: string
): boolean {
  const field = condition.field as keyof MyDayDailyLog;
  const threshold = condition.threshold;
  const days = condition.days || 7;

  if (!field || threshold === undefined) return false;

  const now = new Date();
  const sinceDateStr = getLocalDateStr(now, timezone);
  const since = new Date(sinceDateStr + "T00:00:00.000Z");
  const recentLogs = completedLogs.filter((l) => l.localDate >= since);

  if (recentLogs.length === 0) return false;

  const aboveCount = recentLogs.filter(
    (l) => {
      const val = l[field];
      return val !== null && typeof val === "number" && val >= threshold;
    }
  ).length;

  return aboveCount >= (condition.minDays || 3);
}

function evaluateStreak(
  condition: Extract<InsightCondition, { type: "streak" }>,
  completedLogs: MyDayDailyLog[],
  timezone: string
): boolean {
  if (!condition.minDays) return false;

  // Build a set of date strings for O(1) lookup
  const dateSet = new Set(
    completedLogs.map((l) => l.localDate.toISOString().split("T")[0])
  );

  let streak = 0;
  let checkDate = new Date();

  // Use user's local date
  const todayStr = getLocalDateStr(checkDate, timezone);
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

  return streak >= condition.minDays;
}

function evaluateMissed(
  condition: Extract<InsightCondition, { type: "missed" }>,
  completedLogs: MyDayDailyLog[],
  timezone: string
): boolean {
  const days = condition.days || 3;

  const now = new Date();
  const sinceDateStr = getLocalDateStr(now, timezone);
  const since = new Date(sinceDateStr + "T00:00:00.000Z");
  const recentLogs = completedLogs.filter((l) => l.localDate >= since);

  // If user missed more than 1 day in the last N days, trigger
  return recentLogs.length < (days - 1);
}

function evaluateMoodTrend(
  condition: Extract<InsightCondition, { type: "mood_trend" }>,
  completedLogs: MyDayDailyLog[]
): boolean {
  if (completedLogs.length < 5) return false;

  const mid = Math.floor(completedLogs.length / 2);
  const firstHalf = completedLogs.slice(0, mid);
  const secondHalf = completedLogs.slice(mid);

  const avgFirst = firstHalf.reduce((s, l) => s + (l.mood || 3), 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((s, l) => s + (l.mood || 3), 0) / secondHalf.length;

  if (condition.direction === "declining") return avgSecond < avgFirst - 0.5;
  if (condition.direction === "improving") return avgSecond > avgFirst + 0.5;
  return false;
}

/**
 * Get up to N insights that matched against the logs.
 */
export function getInsights(
  rules: { id: string; message: string; condition: InsightCondition | null }[],
  logs: MyDayDailyLog[],
  timezone: string
): Array<{ ruleId: string; message: string }> {
  const matched: Array<{ ruleId: string; message: string }> = [];

  for (const rule of rules) {
    if (evaluateCondition(rule.condition, logs, timezone)) {
      matched.push({ ruleId: rule.id, message: rule.message });
    }
  }

  return matched.slice(0, 3);
}
