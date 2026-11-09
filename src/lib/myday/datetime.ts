/**
 * Timezone-aware date utilities.
 *
 * Prisma stores dates in UTC. To correctly determine "today" for a user
 * in a specific timezone, we convert the current UTC timestamp to that
 * timezone and extract the date portion.
 *
 * Example: UTC 2026-11-08T16:00:00Z  →  Asia/Tokyo  →  2026-11-09
 */

/**
 * Return the local date string (YYYY-MM-DD) for a user in the given timezone.
 * Uses `Intl.DateTimeFormat` which supports all IANA timezones.
 */
export function getLocalDateStr(now: Date, timezone: string): string {
  try {
    return now.toLocaleDateString("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
    // en-CA gives YYYY-MM-DD format
  } catch {
    // Fallback: ignore timezone and use UTC
    return now.toISOString().split("T")[0];
  }
}

/**
 * Return the current hour (0–23) in the user's timezone.
 */
export function getLocalHour(now: Date, timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).formatToParts(now);
    const hourPart = parts.find((p) => p.type === "hour");
    return hourPart ? parseInt(hourPart.value, 10) : now.getUTCHours();
  } catch {
    return now.getUTCHours();
  }
}

/**
 * Convert a reminder time string ("HH:MM") and user timezone into a check.
 * Returns true if the current local time is within the same hour as the reminder.
 *
 * Uses Intl.DateTimeFormat for proper IANA timezone support without external deps.
 */
export function isReminderTime(now: Date, reminderTimeStr: string, timezone: string): boolean {
  const [targetHourStr, targetMinStr] = reminderTimeStr.split(":");
  const targetHour = parseInt(targetHourStr || "0", 10);
  const targetMin = parseInt(targetMinStr || "0", 10);

  if (isNaN(targetHour) || targetHour < 0 || targetHour > 23) return false;

  try {
    const localParts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(now);

    const localHour = parseInt(
      localParts.find((p) => p.type === "hour")?.value || "0",
      10
    );
    const localMin = parseInt(
      localParts.find((p) => p.type === "minute")?.value || "0",
      10
    );

    return localHour === targetHour && localMin >= targetMin && localMin < targetMin + 10;
  } catch {
    // Fallback: strict UTC comparison
    return now.getUTCHours() === targetHour && now.getUTCMinutes() === targetMin;
  }
}

/**
 * Parse a "HH:MM" string into a Date at a given hour:minute (no date significance).
 */
export function parseReminderTime(timeStr: string): Date {
  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return new Date();
  const date = new Date();
  date.setUTCHours(h, m, 0, 0);
  return date;
}

/**
 * Get the start-of-day timestamp for a user in a given timezone.
 * Used to query DB for "today's" logs.
 */
export function getStartOfDay(now: Date, timezone: string): Date {
  const localStr = getLocalDateStr(now, timezone);
  // Return midnight UTC of that date — DB stores in UTC
  // We need to figure out what UTC time corresponds to local midnight
  // For simplicity, we store localDate as a Date at midnight UTC
  return new Date(localStr + "T00:00:00.000Z");
}
