/**
 * Level Generator - Sequential Progression System
 *
 * Design principles:
 *   - Players go through levels 1, 2, 3, ... sequentially (no band selection screen)
 *   - Every 5th level introduces a NEW category or constraint to keep things fresh
 *   - Difficulty ramps gradually: timer shrinks, categories increase, constraints stack
 *   - Letters are assigned deterministically (seeded RNG based on level number)
 *   - Impossible letter-category combos are always filtered out
 *   - Bands exist internally for metadata but are invisible to the player
 */

// ============================================
// TYPE DEFINITIONS (all existing exports preserved)
// ============================================

export type CategoryType =
  | 'names'
  | 'places'
  | 'animal'
  | 'thing'
  | 'fruits_vegetables'
  | 'sports_games'
  | 'brands'
  | 'health_issues'
  | 'countries'
  | 'movies'
  | 'songs'
  | 'professions'
  | 'food_dishes'
  | 'historical_figures';

export interface LevelConstraint {
  type:
    | 'none'
    | 'no_common_words'
    | 'min_word_length'
    | 'no_repeat_letters'
    | 'time_pressure'
    | 'survival'
    | 'ends_with_letter'
    | 'double_letters'
    | 'max_word_length'
    | 'combo';
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

  // Timing
  timerSeconds: number;

  // Letter configuration
  letter: string;
  letterType: 'easy' | 'normal' | 'hard';
  lettersPerCategory?: string[];
  isMultiLetterMode?: boolean;

  // Categories
  categories: CategoryType[];
  categoryCount: number;

  // Scoring
  passScorePercent: number;
  maxPossibleScore: number;
  minScoreToPass: number;

  // Constraints
  constraint: LevelConstraint;
  isSurvivalMode: boolean;

  // Bonuses
  bonusMultiplier: number;
}

export interface DifficultyBand {
  bandNumber: number;
  name: string;
  levelRange: [number, number];
  description: string;

  timerRange: [number, number];
  passScoreRange: [number, number];
  categoryCountRange: [number, number];
  letterDifficulties: Array<'easy' | 'normal' | 'hard'>;
  constraintPool: LevelConstraint['type'][];
  allowComboConstraints: boolean;
  survivalModeChance: number;
  bonusMultiplierRange: [number, number];
  availableCategories: CategoryType[];
  multiLetterMode?: boolean;
}

// ============================================
// SEEDED RANDOM
// ============================================

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const temp = result[i]!;
      result[i] = result[j]!;
      result[j] = temp;
    }
    return result;
  }

  pick<T>(array: T[]): T {
    return array[Math.floor(this.next() * array.length)]!;
  }

  pickMultiple<T>(array: T[], count: number): T[] {
    const shuffled = this.shuffle(array);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }
}

// ============================================
// UTILITIES
// ============================================

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * Math.min(1, Math.max(0, t));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ============================================
// LETTER POOLS
// ============================================

const LETTER_POOLS = {
  easy: ['S', 'M', 'B', 'T', 'C', 'P', 'R', 'D', 'L', 'F'],
  normal: [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'R', 'S', 'T', 'U', 'V', 'W',
  ],
  hard: ['I', 'J', 'K', 'O', 'U', 'V', 'Q', 'Y', 'Z'],
  endLetters: ['A', 'E', 'N', 'R', 'S', 'T', 'Y', 'D', 'L', 'M'],
};

// ============================================
// IMPOSSIBLE LETTER-CATEGORY COMBINATIONS
// ============================================

const IMPOSSIBLE_COMBOS: Record<string, CategoryType[]> = {
  X: [
    'animal', 'names', 'places', 'sports_games', 'food_dishes', 'thing',
    'health_issues', 'brands', 'professions', 'historical_figures', 'countries',
    'movies', 'songs', 'fruits_vegetables',
  ],
  Q: [
    'animal', 'names', 'sports_games', 'food_dishes', 'thing',
    'health_issues', 'brands', 'professions', 'historical_figures', 'songs', 'fruits_vegetables',
  ],
  Z: [
    'sports_games', 'food_dishes', 'thing', 'health_issues', 'professions',
    'songs', 'historical_figures', 'fruits_vegetables',
  ],
  Y: [
    'health_issues', 'sports_games', 'professions', 'historical_figures', 'thing',
    'brands', 'food_dishes', 'fruits_vegetables',
  ],
  U: ['health_issues', 'sports_games', 'thing', 'historical_figures'],
  V: ['sports_games', 'health_issues', 'thing', 'historical_figures'],
  K: ['health_issues', 'historical_figures', 'thing'],
  J: ['health_issues', 'sports_games', 'thing', 'historical_figures'],
  I: ['sports_games', 'thing', 'health_issues'],
  O: ['health_issues', 'sports_games', 'thing'],
  W: ['health_issues'],
};

// ============================================
// ENDS-WITH RESTRICTED COMBOS
// ============================================

const ENDS_WITH_RESTRICTED: Record<string, CategoryType[]> = {
  J: [
    'animal', 'thing', 'places', 'names', 'brands', 'food_dishes', 'movies',
    'songs', 'professions', 'countries', 'historical_figures', 'health_issues',
    'sports_games',
  ],
  Q: [
    'animal', 'thing', 'places', 'names', 'brands', 'food_dishes', 'movies',
    'songs', 'professions', 'countries', 'historical_figures', 'health_issues',
    'sports_games',
  ],
  X: [
    'animal', 'thing', 'places', 'names', 'brands', 'food_dishes', 'movies',
    'songs', 'professions', 'countries', 'historical_figures', 'health_issues',
    'sports_games',
  ],
  Z: [
    'animal', 'thing', 'places', 'names', 'brands', 'food_dishes', 'movies',
    'songs', 'professions', 'countries', 'historical_figures', 'health_issues',
    'sports_games',
  ],
  Y: [
    'animal', 'thing', 'places', 'brands', 'food_dishes', 'professions',
    'historical_figures', 'health_issues', 'sports_games',
  ],
  U: [
    'animal', 'thing', 'brands', 'professions', 'historical_figures',
    'health_issues', 'sports_games',
  ],
  V: [
    'animal', 'thing', 'brands', 'professions', 'historical_figures',
    'health_issues', 'sports_games',
  ],
  K: ['thing', 'professions', 'historical_figures', 'health_issues', 'sports_games'],
  I: ['thing', 'professions', 'sports_games'],
  O: ['thing', 'health_issues', 'sports_games', 'professions'],
};

// ============================================
// PRE-DEFINED WARMUP LETTER SEQUENCE (levels 1-25)
// ============================================

const WARMUP_LETTER_SEQUENCE: string[] = [
  'S', 'M', 'B', 'T', 'C', 'P', 'R', 'D', 'L', 'F',
  'H', 'G', 'N', 'W', 'A', 'E', 'T', 'S', 'C', 'M',
  'P', 'B', 'R', 'L', 'D',
];

// ============================================
// CATEGORY INTRODUCTION SCHEDULE
// Levels 1-4: BASICS (Name, Place, Animal, Thing) - warm up
// Level 2+: Add ONE new category EVERY LEVEL - constant variety, never boring!
// ============================================

interface CategoryMilestone {
  level: number;
  category: CategoryType;
}

// New categories unlocked EVERY LEVEL - keeps it fresh and exciting throughout
const CATEGORY_MILESTONES: CategoryMilestone[] = [
  { level: 2, category: 'sports_games' },        // 5 categories from level 2
  { level: 3, category: 'brands' },              // 6 categories from level 3
  { level: 4, category: 'countries' },           // 7 categories from level 4
  { level: 5, category: 'food_dishes' },         // 8 categories from level 5
  { level: 6, category: 'professions' },         // 9 categories from level 6
  { level: 7, category: 'movies' },              // 10 categories from level 7
  { level: 8, category: 'songs' },               // 11 categories from level 8
  { level: 9, category: 'health_issues' },       // 12 categories from level 9
  { level: 10, category: 'historical_figures' }, // 13 categories from level 10
  { level: 11, category: 'fruits_vegetables' },  // 14 categories from level 11
];

/** The four starter categories always available from level 1 */
const STARTER_CATEGORIES: CategoryType[] = ['names', 'places', 'animal', 'thing'];

/**
 * Return the full set of unlocked categories for a given level number.
 */
function getAvailableCategories(level: number): CategoryType[] {
  const cats: CategoryType[] = [...STARTER_CATEGORIES];
  for (const milestone of CATEGORY_MILESTONES) {
    if (level >= milestone.level) {
      cats.push(milestone.category);
    }
  }
  return cats;
}

// ============================================
// CONSTRAINT INTRODUCTION SCHEDULE
// Smooth progression: easy constraints early, harder ones later
// EASY: min_word_length, max_word_length
// MEDIUM: ends_with_letter, double_letters
// HARD: no_repeat_letters, no_common_words
// VERY HARD: combo, survival, time_pressure
// ============================================

interface ConstraintMilestone {
  level: number;
  type: LevelConstraint['type'];
}

// Constraints introduced gradually - easy first, progressively harder
const CONSTRAINT_MILESTONES: ConstraintMilestone[] = [
  { level: 20, type: 'min_word_length' },       // EASY: 4+ letter words (level 20)
  { level: 35, type: 'max_word_length' },       // EASY: max length limit (level 35)
  { level: 50, type: 'ends_with_letter' },      // MEDIUM: ends with specific letter (level 50)
  { level: 70, type: 'double_letters' },        // MEDIUM: words with double letters (level 70)
  { level: 95, type: 'no_repeat_letters' },     // HARD: no repeating letters (level 95)
  { level: 130, type: 'no_common_words' },      // HARD: avoid common words (level 130)
  { level: 190, type: 'combo' },                // VERY HARD: multiple constraints (level 190)
  { level: 260, type: 'survival' },             // VERY HARD: one wrong = fail (level 260)
  { level: 350, type: 'time_pressure' },        // VERY HARD: reduced time (level 350)
];

/**
 * Build the pool of constraint types available at a given level.
 * Smooth difficulty curve: constraints start appearing occasionally, then more frequently.
 */
function getConstraintPool(level: number): LevelConstraint['type'][] {
  const pool: LevelConstraint['type'][] = ['none'];
  for (const milestone of CONSTRAINT_MILESTONES) {
    if (level >= milestone.level) {
      pool.push(milestone.type);
    }
  }

  // Smooth weighting: 'none' stays common until much later
  // Prevents constraint overload while keeping progression fresh
  let noneWeight = 1;
  if (level < 50) noneWeight = 8;           // Levels 1-49: constraints are rare (1 in 9 chance)
  else if (level < 100) noneWeight = 5;     // Levels 50-99: constraints appear more (1 in 6 chance)
  else if (level < 150) noneWeight = 3;     // Levels 100-149: constraints common (1 in 4 chance)
  else if (level < 200) noneWeight = 2;     // Levels 150-199: constraints very common (1 in 3 chance)
  else noneWeight = 1;                      // Levels 200+: constraints always present

  for (let i = 1; i < noneWeight; i++) pool.push('none');

  return pool;
}

// ============================================
// CONSTRAINT PLAYABILITY CHECKS
// ============================================

function isConstraintPlayable(
  letter: string,
  category: CategoryType,
  constraintType: LevelConstraint['type']
): boolean {
  if (constraintType === 'ends_with_letter') {
    const restricted = ENDS_WITH_RESTRICTED[letter];
    if (restricted && restricted.includes(category)) return false;
  }

  if (constraintType === 'no_repeat_letters') {
    const hardLetters = ['Q', 'X', 'Z', 'J', 'K'];
    if (hardLetters.includes(letter)) return false;
  }

  if (constraintType === 'double_letters') {
    const hardLetters = ['Q', 'X', 'Z', 'J', 'Y', 'K', 'V', 'U'];
    if (hardLetters.includes(letter)) return false;
  }

  return true;
}

function isPlayableForAll(
  letter: string,
  categories: CategoryType[],
  constraintType: LevelConstraint['type'],
  lettersPerCategory?: string[]
): boolean {
  if (lettersPerCategory) {
    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      const ltr = lettersPerCategory[i];
      if (cat && ltr && !isConstraintPlayable(ltr, cat, constraintType)) {
        return false;
      }
    }
  } else {
    for (const cat of categories) {
      if (!isConstraintPlayable(letter, cat, constraintType)) return false;
    }
  }
  return true;
}

// ============================================
// DIFFICULTY SCALING FUNCTIONS
// All scaling uses the raw level number so progression is smooth.
// ============================================

/**
 * Timer in seconds per category - smooth gradual progression.
 * Level 1-25: Gradual decrease from 18s → 16s (learning phase, safe)
 * Level 26-75: Gradual decrease from 16s → 13s (constraints introduced gently)
 * Level 76-150: Gradual decrease from 13s → 10s (ramping up difficulty)
 * Level 150+: Gradual decrease from 10s → 5s (expert level squeeze)
 *
 * No sudden jumps - smooth curve throughout.
 */
function getBaseTimerSeconds(level: number): number {
  if (level <= 1) return 18;

  // Smooth interpolation throughout the entire range
  let seconds: number;

  if (level <= 25) {
    // 18s → 16s over 25 levels
    seconds = lerp(18, 16, (level - 1) / 24);
  } else if (level <= 75) {
    // 16s → 13s over 50 levels
    seconds = lerp(16, 13, (level - 25) / 50);
  } else if (level <= 150) {
    // 13s → 10s over 75 levels
    seconds = lerp(13, 10, (level - 75) / 75);
  } else {
    // 10s → 5s over remaining levels (level 150 to 400+)
    const progress = Math.min((level - 150) / 250, 1);
    const curved = Math.sqrt(progress); // slightly front-load for pacing
    seconds = lerp(10, 5, curved);
  }

  return Math.round(seconds);
}

/**
 * Number of categories per level.
 * Levels 1-4: Always 4 categories (starter categories)
 * Level 5+: Gradually increases as more categories unlock
 *
 * The formula ensures:
 * - Levels 1-4: exactly 4 categories
 * - Level 5-9: 4-5 categories
 * - Level 10-14: 5-6 categories
 * - Level 15-19: 5-6 categories
 * - Level 20-24: 5-7 categories
 * - Level 25+: continues scaling up to max 8
 */
function getCategoryCount(level: number, rng: SeededRandom): number {
  // Levels 1-4: Always exactly 4 starter categories
  if (level <= 4) {
    return 4;
  }

  // Calculate how many categories are unlocked at this level
  const unlockedCategories = getAvailableCategories(level).length;

  // Base minimum starts at 4, increases every 10 levels
  const baseMin = Math.min(4 + Math.floor((level - 5) / 10), 6);

  // Maximum is either all unlocked categories or 8, whichever is smaller
  // But we don't want to always use ALL categories - leave room for variety
  const maxCategories = Math.min(unlockedCategories, 8);

  // The actual max for this level scales with level progress
  const scaledMax = Math.min(baseMin + 2, maxCategories);

  // Random selection between min and max
  return rng.nextInt(baseMin, scaledMax);
}

/**
 * Pass score percent - smooth gradual increases.
 * Level 1-50: Gradual increase from 50% → 58% (learning and easy constraints)
 * Level 51-150: Gradual increase from 58% → 75% (getting serious)
 * Level 150+: Gradual increase from 75% → 95% (expert level challenge)
 */
function getPassScorePercent(level: number): number {
  if (level <= 1) return 50;

  let passPercent: number;

  if (level <= 50) {
    // 50% → 58% over 50 levels (forgiving at start)
    passPercent = lerp(50, 58, (level - 1) / 49);
  } else if (level <= 150) {
    // 58% → 75% over 100 levels (steady increase)
    passPercent = lerp(58, 75, (level - 50) / 100);
  } else {
    // 75% → 95% over remaining levels (expert squeeze)
    const progress = Math.min((level - 150) / 250, 1);
    passPercent = lerp(75, 95, progress);
  }

  return Math.round(passPercent);
}

/**
 * Bonus multiplier.
 * 1.0 at level 1, up to 2.0 at level 500.
 */
function getBonusMultiplier(level: number): number {
  const progress = Math.min(level / 500, 1);
  return Number(lerp(1.0, 2.0, progress).toFixed(2));
}

/**
 * Survival mode probability.
 * 0% before level 100, ramps to ~60% by level 400+.
 */
function getSurvivalChance(level: number): number {
  if (level < 100) return 0;
  const progress = Math.min((level - 100) / 300, 1);
  return lerp(0.05, 0.6, progress);
}

/**
 * Maximum number of combo sub-constraints based on level.
 */
function getMaxComboCount(level: number): number {
  if (level >= 300) return 3;
  return 2;
}

// ============================================
// LETTER SELECTION
// ============================================

function getLetterDifficultyPool(level: number): Array<'easy' | 'normal' | 'hard'> {
  if (level <= 25) return ['easy'];
  if (level <= 75) return ['easy', 'easy', 'normal'];
  if (level <= 150) return ['easy', 'normal', 'normal'];
  if (level <= 250) return ['normal', 'normal', 'hard'];
  if (level <= 350) return ['normal', 'hard', 'hard'];
  return ['hard', 'hard', 'normal'];
}

function getValidCategoryCount(letter: string, categories: CategoryType[]): number {
  const impossible = IMPOSSIBLE_COMBOS[letter] ?? [];
  return categories.filter((c) => !impossible.includes(c)).length;
}

const MIN_VALID_CATEGORIES_FOR_LETTER = 3;

function selectLetter(
  level: number,
  rng: SeededRandom,
  availableCategories: CategoryType[]
): { letter: string; type: LevelData['letterType'] } {
  // Warmup: deterministic sequence
  if (level >= 1 && level <= 25) {
    const letter = WARMUP_LETTER_SEQUENCE[level - 1] ?? 'S';
    return { letter, type: 'easy' };
  }

  const diffPool = getLetterDifficultyPool(level);
  const difficulty = rng.pick(diffPool);

  const tryPool = (pool: string[]): string | null => {
    const shuffled = rng.shuffle([...pool]);
    for (const l of shuffled) {
      if (getValidCategoryCount(l, availableCategories) >= MIN_VALID_CATEGORIES_FOR_LETTER) {
        return l;
      }
    }
    return null;
  };

  let pool: string[];
  let type: LevelData['letterType'];

  switch (difficulty) {
    case 'easy':
      pool = LETTER_POOLS.easy;
      type = 'easy';
      break;
    case 'normal':
      pool = LETTER_POOLS.normal;
      type = 'normal';
      break;
    case 'hard':
      pool = LETTER_POOLS.hard;
      type = 'hard';
      break;
  }

  let letter = tryPool(pool);
  if (!letter && type === 'hard') {
    letter = tryPool(LETTER_POOLS.normal);
    if (letter) type = 'normal';
  }
  if (!letter) {
    letter = tryPool(LETTER_POOLS.easy);
    if (letter) type = 'easy';
  }
  if (!letter) {
    letter = 'S';
    type = 'easy';
  }

  return { letter, type };
}

/**
 * Select different letters for multi-letter mode (level 200+).
 */
function selectMultipleLetters(
  level: number,
  rng: SeededRandom,
  categories: CategoryType[]
): string[] {
  const letters: string[] = [];
  const used = new Set<string>();
  const diffPool = getLetterDifficultyPool(level);

  for (let i = 0; i < categories.length; i++) {
    const category = categories[i]!;
    const impossible = IMPOSSIBLE_COMBOS as Record<string, CategoryType[]>;
    let found = false;

    for (let attempt = 0; attempt < 100; attempt++) {
      const diff = rng.pick(diffPool);
      let pool: string[];
      switch (diff) {
        case 'easy':  pool = LETTER_POOLS.easy; break;
        case 'normal': pool = LETTER_POOLS.normal; break;
        case 'hard':  pool = LETTER_POOLS.hard; break;
      }
      const letter = rng.pick(pool);
      const blocked = impossible[letter] ?? [];
      if (!blocked.includes(category) && !used.has(letter)) {
        letters.push(letter);
        used.add(letter);
        found = true;
        break;
      }
    }

    if (!found) {
      // Fallback: pick any safe easy letter
      const safe = LETTER_POOLS.easy.filter((l) => {
        const blocked = impossible[l] ?? [];
        return !blocked.includes(category) && !used.has(l);
      });
      const letter = safe.length > 0 ? rng.pick(safe) : 'S';
      letters.push(letter);
      used.add(letter);
    }
  }
  return letters;
}

// ============================================
// CATEGORY SELECTION
// ============================================

function selectCategories(
  level: number,
  rng: SeededRandom,
  count: number,
  letter: string
): CategoryType[] {
  // Levels 1-4: Always use exactly the 4 starter categories
  if (level <= 4) {
    const impossible = IMPOSSIBLE_COMBOS[letter] ?? [];
    const validStarters = STARTER_CATEGORIES.filter((c) => !impossible.includes(c));
    // If some starters are impossible with this letter, fill with what we can
    if (validStarters.length < 4) {
      // This shouldn't happen with easy letters, but just in case
      return rng.shuffle(validStarters);
    }
    return rng.shuffle([...STARTER_CATEGORIES]);
  }

  const available = getAvailableCategories(level);
  const impossible = IMPOSSIBLE_COMBOS[letter] ?? [];
  const valid = available.filter((c) => !impossible.includes(c));

  // Shuffle the valid pool
  const shuffled = rng.shuffle(valid);

  // Pick one by one, enforcing mutual exclusions as we go
  const picked: CategoryType[] = [];
  for (const cat of shuffled) {
    if (picked.length >= count) break;
    // Mutual exclusion: countries and places never together
    if (cat === 'countries' && picked.includes('places')) continue;
    if (cat === 'places' && picked.includes('countries')) continue;
    // Mutual exclusion: fruits_vegetables and food_dishes never together
    if (cat === 'fruits_vegetables' && picked.includes('food_dishes')) continue;
    if (cat === 'food_dishes' && picked.includes('fruits_vegetables')) continue;
    picked.push(cat);
  }

  // At milestone levels, guarantee the newly introduced category is included
  const milestone = CATEGORY_MILESTONES.find((m) => m.level === level);
  if (milestone && valid.includes(milestone.category) && !picked.includes(milestone.category)) {
    const milCat = milestone.category;
    // Check mutual exclusion for milestone category
    const conflicts =
      (milCat === 'countries' && picked.includes('places')) ||
      (milCat === 'places' && picked.includes('countries')) ||
      (milCat === 'fruits_vegetables' && picked.includes('food_dishes')) ||
      (milCat === 'food_dishes' && picked.includes('fruits_vegetables'));
    if (!conflicts) {
      if (picked.length >= count) picked.pop();
      picked.push(milCat);
    }
  }

  return rng.shuffle(picked);
}

// ============================================
// CONSTRAINT SELECTION
// ============================================

function createSingleConstraint(
  type: LevelConstraint['type'],
  level: number,
  letter: string,
  rng: SeededRandom,
  lettersPerCategory?: string[]
): LevelConstraint {
  switch (type) {
    case 'none':
      return { type: 'none', description: 'No special constraints' };

    case 'no_common_words':
      return { type: 'no_common_words', description: 'Avoid common/obvious answers' };

    case 'min_word_length': {
      const hardLetters = ['Q', 'X', 'Z', 'J', 'Y', 'K', 'V', 'U'];
      let hasHard = hardLetters.includes(letter);
      if (lettersPerCategory) {
        hasHard = lettersPerCategory.some((l) => hardLetters.includes(l));
      }
      const minLength = hasHard
        ? Math.min(4 + Math.floor(level / 200), 5)
        : Math.min(4 + Math.floor(level / 100), 7);
      return {
        type: 'min_word_length',
        value: minLength,
        description: `Words must be ${minLength}+ letters`,
      };
    }

    case 'max_word_length': {
      const maxLength = Math.max(6, 10 - Math.floor(level / 150));
      return {
        type: 'max_word_length',
        value: maxLength,
        description: `Words must be ${maxLength} letters or less`,
      };
    }

    case 'no_repeat_letters':
      return { type: 'no_repeat_letters', description: 'No letter can repeat in your answer' };

    case 'time_pressure':
      return { type: 'time_pressure', description: 'Think fast! Reduced time' };

    case 'survival':
      return { type: 'survival', description: 'One invalid answer = level failed!' };

    case 'ends_with_letter': {
      const endLetter = rng.pick(LETTER_POOLS.endLetters);
      return {
        type: 'ends_with_letter',
        endLetter,
        description: `Words must end with "${endLetter}"`,
      };
    }

    case 'double_letters':
      return {
        type: 'double_letters',
        description: 'Words must contain double letters (ee, ll, ss...)',
      };

    default:
      return { type: 'none', description: 'No special constraints' };
  }
}

function selectConstraint(
  level: number,
  rng: SeededRandom,
  letter: string,
  categories: CategoryType[],
  lettersPerCategory?: string[]
): LevelConstraint {
  const pool = getConstraintPool(level);

  // For the very first few levels, keep it simple
  if (level < 30) {
    return { type: 'none', description: 'No special constraints' };
  }

  // At milestone levels (every 5th), increase chance of the newest constraint
  const isMilestone = level % 5 === 0;

  let constraintType = rng.pick(pool);

  // Very hard letters should avoid certain constraints
  const veryHardLetters = ['Q', 'X', 'Z'];
  const isVeryHard = veryHardLetters.includes(letter);

  if (isVeryHard && ['double_letters', 'ends_with_letter'].includes(constraintType)) {
    const alt = pool.filter(
      (c) => c !== 'double_letters' && c !== 'ends_with_letter' && c !== 'combo'
    );
    constraintType = alt.length > 0 ? rng.pick(alt) : 'none';
  }

  // Check playability across all categories
  if (
    constraintType !== 'none' &&
    constraintType !== 'combo' &&
    !isPlayableForAll(letter, categories, constraintType, lettersPerCategory)
  ) {
    const alt = pool.filter(
      (c) =>
        c !== constraintType &&
        c !== 'combo' &&
        (c === 'none' || isPlayableForAll(letter, categories, c, lettersPerCategory))
    );
    constraintType = alt.length > 0 ? rng.pick(alt) : 'none';
  }

  // Handle combo constraints
  if (constraintType === 'combo' && level >= 75) {
    const comboPool = pool.filter(
      (c) => c !== 'combo' && c !== 'none' && c !== 'survival'
    );
    // Filter to playable-only constraints
    const playable = comboPool.filter((c) =>
      isPlayableForAll(letter, categories, c, lettersPerCategory)
    );
    if (playable.length < 2) {
      // Not enough constraints for a combo; fall back
      return createSingleConstraint(
        playable[0] ?? 'none',
        level,
        letter,
        rng,
        lettersPerCategory
      );
    }

    const maxCombo = getMaxComboCount(level);
    const count = rng.nextInt(2, Math.min(maxCombo, playable.length));
    const selected = rng.pickMultiple(playable, count);

    const comboConstraints = selected.map((t) => {
      const c = createSingleConstraint(t, level, letter, rng, lettersPerCategory);
      return { type: c.type, value: c.value, endLetter: c.endLetter };
    });

    const descriptions = comboConstraints.map((c) => {
      if (c.type === 'min_word_length') return `${c.value}+ letters`;
      if (c.type === 'max_word_length') return `${c.value} letters or less`;
      if (c.type === 'ends_with_letter') return `ends with "${c.endLetter}"`;
      const full = createSingleConstraint(c.type, level, letter, rng, lettersPerCategory);
      return full.description;
    });

    return {
      type: 'combo',
      comboConstraints,
      description: descriptions.join(' + '),
    };
  }

  return createSingleConstraint(constraintType, level, letter, rng, lettersPerCategory);
}

// ============================================
// INTERNAL BAND SYSTEM
// Bands are used for metadata / labeling only.
// Players never see a band selection screen.
// ============================================

const DIFFICULTY_BANDS: DifficultyBand[] = [
  {
    bandNumber: 1,
    name: 'Warmup',
    levelRange: [1, 25],
    description: 'Learn the basics with 4 starter categories (Name, Place, Animal, Thing), then unlock new categories every 5 levels',
    timerRange: [18, 16],
    passScoreRange: [30, 45],
    categoryCountRange: [4, 5],
    letterDifficulties: ['easy'],
    constraintPool: ['none', 'min_word_length', 'ends_with_letter'],
    allowComboConstraints: false,
    survivalModeChance: 0,
    bonusMultiplierRange: [1.0, 1.0],
    availableCategories: ['names', 'places', 'animal', 'thing', 'sports_games', 'brands', 'countries', 'food_dishes', 'professions'],
  },
  {
    bandNumber: 2,
    name: 'Getting Started',
    levelRange: [26, 50],
    description: 'More categories unlock; more constraint types appear',
    timerRange: [14, 12],
    passScoreRange: [35, 50],
    categoryCountRange: [5, 6],
    letterDifficulties: ['easy', 'normal'],
    constraintPool: ['none', 'min_word_length', 'ends_with_letter', 'max_word_length', 'double_letters', 'no_repeat_letters'],
    allowComboConstraints: false,
    survivalModeChance: 0,
    bonusMultiplierRange: [1.0, 1.1],
    availableCategories: [
      'names', 'places', 'animal', 'thing', 'sports_games', 'brands',
      'countries', 'food_dishes', 'professions', 'movies', 'songs',
      'health_issues', 'historical_figures', 'fruits_vegetables',
    ],
  },
  {
    bandNumber: 3,
    name: 'Picking Up Speed',
    levelRange: [51, 100],
    description: 'All 14 categories unlocked, combo constraints introduced',
    timerRange: [12, 10],
    passScoreRange: [45, 60],
    categoryCountRange: [5, 7],
    letterDifficulties: ['easy', 'normal'],
    constraintPool: ['none', 'min_word_length', 'ends_with_letter', 'no_repeat_letters', 'max_word_length', 'double_letters', 'no_common_words', 'combo', 'survival'],
    allowComboConstraints: true,
    survivalModeChance: 0.05,
    bonusMultiplierRange: [1.1, 1.2],
    availableCategories: [
      'names', 'places', 'animal', 'thing', 'sports_games', 'brands',
      'countries', 'food_dishes', 'professions', 'movies', 'songs',
      'health_issues', 'historical_figures', 'fruits_vegetables',
    ],
  },
  {
    bandNumber: 4,
    name: 'Challenger',
    levelRange: [101, 200],
    description: 'Time pressure mode, harder letters emerge',
    timerRange: [10, 8],
    passScoreRange: [55, 72],
    categoryCountRange: [6, 7],
    letterDifficulties: ['normal', 'hard'],
    constraintPool: [
      'none', 'min_word_length', 'ends_with_letter', 'no_repeat_letters',
      'max_word_length', 'double_letters', 'no_common_words', 'combo',
      'survival', 'time_pressure',
    ],
    allowComboConstraints: true,
    survivalModeChance: 0.15,
    bonusMultiplierRange: [1.2, 1.4],
    availableCategories: [
      'names', 'places', 'animal', 'thing', 'sports_games', 'brands',
      'countries', 'food_dishes', 'professions', 'movies', 'songs',
      'health_issues', 'historical_figures', 'fruits_vegetables',
    ],
  },
  {
    bandNumber: 5,
    name: 'Expert',
    levelRange: [201, 300],
    description: 'Multi-letter mode appears; triple combos at 300',
    timerRange: [8, 6],
    passScoreRange: [68, 82],
    categoryCountRange: [6, 8],
    letterDifficulties: ['normal', 'hard'],
    constraintPool: [
      'min_word_length', 'ends_with_letter', 'no_repeat_letters',
      'max_word_length', 'double_letters', 'no_common_words', 'combo',
      'survival', 'time_pressure',
    ],
    allowComboConstraints: true,
    survivalModeChance: 0.3,
    bonusMultiplierRange: [1.4, 1.6],
    availableCategories: [
      'names', 'places', 'animal', 'thing', 'sports_games', 'brands',
      'countries', 'food_dishes', 'professions', 'movies', 'songs',
      'health_issues', 'historical_figures', 'fruits_vegetables',
    ],
    multiLetterMode: true,
  },
  {
    bandNumber: 6,
    name: 'Master',
    levelRange: [301, 400],
    description: 'Triple constraints, hard letters, tight timers',
    timerRange: [6, 5],
    passScoreRange: [78, 90],
    categoryCountRange: [7, 8],
    letterDifficulties: ['hard', 'normal'],
    constraintPool: [
      'min_word_length', 'ends_with_letter', 'no_repeat_letters',
      'max_word_length', 'double_letters', 'no_common_words', 'combo',
      'survival', 'time_pressure',
    ],
    allowComboConstraints: true,
    survivalModeChance: 0.45,
    bonusMultiplierRange: [1.6, 1.8],
    availableCategories: [
      'names', 'places', 'animal', 'thing', 'sports_games', 'brands',
      'countries', 'food_dishes', 'professions', 'movies', 'songs',
      'health_issues', 'historical_figures', 'fruits_vegetables',
    ],
    multiLetterMode: true,
  },
  {
    bandNumber: 7,
    name: 'Legendary',
    levelRange: [401, 500],
    description: 'Everything goes - the hardest possible challenge',
    timerRange: [5, 4],
    passScoreRange: [88, 95],
    categoryCountRange: [7, 8],
    letterDifficulties: ['hard'],
    constraintPool: [
      'min_word_length', 'ends_with_letter', 'no_repeat_letters',
      'max_word_length', 'double_letters', 'no_common_words', 'combo',
      'survival', 'time_pressure',
    ],
    allowComboConstraints: true,
    survivalModeChance: 0.6,
    bonusMultiplierRange: [1.8, 2.0],
    availableCategories: [
      'names', 'places', 'animal', 'thing', 'sports_games', 'brands',
      'countries', 'food_dishes', 'professions', 'movies', 'songs',
      'health_issues', 'historical_figures', 'fruits_vegetables',
    ],
    multiLetterMode: true,
  },
];

function getBandForLevel(level: number): DifficultyBand {
  const band = DIFFICULTY_BANDS.find(
    (b) => level >= b.levelRange[0] && level <= b.levelRange[1]
  );
  return band ?? DIFFICULTY_BANDS[DIFFICULTY_BANDS.length - 1]!;
}

// ============================================
// MAIN LEVEL GENERATOR
// ============================================

/**
 * Generate a single level's data.
 * Levels 1-500 are supported; values outside that range are clamped.
 */
export function generateLevel(levelNumber: number): LevelData {
  if (levelNumber < 1 || levelNumber > 500) {
    throw new Error(`Invalid level number: ${levelNumber}. Must be between 1 and 500.`);
  }

  const rng = new SeededRandom(levelNumber * 12345);
  const band = getBandForLevel(levelNumber);

  // --- Letter ---
  const isMultiLetterMode = levelNumber >= 200 && rng.next() < Math.min((levelNumber - 200) / 300, 0.6);
  const availableCategories = getAvailableCategories(levelNumber);

  const { letter, type: letterType } = selectLetter(levelNumber, rng, availableCategories);

  // --- Categories ---
  const categoryCount = getCategoryCount(levelNumber, rng);
  const categories = selectCategories(levelNumber, rng, categoryCount, letter);

  // --- Multi-letter mode ---
  let lettersPerCategory: string[] | undefined;
  let primaryLetter = letter;

  if (isMultiLetterMode && categories.length > 0) {
    lettersPerCategory = selectMultipleLetters(levelNumber, rng, categories);
    primaryLetter = lettersPerCategory[0] ?? letter;
  }

  // --- Constraint ---
  const constraint = selectConstraint(
    levelNumber,
    rng,
    primaryLetter,
    categories,
    lettersPerCategory
  );

  // --- Timer ---
  let timerSeconds = getBaseTimerSeconds(levelNumber);

  // GENEROUS BONUS TIME for difficult constraints
  // This ensures players have enough time when facing challenging constraints
  const hasMinWordLength =
    constraint.type === 'min_word_length' ||
    (constraint.type === 'combo' &&
      constraint.comboConstraints?.some((c) => c.type === 'min_word_length'));
  const minWordValue =
    constraint.type === 'min_word_length'
      ? constraint.value ?? 4
      : constraint.comboConstraints?.find((c) => c.type === 'min_word_length')?.value ?? 0;

  // Bonus time based on constraint type
  if (constraint.type !== 'none' && constraint.type !== 'time_pressure') {
    // Any constraint gets +3 seconds base bonus
    timerSeconds += 3;
  }

  // Additional bonuses for specific difficult constraints
  if (hasMinWordLength && minWordValue >= 5) {
    timerSeconds += 3; // Extra time for 5+ letter words
  }
  if (hasMinWordLength && minWordValue >= 6) {
    timerSeconds += 2; // Even more for 6+ letter words
  }
  if (constraint.type === 'ends_with_letter') {
    timerSeconds += 2; // Ending with specific letter is tricky
  }
  if (constraint.type === 'no_repeat_letters') {
    timerSeconds += 3; // Very challenging constraint
  }
  if (constraint.type === 'double_letters') {
    timerSeconds += 2; // Needs thinking
  }
  if (constraint.type === 'combo') {
    timerSeconds += 4; // Multiple constraints need much more time
  }
  if (constraint.type === 'survival') {
    timerSeconds += 2; // High stakes, give breathing room
  }
  if (constraint.type === 'time_pressure') {
    timerSeconds = Math.max(6, timerSeconds - 4); // Still challenging but not brutal
  }

  // Clamp to reasonable bounds (more generous max)
  timerSeconds = clamp(timerSeconds, 5, 25);

  // --- Scoring ---
  const passScorePercent = getPassScorePercent(levelNumber);
  const maxPossibleScore = categories.length * 10;
  const minScoreToPass = Math.ceil((maxPossibleScore * passScorePercent) / 100);

  // --- Survival ---
  const isSurvivalMode =
    constraint.type === 'survival' || rng.next() < getSurvivalChance(levelNumber);

  // --- Bonus ---
  const bonusMultiplier = getBonusMultiplier(levelNumber);

  return {
    level: levelNumber,
    band: band.bandNumber,
    bandName: band.name,
    timerSeconds,
    letter: isMultiLetterMode ? primaryLetter : letter,
    letterType,
    lettersPerCategory: isMultiLetterMode ? lettersPerCategory : undefined,
    isMultiLetterMode: isMultiLetterMode || undefined,
    categories,
    categoryCount: categories.length,
    passScorePercent,
    maxPossibleScore,
    minScoreToPass,
    constraint,
    isSurvivalMode,
    bonusMultiplier,
  };
}

/**
 * Generate all 500 levels.
 */
export function generateAllLevels(): LevelData[] {
  return Array.from({ length: 500 }, (_, i) => generateLevel(i + 1));
}

/**
 * Get all difficulty bands metadata.
 */
export function getAllBands(): DifficultyBand[] {
  return DIFFICULTY_BANDS;
}

/**
 * Get a specific band by number.
 */
export function getBand(bandNumber: number): DifficultyBand | undefined {
  return DIFFICULTY_BANDS.find((b) => b.bandNumber === bandNumber);
}

/**
 * Get a human-readable summary of a level.
 */
export function getLevelSummary(levelNumber: number): string {
  const level = generateLevel(levelNumber);
  const letterDisplay = level.isMultiLetterMode
    ? `Letters: ${level.lettersPerCategory?.join(', ')}`
    : `Letter "${level.letter}"`;

  return `Level ${level.level} (${level.bandName}): ${letterDisplay} | ${level.categoryCount} categories | ${level.timerSeconds}s | Pass: ${level.minScoreToPass}/${level.maxPossibleScore} (${level.passScorePercent}%)${level.isSurvivalMode ? ' | SURVIVAL' : ''} | ${level.constraint.description}`;
}
