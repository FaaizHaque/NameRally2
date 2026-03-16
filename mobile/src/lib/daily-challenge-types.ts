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
  hasSpeedBonus: boolean; // +2 points if answered in <= 5 seconds
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

// Speed bonus threshold in milliseconds (5 seconds)
export const SPEED_BONUS_THRESHOLD_MS = 5000;
export const SPEED_BONUS_POINTS = 2;
export const BASE_CORRECT_POINTS = 10;
export const DAILY_CHALLENGE_CATEGORY_COUNT = 6;

/**
 * Calculate score for a single answer
 */
export function calculateAnswerScore(isValid: boolean, timeMs: number): { score: number; hasSpeedBonus: boolean } {
  if (!isValid) {
    return { score: 0, hasSpeedBonus: false };
  }

  const hasSpeedBonus = timeMs <= SPEED_BONUS_THRESHOLD_MS;
  const score = BASE_CORRECT_POINTS + (hasSpeedBonus ? SPEED_BONUS_POINTS : 0);

  return { score, hasSpeedBonus };
}

/**
 * Generate a share message for the challenge result
 */
export function generateShareMessage(result: DailyChallengeResult, challenge: DailyChallenge): string {
  const correctCount = result.answers.filter(a => a.isValid).length;
  const speedBonusCount = result.answers.filter(a => a.hasSpeedBonus).length;
  const totalTime = Math.floor(result.totalTimeMs / 1000);
  const minutes = Math.floor(totalTime / 60);
  const seconds = totalTime % 60;
  const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  // Create result grid (emoji-based)
  const grid = result.answers.map(a => {
    if (!a.isValid) return '❌';
    if (a.hasSpeedBonus) return '⚡';
    return '✅';
  }).join('');

  return `NameRally Daily Challenge — ${result.date}

${grid}
Letter: ${challenge.letter}
Score: ${result.totalScore} pts · ${correctCount}/6 correct${speedBonusCount > 0 ? ` · ⚡${speedBonusCount}` : ''}
Time: ${timeStr}

Can you beat my score? Download NameRally on the App Store:
https://apps.apple.com/app/namerally`;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}
