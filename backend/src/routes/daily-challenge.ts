import { Hono } from 'hono';

/**
 * Daily Challenge API Routes
 *
 * Provides endpoints for generating and retrieving daily challenges.
 * Each day has a unique challenge that all players can attempt.
 */

// Category types matching the frontend
type CategoryType =
  | 'names'
  | 'places'
  | 'animal'
  | 'thing'
  | 'sports_games'
  | 'brands'
  | 'health_issues'
  | 'countries'
  | 'movies'
  | 'songs'
  | 'professions'
  | 'food_dishes'
  | 'historical_figures';

interface DailyChallenge {
  id: string;
  date: string;
  letter: string; // Single letter or combo for ALL categories
  categories: CategoryType[];
  createdAt: number;
}

// All available categories for the daily challenge
const ALL_CATEGORIES: CategoryType[] = [
  'names', 'places', 'animal', 'thing', 'sports_games',
  'brands', 'health_issues', 'countries',
  'movies', 'songs', 'professions', 'food_dishes', 'historical_figures'
];

// Letter pools by difficulty (mirrors single-player level-generator pools)
const EASY_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'L', 'M', 'N', 'P', 'R', 'S', 'T', 'W'];
const MEDIUM_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'R', 'S', 'T', 'U', 'V', 'W'];
const HARD_LETTERS = ['I', 'J', 'K', 'O', 'Q', 'U', 'V', 'Y', 'Z']; // X removed — no valid categories

// Difficulty levels for daily challenges
type DifficultyLevel = 'easy' | 'medium' | 'hard';

// Category count: minimum 6 categories per day
const DAILY_CHALLENGE_CATEGORY_COUNT = 6;

// Impossible letter-category combinations — kept in sync with level-generator.ts
const IMPOSSIBLE_COMBOS: Record<string, CategoryType[]> = {
  X: [
    'animal', 'names', 'places', 'sports_games', 'food_dishes', 'thing',
    'health_issues', 'brands', 'professions', 'historical_figures', 'countries',
    'movies', 'songs',
  ],
  Q: [
    'animal', 'names', 'sports_games', 'food_dishes', 'thing',
    'health_issues', 'brands', 'professions', 'historical_figures', 'songs', 'fruits_vegetables',
  ],
  Z: ['sports_games', 'food_dishes', 'thing', 'health_issues', 'professions', 'songs', 'historical_figures'],
  Y: ['health_issues', 'sports_games', 'professions', 'historical_figures', 'thing', 'brands', 'food_dishes'],
  U: ['health_issues', 'sports_games', 'thing', 'historical_figures'],
  V: ['sports_games', 'health_issues', 'thing', 'historical_figures'],
  K: ['health_issues', 'historical_figures', 'thing'],
  J: ['health_issues', 'sports_games', 'thing', 'historical_figures'],
  I: ['sports_games', 'thing', 'health_issues'],
  O: ['health_issues', 'sports_games', 'thing'],
  W: ['health_issues'],
};

// Category pairs that should NOT appear together in the same challenge
// (too similar — players would be confused about which to use for an answer)
const INCOMPATIBLE_PAIRS: [CategoryType, CategoryType][] = [
  ['countries', 'places'],         // Countries ⊂ Places — overlap is too large
  ['food_dishes', 'fruits_vegetables'], // Both are food — fruits/veg could go in either
];

/**
 * Seeded random number generator for deterministic daily challenges
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
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
}

/**
 * Convert date string to numeric seed
 */
function dateToSeed(dateString: string): number {
  // Use the date string characters to create a numeric seed
  let seed = 0;
  for (let i = 0; i < dateString.length; i++) {
    seed = seed * 31 + dateString.charCodeAt(i);
  }
  return Math.abs(seed);
}

/**
 * Check if a letter-category combination is valid
 */
function isValidLetterCategory(letter: string, category: CategoryType): boolean {
  const impossibleCategories = IMPOSSIBLE_COMBOS[letter];
  if (!impossibleCategories) return true;
  return !impossibleCategories.includes(category);
}

/**
 * Filter out categories that would create incompatible pairs with already-selected ones
 */
function filterIncompatible(candidate: CategoryType, selected: CategoryType[]): boolean {
  for (const [a, b] of INCOMPATIBLE_PAIRS) {
    if (candidate === a && selected.includes(b)) return false;
    if (candidate === b && selected.includes(a)) return false;
  }
  return true;
}

/**
 * Determine difficulty level based on date (cycles through difficulties)
 */
function getDifficultyForDate(dateString: string): DifficultyLevel {
  const seed = dateToSeed(dateString);
  // Use a simple modulo to cycle through difficulties
  // This ensures variety day-to-day
  const dayIndex = seed % 7;
  if (dayIndex < 3) return 'easy';      // ~43% of days
  if (dayIndex < 6) return 'medium';    // ~43% of days
  return 'hard';                         // ~14% of days
}

/**
 * Get letter pool based on difficulty
 */
function getLetterPoolForDifficulty(difficulty: DifficultyLevel): string[] {
  switch (difficulty) {
    case 'easy':
      return EASY_LETTERS;
    case 'medium':
      return MEDIUM_LETTERS;
    case 'hard':
      return HARD_LETTERS;
    default:
      return EASY_LETTERS;
  }
}

// Must be able to fill a full challenge — if a letter can't supply this many valid categories, skip it
const MIN_VALID_CATEGORIES_FOR_LETTER = DAILY_CHALLENGE_CATEGORY_COUNT; // = 6

/**
 * Count how many categories are valid for a given letter
 */
function getValidCategoryCount(letter: string): number {
  const blocked = IMPOSSIBLE_COMBOS[letter] ?? [];
  return ALL_CATEGORIES.filter((c) => !blocked.includes(c)).length;
}

/**
 * Generate a daily challenge for a specific date
 */
function generateDailyChallenge(dateString: string): DailyChallenge {
  const seed = dateToSeed(dateString);
  const rng = new SeededRandom(seed);

  // Determine difficulty for this date
  const difficulty = getDifficultyForDate(dateString);

  // Pick a letter that has enough valid categories (mirrors single-player logic)
  const letterPool = getLetterPoolForDifficulty(difficulty);
  const shuffledPool = rng.shuffle([...letterPool]);
  const letter = shuffledPool.find((l) => getValidCategoryCount(l) >= MIN_VALID_CATEGORIES_FOR_LETTER)
    ?? rng.pick(EASY_LETTERS); // Fallback to easy letter if nothing qualifies

  // Pick 6 random categories that work with this letter and don't form incompatible pairs
  const shuffledCategories = rng.shuffle(
    ALL_CATEGORIES.filter(cat => isValidLetterCategory(letter, cat))
  );
  const selectedCategories: CategoryType[] = [];
  for (const cat of shuffledCategories) {
    if (selectedCategories.length >= DAILY_CHALLENGE_CATEGORY_COUNT) break;
    if (filterIncompatible(cat, selectedCategories)) {
      selectedCategories.push(cat);
    }
  }

  // Generate a unique ID based on date
  const id = `dc-${dateString}`;

  return {
    id,
    date: dateString,
    letter,
    categories: selectedCategories,
    createdAt: Date.now(),
  };
}

/**
 * Generate a shareable code from a challenge result
 */
function generateShareCode(challengeId: string, username: string): string {
  // Create a short unique code
  const combined = `${challengeId}-${username}-${Date.now()}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash * 31 + combined.charCodeAt(i)) % 2147483647;
  }
  // Convert to alphanumeric code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  let temp = Math.abs(hash);
  for (let i = 0; i < 6; i++) {
    code += chars[temp % chars.length];
    temp = Math.floor(temp / chars.length);
  }
  return code;
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDateString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0] ?? '';
}

const dailyChallengeRouter = new Hono();

/**
 * GET /api/daily-challenge
 * Get today's daily challenge
 */
dailyChallengeRouter.get('/', (c) => {
  const today = getTodayDateString();
  const challenge = generateDailyChallenge(today);
  return c.json(challenge);
});

/**
 * GET /api/daily-challenge/:date
 * Get the daily challenge for a specific date
 */
dailyChallengeRouter.get('/:date', (c) => {
  const date = c.req.param('date');

  // Validate date format (YYYY-MM-DD)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return c.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, 400);
  }

  const challenge = generateDailyChallenge(date);
  return c.json(challenge);
});

/**
 * POST /api/daily-challenge/generate-share-code
 * Generate a share code for a completed challenge
 */
dailyChallengeRouter.post('/generate-share-code', async (c) => {
  try {
    const body = await c.req.json();
    const { challengeId, username } = body;

    if (!challengeId || !username) {
      return c.json({ error: 'Missing challengeId or username' }, 400);
    }

    const shareCode = generateShareCode(challengeId, username);
    return c.json({ shareCode });
  } catch (error) {
    return c.json({ error: 'Invalid request body' }, 400);
  }
});

/**
 * GET /api/daily-challenge/share/:code
 * Get challenge info from a share code
 * Note: This returns today's challenge since share codes are for the same day
 */
dailyChallengeRouter.get('/share/:code', (c) => {
  const code = c.req.param('code');

  // Validate code format
  if (!/^[A-Z0-9]{6}$/.test(code)) {
    return c.json({ error: 'Invalid share code format' }, 400);
  }

  // Return today's challenge (share codes are meant to invite friends to play the same day's challenge)
  const today = getTodayDateString();
  const challenge = generateDailyChallenge(today);

  return c.json({
    challenge,
    shareCode: code,
    message: "Join the Daily Challenge!"
  });
});

export { dailyChallengeRouter };
