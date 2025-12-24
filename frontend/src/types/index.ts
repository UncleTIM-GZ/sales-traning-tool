/**
 * TypeScript类型定义
 */

// ===== User =====
export interface User {
  id: string;
  email: string;
  name: string;
  track: "sales" | "social";
  role: "user" | "admin";
}

export interface Profile {
  id: string;
  userId: string;
  baselineScore: number | null;
  weakDimensions: string[];
  preferences: Record<string, unknown>;
  onboardingCompleted: boolean;
}

// ===== Scenario =====
export interface Scenario {
  id: string;
  name: string;
  track: "sales" | "social";
  mode: "train" | "exam" | "replay";
  difficulty: number;
  description: string | null;
  config: Record<string, unknown>;
  rubricVersion: string;
  status: "draft" | "published" | "archived";
}

export interface ScenarioPack {
  id: string;
  name: string;
  track: "sales" | "social";
  difficultyRange: number[];
  scenarioCount: number;
  status: "draft" | "published" | "archived";
}

// ===== Session =====
export interface Session {
  id: string;
  userId: string;
  scenarioId: string;
  mode: "train" | "exam" | "replay";
  seed: number | null;
  status: "pending" | "active" | "completed" | "aborted";
  startedAt: string | null;
  endedAt: string | null;
}

export interface Turn {
  turnNumber: number;
  role: "user" | "npc" | "coach";
  content: string;
  createdAt: string;
}

// ===== Report =====
export interface DimensionScore {
  name: string;
  weight: number;
  score: number;
  maxScore: number;
  evidence: { turn: number; text: string }[];
}

export interface Highlight {
  title: string;
  why: string;
  example: string;
}

export interface Issue {
  title: string;
  why: string;
  fix: string;
}

export interface Replacement {
  original: string;
  better: string;
}

export interface Report {
  id: string;
  sessionId: string;
  userId: string;
  rubricVersion: string;
  totalScore: number;
  dimensions: DimensionScore[];
  highlights: Highlight[];
  issues: Issue[];
  replacements: Replacement[];
  nextActions: {
    recommendedScenarios: string[];
    realWorldTask: string | null;
  } | null;
  metadata: {
    tokensUsed: number;
    latencyAvgMs: number;
    coachHintsUsed: number;
  } | null;
  createdAt: string;
}

// ===== Training =====
export interface TrainingPlan {
  id: string;
  userId: string;
  name: string;
  durationDays: number;
  dailyTasks: DailyTask[];
  status: "active" | "paused" | "completed";
  startedAt: string | null;
}

export interface DailyTask {
  day: number;
  tasks: {
    type: "learn" | "practice" | "review";
    title?: string;
    scenarioId?: string;
    durationMin: number;
  }[];
}

export interface TrainingProgress {
  userId: string;
  currentPlan: {
    id: string;
    name: string;
    day: number;
    totalDays: number;
    todayCompleted: number;
    todayTotal: number;
  } | null;
  stats: {
    totalSessions: number;
    totalDurationMin: number;
    avgScore: number;
    scoreTrend: number[];
  };
  streak: {
    current: number;
    longest: number;
  };
}

// ===== API Response =====
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export interface ApiError {
  detail: string;
  status: number;
}
