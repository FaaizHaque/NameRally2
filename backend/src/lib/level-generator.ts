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
  | 'professions'
  | 'food_dishes'
  | 'historical_figures';

export interface LevelConstraint {
  type:
    | 'none'
    | 'min_word_length'
    | 'no_repeat_letters'
    | 'time_pressure'
    | 'survival'
    | 'ends_with_letter'
    | 'double_letters'
    | 'max_word_length'
    | 'contains_vowel'
    | 'odd_length'
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
    'fruits_vegetables',
  ],
  Q: [
    'animal', 'names', 'sports_games', 'food_dishes', 'thing',
    'health_issues', 'brands', 'professions', 'historical_figures', 'fruits_vegetables',
  ],
  Z: [
    'sports_games', 'food_dishes', 'thing', 'health_issues', 'professions',
    'historical_figures', 'fruits_vegetables',
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
    'animal', 'thing', 'places', 'names', 'brands', 'food_dishes',
    'professions', 'countries', 'historical_figures', 'health_issues',
    'sports_games',
  ],
  Q: [
    'animal', 'thing', 'places', 'names', 'brands', 'food_dishes',
    'professions', 'countries', 'historical_figures', 'health_issues',
    'sports_games',
  ],
  X: [
    'animal', 'thing', 'places', 'names', 'brands', 'food_dishes',
    'professions', 'countries', 'historical_figures', 'health_issues',
    'sports_games',
  ],
  Z: [
    'animal', 'thing', 'places', 'names', 'brands', 'food_dishes',
    'professions', 'countries', 'historical_figures', 'health_issues',
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
// Deterministic — every level has a fixed pool size.
//
// L1:  3 cats — Names, Animal, Places
// L2:  4 cats — + Things
// L4:  5 cats — + Fruits & Veg
// L6:  6 cats — + Countries
// L8:  7 cats — + Professions
// L11: 8 cats — + Sports & Games
// L14: 9 cats — + Food & Dishes
// L17: 10 cats — + Brands
// L20: 11 cats — + Health Issues
// L24: 12 cats — + Historical Figures (ALL)
// ============================================

interface CategoryMilestone {
  level: number;
  category: CategoryType;
}

const CATEGORY_MILESTONES: CategoryMilestone[] = [
  { level: 2,  category: 'thing' },              // 4 cats
  { level: 4,  category: 'fruits_vegetables' },  // 5 cats
  { level: 6,  category: 'countries' },          // 6 cats
  { level: 8,  category: 'professions' },        // 7 cats
  { level: 11, category: 'sports_games' },       // 8 cats
  { level: 14, category: 'food_dishes' },        // 9 cats
  { level: 17, category: 'brands' },             // 10 cats
  { level: 20, category: 'health_issues' },      // 11 cats
  { level: 24, category: 'historical_figures' }, // 12 cats (ALL)
];

/** Three starter categories — always available from level 1 */
const STARTER_CATEGORIES: CategoryType[] = ['names', 'animal', 'places'];

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
// CONSTRAINT SCHEDULE — fully deterministic per level range
//
// L1-4:   none
// L5-9:   min_word_length (4+ letters)
// L10-14: min_word_length (5+ letters)
// L15-19: min_word_length (6+ letters)
// L20-29: max_word_length (max 8 letters)
// L30-39: contains_vowel
// L40-49: no_repeat_letters
// L50-59: survival
// L60-69: odd_length
// L70-79: double_letters
// L80-89: ends_with_letter
// L90-100: combo
// ============================================

/**
 * Returns the fixed constraint type for a given level — no randomness.
 */
function getConstraintTypeForLevel(level: number): LevelConstraint['type'] {
  if (level < 5)   return 'none';
  if (level < 20)  return 'min_word_length';
  if (level < 30)  return 'max_word_length';
  if (level < 40)  return 'contains_vowel';
  if (level < 50)  return 'no_repeat_letters';
  if (level < 60)  return 'survival';
  if (level < 70)  return 'odd_length';
  if (level < 80)  return 'double_letters';
  if (level < 90)  return 'ends_with_letter';
  return 'combo';
}

// ============================================
// ENDS-WITH + START-LETTER CROSS-RESTRICTIONS
// Some (startLetter, endLetter) pairs are near-impossible for certain categories.
// E.g. countries starting with A ending with L — no common countries exist.
// Key: endLetter → { startLetter → restricted categories }
// ============================================

const START_END_BLOCKED: Record<string, Record<string, CategoryType[]>> = {
  L: {
    A: ['countries', 'places'],
    I: ['countries'],
    O: ['countries'],
    U: ['countries'],
    K: ['countries'],
    V: ['countries'],
    E: ['countries'],
  },
  D: {
    A: ['countries'],
    I: ['countries'],
    O: ['countries'],
    U: ['countries'],
    K: ['countries'],
  },
  M: {
    A: ['countries'],
    I: ['countries'],
    K: ['countries'],
    V: ['countries'],
  },
};

/**
 * Returns true if the given endLetter is viable for ALL categories with the given startLetter.
 */
function isEndLetterViable(
  startLetter: string,
  endLetter: string,
  categories: CategoryType[]
): boolean {
  const byEnd = START_END_BLOCKED[endLetter];
  if (!byEnd) return true;
  const restricted = byEnd[startLetter];
  if (!restricted) return true;
  return !categories.some((cat) => restricted.includes(cat));
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
 * Seconds allowed per category based on level.
 * L1-29:  20s per category (generous — learning phase)
 * L30-69: 15s per category (standard — constraints kicking in)
 * L70+:   10s per category (tight — expert pressure)
 *
 * Total timer = categoryCount × secondsPerCategory.
 * This keeps the timer proportional to the actual workload.
 */
function getSecondsPerCategory(level: number): number {
  if (level < 30) return 20;
  if (level < 70) return 15;
  return 10;
}

function getBaseTimerSeconds(level: number, categoryCount: number): number {
  return getSecondsPerCategory(level) * categoryCount;
}

/**
 * Number of categories per level.
 * Always equals the number of unlocked categories at that level —
 * every available category is used every round, so each introduction
 * is immediately felt and the pool grows organically.
 *
 * Level 1-2:    3   Level 3-5:    4   Level 6-10:   5
 * Level 11-30:  6   Level 31-50:  7   Level 51-100: 8
 * Level 101-200: 9  Level 201-300: 10 Level 301-400: 11
 * Level 401-450: 12 Level 451-465: 13 Level 466-480: 14
 * Level 481-500: 15 (ALL)
 */
function getCategoryCount(level: number, _rng: SeededRandom): number {
  return getAvailableCategories(level).length;
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
  const available = getAvailableCategories(level);
  const impossible = IMPOSSIBLE_COMBOS[letter] ?? [];
  const valid = available.filter((c) => !impossible.includes(c));

  // Shuffle and return up to `count` — count always equals available.length so all
  // unlocked categories are used each round (some may be filtered by impossible combos).
  return rng.shuffle(valid).slice(0, count);
}

// ============================================
// CONSTRAINT SELECTION
// ============================================

function createSingleConstraint(
  type: LevelConstraint['type'],
  level: number,
  letter: string,
  rng: SeededRandom,
  lettersPerCategory?: string[],
  categories?: CategoryType[]
): LevelConstraint {
  switch (type) {
    case 'none':
      return { type: 'none', description: 'No special constraints' };


    case 'min_word_length': {
      const hardLetters = ['Q', 'X', 'Z', 'J', 'Y', 'K', 'V', 'U'];
      let hasHard = hardLetters.includes(letter);
      if (lettersPerCategory) {
        hasHard = lettersPerCategory.some((l) => hardLetters.includes(l));
      }
      let minLength: number;
      if (hasHard) {
        // Easier targets for hard letters
        minLength = level < 10 ? 4 : 5;
      } else {
        // L5-9: 4+, L10-14: 5+, L15+: 6+
        if (level < 10) minLength = 4;
        else if (level < 15) minLength = 5;
        else minLength = 6;
      }
      return {
        type: 'min_word_length',
        value: minLength,
        description: `Words must be ${minLength}+ letters`,
      };
    }

    case 'max_word_length': {
      // L20-29: max 8, tighter at higher levels
      const maxLength = level < 30 ? 8 : Math.max(6, 8 - Math.floor((level - 30) / 100));
      return {
        type: 'max_word_length',
        value: maxLength,
        description: `Words must be ${maxLength} letters or less`,
      };
    }

    case 'contains_vowel': {
      const vowels = ['A', 'E', 'I', 'O', 'U'];
      const vowel = rng.pick(vowels);
      return {
        type: 'contains_vowel',
        endLetter: vowel,
        description: `Words must contain the vowel "${vowel}"`,
      };
    }

    case 'no_repeat_letters':
      return { type: 'no_repeat_letters', description: 'No letter can repeat in your answer' };

    case 'time_pressure':
      return { type: 'time_pressure', description: 'Think fast! Reduced time' };

    case 'survival':
      return { type: 'survival', description: 'One invalid answer = level failed!' };

    case 'ends_with_letter': {
      // Pick an endLetter that doesn't form an impossible combo with the start letter
      const candidateLetters = [...LETTER_POOLS.endLetters];
      // Shuffle so selection is still random
      for (let i = candidateLetters.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        [candidateLetters[i], candidateLetters[j]] = [candidateLetters[j], candidateLetters[i]];
      }
      const viableCats = categories ?? [];
      const endLetter =
        candidateLetters.find((el) => isEndLetterViable(letter, el, viableCats)) ??
        candidateLetters[0]!;
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

    case 'odd_length':
      return {
        type: 'odd_length',
        description: 'Words must be an odd number of letters (3, 5, 7...)',
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
  // Deterministic — constraint type is fixed for the level range
  let constraintType = getConstraintTypeForLevel(level);

  // If this letter makes the constraint unplayable, fall back to none
  const veryHardLetters = ['Q', 'X', 'Z'];
  const isVeryHard = veryHardLetters.includes(letter);

  if (isVeryHard && ['double_letters', 'ends_with_letter', 'no_repeat_letters'].includes(constraintType)) {
    constraintType = 'none';
  }

  if (
    constraintType !== 'none' &&
    constraintType !== 'combo' &&
    constraintType !== 'survival' &&
    !isPlayableForAll(letter, categories, constraintType, lettersPerCategory)
  ) {
    constraintType = 'none';
  }

  // Handle combo — pick two fixed non-conflicting constraints from the earlier ranges
  if (constraintType === 'combo') {
    const comboOptions: LevelConstraint['type'][] = [
      'min_word_length', 'max_word_length', 'contains_vowel',
      'odd_length', 'double_letters', 'ends_with_letter',
    ];
    const playable = comboOptions.filter((c) =>
      !isVeryHard ||
      !['double_letters', 'ends_with_letter'].includes(c)
    ).filter((c) =>
      isPlayableForAll(letter, categories, c, lettersPerCategory)
    );

    if (playable.length < 2) {
      return createSingleConstraint('min_word_length', level, letter, rng, lettersPerCategory, categories);
    }

    // Pick first two from the playable list (seeded pick for consistent results)
    const selected = rng.pickMultiple(playable, 2);
    const comboConstraints = selected.map((t) => {
      const c = createSingleConstraint(t, level, letter, rng, lettersPerCategory, categories);
      return { type: c.type, value: c.value, endLetter: c.endLetter };
    });

    const descriptions = comboConstraints.map((c) => {
      if (c.type === 'min_word_length') return `${c.value}+ letters`;
      if (c.type === 'max_word_length') return `${c.value} letters or less`;
      if (c.type === 'ends_with_letter') return `ends with "${c.endLetter}"`;
      if (c.type === 'contains_vowel') return `contains vowel "${c.endLetter}"`;
      const full = createSingleConstraint(c.type, level, letter, rng, lettersPerCategory, categories);
      return full.description;
    });

    return { type: 'combo', comboConstraints, description: descriptions.join(' + ') };
  }

  return createSingleConstraint(constraintType, level, letter, rng, lettersPerCategory, categories);
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
    description: 'Start with Names, Animal, Places (3 cats) and unlock new categories every few levels up to 6 by level 11',
    timerRange: [18, 16],
    passScoreRange: [30, 45],
    categoryCountRange: [3, 6],
    letterDifficulties: ['easy'],
    constraintPool: ['none', 'min_word_length'],
    allowComboConstraints: false,
    survivalModeChance: 0,
    bonusMultiplierRange: [1.0, 1.0],
    availableCategories: ['names', 'animal', 'places', 'thing', 'fruits_vegetables', 'sports_games'],
  },
  {
    bandNumber: 2,
    name: 'Getting Started',
    levelRange: [26, 50],
    description: 'Brands unlocked at 31; constraints start at 30',
    timerRange: [14, 12],
    passScoreRange: [35, 50],
    categoryCountRange: [6, 7],
    letterDifficulties: ['easy', 'normal'],
    constraintPool: ['none', 'min_word_length', 'max_word_length', 'contains_vowel', 'no_repeat_letters'],
    allowComboConstraints: false,
    survivalModeChance: 0,
    bonusMultiplierRange: [1.0, 1.1],
    availableCategories: ['names', 'animal', 'places', 'thing', 'fruits_vegetables', 'sports_games', 'brands'],
  },
  {
    bandNumber: 3,
    name: 'Picking Up Speed',
    levelRange: [51, 100],
    description: 'Health Issues (8 cats), harder letters appear',
    timerRange: [12, 10],
    passScoreRange: [45, 60],
    categoryCountRange: [8, 8],
    letterDifficulties: ['easy', 'normal'],
    constraintPool: ['none', 'min_word_length', 'max_word_length', 'contains_vowel', 'no_repeat_letters', 'survival', 'odd_length', 'double_letters', 'ends_with_letter', 'combo'],
    allowComboConstraints: true,
    survivalModeChance: 0,
    bonusMultiplierRange: [1.1, 1.2],
    availableCategories: ['names', 'animal', 'places', 'thing', 'fruits_vegetables', 'sports_games', 'brands', 'health_issues'],
  },
  {
    bandNumber: 4,
    name: 'Challenger',
    levelRange: [101, 200],
    description: 'Countries unlocked (9 cats), no-repeat-letters constraint',
    timerRange: [10, 8],
    passScoreRange: [55, 72],
    categoryCountRange: [9, 9],
    letterDifficulties: ['normal', 'hard'],
    constraintPool: ['none', 'min_word_length', 'max_word_length', 'no_repeat_letters'],
    allowComboConstraints: false,
    survivalModeChance: 0,
    bonusMultiplierRange: [1.2, 1.4],
    availableCategories: [
      'names', 'animal', 'places', 'thing', 'fruits_vegetables', 'sports_games',
      'brands', 'health_issues', 'countries',
    ],
  },
  {
    bandNumber: 5,
    name: 'Expert',
    levelRange: [201, 300],
    description: 'Food & Dishes (10 cats), multi-letter mode, survival kicks in',
    timerRange: [8, 6],
    passScoreRange: [68, 82],
    categoryCountRange: [10, 10],
    letterDifficulties: ['normal', 'hard'],
    constraintPool: ['none', 'min_word_length', 'max_word_length', 'no_repeat_letters', 'survival', 'time_pressure'],
    allowComboConstraints: false,
    survivalModeChance: 0.15,
    bonusMultiplierRange: [1.4, 1.6],
    availableCategories: [
      'names', 'animal', 'places', 'thing', 'fruits_vegetables', 'sports_games',
      'brands', 'health_issues', 'countries', 'food_dishes',
    ],
    multiLetterMode: true,
  },
  {
    bandNumber: 6,
    name: 'Master',
    levelRange: [301, 400],
    description: 'Professions at 401, triple constraints, tight timers',
    timerRange: [6, 5],
    passScoreRange: [78, 90],
    categoryCountRange: [10, 10],
    letterDifficulties: ['hard', 'normal'],
    constraintPool: ['min_word_length', 'max_word_length', 'no_repeat_letters', 'survival', 'time_pressure', 'double_letters'],
    allowComboConstraints: false,
    survivalModeChance: 0.3,
    bonusMultiplierRange: [1.6, 1.8],
    availableCategories: [
      'names', 'animal', 'places', 'thing', 'fruits_vegetables', 'sports_games',
      'brands', 'health_issues', 'countries', 'food_dishes',
    ],
    multiLetterMode: true,
  },
  {
    bandNumber: 7,
    name: 'Legendary',
    levelRange: [401, 500],
    description: 'All 12 categories unlocked by 481 — maximum difficulty',
    timerRange: [5, 4],
    passScoreRange: [88, 95],
    categoryCountRange: [11, 12],
    letterDifficulties: ['hard'],
    constraintPool: ['min_word_length', 'max_word_length', 'no_repeat_letters', 'survival', 'time_pressure', 'double_letters', 'ends_with_letter', 'combo'],
    allowComboConstraints: true,
    survivalModeChance: 0.45,
    bonusMultiplierRange: [1.8, 2.0],
    availableCategories: [
      'names', 'animal', 'places', 'thing', 'fruits_vegetables', 'sports_games',
      'brands', 'health_issues', 'countries', 'food_dishes',
      'professions', 'historical_figures',
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
  let timerSeconds = getBaseTimerSeconds(levelNumber, categories.length);

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
  if (constraint.type === 'contains_vowel') {
    timerSeconds += 2; // Requires finding words with a specific vowel
  }
  if (constraint.type === 'odd_length') {
    timerSeconds += 2; // Requires counting letters before answering
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

  // Clamp: min 10s total, max = base (constraint bonuses only add, never exceed base by more than 30s)
  timerSeconds = clamp(timerSeconds, 10, getBaseTimerSeconds(levelNumber, categories.length) + 30);

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
