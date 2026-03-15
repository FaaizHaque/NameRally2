import { CategoryType } from './state/game-store';

// ─── Local data sets loaded from bundled JSON files ───────────────────────────
// These replace the previous Supabase table queries for validation/hints.
// Supabase is now only used for multiplayer connection (session management).

import namesData from '../data/names.json';
import placesData from '../data/places.json';
import thingsData from '../data/things.json';
import sportsGamesData from '../data/sports_games.json';
import foodDishesData from '../data/food_dishes.json';
import healthIssuesData from '../data/health_issues.json';
import historicalFiguresData from '../data/historical_figures.json';
import moviesData from '../data/movies.json';
import professionsData from '../data/professions.json';
import songsData from '../data/songs.json';
import musicArtistsData from '../data/music_artists.json';
import animalsData from '../data/animals.json';
import fruitsVegetablesData from '../data/fruits_vegetables.json';
import brandsData from '../data/brands.json';

// Build normalized Sets for O(1) lookup — normalized to lowercase, no accents
// Adds multiple spelling variants so players can type any reasonable form.
function buildSet(data: string[]): Set<string> {
  const s = new Set<string>();
  for (const entry of data) {
    if (entry && entry.trim().length > 0) {
      const norm = normalizeForComparison(entry);
      s.add(norm);
      // dot-free variant: "e.t." → "et"
      const noDots = norm.replace(/\./g, '').replace(/\s+/g, ' ').trim();
      if (noDots !== norm) s.add(noDots);
      // no-space variant: "dodge ball" → "dodgeball", "ice cream" → "icecream"
      const noSpaces = norm.replace(/\s+/g, '');
      if (noSpaces !== norm) s.add(noSpaces);
      // hyphenated variant: "dodge ball" → "dodge-ball"
      const hyphenated = norm.replace(/\s+/g, '-');
      if (hyphenated !== norm) s.add(hyphenated);
    }
  }
  return s;
}

const LOCAL_SETS: Partial<Record<CategoryType, Set<string>>> = {
  names:              buildSet(namesData as string[]),
  places:             buildSet(placesData as string[]),
  thing:              buildSet(thingsData as string[]),
  animal:             buildSet(animalsData as string[]),
  fruits_vegetables:  buildSet(fruitsVegetablesData as string[]),
  sports_games:       buildSet(sportsGamesData as string[]),
  food_dishes:        buildSet(foodDishesData as string[]),
  health_issues:      buildSet(healthIssuesData as string[]),
  famous_people: buildSet(historicalFiguresData as string[]),
  movies:             buildSet(moviesData as string[]),
  professions:        buildSet(professionsData as string[]),
  songs:              buildSet(songsData as string[]),
  music_artists:      buildSet(musicArtistsData as string[]),
  brands:             buildSet(brandsData as string[]),
};

// Raw arrays indexed by first char for fast hint lookup
const LOCAL_RAW: Partial<Record<CategoryType, string[]>> = {
  names:              namesData as string[],
  places:             placesData as string[],
  thing:              thingsData as string[],
  animal:             animalsData,
  fruits_vegetables:  fruitsVegetablesData,
  sports_games:       sportsGamesData as string[],
  food_dishes:        foodDishesData as string[],
  health_issues:      healthIssuesData as string[],
  famous_people: historicalFiguresData as string[],
  movies:             moviesData as string[],
  professions:        professionsData as string[],
  songs:              songsData as string[],
  music_artists:      musicArtistsData as string[],
  brands:             brandsData as string[],
};

/**
 * Hardcoded list of all countries (unchanged)
 */
const COUNTRIES_LIST = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina', 'Armenia', 'Australia', 'Austria',
  'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan',
  'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon',
  'Canada', 'Cape Verde', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo', 'Costa Rica',
  'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'East Timor', 'Ecuador',
  'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji', 'Finland', 'France',
  'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau',
  'Guyana', 'Haiti', 'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland',
  'Israel', 'Italy', 'Ivory Coast', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'Kosovo',
  'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania',
  'Luxembourg', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius',
  'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia',
  'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia', 'Norway',
  'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland',
  'Portugal', 'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa', 'San Marino',
  'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands',
  'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland',
  'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey',
  'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Vanuatu',
  'Vatican City', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe',
];

/**
 * Normalizes a word for comparison:
 * - lowercase, strip accents, strip apostrophes, normalize spaces/hyphens
 */
function normalizeForComparison(word: string): string {
  return word
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`´]/g, '')
    .replace(/[\s\-_]+/g, ' ')
    .trim();
}

/**
 * Strips a leading article ("the ", "a ", "an ") from a string.
 * Returns the remainder, or the original string if no article is found.
 */
function stripLeadingArticle(word: string): string {
  return word.replace(/^(the|a|an)\s+/i, '');
}

/**
 * Checks whether a normalized word exists in a local Set,
 * trying a handful of common variations (plural, hyphen, space).
 * When ignoreArticles is true, also tries matching after stripping
 * leading articles ("The", "A", "An") from both the input and dataset entries.
 */
function existsInLocalSet(set: Set<string>, word: string, ignoreArticles: boolean = false): boolean {
  const norm = normalizeForComparison(word);

  if (set.has(norm)) return true;
  // space ↔ hyphen
  if (set.has(norm.replace(/\s+/g, '-'))) return true;
  if (set.has(norm.replace(/-/g, ' '))) return true;
  // no spaces
  if (set.has(norm.replace(/\s+/g, ''))) return true;
  // drop trailing 's'
  if (norm.endsWith('s') && norm.length > 3 && set.has(norm.slice(0, -1))) return true;
  // drop trailing 'es'
  if (norm.endsWith('es') && norm.length > 4 && set.has(norm.slice(0, -2))) return true;
  // berries → berry
  if (norm.endsWith('ies') && norm.length > 4 && set.has(norm.slice(0, -3) + 'y')) return true;

  // Dot removal: "ET" matches "E.T." entries stored without dots, and vice versa
  const noDots = norm.replace(/\./g, '').replace(/\s+/g, ' ').trim();
  if (noDots !== norm) {
    if (set.has(noDots)) return true;
    if (set.has(noDots.replace(/\s+/g, '-'))) return true;
    if (set.has(noDots.replace(/-/g, ' '))) return true;
  }

  // Abbreviation expansion: "St. Petersburg" / "St Petersburg" → "Saint Petersburg"
  const expandAbbrev = (s: string) =>
    s.replace(/\bst\.?\s+/g, 'saint ').replace(/\bmt\.?\s+/g, 'mount ').replace(/\bft\.?\s+/g, 'fort ').trim();
  const expanded = expandAbbrev(norm);
  if (expanded !== norm) {
    if (set.has(expanded)) return true;
    if (set.has(expanded.replace(/\s+/g, '-'))) return true;
  }
  const expandedNoDots = expandAbbrev(noDots);
  if (expandedNoDots !== expanded && expandedNoDots !== noDots) {
    if (set.has(expandedNoDots)) return true;
  }

  // Article-stripping: try matching the user's input (without article) against
  // dataset entries that start with an article, and vice versa.
  if (ignoreArticles) {
    const strippedInput = stripLeadingArticle(norm);
    // User typed without article → check if "the <input>" / "a <input>" / "an <input>" exists
    if (strippedInput !== norm) {
      // Input itself had an article; try the stripped version directly
      if (existsInLocalSet(set, strippedInput, false)) return true;
    }
    // Try prepending articles to the input to match dataset entries like "the godfather"
    for (const article of ['the ', 'a ', 'an ']) {
      const withArticle = article + norm;
      if (set.has(withArticle)) return true;
      if (set.has(withArticle.replace(/\s+/g, '-'))) return true;
      if (set.has(withArticle.replace(/\s+/g, ''))) return true;
    }
    // Also try stripping the article from the input and matching the rest
    if (strippedInput !== norm) {
      for (const article of ['the ', 'a ', 'an ']) {
        const withArticle = article + strippedInput;
        if (set.has(withArticle)) return true;
        if (set.has(withArticle.replace(/\s+/g, '-'))) return true;
        if (set.has(withArticle.replace(/\s+/g, ''))) return true;
      }
    }
  }

  return false;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Validates a word against the local dataset for a category.
 */
export async function validateWordLocally(
  word: string,
  category: CategoryType
): Promise<{ found: boolean; source: 'local' | 'countries' | 'not_found' }> {
  if (category === 'countries') {
    const norm = normalizeForComparison(word);
    const found = COUNTRIES_LIST.some(c => normalizeForComparison(c) === norm);
    return { found, source: found ? 'countries' : 'not_found' };
  }

  const set = LOCAL_SETS[category];
  if (!set) return { found: false, source: 'not_found' };

  const ignoreArticles = category === 'movies' || category === 'songs';
  const found = existsInLocalSet(set, word, ignoreArticles);
  return { found, source: found ? 'local' : 'not_found' };
}

/**
 * Returns hint words from local data starting with `letter`.
 */
export async function getHintsLocally(
  category: CategoryType,
  letter: string,
  limit: number = 20
): Promise<string[]> {
  const letterLower = letter.toLowerCase();

  if (category === 'countries') {
    return COUNTRIES_LIST
      .filter(c => c.toLowerCase().startsWith(letterLower))
      .slice(0, limit);
  }

  const raw = LOCAL_RAW[category];
  if (!raw) return [];

  const matches = raw.filter(w => w && w.toLowerCase().startsWith(letterLower));
  // Shuffle so hints feel varied
  const shuffled = [...matches].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit);
}

/**
 * Fuzzy-validates a word against local data.
 */
export async function validateWordFuzzy(
  word: string,
  category: CategoryType
): Promise<{ found: boolean; matchedWord?: string }> {
  if (category === 'countries') {
    const norm = normalizeForComparison(word);
    const match = COUNTRIES_LIST.find(c => normalizeForComparison(c) === norm);
    return match ? { found: true, matchedWord: match } : { found: false };
  }

  const set = LOCAL_SETS[category];
  const raw = LOCAL_RAW[category];
  if (!set || !raw) return { found: false };

  const ignoreArticles = category === 'movies' || category === 'songs';
  if (existsInLocalSet(set, word, ignoreArticles)) {
    // Find the original-cased entry to return as matchedWord
    const norm = normalizeForComparison(word);
    const strippedNorm = stripLeadingArticle(norm);
    const matchedWord = raw.find(w => {
      const wNorm = normalizeForComparison(w);
      if (wNorm === norm) return true;
      if (ignoreArticles) {
        // Match "godfather" to "The Godfather" or "the godfather" to "Godfather"
        const wStripped = stripLeadingArticle(wNorm);
        if (wStripped === norm || wStripped === strippedNorm) return true;
        if (wNorm === strippedNorm) return true;
        // Match input with prepended articles
        for (const article of ['the ', 'a ', 'an ']) {
          if ((article + norm) === wNorm) return true;
          if ((article + strippedNorm) === wNorm) return true;
        }
      }
      return false;
    }) ?? word;
    return { found: true, matchedWord };
  }

  return { found: false };
}

/**
 * Returns true if the category has a local dataset.
 */
export function hasCategorySupport(category: CategoryType): boolean {
  return category in LOCAL_SETS || category === 'countries';
}
