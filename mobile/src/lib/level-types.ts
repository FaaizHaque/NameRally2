/**
 * Level Types for Single Player Progression System
 * Mirrors the backend types for type safety
 */

export type LevelCategoryType =
  | 'names'
  | 'places'
  | 'animal'
  | 'thing'
  | 'fruits_vegetables'
  | 'sports_games'
  | 'brands'
  | 'health_issues'
  // Advanced categories (unlocked at higher levels)
  | 'countries'
  | 'professions'
  | 'food_dishes'
  | 'celebrities';

export interface LevelConstraint {
  type: 'none' | 'no_common_words' | 'min_word_length' | 'no_repeat_letters' | 'time_pressure' | 'survival' | 'ends_with_letter' | 'double_letters' | 'max_word_length' | 'contains_vowel' | 'odd_length' | 'combo';
  value?: number;
  endLetter?: string;
  comboConstraints?: Array<{
    type: LevelConstraint['type'];
    value?: number;
    endLetter?: string;
  }>;
  description: string;
}

export interface LevelData {
  level: number;
  band: number;
  bandName: string;
  timerSeconds: number;
  letter: string;
  letterType: 'easy' | 'normal' | 'hard' | 'two_letter';
  categories: LevelCategoryType[];
  categoryCount: number;
  passScorePercent: number;
  maxPossibleScore: number;
  minScoreToPass: number;
  constraint: LevelConstraint;
  isSurvivalMode: boolean;
  bonusMultiplier: number;
  // Multi-letter mode fields
  isMultiLetterMode?: boolean;
  lettersPerCategory?: string[];
}

export interface DifficultyBand {
  bandNumber: number;
  name: string;
  levelRange: [number, number];
  description: string;
  timerRange: [number, number];
  passScoreRange: [number, number];
  categoryCountRange: [number, number];
  letterDifficulty: 'easy' | 'normal' | 'hard' | 'mixed' | 'two_letter';
  constraintTypes: LevelConstraint['type'][];
  survivalModeChance: number;
  bonusMultiplierRange: [number, number];
  availableCategories: LevelCategoryType[];
}

export interface LevelProgress {
  unlockedLevel: number; // Highest level player can attempt (starts at 1)
  levelScores: Record<number, number>; // Best score for each completed level
  levelStars: Record<number, number>; // Stars earned per level (1-3)
  totalStars: number; // Total stars earned across all levels
  totalPoints: number; // Sum of best scores from all completed levels
  milestoneStarsAwarded?: number; // Total milestone bonus stars already awarded (every 100 pts = 5 stars)
}

/**
 * Calculate stars based on score — thresholds tied to category count.
 *
 * catCount 3–4:   2★ = 75%  3★ = 90%
 * catCount 5–7:   2★ = 78%  3★ = 92%
 * catCount 8–10:  2★ = 82%  3★ = 95%
 * catCount 11–12: 2★ = 85%  3★ = 100% (perfect score only)
 */
export function calculateStars(score: number, maxScore: number, minToPass: number): number {
  if (score < minToPass) return 0;
  const catCount = maxScore / 10;
  const pct = (score / maxScore) * 100;

  let two: number, three: number;
  if (catCount <= 4)       { two = 75; three = 90; }
  else if (catCount <= 7)  { two = 78; three = 92; }
  else if (catCount <= 10) { two = 82; three = 95; }
  else                     { two = 85; three = 100; }

  if (pct >= three) return 3;
  if (pct >= two)   return 2;
  return 1;
}

/**
 * Check if player passed a level
 */
export function didPassLevel(score: number, levelData: LevelData): boolean {
  return score >= levelData.minScoreToPass;
}
