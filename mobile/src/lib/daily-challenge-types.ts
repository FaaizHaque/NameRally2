/**
 * Daily Challenge Types
 * Types for the daily challenge feature where players compete on the same challenge
 */

import type { LevelCategoryType } from './level-types';

export interface DailyChallenge {
  id: string;
  date: string; // YYYY-MM-DD format
  letter: string; // Single letter or combo for ALL categories
  categories: LevelCategoryType[];
  createdAt: number;
}

export interface DailyChallengeAnswer {
  category: LevelCategoryType;
  letter: string;
  answer: string;
  isValid: boolean;
  score: number;
  timeMs: number; // Time taken to fill this answer in milliseconds
  hasSpeedBonus: false; // kept for schema compatibility, always false
}

export interface DailyChallengeResult {
  id: string;
  challengeId: string;
  date: string;
  username: string;
  answers: DailyChallengeAnswer[];
  totalScore: number;
  totalTimeMs: number; // Total time to complete all categories
  completedAt: number;
  shareCode: string; // Unique code to share with friends
}

export interface DailyChallengeState {
  // Current daily challenge
  currentChallenge: DailyChallenge | null;

  // User's result for today
  todayResult: DailyChallengeResult | null;

  // Has user completed today's challenge
  hasCompletedToday: boolean;

  // Loading states
  isLoadingChallenge: boolean;

  // Active game state
  isPlaying: boolean;
  startTime: number | null;
  categoryStartTimes: Record<LevelCategoryType, number>; // When each category input was focused
  answers: Record<LevelCategoryType, string>;
  answerTimes: Record<LevelCategoryType, number>; // Time taken for each answer
}

export const BASE_CORRECT_POINTS = 10;
export const DAILY_CHALLENGE_CATEGORY_COUNT = 6;
export const DAILY_CHALLENGE_TIME_LIMIT_S = 60; // 1-minute countdown

/**
 * Calculate score for a single answer (no speed bonus)
 */
export function calculateAnswerScore(isValid: boolean, _timeMs: number): { score: number; hasSpeedBonus: boolean } {
  if (!isValid) {
    return { score: 0, hasSpeedBonus: false };
  }
  return { score: BASE_CORRECT_POINTS, hasSpeedBonus: false };
}

/**
 * Generate a share message for the challenge result
 */
export function generateShareMessage(result: DailyChallengeResult, challenge: DailyChallenge): string {
  const correctCount = result.answers.filter(a => a.isValid).length;
  const totalTime = Math.floor(result.totalTimeMs / 1000);
  const minutes = Math.floor(totalTime / 60);
  const seconds = totalTime % 60;
  const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  // Create result grid (emoji-based)
  const grid = result.answers.map(a => a.isValid ? '✅' : '❌').join('');

  return `NAPT Daily Challenge — ${result.date}

${grid}
Letter: ${challenge.letter}
Score: ${result.totalScore} pts · ${correctCount}/6 correct
Time: ${timeStr}

Can you beat my score? Download NAPT on the App Store:
https://apps.apple.com/app/id6759828697`;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}
