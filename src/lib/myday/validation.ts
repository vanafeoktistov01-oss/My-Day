import { CHECKIN_LIMITS, type CheckinRequest } from "./types";

/**
 * Validate and sanitize check-in request data.
 * Returns validated data or null if invalid.
 */
export function validateCheckin(data: Partial<CheckinRequest>): {
  sleepHours: number | null;
  waterCups: number | null;
  mood: number | null;
  habitDone: boolean | null;
} | null {
  const { sleepHours, waterCups, mood, habitDone } = data;

  // Sleep hours
  let finalSleep: number | null = null;
  if (sleepHours !== undefined && sleepHours !== null) {
    const { min, max } = CHECKIN_LIMITS.sleepHours;
    if (typeof sleepHours !== "number" || sleepHours < min || sleepHours > max || isNaN(sleepHours)) {
      return null;
    }
    finalSleep = Math.round(sleepHours * 2) / 2; // round to nearest 0.5
  }

  // Water cups
  let finalWater: number | null = null;
  if (waterCups !== undefined && waterCups !== null) {
    const { min, max } = CHECKIN_LIMITS.waterCups;
    if (typeof waterCups !== "number" || !Number.isInteger(waterCups) || waterCups < min || waterCups > max || isNaN(waterCups)) {
      return null;
    }
    finalWater = waterCups;
  }

  // Mood
  let finalMood: number | null = null;
  if (mood !== undefined && mood !== null) {
    const { min, max } = CHECKIN_LIMITS.mood;
    if (typeof mood !== "number" || !Number.isInteger(mood) || mood < min || mood > max || isNaN(mood)) {
      return null;
    }
    finalMood = mood;
  }

  // Habit done
  let finalHabit: boolean | null = null;
  if (habitDone !== undefined && habitDone !== null) {
    if (typeof habitDone !== "boolean") {
      return null;
    }
    finalHabit = habitDone;
  }

  return {
    sleepHours: finalSleep,
    waterCups: finalWater,
    mood: finalMood,
    habitDone: finalHabit,
  };
}

/**
 * Sanitize telegramId: must be numeric string, 5-15 digits.
 */
export function sanitizeTelegramId(id: string | null): string | null {
  if (!id) return null;
  const cleaned = id.replace(/[^0-9]/g, "");
  if (cleaned.length < 5 || cleaned.length > 15) return null;
  return cleaned;
}

/**
 * Validate timezone is a recognized IANA timezone.
 */
const VALID_TIMEZONES = [
  "Europe/Moscow", "Asia/Samara", "Asia/Yekaterinburg", "Asia/Omsk",
  "Asia/Krasnoyarsk", "Asia/Novosibirsk", "Asia/Irkutsk", "Asia/Chita",
  "Asia/Sakhalin", "Asia/Vladivostok", "Asia/Seoul", "Asia/Tokyo",
  "Asia/Shanghai", "Asia/Singapore", "Asia/Dubai", "Europe/London",
  "Europe/Berlin", "Europe/Paris", "America/New_York", "America/Los_Angeles",
];

export function isValidTimezone(tz: string): boolean {
  if (VALID_TIMEZONES.includes(tz)) return true;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
