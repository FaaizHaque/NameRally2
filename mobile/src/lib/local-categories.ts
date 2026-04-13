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
import celebritiesData from '../data/celebrities.json';
import professionsData from '../data/professions.json';
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

// ─── Known Western/Latin aliases for Arabic/Islamic scholarly names ───────────
// Maps the canonical normalized form → array of alternate normalized aliases.
const SCHOLAR_ALIASES: Record<string, string[]> = {
  'ibn sina':           ['avicenna', 'abu ali sina', 'abu ali al husayn ibn sina'],
  'ibn rushd':          ['averroes', 'averrhoes', 'abu al walid ibn rushd'],
  'ibn al haytham':     ['alhazen', 'alhacen', 'al haytham', 'abu ali al haytham'],
  'al zahrawi':         ['abulcasis', 'albucasis', 'abu al qasim al zahrawi'],
  'al khwarizmi':       ['algoritmi', 'al khawarizmi', 'khawarizmi', 'al-khawarizmi'],
  'al biruni':          ['alberuni', 'abu rayhan al biruni', 'abu rayhan biruni', 'biruni'],
  'al razi':            ['rhazes', 'rasis', 'abu bakr al razi', 'abu bakr razi'],
  'al kindi':           ['alkindus', 'abu yusuf al kindi'],
  'al farabi':          ['alpharabius', 'alfarabi', 'abu nasr al farabi'],
  'ibn khaldun':        ['abu zayd ibn khaldun', 'abd al rahman ibn khaldun'],
  'al idrisi':          ['edrisi', 'al-idrisi', 'abu abdallah al idrisi'],
  'al battani':         ['albategnius', 'albatenius'],
  'al tusi':            ['nasir al din al tusi', 'nasireddin tusi'],
  'al masudi':          ['al-masudi', 'abu al hasan al masudi'],
  'al jazari':          ['al-jazari', 'ibn al razzaz al jazari'],
  'ibn al nafis':       ['ibn nafis', 'ala al din ibn al nafis'],
  'jabir ibn hayyan':   ['geber', 'jabir', 'al kimia'],
  'ferdowsi':           ['firdausi', 'firdusi', 'firdousi', 'firdawsi', 'abu al qasim ferdowsi'],
  'omar khayyam':       ['khayyam', 'umar khayyam', 'omar khayyam nishaburi'],
  'rumi':               ['jalal al din rumi', 'mevlana', 'mawlana rumi', 'jalal ud din rumi'],
  'hafez':              ['hafiz', 'khwaja shams ud din hafiz', 'hafiz shirazi'],
  'saadi shirazi':      ['saadi', 'sa di shirazi', 'shaykh saadi'],
  'attar of nishapur':  ['farid ud din attar', 'attar', 'farid al din attar'],
  'nizami ganjavi':     ['nizami', 'ilyas ibn yusuf nizami'],
  'amir khusrow':       ['khusrow', 'amir khusrau', 'khusrau'],
  'jami':               ['nur al din jami', 'molla jami'],
  'al mutanabbi':       ['mutanabbi', 'abu tayyib al mutanabbi'],
  'al ghazali':         ['algazel', 'abu hamid al ghazali', 'imam ghazali'],
  'ibn arabi':          ['muhyiddin ibn arabi', 'shaykh al akbar'],
  'harun al rashid':    ['haroun al rashid', 'harun rashid', 'haroon al rashid'],
  'salah al din al ayyubi': ['saladin', 'salah al din', 'salahuddin', 'saladdin'],
  'tariq ibn ziyad':    ['tariq ziyad', 'tarik ibn ziyad'],
  'khalid ibn al walid':['khalid bin walid', 'khalid al walid', 'khalid ibn walid', 'sword of allah'],
  'muhammad ibn qasim': ['muhammad bin qasim', 'bin qasim', 'ibn qasim'],
  'abu bakr al siddiq': ['abu bakr', 'abu bakr siddiq', 'al siddiq'],
  'umar ibn al khattab':['umar ibn khattab', 'omar ibn khattab', 'umar al farooq', 'farooq'],
  'uthman ibn affan':   ['uthman', 'usman ibn affan', 'usman'],
  'ali ibn abi talib':  ['ali ibn abi talib', 'imam ali', 'ali al murtaza'],
  'suleiman the magnificent': ['suleiman', 'suleyman', 'sulaiman', 'kanuni sultan suleyman'],
  'mehmed ii':          ['mehmed the conqueror', 'sultan mehmed', 'fatih sultan mehmed', 'fatih'],
  'allama iqbal':       ['iqbal', 'muhammad iqbal', 'sir muhammad iqbal'],
  'faiz ahmed faiz':    ['faiz', 'faiz ahmed'],
  'mirza ghalib':       ['ghalib', 'asadullah khan ghalib', 'mirza asadullah'],
  'bulleh shah':        ['bullah shah', 'sayyed abdullah shah qadri'],
  'waris shah':         ['warris shah'],
  'malala yousafzai':   ['malala', 'malala yusufzai', 'malala yousufzai'],
  'abdus salam':        ['dr abdus salam', 'professor abdus salam'],

  // Prophets — Arabic / Hebrew / common name variants
  'prophet noah':       ['nuh', 'prophet nuh', 'nooh'],
  'prophet idris':      ['enoch', 'prophet enoch', 'idris enoch'],
  'prophet hud':        ['hud', 'eber'],
  'prophet salih':      ['saleh', 'saleh prophet'],
  'prophet lot':        ['lut', 'prophet lut'],
  'prophet ishmael':    ['ismail', 'prophet ismail', 'prophet ismael'],
  'prophet isaac':      ['ishaq', 'prophet ishaq'],
  'prophet jacob':      ['yaqub', 'prophet yaqub', 'israel'],
  'prophet joseph':     ['yusuf', 'prophet yusuf'],
  'prophet shuaib':     ['jethro', 'prophet jethro', 'shuayb'],
  'prophet job':        ['ayyub', 'prophet ayyub'],
  'prophet aaron':      ['harun', 'prophet harun'],
  'prophet david':      ['dawud', 'prophet dawud'],
  'prophet solomon':    ['sulayman', 'prophet sulayman', 'prophet sulaiman'],
  'prophet elijah':     ['ilyas', 'prophet ilyas'],
  'prophet elisha':     ['al yasa', 'prophet al yasa'],
  'prophet jonah':      ['yunus', 'prophet yunus'],
  'prophet zechariah':  ['zakariya', 'prophet zakariya', 'prophet zachariah'],
  'prophet john the baptist': ['yahya', 'prophet yahya', 'john the baptist'],
  'prophet jesus':      ['isa', 'prophet isa', 'jesus christ', 'jesus of nazareth'],
  'prophet ezra':       ['uzayr', 'prophet uzayr', 'uzair'],

  // Associated biblical / Quranic figures
  'queen of sheba':     ['bilqis', 'queen bilqis', 'queen of saba'],
  'virgin mary':        ['maryam', 'saint mary', 'our lady', 'blessed virgin'],
  'fatimah bint muhammad': ['fatima', 'fatimah', 'fatima al zahra'],

  // Russian Tsars variants
  'ivan iii of russia': ['ivan the great', 'ivan iii'],
  'boris godunov':      ['boris godunov tsar', 'tsar boris'],
  'michael i of russia':['mikhail romanov', 'tsar mikhail'],
  'elizabeth of russia':['empress elizabeth', 'elizaveta petrovna'],
  'peter iii of russia':['tsar peter iii'],
  'paul i of russia':   ['tsar paul', 'emperor paul i'],
  'nicholas i of russia':['tsar nicholas i', 'nicholas i'],
  'alexander nevsky':   ['prince alexander nevsky', 'nevsky'],

  // US Presidents — common nickname forms
  'theodore roosevelt':  ['ted roosevelt', 'teddy roosevelt', 'tr'],
  'william howard taft': ['bill taft'],
  'dwight d eisenhower': ['ike eisenhower', 'ike', 'dwight eisenhower'],
  'john f kennedy':      ['jfk', 'jack kennedy', 'john kennedy', 'kennedy'],
  'richard nixon':       ['dick nixon'],
  'james carter':        ['jimmy carter', 'jimmy'],
  'william jefferson clinton': ['bill clinton'],
  'george h w bush':     ['george bush sr', 'george hw bush', 'bush sr'],
  'george w bush':       ['george bush jr', 'george w bush', 'dubya'],
  'barack obama':        ['obama', 'barry obama'],

  // Mughal variants
  'bahadur shah zafar': ['bahadur shah ii', 'zafar', 'last mughal emperor'],
  'bahadur shah i':     ['bahadur shah', 'muazzam'],
  'jahandar shah':      ['jahandar'],
  'farrukhsiyar':       ['farrukh siyar'],
  'muhammad shah':      ['muhammad shah mughal', 'rangila'],
  'shah alam ii':       ['shah alam', 'ali gauhar'],
  'akbar shah ii':      ['akbar ii'],
};

// Reverse-index: alias → canonical, so we can look up by alias directly
const ALIAS_TO_CANONICAL = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(SCHOLAR_ALIASES)) {
  for (const alias of aliases) {
    ALIAS_TO_CANONICAL.set(normalizeForComparison(alias), canonical);
  }
}

/**
 * Generates additional lookup variants for a person's name:
 * - First name only ("Malala Yousafzai" → "malala")
 * - Last name only ("Angela Merkel" → "merkel")
 * - First + Last, skipping middle particles ("Omar Abdullah Khan" → "omar khan")
 * - Arabic/Islamic particle substitutions: ibn↔bin, al↔el, etc.
 * - Muhammad spelling variants
 * - Dropping common particles entirely
 */
function nameVariants(norm: string): string[] {
  const variants: string[] = [];
  const words = norm.split(' ').filter(Boolean);
  if (words.length < 2) return variants;

  // First name only
  variants.push(words[0]);
  // Last word only
  variants.push(words[words.length - 1]);

  // First + last (skip middle words) when 3+ tokens
  if (words.length >= 3) {
    variants.push(words[0] + ' ' + words[words.length - 1]);
  }

  // Arabic particles set — used to build particle-free variants
  const PARTICLES = new Set(['ibn', 'bin', 'ben', 'bint', 'al', 'el', 'ul', 'abu', 'abi', 'umm', 'abd', 'aba', 'the']);

  // ibn ↔ bin substitution (keep other words intact)
  const ibnBin = norm
    .replace(/\bibn\b/g, 'bin')
    .replace(/\bbin\b(?! laden)/g, 'ibn'); // bin laden is a special case
  if (ibnBin !== norm) variants.push(ibnBin);

  // al ↔ el substitution
  const alEl = norm.replace(/\bal\b/g, 'el').replace(/\bel\b/g, 'al');
  if (alEl !== norm) variants.push(alEl);

  // Combined ibn→bin + al→el
  const ibnBinAlEl = norm.replace(/\bibn\b/g, 'bin').replace(/\bal\b/g, 'el');
  if (ibnBinAlEl !== norm) variants.push(ibnBinAlEl);

  // Strip ALL particles → bare name tokens only
  const noParticleWords = words.filter(w => !PARTICLES.has(w));
  if (noParticleWords.length > 0 && noParticleWords.length < words.length) {
    const noParticle = noParticleWords.join(' ');
    variants.push(noParticle);
    // Also add first + last of stripped version
    if (noParticleWords.length >= 2) {
      variants.push(noParticleWords[0] + ' ' + noParticleWords[noParticleWords.length - 1]);
    }
    if (noParticleWords.length >= 1) variants.push(noParticleWords[0]);
  }

  // Muhammad / Mohammed / Mohamed spelling normalisation
  const muhNorm = norm.replace(/\b(mohammed|mohamed|mohammad|mohamad|mahomet|mehmed(?!\s+[iv]+\b)|muhammed)\b/g, 'muhammad');
  if (muhNorm !== norm) variants.push(muhNorm);

  // Transliteration: 'kh' ↔ 'h', 'dh' ↔ 'd' (very loose but helps)
  // e.g. "khayyam" vs "hayyam"
  // Skip — too aggressive, would create false positives

  return [...new Set(variants)];
}

/**
 * Builds the celebrities Set: standard variants + name-specific variants + aliases.
 */
function buildCelebritySet(data: string[]): Set<string> {
  const s = buildSet(data); // all standard variants first

  for (const entry of data) {
    if (!entry?.trim()) continue;
    const norm = normalizeForComparison(entry);

    // Name variants (first name, last name, particle substitutions, etc.)
    for (const v of nameVariants(norm)) {
      if (v && v.length >= 2) s.add(v);
    }

    // Known scholar/historical aliases
    const aliases = SCHOLAR_ALIASES[norm];
    if (aliases) {
      for (const alias of aliases) {
        const an = normalizeForComparison(alias);
        s.add(an);
        // Also add no-space and hyphenated variants of alias
        s.add(an.replace(/\s+/g, ''));
        s.add(an.replace(/\s+/g, '-'));
      }
    }
  }

  // Also add all reverse-alias entries (so looking up "avicenna" works even if
  // the canonical "ibn sina" wasn't directly in the data somehow)
  for (const [alias] of ALIAS_TO_CANONICAL) {
    s.add(alias);
  }

  return s;
}

// Also enhance names set with first-name-only and last-name-only variants
function buildNamesSet(data: string[]): Set<string> {
  const s = buildSet(data);
  for (const entry of data) {
    if (!entry?.trim()) continue;
    const norm = normalizeForComparison(entry);
    const words = norm.split(' ').filter(Boolean);
    if (words.length >= 2) {
      s.add(words[0]);                          // first name only
      s.add(words[words.length - 1]);           // last name only
    }
  }
  return s;
}

const LOCAL_SETS: Partial<Record<CategoryType, Set<string>>> = {
  names:              buildNamesSet(namesData as string[]),
  places:             buildSet(placesData as string[]),
  thing:              buildSet(thingsData as string[]),
  animal:             buildSet(animalsData as string[]),
  fruits_vegetables:  buildSet(fruitsVegetablesData as string[]),
  sports_games:       buildSet(sportsGamesData as string[]),
  food_dishes:        buildSet(foodDishesData as string[]),
  health_issues:      buildSet(healthIssuesData as string[]),
  celebrities:        buildCelebritySet(celebritiesData as string[]),
  professions:        buildSet(professionsData as string[]),
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
  celebrities: celebritiesData as string[],
  professions:        professionsData as string[],
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
  'Vatican City', 'Venezuela', 'Vietnam', 'Wales', 'Yemen', 'Zambia', 'Zimbabwe',
  // UK home nations — widely recognised as countries even though not UN sovereign states
  'Scotland', 'England', 'Northern Ireland',
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

  const ignoreArticles = false;
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

  const ignoreArticles = false;
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

  // For names: accept "First Last" if the first name alone is a known name
  // e.g. "Travis Scott", "Jay-Z Rivera", "Kim Kardashian" — first word must be recognised
  if (category === 'names') {
    const words = normalizeForComparison(word).split(/\s+/).filter(Boolean);
    if (words.length >= 2 && set.has(words[0])) {
      return { found: true, matchedWord: word };
    }
  }

  return { found: false };
}

/**
 * Returns true if the category has a local dataset.
 */
export function hasCategorySupport(category: CategoryType): boolean {
  return category in LOCAL_SETS || category === 'countries';
}
