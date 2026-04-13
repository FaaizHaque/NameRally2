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
  | 'celebrities';

export interface LevelConstraint {
  type:
    | 'none'
    | 'min_word_length'
    | 'no_repeat_letters'
    | 'time_pressure'
    | 'ends_with_letter'
    | 'double_letters'
    | 'repeated_letter'
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
  letterType: 'easy' | 'normal' | 'hard' | 'two_letter';
  letterOptions?: string[];       // All valid starting combos (e.g. ['FA','FI','FO'])
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

// Only truly impossible combos — very conservative, err on the side of inclusion.
// X blocks everything (nothing common starts with X in any category).
// Q blocks only the 2 categories where Q genuinely has no playable answers.
const IMPOSSIBLE_COMBOS: Record<string, CategoryType[]> = {
  X: [
    'names', 'places', 'animal', 'thing', 'food_dishes', 'sports_games',
    'fruits_vegetables', 'countries', 'brands', 'celebrities', 'professions',
    'health_issues',
  ],
  Q: ['sports_games', 'professions'],
  // No sovereign country starts with W (Wales, Western Sahara are not UN member states)
  W: ['countries'],
};

// ============================================
// MUTUALLY EXCLUSIVE CATEGORY PAIRS
// These two pairs should never appear together in the same level
// (unless the level explicitly uses useFullPool or specificCategories — those bypass this rule).
// ============================================

const MUTUALLY_EXCLUSIVE_PAIRS: [CategoryType, CategoryType][] = [
  ['countries', 'places'],
  ['food_dishes', 'fruits_vegetables'],
];

/**
 * From a list of valid categories, randomly drop one from each mutually exclusive pair
 * where both members appear. Mutually exclusive categories may still appear across different
 * rounds — they just can't appear in the SAME round.
 */
function enforceMutualExclusion(categories: CategoryType[], rng: SeededRandom): CategoryType[] {
  let result = [...categories];
  for (const [catA, catB] of MUTUALLY_EXCLUSIVE_PAIRS) {
    if (result.includes(catA) && result.includes(catB)) {
      // Randomly keep one of the pair
      const dropA = rng.next() < 0.5;
      result = result.filter((c) => c !== (dropA ? catA : catB));
    }
  }
  return result;
}

// ============================================
// ENDS-WITH RESTRICTED COMBOS
// ============================================

const ENDS_WITH_RESTRICTED: Record<string, CategoryType[]> = {
  J: [
    'animal', 'thing', 'places', 'names', 'brands', 'food_dishes',
    'professions', 'countries', 'celebrities', 'health_issues',
    'sports_games',
  ],
  Q: [
    'animal', 'thing', 'places', 'names', 'brands', 'food_dishes',
    'professions', 'countries', 'celebrities', 'health_issues',
    'sports_games',
  ],
  X: [
    'animal', 'thing', 'places', 'names', 'brands', 'food_dishes',
    'professions', 'countries', 'celebrities', 'health_issues',
    'sports_games',
  ],
  Z: [
    'animal', 'thing', 'places', 'names', 'brands', 'food_dishes',
    'professions', 'countries', 'celebrities', 'health_issues',
    'sports_games',
  ],
  Y: [
    'animal', 'thing', 'places', 'brands', 'food_dishes', 'professions',
    'celebrities', 'health_issues', 'sports_games',
  ],
  U: [
    'animal', 'thing', 'brands', 'professions', 'celebrities',
    'health_issues', 'sports_games',
  ],
  V: [
    'animal', 'thing', 'brands', 'professions', 'celebrities',
    'health_issues', 'sports_games',
  ],
  K: ['thing', 'professions', 'celebrities', 'health_issues', 'sports_games'],
  I: ['thing', 'professions', 'sports_games'],
  O: ['thing', 'health_issues', 'sports_games', 'professions'],
};

// Two-letter combo levels and their letters
const TWO_LETTER_LEVELS: Record<number, string> = {
  10: 'CH',
  15: 'SH',
  19: 'BA',
  23: 'CO',
  29: 'MA',
  33: 'SO',
  38: 'LA',
  44: 'TA',
  76: 'HA',
  86: 'WA',
  95: 'PR',
};

// ============================================
// PRE-COMPUTED LETTER ASSIGNMENTS FOR LEVELS 1-100
//
// Simple approach: cycle through the 22-letter pool in a shuffled order,
// respecting forced letters at specific levels, guaranteeing no adjacent duplicates.
// Replaces the broken sliding-window RNG system entirely for levels 1-100.
// ============================================

/**
 * Pre-computes a letter for every non-forced, non-two-letter level from 1 to 100.
 * Forced/two-letter levels are handled by their existing checks in generateLevel
 * and are only referenced here to ensure adjacency constraints are respected.
 */
const LEVEL_LETTER_ASSIGNMENTS: Record<number, string> = (() => {
  // All 22 playable letters for levels 1-100
  const pool = ['S', 'M', 'C', 'T', 'P', 'R', 'D', 'N', 'G', 'H', 'I', 'V', 'E', 'O', 'U', 'W', 'F', 'A', 'B', 'L', 'K', 'J'];

  // Known fixed letters (forced or two-letter) — used only for adjacency checking
  const fixedMap: Record<number, string> = {
    1: 'S', 2: 'M', 3: 'T', 4: 'C', 5: 'P', 6: 'R', 7: 'D',
    8: 'L', 10: 'CH', 13: 'B', 14: 'Z', 15: 'SH', 17: 'Q',
    19: 'BA', 23: 'CO', 29: 'MA', 33: 'SO', 38: 'LA', 44: 'TA',
    48: 'LI', 53: 'FA', 60: 'PA', 63: 'RA', 66: 'Y', 67: 'A',
    72: 'J', 76: 'HA', 82: 'K', 86: 'WA', 95: 'PR', 96: 'F',
  };

  // Full map we'll build up (starts with fixed letters)
  const fullMap: Record<number, string> = { ...fixedMap };

  // Free levels — those without a fixed assignment
  const freeLevels: number[] = [];
  for (let l = 1; l <= 100; l++) {
    if (!fixedMap[l]) freeLevels.push(l);
  }

  // Build a long shuffled cycle of the pool with a fixed seed (deterministic, not game RNG)
  const rng = new SeededRandom(99999);
  let cycle: string[] = [];
  for (let i = 0; i < 5; i++) {
    cycle = cycle.concat(rng.shuffle([...pool]));
  }

  // Assign letters in level order, skipping letters that match adjacent levels
  let idx = 0;
  for (const lvl of freeLevels) {
    const prev = fullMap[lvl - 1];
    const next = fullMap[lvl + 1];

    let picked = '';
    for (let tries = 0; tries < cycle.length; tries++) {
      const candidate = cycle[(idx + tries) % cycle.length]!;
      if (candidate !== prev && candidate !== next) {
        picked = candidate;
        idx += tries + 1;
        break;
      }
    }

    fullMap[lvl] = picked || 'S';
  }

  // Return only free-level assignments
  const result: Record<number, string> = {};
  for (const lvl of freeLevels) {
    result[lvl] = fullMap[lvl]!;
  }
  return result;
})();

// ============================================
// LEVEL OVERRIDES — explicit config for levels 1-100
// ============================================

interface LevelOverride {
  // Letter
  forceLetter?: string;             // exact forced single or two-letter value
  forceLetterOptions?: string[];    // pick one at random (seeded) — e.g. ['LA','LO']
  // Categories
  categoryCount?: number;           // how many to pick from available pool
  specificCategories?: CategoryType[]; // exact set, bypasses impossible-combo filter
  useEasyCategories?: boolean;      // pick from easy-category priority list
  easyCount?: number;               // how many easy cats to pick
  useFullPool?: boolean;            // use ALL currently unlocked categories
  // Constraint
  constraintType?: LevelConstraint['type'];
  constraintValue?: number;
  constraintEndLetter?: string;
  constraintEndLetterOptions?: string[]; // pick one at random (seeded) — e.g. ['E','R']
  comboConstraints?: Array<{ type: LevelConstraint['type']; value?: number; endLetter?: string }>;
  // Timer
  timerSecondsPerCategory?: number; // overrides base calc; total = value × catCount
  // Multi-letter mode
  isMultiLetterMode?: boolean;
  multiLetterAssignments?: Partial<Record<CategoryType, string>>; // fixed per-cat
  multiLetterOptions?: string[];    // pool shuffled & assigned one-per-cat
}

const LEVEL_OVERRIDES: Record<number, LevelOverride> = {
  // ── L1-4: starter cats, no constraint ─────────────────────────────────────
  // L1 = 3 cats (names, places, animal), L2 = 4 cats (+thing)
  1: { forceLetter: 'S', specificCategories: ['names', 'places', 'animal'] },
  2: { forceLetter: 'M', specificCategories: ['names', 'places', 'animal', 'thing'] },
  3: { forceLetter: 'T', categoryCount: 4 },
  4: { forceLetter: 'C', categoryCount: 4 },
  // ── L5-10: +Food&Dishes (5 cats), CH combo at 10 ──────────────────────────
  5:  { forceLetter: 'P', categoryCount: 5 },
  6:  { forceLetter: 'R', categoryCount: 5, constraintType: 'min_word_length', constraintValue: 4 },
  7:  { forceLetter: 'D', categoryCount: 5, constraintType: 'min_word_length', constraintValue: 4 },
  8:  { forceLetter: 'L', categoryCount: 5, constraintType: 'min_word_length', constraintValue: 4 },
  9:  { categoryCount: 5 },
  // L10 → TWO_LETTER_LEVELS = 'CH'
  10: { categoryCount: 5 },
  // ── L11-15: +Sports&Games (6 cats), SH combo at 15 ────────────────────────
  11: { categoryCount: 6, constraintType: 'max_word_length', constraintValue: 8 },
  12: { categoryCount: 6, constraintType: 'max_word_length', constraintValue: 8 },
  13: { forceLetter: 'B', categoryCount: 6 },
  14: { forceLetter: 'Z', specificCategories: ['names', 'places', 'animal', 'thing', 'food_dishes'] },
  // L15 → TWO_LETTER_LEVELS = 'SH'
  15: { categoryCount: 5 },
  // ── L16-20: +Fruits&Veg (7 cats), BA combo at 19 ──────────────────────────
  // Note: {food_dishes, fruits_vegetables} are mutually exclusive from L16+
  16: { categoryCount: 6, constraintType: 'min_word_length', constraintValue: 4 },
  17: { forceLetter: 'Q', categoryCount: 5 },
  18: { categoryCount: 6, constraintType: 'min_word_length', constraintValue: 5 },
  // L19 → TWO_LETTER_LEVELS = 'BA'
  19: { categoryCount: 6 },
  // L20: "all 7" exception — food&fruits both appear (useFullPool bypasses mutual exclusion)
  20: { useFullPool: true, constraintType: 'repeated_letter' },
  // ── L21-30: +Countries (8 cats, 6 max after mutual exclusion), CO at 23, MA at 29 ─
  21: { categoryCount: 6 },
  22: { categoryCount: 6, constraintType: 'min_word_length', constraintValue: 4 },
  // L23 → TWO_LETTER_LEVELS = 'CO'
  24: { categoryCount: 6, constraintType: 'min_word_length', constraintValue: 5 },
  25: { categoryCount: 6, constraintType: 'double_letters' },
  26: { categoryCount: 6, constraintType: 'min_word_length', constraintValue: 4 },
  27: { categoryCount: 6, isMultiLetterMode: true },
  28: { categoryCount: 6, constraintType: 'min_word_length', constraintValue: 5 },
  // L29 → TWO_LETTER_LEVELS = 'MA'
  30: { categoryCount: 6, constraintType: 'ends_with_letter', constraintEndLetterOptions: ['E', 'R'] },
  // ── L31-40: +Brands (9 cats, 7 max after mutual exclusion), SO at 33, LA at 38 ──
  31: { categoryCount: 7, constraintType: 'repeated_letter' },
  32: { categoryCount: 7, constraintType: 'min_word_length', constraintValue: 5 },
  // L33 → TWO_LETTER_LEVELS = 'SO'
  34: { categoryCount: 7, constraintType: 'min_word_length', constraintValue: 5 },
  35: { categoryCount: 7, constraintType: 'ends_with_letter', constraintEndLetterOptions: ['L', 'T'] },
  36: { categoryCount: 7, isMultiLetterMode: true },
  37: { useEasyCategories: true, easyCount: 5, constraintType: 'min_word_length', constraintValue: 6 },
  // L38 → TWO_LETTER_LEVELS = 'LA'
  39: { categoryCount: 7, constraintType: 'repeated_letter' },
  40: { useEasyCategories: true, easyCount: 6, constraintType: 'ends_with_letter', constraintEndLetterOptions: ['N', 'Y'] },
  // ── L41-50: +Celebrities (10 cats, 8 max), TA at 44 ───────────────────────
  41: { categoryCount: 8 },
  42: { useEasyCategories: true, easyCount: 6, constraintType: 'double_letters' },
  43: { categoryCount: 8, isMultiLetterMode: true },
  // L44 → TWO_LETTER_LEVELS = 'TA'
  45: { useEasyCategories: true, easyCount: 6, constraintType: 'ends_with_letter', constraintEndLetterOptions: ['D', 'R'] },
  46: { categoryCount: 8, constraintType: 'repeated_letter' },
  // L47: 5+ easy cats, min 5 letters (softened — accessible challenge)
  47: { useEasyCategories: true, easyCount: 5, constraintType: 'min_word_length', constraintValue: 5, isMultiLetterMode: true },
  48: { forceLetterOptions: ['LI', 'LE'], categoryCount: 6 },
  49: { categoryCount: 8 },
  50: { categoryCount: 8, timerSecondsPerCategory: 5, constraintType: 'repeated_letter' },
  // ── L51-60: +Professions (11 cats, 9 max) ─────────────────────────────────
  51: { categoryCount: 9, constraintType: 'repeated_letter' },
  52: { useEasyCategories: true, easyCount: 5, constraintType: 'min_word_length', constraintValue: 6, isMultiLetterMode: true },
  53: { forceLetterOptions: ['FA', 'FI', 'FO'], categoryCount: 9, constraintType: 'repeated_letter' },
  54: { categoryCount: 9, constraintType: 'repeated_letter' },
  55: { useEasyCategories: true, easyCount: 7, constraintType: 'double_letters' },
  56: { categoryCount: 8, constraintType: 'repeated_letter' },
  57: { categoryCount: 8, isMultiLetterMode: true, constraintType: 'repeated_letter' },
  58: { categoryCount: 8, constraintType: 'repeated_letter' },
  59: { categoryCount: 8, timerSecondsPerCategory: 5, constraintType: 'repeated_letter' },
  60: { forceLetterOptions: ['PA', 'PE', 'PO'], categoryCount: 8 },
  // ── L61-70: +Health Issues (12 cats, 10 max), all 12 at 65 & 70 ───────────
  61: { categoryCount: 10 },
  62: { useEasyCategories: true, easyCount: 5, constraintType: 'min_word_length', constraintValue: 6 },
  63: { categoryCount: 10, isMultiLetterMode: true },
  64: {
    isMultiLetterMode: true,
    specificCategories: ['names', 'thing', 'animal', 'places', 'brands', 'food_dishes'],
    multiLetterAssignments: { names: 'AM', thing: 'BR', animal: 'CR', places: 'DE', brands: 'TO', food_dishes: 'KA' },
  },
  // L65: all 12 — useFullPool bypasses mutual exclusion
  65: { useFullPool: true },
  66: {
    forceLetter: 'Y',
    specificCategories: ['names', 'places', 'thing', 'celebrities', 'food_dishes', 'brands'],
  },
  67: {
    forceLetter: 'A',
    specificCategories: ['names', 'places', 'animal', 'thing', 'brands', 'celebrities', 'professions', 'food_dishes'],
    constraintType: 'min_word_length', constraintValue: 7,
  },
  68: { categoryCount: 6, timerSecondsPerCategory: 5 },
  69: { categoryCount: 6 },
  // L70: all 12 exception — useFullPool bypasses mutual exclusion
  70: { useFullPool: true },
  // ── L71-80: 7-10 of 12, HA combo at 76, all 12 at 78-80 ──────────────────
  71: { categoryCount: 7 },
  72: {
    specificCategories: ['names', 'places', 'thing', 'celebrities', 'food_dishes', 'brands', 'health_issues', 'professions'],
    isMultiLetterMode: true,
  },
  73: { categoryCount: 7 },
  74: {
    categoryCount: 9,
    constraintType: 'combo',
    comboConstraints: [{ type: 'min_word_length', value: 4 }, { type: 'max_word_length', value: 10 }],
    timerSecondsPerCategory: 6,
  },
  75: { categoryCount: 7, isMultiLetterMode: true },
  // L76 → TWO_LETTER_LEVELS = 'HA'
  76: {
    specificCategories: ['names', 'places', 'animal', 'thing', 'brands', 'celebrities', 'professions', 'food_dishes'],
  },
  77: { categoryCount: 7, timerSecondsPerCategory: 5 },
  78: { useFullPool: true },
  79: { useFullPool: true },
  80: { useFullPool: true },
  // ── L81-90: 8-12 of 12, WA combo at 86, all 12 at 89-90 ──────────────────
  81: { categoryCount: 8, isMultiLetterMode: true },
  82: {
    forceLetter: 'K',
    specificCategories: ['names', 'places', 'thing', 'animal', 'celebrities', 'food_dishes', 'brands', 'health_issues', 'professions'],
  },
  83: { categoryCount: 8 },
  84: { categoryCount: 8, constraintType: 'min_word_length', constraintValue: 5, timerSecondsPerCategory: 8 },
  85: { categoryCount: 8 },
  // L86 → TWO_LETTER_LEVELS = 'WA'
  86: {
    specificCategories: ['names', 'places', 'animal', 'thing', 'brands', 'celebrities', 'professions', 'food_dishes'],
  },
  87: { categoryCount: 8 },
  88: { categoryCount: 8, isMultiLetterMode: true },
  89: { useFullPool: true },
  90: { useFullPool: true },
  // ── L91-100: 10-12 of 12, PR combo at 95, multi-letter at 99-100 ──────────
  91: { categoryCount: 10 },
  92: { categoryCount: 10, constraintType: 'double_letters' },
  93: { categoryCount: 10, isMultiLetterMode: true },
  94: { categoryCount: 10 },
  // L95 → TWO_LETTER_LEVELS = 'PR'
  95: {
    specificCategories: ['names', 'places', 'thing', 'celebrities', 'food_dishes', 'brands', 'professions', 'sports_games'],
    timerSecondsPerCategory: 6,
  },
  96: {
    forceLetter: 'F',
    specificCategories: ['names', 'places', 'thing', 'brands', 'celebrities', 'food_dishes', 'health_issues'],
    constraintType: 'ends_with_letter', constraintEndLetter: 'E',
  },
  97: { categoryCount: 10, isMultiLetterMode: true },
  98: { useFullPool: true },
  // L99: all 12, multi-letter pool — J/G/I/O/U/V/Y/Z/BR/E/NA/RO all valid with at least some categories
  99: {
    useFullPool: true,
    isMultiLetterMode: true,
    multiLetterOptions: ['BR', 'E', 'G', 'I', 'J', 'NA', 'O', 'RO', 'U', 'V', 'Y', 'Z'],
  },
  // L100: all 12, combo constraint (min 5 + max 12), tight timer — grand finale
  100: {
    useFullPool: true,
    isMultiLetterMode: true,
    constraintType: 'combo',
    comboConstraints: [{ type: 'min_word_length', value: 5 }, { type: 'max_word_length', value: 12 }],
    timerSecondsPerCategory: 5,
  },
};

// ============================================
// CATEGORY INTRODUCTION SCHEDULE
// Deterministic — every level has a fixed pool size.
//
// L1:  3 cats — Names, Places, Animal
// L2:  4 cats — + Thing
// L5:  5 cats — + Food & Dishes
// L11: 6 cats — + Sports & Games
// L16: 7 cats — + Fruits & Vegetables
// L21: 8 cats — + Countries
// L31: 9 cats — + Brands
// L41: 10 cats — + Celebrities
// L51: 11 cats — + Professions
// L61: 12 cats — + Health Issues (ALL)
// ============================================

interface CategoryMilestone {
  level: number;
  category: CategoryType;
}

const CATEGORY_MILESTONES: CategoryMilestone[] = [
  { level: 2,  category: 'thing' },              // 4 cats
  { level: 5,  category: 'food_dishes' },        // 5 cats
  { level: 11, category: 'sports_games' },       // 6 cats
  { level: 16, category: 'fruits_vegetables' },  // 7 cats
  { level: 21, category: 'countries' },          // 8 cats
  { level: 31, category: 'brands' },             // 9 cats
  { level: 41, category: 'celebrities' },        // 10 cats
  { level: 51, category: 'professions' },        // 11 cats
  { level: 61, category: 'health_issues' },      // 12 cats (ALL)
];

/** Three starter categories — always available from level 1 */
const STARTER_CATEGORIES: CategoryType[] = ['names', 'places', 'animal'];

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

/** "Easy" category priority — content-familiar, most players know these well */
const EASY_CATEGORY_PRIORITY: CategoryType[] = [
  'names', 'places', 'animal', 'thing', 'fruits_vegetables', 'countries', 'brands',
];

function getEasyCategoriesForLevel(level: number): CategoryType[] {
  const available = getAvailableCategories(level);
  return EASY_CATEGORY_PRIORITY.filter((c) => available.includes(c));
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
  if (level < 60)  return 'repeated_letter';
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
// DOUBLE-LETTERS + LETTER+CATEGORY CROSS-RESTRICTIONS
// Letters where a specific category has no common answers with double letters.
// Key: startLetter → categories that are impossible under double_letters constraint
// ============================================
const DOUBLE_LETTERS_CATEGORY_BLOCKED: Record<string, CategoryType[]> = {
  // Countries with double letters exist for: A (Andorra), C (Cameroon), G (Guinea-Bissau),
  // M (Morocco), P (Philippines), R (Russia), S (Seychelles), W (none, no countries exist).
  // All other letters have no well-known countries with consecutive repeated letters.
  B: ['countries'],  // Bahamas, Belgium, Brazil — none have double letters
  D: ['countries'],  // Denmark, Djibouti, Dominican Republic — none
  E: ['countries'],  // Ecuador, Egypt, Estonia — none
  F: ['countries'],  // Fiji, Finland, France — none
  H: ['countries'],  // Haiti, Honduras, Hungary — none
  I: ['countries'],  // Iceland, India, Indonesia — none
  J: ['countries'],  // Jamaica, Japan, Jordan — none
  K: ['countries'],  // Kazakhstan, Kenya, Kuwait — none
  L: ['countries'],  // Laos, Latvia, Lebanon, Luxembourg — none
  N: ['countries'],  // Namibia, Nepal, Netherlands, Nigeria — none
  O: ['countries'],  // Only Oman — no double letters possible
  T: ['countries'],  // Tanzania, Thailand, Turkey, Tuvalu — none
  U: ['countries'],  // Uganda, Ukraine, Uruguay, Uzbekistan — none
  V: ['countries'],  // Vanuatu, Venezuela, Vietnam — none
  Y: ['countries'],  // Only Yemen — no double letters
  Z: ['countries'],  // Zambia, Zimbabwe — none
};

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
    // Category-specific blocks: some letters have no valid answers in certain categories
    const catBlocked = DOUBLE_LETTERS_CATEGORY_BLOCKED[letter];
    if (catBlocked && catBlocked.includes(category)) return false;
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
 * Seconds allowed per category — flat 10s per category globally.
 * Total timer = categoryCount × 10.
 * Time-pressure levels use timerSecondsPerCategory override.
 */
function getSecondsPerCategory(_level: number): number {
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
 * Pass score percent — tied to category count, not level number.
 * More categories unlocked = higher bar required to pass.
 *
 * 3–4  cats → 50%   (early game, forgiving)
 * 5–7  cats → 55%   (mid game)
 * 8–10 cats → 60%   (late game)
 * 11–12 cats → 65%  (full pool — meaningful threshold)
 */
function getPassScorePercent(_level: number, categoryCount: number): number {
  if (categoryCount <= 4) return 50;
  if (categoryCount <= 7) return 55;
  if (categoryCount <= 10) return 60;
  return 65;
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
  // Levels 1-100: easy + normal letters (22 unique letters > WINDOW=20, prevents exhaustion)
  if (level <= 100) return ['easy', 'normal'];
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
  availableCategories: CategoryType[],
  excludedLetters: Set<string> = new Set()
): { letter: string; type: LevelData['letterType'] } {
  const diffPool = getLetterDifficultyPool(level);
  const difficulty = rng.pick(diffPool);

  const tryPool = (pool: string[]): string | null => {
    const shuffled = rng.shuffle([...pool]);
    for (const l of shuffled) {
      if (excludedLetters.has(l)) continue;
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
  if (!letter && type !== 'easy') {
    letter = tryPool(LETTER_POOLS.easy);
    if (letter) type = 'easy';
  }
  // If block exclusions exhausted the preferred pool, fall back to normal pool
  if (!letter) {
    letter = tryPool(LETTER_POOLS.normal);
    if (letter) type = 'normal';
  }
  // Last resort: ignore block exclusions, pick any valid letter
  if (!letter) {
    const allLetters = rng.shuffle([...new Set([...LETTER_POOLS.easy, ...LETTER_POOLS.normal])]);
    for (const l of allLetters) {
      if (getValidCategoryCount(l, availableCategories) >= MIN_VALID_CATEGORIES_FOR_LETTER) {
        letter = l;
        type = LETTER_POOLS.easy.includes(l) ? 'easy' : 'normal';
        break;
      }
    }
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

  // Enforce mutual exclusion — don't show countries+places or food+fruits in the same round
  const pool = enforceMutualExclusion(rng.shuffle(valid), rng);

  return pool.slice(0, Math.min(count, pool.length));
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

    case 'repeated_letter':
      return { type: 'repeated_letter', description: 'Word must contain a repeated letter (e.g. paper, level, total)' };

    case 'ends_with_letter': {
      // Pick an endLetter that doesn't form an impossible combo with the start letter
      const candidateLetters = [...LETTER_POOLS.endLetters];
      // Shuffle so selection is still random
      for (let i = candidateLetters.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        const tmp = candidateLetters[i]!; candidateLetters[i] = candidateLetters[j]!; candidateLetters[j] = tmp;
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
    constraintType !== 'repeated_letter' &&
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
    description: 'Start with Names, Places, Animal (3 cats). L2: +Thing. L5: +Food&Dishes. L11: +Sports&Games. L16: +Fruits&Veg. L21: +Countries. Combo letters at L10, L15, L19, L23.',
    timerRange: [18, 16],
    passScoreRange: [30, 45],
    categoryCountRange: [3, 6],
    letterDifficulties: ['easy'],
    constraintPool: ['none', 'min_word_length', 'double_letters'],
    allowComboConstraints: false,
    survivalModeChance: 0,
    bonusMultiplierRange: [1.0, 1.0],
    availableCategories: ['names', 'animal', 'places', 'thing', 'brands', 'fruits_vegetables', 'professions'],
  },
  {
    bandNumber: 2,
    name: 'Getting Started',
    levelRange: [26, 50],
    description: 'L31: +Brands. L41: +Celebrities. Combo letters at SO/LA/TA. Ends-with constraints, easy category breathers.',
    timerRange: [14, 12],
    passScoreRange: [35, 50],
    categoryCountRange: [6, 8],
    letterDifficulties: ['easy', 'normal'],
    constraintPool: ['none', 'min_word_length', 'ends_with_letter', 'double_letters'],
    allowComboConstraints: false,
    survivalModeChance: 0,
    bonusMultiplierRange: [1.0, 1.1],
    availableCategories: [
      'names', 'animal', 'places', 'thing', 'brands', 'fruits_vegetables',
      'professions', 'celebrities', 'food_dishes', 'countries',
    ],
  },
  {
    bandNumber: 3,
    name: 'Picking Up Speed',
    levelRange: [51, 100],
    description: 'L51: +Professions. L61: +Health Issues (all 12 cats). Multi-letter mode at L64. Harder letters appear.',
    timerRange: [12, 10],
    passScoreRange: [45, 60],
    categoryCountRange: [10, 12],
    letterDifficulties: ['easy', 'normal'],
    constraintPool: ['none', 'min_word_length', 'max_word_length', 'contains_vowel', 'no_repeat_letters', 'repeated_letter', 'odd_length', 'double_letters', 'ends_with_letter', 'combo'],
    allowComboConstraints: true,
    survivalModeChance: 0,
    bonusMultiplierRange: [1.1, 1.2],
    availableCategories: [
      'names', 'animal', 'places', 'thing', 'brands', 'fruits_vegetables',
      'professions', 'celebrities', 'food_dishes', 'countries', 'sports_games', 'health_issues',
    ],
  },
  {
    bandNumber: 4,
    name: 'Challenger',
    levelRange: [101, 200],
    description: 'All 12 categories unlocked, no-repeat-letters constraint',
    timerRange: [10, 8],
    passScoreRange: [55, 72],
    categoryCountRange: [12, 12],
    letterDifficulties: ['normal', 'hard'],
    constraintPool: ['none', 'min_word_length', 'max_word_length', 'no_repeat_letters'],
    allowComboConstraints: false,
    survivalModeChance: 0,
    bonusMultiplierRange: [1.2, 1.4],
    availableCategories: [
      'names', 'animal', 'places', 'thing', 'brands', 'fruits_vegetables',
      'professions', 'celebrities', 'food_dishes', 'countries', 'sports_games', 'health_issues',
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
    constraintPool: ['none', 'min_word_length', 'max_word_length', 'no_repeat_letters', 'repeated_letter', 'time_pressure'],
    allowComboConstraints: false,
    survivalModeChance: 0.15,
    bonusMultiplierRange: [1.4, 1.6],
    availableCategories: [
      'names', 'animal', 'places', 'thing', 'brands', 'fruits_vegetables',
      'professions', 'celebrities', 'food_dishes', 'countries', 'sports_games', 'health_issues',
    ],
    multiLetterMode: true,
  },
  {
    bandNumber: 6,
    name: 'Master',
    levelRange: [301, 400],
    description: 'All 12 categories, triple constraints, tight timers',
    timerRange: [6, 5],
    passScoreRange: [78, 90],
    categoryCountRange: [12, 12],
    letterDifficulties: ['hard', 'normal'],
    constraintPool: ['min_word_length', 'max_word_length', 'no_repeat_letters', 'repeated_letter', 'time_pressure', 'double_letters'],
    allowComboConstraints: false,
    survivalModeChance: 0.3,
    bonusMultiplierRange: [1.6, 1.8],
    availableCategories: [
      'names', 'animal', 'places', 'thing', 'brands', 'fruits_vegetables',
      'professions', 'celebrities', 'food_dishes', 'countries', 'sports_games', 'health_issues',
    ],
    multiLetterMode: true,
  },
  {
    bandNumber: 7,
    name: 'Legendary',
    levelRange: [401, 500],
    description: 'All 12 categories — maximum difficulty',
    timerRange: [5, 4],
    passScoreRange: [88, 95],
    categoryCountRange: [12, 12],
    letterDifficulties: ['hard'],
    constraintPool: ['min_word_length', 'max_word_length', 'no_repeat_letters', 'repeated_letter', 'time_pressure', 'double_letters', 'ends_with_letter', 'combo'],
    allowComboConstraints: true,
    survivalModeChance: 0.45,
    bonusMultiplierRange: [1.8, 2.0],
    availableCategories: [
      'names', 'animal', 'places', 'thing', 'brands', 'fruits_vegetables',
      'professions', 'celebrities', 'food_dishes', 'countries', 'sports_games', 'health_issues',
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
  const availableCategories = getAvailableCategories(levelNumber);
  const override = LEVEL_OVERRIDES[levelNumber];
  const twoLetterCombo = TWO_LETTER_LEVELS[levelNumber];

  // ─── LETTER ───────────────────────────────────────────────────────────────
  let letter: string;
  let letterType: LevelData['letterType'];
  let letterOptions: string[] | undefined;

  if (twoLetterCombo) {
    letter = twoLetterCombo;
    letterType = 'two_letter';
  } else if (override?.forceLetter) {
    letter = override.forceLetter;
    letterType = override.forceLetter.length > 1 ? 'two_letter' : 'hard';
  } else if (override?.forceLetterOptions) {
    // All options are valid — don't pick one, expose all to the player
    letterOptions = override.forceLetterOptions;
    letter = override.forceLetterOptions[0]!; // primary letter for validation/display
    letterType = letter.length > 1 ? 'two_letter' : 'normal';
  } else if (levelNumber <= 100) {
    // Use pre-computed assignment — guaranteed no adjacent duplicates
    letter = LEVEL_LETTER_ASSIGNMENTS[levelNumber] ?? 'S';
    letterType = LETTER_POOLS.easy.includes(letter) ? 'easy' : 'normal';
  } else {
    const sel = selectLetter(levelNumber, rng, availableCategories, new Set());
    letter = sel.letter;
    letterType = sel.type;
  }

  // ─── MULTI-LETTER MODE ────────────────────────────────────────────────────
  const isMultiLetterMode = override?.isMultiLetterMode ??
    (levelNumber >= 200 && rng.next() < Math.min((levelNumber - 200) / 300, 0.6));

  // ─── CATEGORIES ───────────────────────────────────────────────────────────
  let categories: CategoryType[];

  if (override?.specificCategories) {
    // Exact set — bypass impossible-combo filtering (user designed this deliberately)
    categories = override.specificCategories;
  } else if (override?.useFullPool) {
    if (isMultiLetterMode) {
      categories = enforceMutualExclusion(rng.shuffle(availableCategories), rng);
    } else {
      const impossible = letter.length === 1 ? (IMPOSSIBLE_COMBOS[letter] ?? []) : [];
      const valid = availableCategories.filter((c) => !impossible.includes(c));
      categories = enforceMutualExclusion(rng.shuffle(valid), rng);
    }
  } else if (override?.useEasyCategories) {
    const easyPool = getEasyCategoriesForLevel(levelNumber);
    const impossible = letter.length === 1 ? (IMPOSSIBLE_COMBOS[letter] ?? []) : [];
    const cType = override.constraintType;
    const filterFn = (c: CategoryType) => {
      if (impossible.includes(c)) return false;
      // Also exclude categories that are impossible given the constraint + letter combo
      if (cType && letter.length === 1 && !isConstraintPlayable(letter, c, cType)) return false;
      return true;
    };
    const validEasy = easyPool.filter(filterFn);
    const exclusionPool = enforceMutualExclusion(rng.shuffle(validEasy), rng);
    const targetCount = override.easyCount ?? override.categoryCount ?? 4;

    let finalPool = exclusionPool;
    // If the easy pool (after constraint + mutual-exclusion filtering) is smaller than
    // needed (e.g. ends_with_letter + letter 'Y' kills most categories), fall back to
    // the full band pool so the level always gets enough categories.
    if (exclusionPool.length < targetCount) {
      const validFull = availableCategories.filter(filterFn);
      const fullPool = enforceMutualExclusion(rng.shuffle(validFull), rng);
      if (fullPool.length > exclusionPool.length) {
        finalPool = fullPool;
      }
    }

    const count = Math.min(targetCount, finalPool.length);
    categories = finalPool.slice(0, count);
  } else if (override?.categoryCount !== undefined) {
    const impossible = letter.length === 1 ? (IMPOSSIBLE_COMBOS[letter] ?? []) : [];
    const cType = override.constraintType;
    const valid = availableCategories.filter((c) => {
      if (impossible.includes(c)) return false;
      if (cType && letter.length === 1 && !isConstraintPlayable(letter, c, cType)) return false;
      return true;
    });
    const pool = enforceMutualExclusion(rng.shuffle(valid), rng);
    categories = pool.slice(0, Math.min(override.categoryCount, pool.length));
    // Guarantee milestone category is included at its introduction level.
    // When the milestone wasn't in the slice, replace the last element with it, then
    // deterministically remove its mutual-exclusion partner (if present).
    // We do NOT re-call enforceMutualExclusion here because that function uses
    // rng.next() < 0.5 and could randomly drop the milestone we just added.
    const thisMilestone = CATEGORY_MILESTONES.find(m => m.level === levelNumber);
    if (thisMilestone && !categories.includes(thisMilestone.category) && valid.includes(thisMilestone.category)) {
      let newCats = [...categories.slice(0, categories.length - 1), thisMilestone.category];
      for (const [catA, catB] of MUTUALLY_EXCLUSIVE_PAIRS) {
        const partner = catA === thisMilestone.category ? catB : catB === thisMilestone.category ? catA : null;
        if (partner && newCats.includes(partner)) {
          newCats = newCats.filter(c => c !== partner);
        }
      }
      categories = newCats;
    }
  } else {
    // L101+ default: all available (filtered by impossible combos)
    categories = selectCategories(levelNumber, rng, getCategoryCount(levelNumber, rng), letter);
  }

  // ─── MULTI-LETTER ASSIGNMENT ──────────────────────────────────────────────
  let lettersPerCategory: string[] | undefined;
  let primaryLetter = letter;

  if (isMultiLetterMode && categories.length > 0) {
    if (override?.multiLetterAssignments) {
      lettersPerCategory = categories.map((cat) => override.multiLetterAssignments![cat] ?? letter);
    } else if (override?.multiLetterOptions) {
      const shuffled = rng.shuffle([...override.multiLetterOptions]);
      lettersPerCategory = categories.map((_, i) => shuffled[i % shuffled.length]!);
    } else {
      lettersPerCategory = selectMultipleLetters(levelNumber, rng, categories);
    }
    primaryLetter = lettersPerCategory[0] ?? letter;
  }

  // ─── CONSTRAINT ───────────────────────────────────────────────────────────
  let constraint: LevelConstraint;

  if (override?.constraintType) {
    const cType = override.constraintType;
    if (cType === 'min_word_length') {
      const val = override.constraintValue ?? 4;
      constraint = { type: 'min_word_length', value: val, description: `Words must be ${val}+ letters` };
    } else if (cType === 'max_word_length') {
      const val = override.constraintValue ?? 8;
      constraint = { type: 'max_word_length', value: val, description: `Words must be ${val} letters or less` };
    } else if (cType === 'ends_with_letter') {
      const el = override.constraintEndLetterOptions
        ? rng.pick(override.constraintEndLetterOptions)
        : (override.constraintEndLetter ?? 'E');
      constraint = { type: 'ends_with_letter', endLetter: el, description: `Words must end with "${el}"` };
    } else if (cType === 'double_letters') {
      constraint = { type: 'double_letters', description: 'Words must contain double letters (ee, ll, ss...)' };
    } else if (cType === 'no_repeat_letters') {
      constraint = { type: 'no_repeat_letters', description: 'No letter can repeat in your answer' };
    } else if (cType === 'repeated_letter') {
      constraint = { type: 'repeated_letter', description: 'Word must contain a repeated letter (e.g. paper, level, total)' };
    } else if (cType === 'combo' && override.comboConstraints) {
      const combos = override.comboConstraints;
      const descriptions = combos.map((c) => {
        if (c.type === 'min_word_length') return `${c.value}+ letters`;
        if (c.type === 'max_word_length') return `${c.value} letters or less`;
        if (c.type === 'ends_with_letter') return `ends with "${c.endLetter}"`;
        return c.type;
      });
      constraint = { type: 'combo', comboConstraints: combos, description: descriptions.join(' + ') };
    } else {
      constraint = { type: 'none', description: 'No special constraints' };
    }
  } else if (levelNumber <= 100) {
    // Levels 1-100 without explicit override get no constraint
    // (combo/hard-letter levels are already challenging enough)
    constraint = { type: 'none', description: 'No special constraints' };
  } else {
    constraint = selectConstraint(levelNumber, rng, primaryLetter, categories, lettersPerCategory);
  }

  // ─── TIMER ────────────────────────────────────────────────────────────────
  let timerSeconds: number;

  if (override?.timerSecondsPerCategory) {
    timerSeconds = override.timerSecondsPerCategory * categories.length;
  } else {
    timerSeconds = getBaseTimerSeconds(levelNumber, categories.length);
  }

  // --- Scoring ---
  const maxPossibleScore = categories.length * 10;
  const passScorePercent = getPassScorePercent(levelNumber, categories.length);
  const minScoreToPass = Math.ceil((maxPossibleScore * passScorePercent) / 100);

  // --- Survival (probabilistic only for levels 100+, survival constraint type removed) ---
  const isSurvivalMode = rng.next() < getSurvivalChance(levelNumber);

  // --- Bonus ---
  const bonusMultiplier = getBonusMultiplier(levelNumber);

  return {
    level: levelNumber,
    band: band.bandNumber,
    bandName: band.name,
    timerSeconds,
    letter: isMultiLetterMode ? primaryLetter : letter,
    letterType,
    letterOptions,
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
    : level.letterOptions
      ? `Letter options: ${level.letterOptions.join(' / ')}`
      : `Letter "${level.letter}"`;

  return `Level ${level.level} (${level.bandName}): ${letterDisplay} | ${level.categoryCount} categories | ${level.timerSeconds}s | Pass: ${level.minScoreToPass}/${level.maxPossibleScore} (${level.passScorePercent}%)${level.isSurvivalMode ? ' | SURVIVAL' : ''} | ${level.constraint.description}`;
}
