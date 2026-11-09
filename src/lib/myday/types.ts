// ==========================================
// Type definitions for "Мой День"
// ==========================================

// --- Models ---

export interface MyDayProfile {
  id: string;
  telegramId: string;
  onboardedAt: Date | null;
  timezone: string;
  reminderTime: Date | null;
  trialStartedAt: Date | null;
  proActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MyDayDailyLog {
  id: number;
  profileId: string;
  localDate: Date;
  sleepHours: number | null;
  waterCups: number | null;
  mood: number | null;
  habitDone: boolean | null;
  status: "COMPLETED" | "UNKNOWN";
  createdAt: Date;
  updatedAt: Date;
}

export interface MyDayHabit {
  id: string;
  profileId: string;
  title: string;
  icon: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MyDayInsightRule {
  id: string;
  profileId: string | null;
  condition: InsightCondition | null;
  message: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MyDayReminderTask {
  id: string;
  profileId: string;
  createdAt: Date;
  lastRetryAt: Date | null;
  retryCount: number;
  maxRetries: number;
  isActive: boolean;
  sentAt: Date | null;
}

// --- Insight Condition Types ---

export type InsightCondition =
  | { type: "less_than"; field: string; threshold: number; days?: number; minDays?: number }
  | { type: "greater_than"; field: string; threshold: number; days?: number; minDays?: number }
  | { type: "streak"; minDays: number }
  | { type: "missed"; days?: number; field?: string }
  | { type: "mood_trend"; direction: "declining" | "improving" };

// --- API Response Types ---

export interface StatsResponse {
  streak: number;
  maxStreak: number;
  totalLogs: number;
  heatmap: { date: string; completed: boolean }[];
  habits: MyDayHabit[];
  avgSleep: number | null;
  avgWater: number | null;
  avgMood: number | null;
}

export interface InsightResponse {
  ruleId: string;
  message: string;
}

export interface InsightsResponse {
  insights: InsightResponse[];
}

export interface CheckinRequest {
  telegramId: string;
  sleepHours?: number | null;
  waterCups?: number | null;
  mood?: number | null;
  habitDone?: boolean | null;
}

export interface ProfileUpdateRequest {
  telegramId: string;
  timezone?: string;
  reminderTime?: string; // ISO time string, e.g. "09:00"
}

// --- Validation Constraints ---

export const CHECKIN_LIMITS = {
  sleepHours: { min: 0, max: 24, step: 0.5 },
  waterCups: { min: 0, max: 50 },
  mood: { min: 1, max: 5 },
  habitDone: { valid: [true, false, null] } as const,
} as const;
