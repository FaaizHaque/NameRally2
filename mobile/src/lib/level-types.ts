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
  | 'movies'
  | 'songs'
  | 'professions'
  | 'food_dishes'
  | 'historical_figures'
  | 'music_artists';

export interface LevelConstraint {
  type: 'none' | 'no_common_words' | 'min_word_length' | 'no_repeat_letters' | 'time_pressure' | 'survival' | 'ends_with_letter' | 'double_letters' | 'max_word_length' | 'combo';
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
}

/**
 * Calculate stars based on score percentage
 * 1 star: Pass (meet minimum)
 * 2 stars: Good (75%+ of max)
 * 3 stars: Perfect (90%+ of max)
 */
export function calculateStars(score: number, maxScore: number, minToPass: number): number {
  if (score < minToPass) return 0;
  const percentage = (score / maxScore) * 100;
  if (percentage >= 90) return 3;
  if (percentage >= 75) return 2;
  return 1;
}

/**
 * Check if player passed a level
 */
export function didPassLevel(score: number, levelData: LevelData): boolean {
  return score >= levelData.minScoreToPass;
}
