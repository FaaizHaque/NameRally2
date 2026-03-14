import { CategoryType } from './state/game-store';
import placesData from '../data/places.json';
import namesData from '../data/names.json';
import animalsData from '../data/animals.json';
import thingsData from '../data/things.json';
import sportsGamesData from '../data/sports_games.json';
import fruitsVegetablesData from '../data/fruits_vegetables.json';
import brandsData from '../data/brands.json';
import healthIssuesData from '../data/health_issues.json';
import {
  validateWordFuzzyInSupabase,
  getHintsFromSupabase,
  hasSupabaseSupport,
} from './supabase-categories';

// Build Sets from JSON data (lowercase for validation)
function buildLowercaseSet(data: string[]): Set<string> {
  const s = new Set<string>();
  for (const entry of data) {
    if (entry && entry.trim().length > 0) {
      s.add(entry.toLowerCase().trim());
    }
  }
  return s;
}

const WORLD_PLACES_SET = buildLowercaseSet(placesData as string[]);
const WORLD_NAMES_SET = buildLowercaseSet(namesData as string[]);
const ANIMALS_SET = buildLowercaseSet(animalsData as string[]);
const THINGS_SET = buildLowercaseSet(thingsData as string[]);
const SPORTS_GAMES_SET = buildLowercaseSet(sportsGamesData as string[]);
const FRUITS_VEGETABLES_SET = buildLowercaseSet(fruitsVegetablesData as string[]);
const BRANDS_SET = buildLowercaseSet(brandsData as string[]);
const HEALTH_ISSUES_SET = buildLowercaseSet(healthIssuesData as string[]);

// Helper function to get singular form of a word (for plural validation)
const getSingularForm = (word: string): string | null => {
  const w = word.toLowerCase();

  // Handle common plural endings
  if (w.endsWith('ies') && w.length > 4) {
    // berries -> berry, cherries -> cherry
    return w.slice(0, -3) + 'y';
  }
  if (w.endsWith('ves') && w.length > 4) {
    // leaves -> leaf, knives -> knife
    return w.slice(0, -3) + 'f';
  }
  if (w.endsWith('oes') && w.length > 4) {
    // tomatoes -> tomato, potatoes -> potato
    return w.slice(0, -2);
  }
  if (w.endsWith('es') && w.length > 3) {
    // boxes -> box, brushes -> brush
    const withoutEs = w.slice(0, -2);
    // Check if it ends in s, x, z, ch, sh
    if (withoutEs.endsWith('s') || withoutEs.endsWith('x') ||
        withoutEs.endsWith('z') || withoutEs.endsWith('ch') ||
        withoutEs.endsWith('sh')) {
      return withoutEs;
    }
    // Otherwise try removing just 's'
    return w.slice(0, -1);
  }
  if (w.endsWith('s') && w.length > 2 && !w.endsWith('ss')) {
    // cats -> cat, dogs -> dog, pens -> pen
    return w.slice(0, -1);
  }

  return null;
};

// British to American spelling mappings (bidirectional lookup)
const BRITISH_AMERICAN_SPELLINGS: Array<[string, string]> = [
  // -our / -or
  ['colour', 'color'],
  ['favour', 'favor'],
  ['flavour', 'flavor'],
  ['honour', 'honor'],
  ['humour', 'humor'],
  ['labour', 'labor'],
  ['neighbour', 'neighbor'],
  ['behaviour', 'behavior'],
  ['harbour', 'harbor'],
  ['savour', 'savor'],
  ['vapour', 'vapor'],
  ['endeavour', 'endeavor'],
  ['tumour', 'tumor'],
  ['vigour', 'vigor'],
  ['parlour', 'parlor'],
  ['rigour', 'rigor'],
  ['candour', 'candor'],
  ['clamour', 'clamor'],
  ['glamour', 'glamor'],
  ['armour', 'armor'],
  ['rancour', 'rancor'],
  ['odour', 'odor'],
  ['splendour', 'splendor'],
  // -ise / -ize
  ['organise', 'organize'],
  ['realise', 'realize'],
  ['recognise', 'recognize'],
  ['apologise', 'apologize'],
  ['categorise', 'categorize'],
  ['criticise', 'criticize'],
  ['emphasise', 'emphasize'],
  ['equalise', 'equalize'],
  ['finalise', 'finalize'],
  ['generalise', 'generalize'],
  ['harmonise', 'harmonize'],
  ['hospitalise', 'hospitalize'],
  ['legalise', 'legalize'],
  ['localise', 'localize'],
  ['maximise', 'maximize'],
  ['minimise', 'minimize'],
  ['modernise', 'modernize'],
  ['normalise', 'normalize'],
  ['optimise', 'optimize'],
  ['prioritise', 'prioritize'],
  ['specialise', 'specialize'],
  ['standardise', 'standardize'],
  ['summarise', 'summarize'],
  ['sympathise', 'sympathize'],
  ['visualise', 'visualize'],
  ['memorise', 'memorize'],
  ['analyse', 'analyze'],
  ['paralyse', 'paralyze'],
  ['catalyse', 'catalyze'],
  // -re / -er
  ['centre', 'center'],
  ['metre', 'meter'],
  ['litre', 'liter'],
  ['fibre', 'fiber'],
  ['theatre', 'theater'],
  ['lustre', 'luster'],
  ['meagre', 'meager'],
  ['sabre', 'saber'],
  ['spectre', 'specter'],
  ['sombre', 'somber'],
  ['calibre', 'caliber'],
  // -ogue / -og
  ['catalogue', 'catalog'],
  ['dialogue', 'dialog'],
  ['monologue', 'monolog'],
  ['prologue', 'prolog'],
  ['epilogue', 'epilog'],
  // -ence / -ense
  ['defence', 'defense'],
  ['offence', 'offense'],
  ['licence', 'license'],
  ['pretence', 'pretense'],
  // -ae- / -e-
  ['anaemia', 'anemia'],
  ['anaesthesia', 'anesthesia'],
  ['encyclopaedia', 'encyclopedia'],
  ['paediatric', 'pediatric'],
  ['haemoglobin', 'hemoglobin'],
  ['haemorrhage', 'hemorrhage'],
  ['leukaemia', 'leukemia'],
  ['oesophagus', 'esophagus'],
  ['orthopaedic', 'orthopedic'],
  ['gynaecology', 'gynecology'],
  ['paedophile', 'pedophile'],
  ['foetus', 'fetus'],
  // -ll / -l
  ['travelled', 'traveled'],
  ['travelling', 'traveling'],
  ['traveller', 'traveler'],
  ['cancelled', 'canceled'],
  ['cancelling', 'canceling'],
  ['labelled', 'labeled'],
  ['labelling', 'labeling'],
  ['modelled', 'modeled'],
  ['modelling', 'modeling'],
  ['counsellor', 'counselor'],
  ['councillor', 'councilor'],
  ['jeweller', 'jeweler'],
  ['jewellery', 'jewelry'],
  ['marvellous', 'marvelous'],
  ['signalling', 'signaling'],
  ['fuelled', 'fueled'],
  ['fuelling', 'fueling'],
  ['quarrelled', 'quarreled'],
  ['rivalled', 'rivaled'],
  ['totalled', 'totaled'],
  // Common food/everyday items
  ['yoghurt', 'yogurt'],
  ['doughnut', 'donut'],
  ['grey', 'gray'],
  ['mould', 'mold'],
  ['moult', 'molt'],
  ['plough', 'plow'],
  ['draught', 'draft'],
  ['cheque', 'check'],
  ['kerb', 'curb'],
  ['tyre', 'tire'],
  ['pyjamas', 'pajamas'],
  ['aluminium', 'aluminum'],
  ['aeroplane', 'airplane'],
  ['sulphur', 'sulfur'],
  ['moustache', 'mustache'],
  ['sceptic', 'skeptic'],
  ['programme', 'program'],
  ['omelette', 'omelet'],
  ['manoeuvre', 'maneuver'],
  ['skilful', 'skillful'],
  ['wilful', 'willful'],
  ['fulfil', 'fulfill'],
  ['instalment', 'installment'],
  ['enrol', 'enroll'],
  ['enrolment', 'enrollment'],
  ['cosy', 'cozy'],
  ['storey', 'story'],
  ['artefact', 'artifact'],
  ['analogue', 'analog'],
  ['ageing', 'aging'],
  ['judgement', 'judgment'],
  ['acknowledgement', 'acknowledgment'],
  ['axe', 'ax'],
  ['gaol', 'jail'],
  ['liquorice', 'licorice'],
  ['speciality', 'specialty'],
  ['connexion', 'connection'],
];

// Build lookup maps for quick access
const britishToAmerican = new Map<string, string>();
const americanToBritish = new Map<string, string>();
for (const [british, american] of BRITISH_AMERICAN_SPELLINGS) {
  britishToAmerican.set(british, american);
  americanToBritish.set(american, british);
}

// Get alternate spelling variants of a word (returns array of possible spellings)
const getSpellingVariants = (word: string): string[] => {
  const w = word.toLowerCase();
  const variants = [w];

  // Check direct mappings
  if (britishToAmerican.has(w)) {
    variants.push(britishToAmerican.get(w)!);
  }
  if (americanToBritish.has(w)) {
    variants.push(americanToBritish.get(w)!);
  }

  // Handle pattern-based transformations for words not in the list
  // -our / -or
  if (w.endsWith('our') && !britishToAmerican.has(w)) {
    variants.push(w.slice(0, -3) + 'or');
  }
  if (w.endsWith('or') && w.length > 3 && !americanToBritish.has(w)) {
    const britishForm = w.slice(0, -2) + 'our';
    variants.push(britishForm);
  }

  // -ise / -ize
  if (w.endsWith('ise') && !britishToAmerican.has(w)) {
    variants.push(w.slice(0, -3) + 'ize');
  }
  if (w.endsWith('ize') && !americanToBritish.has(w)) {
    variants.push(w.slice(0, -3) + 'ise');
  }

  // -re / -er (at end of word)
  if (w.endsWith('re') && w.length > 3 && !britishToAmerican.has(w)) {
    // centre -> center, but not 'are', 'more', etc.
    const stem = w.slice(0, -2);
    if (!['a', 'o', 'i', 'u', 'e', 'mo', 'bo', 'co', 'sco', 'sto', 'fo', 'sho', 'who'].some(x => stem.endsWith(x))) {
      variants.push(stem + 'er');
    }
  }
  if (w.endsWith('er') && w.length > 3 && !americanToBritish.has(w)) {
    const stem = w.slice(0, -2);
    // Only for words that commonly have -re variants
    if (['cent', 'met', 'lit', 'fib', 'theat', 'lust', 'meag', 'sab', 'spect', 'somb', 'calib'].some(x => stem.endsWith(x))) {
      variants.push(stem + 're');
    }
  }

  return [...new Set(variants)];
};

// Normalize an answer to handle abbreviations and punctuation variations.
// Returns all possible normalized forms to look up in the database, e.g.:
//   "St. Petersburg" -> ["st. petersburg", "st petersburg", "saint petersburg"]
//   "Mt. Everest"    -> ["mt. everest", "mt everest", "mount everest"]
const getNormalizedVariants = (answer: string): string[] => {
  const w = answer.toLowerCase().trim();
  const variants = new Set<string>([w]);

  // Strip trailing dots from abbreviations: "St." -> "St", "Mt." -> "Mt"
  const noDots = w.replace(/\b(\w+)\./g, '$1').trim();
  if (noDots !== w) variants.add(noDots);

  // Expand common abbreviations; applied to both dotted and dot-free forms
  const expansions: Array<[RegExp, string]> = [
    [/\bst\b/g, 'saint'],
    [/\bmt\b/g, 'mount'],
    [/\bft\b/g, 'fort'],
  ];

  for (const base of [w, noDots]) {
    for (const [pattern, replacement] of expansions) {
      const expanded = base.replace(pattern, replacement);
      if (expanded !== base) variants.add(expanded);
    }
  }

  return [...variants];
};

// Combine spelling variants and normalized variants for a comprehensive lookup list
const getAllVariants = (answer: string): string[] => {
  return [...new Set([...getSpellingVariants(answer), ...getNormalizedVariants(answer)])];
};

// Comprehensive word databases for each category
export const WORD_DATABASE: Record<CategoryType, Record<string, string[]>> = {
  names: {
    A: ['Adam', 'Aaron', 'Abigail', 'Abraham', 'Adrian', 'Aiden', 'Alex', 'Alexander', 'Alexandra', 'Alexis', 'Alice', 'Alicia', 'Allison', 'Amanda', 'Amber', 'Amy', 'Andrea', 'Andrew', 'Angela', 'Anna', 'Anne', 'Anthony', 'Antonio', 'April', 'Aria', 'Ariana', 'Ashley', 'Audrey', 'Austin', 'Ava'],
    B: ['Bailey', 'Barbara', 'Barry', 'Beatrice', 'Bella', 'Benjamin', 'Bernard', 'Beth', 'Betty', 'Beverly', 'Bill', 'Billy', 'Blake', 'Bob', 'Bobby', 'Bonnie', 'Brad', 'Bradley', 'Brandon', 'Brenda', 'Brian', 'Brianna', 'Brittany', 'Brooke', 'Bruce', 'Bryan', 'Bryce'],
    C: ['Caitlin', 'Caleb', 'Cameron', 'Camilla', 'Carl', 'Carla', 'Carlos', 'Carmen', 'Carol', 'Caroline', 'Carolyn', 'Carrie', 'Casey', 'Catherine', 'Chad', 'Charles', 'Charlie', 'Charlotte', 'Chelsea', 'Cheryl', 'Chris', 'Christian', 'Christina', 'Christine', 'Christopher', 'Cindy', 'Claire', 'Clara', 'Clarence', 'Claude', 'Claudia', 'Clayton', 'Clifford', 'Clyde', 'Cody', 'Colin', 'Colleen', 'Connie', 'Connor', 'Constance', 'Corey', 'Courtney', 'Craig', 'Crystal', 'Curtis', 'Cynthia'],
    D: ['Daisy', 'Dakota', 'Dale', 'Dallas', 'Dalton', 'Damian', 'Damon', 'Dan', 'Dana', 'Daniel', 'Daniela', 'Danielle', 'Danny', 'Darcy', 'Darlene', 'Darren', 'Darryl', 'Dave', 'David', 'Dawn', 'Dean', 'Deanna', 'Debbie', 'Deborah', 'Debra', 'Delilah', 'Dennis', 'Derek', 'Derrick', 'Destiny', 'Devin', 'Devon', 'Diana', 'Diane', 'Diego', 'Dolores', 'Dominic', 'Don', 'Donald', 'Donna', 'Doris', 'Dorothy', 'Douglas', 'Drew', 'Dustin', 'Dylan'],
    E: ['Earl', 'Eddie', 'Edgar', 'Edith', 'Edmund', 'Edward', 'Edwin', 'Eileen', 'Elaine', 'Eleanor', 'Elena', 'Eli', 'Elijah', 'Elizabeth', 'Ella', 'Ellen', 'Ellie', 'Elliot', 'Ellis', 'Elmer', 'Elsa', 'Elsie', 'Elvis', 'Emily', 'Emma', 'Emmanuel', 'Eric', 'Erica', 'Erik', 'Erin', 'Ernest', 'Esther', 'Ethan', 'Eugene', 'Eva', 'Evan', 'Eve', 'Evelyn', 'Everett', 'Ezra'],
    F: ['Faith', 'Fatima', 'Faye', 'Felicia', 'Felix', 'Fernando', 'Fiona', 'Florence', 'Floyd', 'Frances', 'Francis', 'Frank', 'Franklin', 'Fred', 'Frederick', 'Freddy'],
    G: ['Gabriel', 'Gabriella', 'Gail', 'Garrett', 'Gary', 'Gavin', 'Gene', 'Geoffrey', 'George', 'Georgia', 'Gerald', 'Geraldine', 'Gerard', 'Gina', 'Ginger', 'Gladys', 'Glen', 'Glenda', 'Glenn', 'Gloria', 'Gordon', 'Grace', 'Gracie', 'Graham', 'Grant', 'Greg', 'Gregory', 'Gretchen', 'Guy', 'Gwen', 'Gwendolyn'],
    H: ['Hailey', 'Haley', 'Hannah', 'Harold', 'Harriet', 'Harry', 'Harvey', 'Hayden', 'Hazel', 'Heather', 'Hector', 'Heidi', 'Helen', 'Helena', 'Henry', 'Herbert', 'Herman', 'Hillary', 'Holly', 'Homer', 'Hope', 'Howard', 'Hugh', 'Hunter'],
    I: ['Ian', 'Ida', 'Ignacio', 'Imani', 'Imogen', 'India', 'Ingrid', 'Irene', 'Iris', 'Irma', 'Irving', 'Isaac', 'Isabel', 'Isabella', 'Isabelle', 'Isaiah', 'Isidore', 'Ivan', 'Ivy'],
    J: ['Jack', 'Jackie', 'Jackson', 'Jacob', 'Jacqueline', 'Jade', 'Jaden', 'Jaime', 'Jake', 'James', 'Jamie', 'Jan', 'Jane', 'Janet', 'Janice', 'Jared', 'Jasmine', 'Jason', 'Jasper', 'Javier', 'Jay', 'Jayden', 'Jean', 'Jeanette', 'Jeanne', 'Jeff', 'Jeffery', 'Jeffrey', 'Jenna', 'Jennifer', 'Jenny', 'Jeremiah', 'Jeremy', 'Jerome', 'Jerry', 'Jesse', 'Jessica', 'Jessie', 'Jesus', 'Jill', 'Jim', 'Jimmy', 'Jo', 'Joan', 'Joanna', 'Joanne', 'Jocelyn', 'Jodi', 'Jody', 'Joe', 'Joel', 'Joey', 'John', 'Johnny', 'Jon', 'Jonathan', 'Jordan', 'Jorge', 'Jose', 'Joseph', 'Josephine', 'Josh', 'Joshua', 'Joy', 'Joyce', 'Juan', 'Juanita', 'Judith', 'Judy', 'Julia', 'Julian', 'Juliana', 'Julie', 'Juliet', 'Julio', 'June', 'Junior', 'Justin', 'Justine'],
    K: ['Kaitlyn', 'Karen', 'Kari', 'Karina', 'Karl', 'Karla', 'Kate', 'Katelyn', 'Katherine', 'Kathleen', 'Kathryn', 'Kathy', 'Katie', 'Katrina', 'Kay', 'Kayla', 'Kaylee', 'Keisha', 'Keith', 'Kelly', 'Kelsey', 'Ken', 'Kendall', 'Kendra', 'Kenneth', 'Kenny', 'Kent', 'Kerry', 'Kevin', 'Kim', 'Kimberly', 'Kirk', 'Krista', 'Kristen', 'Kristin', 'Kristina', 'Kristine', 'Kristy', 'Kurt', 'Kyle', 'Kylie'],
    L: ['Lacey', 'Lance', 'Landon', 'Lane', 'Lara', 'Larry', 'Laura', 'Lauren', 'Laurence', 'Laurie', 'Lawrence', 'Layla', 'Lea', 'Leah', 'Lee', 'Leigh', 'Lena', 'Leo', 'Leon', 'Leonard', 'Leonardo', 'Leroy', 'Leslie', 'Lester', 'Levi', 'Lewis', 'Liam', 'Lillian', 'Lily', 'Lincoln', 'Linda', 'Lindsay', 'Lindsey', 'Lisa', 'Lloyd', 'Logan', 'Lois', 'Lola', 'Lonnie', 'Lorena', 'Lorenzo', 'Lori', 'Lorraine', 'Louis', 'Louise', 'Lucas', 'Lucia', 'Lucille', 'Lucy', 'Luis', 'Luke', 'Luna', 'Luther', 'Lydia', 'Lynda', 'Lynn', 'Lynne'],
    M: ['Mabel', 'Mack', 'Mackenzie', 'Macy', 'Madeleine', 'Madeline', 'Madison', 'Mae', 'Maggie', 'Malcolm', 'Malik', 'Mallory', 'Mandy', 'Manuel', 'Marc', 'Marcia', 'Marco', 'Marcus', 'Margaret', 'Margarita', 'Maria', 'Mariah', 'Marian', 'Marianne', 'Marie', 'Marilyn', 'Mario', 'Marion', 'Marisa', 'Marissa', 'Marjorie', 'Mark', 'Marlene', 'Marlon', 'Marsha', 'Marshall', 'Martha', 'Martin', 'Marvin', 'Mary', 'Mason', 'Mathew', 'Matt', 'Matthew', 'Maureen', 'Maurice', 'Max', 'Maxine', 'Maxwell', 'Maya', 'Megan', 'Melanie', 'Melinda', 'Melissa', 'Melody', 'Melvin', 'Mercedes', 'Meredith', 'Mia', 'Michael', 'Micheal', 'Michele', 'Michelle', 'Miguel', 'Mike', 'Mildred', 'Miles', 'Milton', 'Mindy', 'Minnie', 'Miranda', 'Miriam', 'Misty', 'Mitchell', 'Molly', 'Monica', 'Monique', 'Morgan', 'Morris', 'Moses', 'Myra', 'Myrtle'],
    N: ['Nadine', 'Nancy', 'Naomi', 'Natalie', 'Natasha', 'Nathan', 'Nathaniel', 'Neal', 'Neil', 'Nellie', 'Nelson', 'Neville', 'Nicholas', 'Nick', 'Nicky', 'Nicolas', 'Nicole', 'Nigel', 'Nina', 'Noah', 'Noel', 'Nora', 'Norma', 'Norman'],
    O: ['Octavia', 'Olga', 'Olive', 'Oliver', 'Olivia', 'Omar', 'Opal', 'Ora', 'Orlando', 'Oscar', 'Otis', 'Otto', 'Owen'],
    P: ['Pablo', 'Paige', 'Pamela', 'Paris', 'Pat', 'Patricia', 'Patrick', 'Patsy', 'Patty', 'Paul', 'Paula', 'Pauline', 'Pearl', 'Pedro', 'Peggy', 'Penelope', 'Penny', 'Percy', 'Perry', 'Pete', 'Peter', 'Phil', 'Philip', 'Phillip', 'Phoebe', 'Phyllis', 'Preston', 'Priscilla'],
    Q: ['Queen', 'Quentin', 'Quincy', 'Quinn'],
    R: ['Rachael', 'Rachel', 'Rafael', 'Ralph', 'Ramon', 'Ramona', 'Randall', 'Randolph', 'Randy', 'Raquel', 'Ray', 'Raymond', 'Rebecca', 'Rebekah', 'Regina', 'Reginald', 'Rene', 'Renee', 'Rex', 'Rhonda', 'Ricardo', 'Richard', 'Rick', 'Ricky', 'Riley', 'Rita', 'Rob', 'Robert', 'Roberta', 'Roberto', 'Robin', 'Robyn', 'Rochelle', 'Rocky', 'Rod', 'Roderick', 'Rodney', 'Roger', 'Roland', 'Roman', 'Ron', 'Ronald', 'Ronnie', 'Rosa', 'Rosalie', 'Rose', 'Rosemary', 'Rosie', 'Ross', 'Roxanne', 'Roy', 'Ruby', 'Rudy', 'Russell', 'Ruth', 'Ryan'],
    S: ['Sabrina', 'Sadie', 'Sally', 'Salvador', 'Sam', 'Samantha', 'Samuel', 'Sandra', 'Sandy', 'Santiago', 'Sara', 'Sarah', 'Saul', 'Savannah', 'Scott', 'Sean', 'Sebastian', 'Selena', 'Serena', 'Sergio', 'Seth', 'Shane', 'Shannon', 'Shari', 'Sharon', 'Shaun', 'Shawn', 'Shawna', 'Sheena', 'Sheila', 'Shelby', 'Sheldon', 'Shelia', 'Shelley', 'Shelly', 'Sheri', 'Sherri', 'Sherry', 'Sheryl', 'Shirley', 'Sidney', 'Sierra', 'Simon', 'Sofia', 'Sonia', 'Sonja', 'Sonya', 'Sophia', 'Sophie', 'Spencer', 'Stacey', 'Stacy', 'Stan', 'Stanley', 'Stella', 'Stephanie', 'Stephen', 'Steve', 'Steven', 'Stewart', 'Stuart', 'Sue', 'Summer', 'Susan', 'Susanne', 'Susie', 'Suzanne', 'Sylvia', 'Sydney'],
    T: ['Tabitha', 'Tamara', 'Tammy', 'Tanya', 'Tara', 'Taryn', 'Tasha', 'Taylor', 'Ted', 'Teresa', 'Teri', 'Terrance', 'Terrence', 'Terri', 'Terry', 'Tess', 'Tessa', 'Theodore', 'Theresa', 'Thomas', 'Tiffany', 'Tim', 'Timothy', 'Tina', 'Todd', 'Tom', 'Tommy', 'Toni', 'Tony', 'Tonya', 'Tracey', 'Traci', 'Tracy', 'Travis', 'Trent', 'Trevor', 'Tricia', 'Trina', 'Tristan', 'Troy', 'Tyler', 'Tyrone'],
    U: ['Ulysses', 'Uma', 'Umar', 'Una', 'Ursula'],
    V: ['Valerie', 'Vanessa', 'Vaughn', 'Vera', 'Verna', 'Vernon', 'Veronica', 'Vicki', 'Vickie', 'Vicky', 'Victor', 'Victoria', 'Vincent', 'Viola', 'Violet', 'Virginia', 'Vivian'],
    W: ['Wade', 'Wallace', 'Walter', 'Wanda', 'Warren', 'Wayne', 'Wendell', 'Wendy', 'Wesley', 'Whitney', 'Wilbur', 'Wilfred', 'Will', 'Willard', 'William', 'Willie', 'Willis', 'Wilma', 'Wilson', 'Winnie', 'Winston', 'Wyatt'],
    X: ['Xander', 'Xavier', 'Xena', 'Ximena'],
    Y: ['Yolanda', 'Yvette', 'Yvonne', 'Yusuf'],
    Z: ['Zachary', 'Zack', 'Zane', 'Zelda', 'Zoe', 'Zoey'],
  },
  places: {
    A: ['Afghanistan', 'Alabama', 'Alaska', 'Albania', 'Algeria', 'Amsterdam', 'Andorra', 'Angola', 'Ankara', 'Antarctica', 'Argentina', 'Arizona', 'Arkansas', 'Armenia', 'Athens', 'Atlanta', 'Auckland', 'Austin', 'Australia', 'Austria', 'Azerbaijan'],
    B: ['Baghdad', 'Bahamas', 'Bahrain', 'Baku', 'Bali', 'Baltimore', 'Bangkok', 'Bangladesh', 'Barcelona', 'Beijing', 'Belarus', 'Belgium', 'Belgrade', 'Belize', 'Benin', 'Berlin', 'Bermuda', 'Bhutan', 'Birmingham', 'Bogota', 'Bolivia', 'Boston', 'Botswana', 'Brazil', 'Brisbane', 'Bristol', 'Brooklyn', 'Brussels', 'Bucharest', 'Budapest', 'Buenos Aires', 'Buffalo', 'Bulgaria', 'Burkina Faso', 'Burundi'],
    C: ['Cairo', 'California', 'Cambodia', 'Cameroon', 'Canada', 'Cancun', 'Cape Town', 'Cardiff', 'Caribbean', 'Casablanca', 'Chad', 'Charlotte', 'Chicago', 'Chile', 'China', 'Cincinnati', 'Cleveland', 'Colombia', 'Colorado', 'Columbus', 'Comoros', 'Congo', 'Connecticut', 'Copenhagen', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic'],
    D: ['Dallas', 'Damascus', 'Dar es Salaam', 'Delaware', 'Delhi', 'Denmark', 'Denver', 'Detroit', 'Dhaka', 'Djibouti', 'Doha', 'Dominica', 'Dominican Republic', 'Dubai', 'Dublin', 'Durban'],
    E: ['Ecuador', 'Edinburgh', 'Egypt', 'El Paso', 'El Salvador', 'England', 'Equatorial Guinea', 'Eritrea', 'Essex', 'Estonia', 'Ethiopia'],
    F: ['Fiji', 'Finland', 'Florence', 'Florida', 'France', 'Frankfurt', 'Freetown', 'Fresno'],
    G: ['Gabon', 'Gambia', 'Geneva', 'Georgia', 'Germany', 'Ghana', 'Gibraltar', 'Glasgow', 'Greece', 'Greenland', 'Grenada', 'Guadalajara', 'Guam', 'Guatemala', 'Guinea', 'Guyana'],
    H: ['Haiti', 'Hamburg', 'Hanoi', 'Harare', 'Hartford', 'Havana', 'Hawaii', 'Helsinki', 'Ho Chi Minh City', 'Hollywood', 'Honduras', 'Hong Kong', 'Honolulu', 'Houston', 'Hungary'],
    I: ['Iceland', 'Idaho', 'Illinois', 'India', 'Indiana', 'Indianapolis', 'Indonesia', 'Iowa', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Istanbul', 'Italy', 'Ivory Coast'],
    J: ['Jacksonville', 'Jakarta', 'Jamaica', 'Japan', 'Jeddah', 'Jersey', 'Jerusalem', 'Johannesburg', 'Jordan'],
    K: ['Kabul', 'Kampala', 'Kansas', 'Kansas City', 'Karachi', 'Kazakhstan', 'Kentucky', 'Kenya', 'Khartoum', 'Kiev', 'Kigali', 'Kingston', 'Kinshasa', 'Korea', 'Kosovo', 'Kuala Lumpur', 'Kuwait', 'Kyoto', 'Kyrgyzstan'],
    L: ['Lagos', 'Laos', 'Las Vegas', 'Latvia', 'Lebanon', 'Leeds', 'Leipzig', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lima', 'Lisbon', 'Lithuania', 'Liverpool', 'Ljubljana', 'London', 'Long Beach', 'Long Island', 'Los Angeles', 'Louisiana', 'Louisville', 'Luanda', 'Lusaka', 'Luxembourg', 'Lyon'],
    M: ['Macau', 'Macedonia', 'Madagascar', 'Madrid', 'Maine', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Manchester', 'Manhattan', 'Manila', 'Maputo', 'Marseille', 'Maryland', 'Massachusetts', 'Mauritania', 'Mauritius', 'Melbourne', 'Memphis', 'Mexico', 'Miami', 'Michigan', 'Milan', 'Milwaukee', 'Minneapolis', 'Minnesota', 'Mississippi', 'Missouri', 'Moldova', 'Monaco', 'Mongolia', 'Montana', 'Montenegro', 'Montevideo', 'Montreal', 'Morocco', 'Moscow', 'Mozambique', 'Mumbai', 'Munich', 'Myanmar'],
    N: ['Nagoya', 'Nairobi', 'Namibia', 'Naples', 'Nashville', 'Nassau', 'Nebraska', 'Nepal', 'Netherlands', 'Nevada', 'New Delhi', 'New Hampshire', 'New Jersey', 'New Mexico', 'New Orleans', 'New York', 'New Zealand', 'Newark', 'Newcastle', 'Nicaragua', 'Nice', 'Niger', 'Nigeria', 'North Carolina', 'North Dakota', 'Norway', 'Nottingham'],
    O: ['Oakland', 'Ohio', 'Oklahoma', 'Oman', 'Omaha', 'Ontario', 'Oregon', 'Orlando', 'Osaka', 'Oslo', 'Ottawa', 'Oxford'],
    P: ['Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Paris', 'Pennsylvania', 'Perth', 'Peru', 'Philadelphia', 'Philippines', 'Phoenix', 'Pittsburgh', 'Poland', 'Portland', 'Porto', 'Portugal', 'Prague', 'Pretoria', 'Providence', 'Puerto Rico'],
    Q: ['Qatar', 'Quebec', 'Queens', 'Queensland', 'Quito'],
    R: ['Raleigh', 'Reykjavik', 'Rhode Island', 'Richmond', 'Riga', 'Rio de Janeiro', 'Riyadh', 'Romania', 'Rome', 'Rotterdam', 'Russia', 'Rwanda'],
    S: ['Sacramento', 'Salzburg', 'Samoa', 'San Antonio', 'San Diego', 'San Francisco', 'San Jose', 'Santiago', 'Sao Paulo', 'Sarajevo', 'Saudi Arabia', 'Scotland', 'Seattle', 'Senegal', 'Seoul', 'Serbia', 'Seville', 'Shanghai', 'Sheffield', 'Sicily', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Sofia', 'Somalia', 'South Africa', 'South Carolina', 'South Dakota', 'South Korea', 'Spain', 'Sri Lanka', 'Stockholm', 'Strasbourg', 'Stuttgart', 'Sudan', 'Suriname', 'Swaziland', 'Sweden', 'Switzerland', 'Sydney', 'Syria'],
    T: ['Taipei', 'Taiwan', 'Tajikistan', 'Tampa', 'Tanzania', 'Tasmania', 'Tbilisi', 'Tehran', 'Tel Aviv', 'Tennessee', 'Texas', 'Thailand', 'The Hague', 'Tirana', 'Togo', 'Tokyo', 'Toronto', 'Trinidad', 'Tripoli', 'Tucson', 'Tunis', 'Tunisia', 'Turin', 'Turkey', 'Turkmenistan', 'Tuscany'],
    U: ['Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Utah', 'Uzbekistan'],
    V: ['Valencia', 'Vancouver', 'Vanuatu', 'Vatican City', 'Venezuela', 'Venice', 'Vermont', 'Vienna', 'Vietnam', 'Virginia', 'Vladivostok'],
    W: ['Wales', 'Warsaw', 'Washington', 'Wellington', 'West Virginia', 'Wisconsin', 'Wuhan', 'Wyoming'],
    X: ['Xiamen', 'Xian'],
    Y: ['Yangon', 'Yemen', 'Yokohama', 'Yonkers', 'York', 'Yorkshire'],
    Z: ['Zagreb', 'Zambia', 'Zanzibar', 'Zimbabwe', 'Zurich'],
  },
  animal: {
    A: ['Aardvark', 'Albatross', 'Alligator', 'Alpaca', 'Anaconda', 'Angelfish', 'Ant', 'Anteater', 'Antelope', 'Armadillo', 'Atlantic Puffin', 'Aye-Aye'],
    B: ['Baboon', 'Badger', 'Bald Eagle', 'Bandicoot', 'Barracuda', 'Bass', 'Basset Hound', 'Bat', 'Bear', 'Beaver', 'Bee', 'Beetle', 'Beluga Whale', 'Bird', 'Bison', 'Blackbird', 'Blue Jay', 'Blue Whale', 'Boa', 'Boar', 'Bobcat', 'Bonobo', 'Border Collie', 'Brown Bear', 'Buffalo', 'Bull', 'Bullfrog', 'Butterfly', 'Buzzard'],
    C: ['Camel', 'Canary', 'Caribou', 'Carp', 'Cat', 'Caterpillar', 'Catfish', 'Centipede', 'Chameleon', 'Cheetah', 'Chicken', 'Chihuahua', 'Chimpanzee', 'Chinchilla', 'Chipmunk', 'Clam', 'Clownfish', 'Cobra', 'Cockatiel', 'Cockatoo', 'Cockroach', 'Cod', 'Corn Snake', 'Cougar', 'Cow', 'Coyote', 'Crab', 'Crane', 'Cricket', 'Crocodile', 'Crow', 'Cuckoo'],
    D: ['Dachshund', 'Dalmatian', 'Deer', 'Dingo', 'Dinosaur', 'Dog', 'Dolphin', 'Donkey', 'Dormouse', 'Dove', 'Dragonfly', 'Duck', 'Dugong', 'Dung Beetle'],
    E: ['Eagle', 'Earthworm', 'Echidna', 'Eel', 'Egret', 'Elephant', 'Elephant Seal', 'Elk', 'Emu'],
    F: ['Falcon', 'Ferret', 'Finch', 'Firefly', 'Fish', 'Flamingo', 'Flatworm', 'Fly', 'Fox', 'Frog'],
    G: ['Gazelle', 'Giant Anteater', 'Giant Panda', 'Giraffe', 'Gnat', 'Goat', 'Goose', 'Gopher', 'Gorilla', 'Grasshopper', 'Great White Shark', 'Green Sea Turtle', 'Grey Whale', 'Groundhog'],
    H: ['Hammerhead Shark', 'Hare', 'Hawk', 'Hedgehog', 'Heron', 'Herring', 'Hippopotamus', 'Horse', 'Husky', 'Hyena'],
    I: ['Iguana', 'Impala', 'Inchworm'],
    J: ['Jackal', 'Jackrabbit', 'Jaguar', 'Jellyfish'],
    K: ['Kangaroo', 'Killer Whale', 'King Cobra', 'Kingfisher', 'Koala', 'Komodo Dragon', 'Kookaburra', 'Krill'],
    L: ['Lamb', 'Lemming', 'Lemur', 'Leopard', 'Lion', 'Lionfish', 'Llama', 'Lobster', 'Lynx'],
    M: ['Manatee', 'Mantis', 'Marmot', 'Meerkat', 'Mink', 'Mole', 'Mongoose', 'Monkey', 'Moose', 'Mountain Lion', 'Mouse', 'Mule', 'Muskox', 'Muskrat'],
    N: ['Narwhal', 'Newt', 'Nightingale'],
    O: ['Ocelot', 'Octopus', 'Opossum', 'Orangutan', 'Orca', 'Osprey', 'Ostrich', 'Otter', 'Owl', 'Ox'],
    P: ['Panda', 'Panther', 'Peacock', 'Pelican', 'Penguin', 'Pig', 'Pigeon', 'Platypus', 'Polar Bear', 'Porcupine', 'Prawn', 'Praying Mantis', 'Puma', 'Python'],
    Q: ['Quail', 'Quetzal'],
    R: ['Rabbit', 'Raccoon', 'Rat', 'Ray', 'Reindeer', 'Rhino', 'Robin', 'Rooster', 'Roundworm'],
    S: ['Salmon', 'Sandpiper', 'Scorpion', 'Sea Lion', 'Seahorse', 'Seal', 'Shark', 'Sheep', 'Shrimp', 'Siberian Tiger', 'Skunk', 'Sloth', 'Slug', 'Snail', 'Snake', 'Snow Leopard', 'Spider', 'Sponge', 'Squid', 'Squirrel', 'Starfish', 'Stork', 'Swan', 'Swordfish'],
    T: ['Tapir', 'Tarantula', 'Tasmanian Devil', 'Tiger', 'Tiger Shark', 'Tortoise', 'Trout', 'Turkey', 'Turtle'],
    U: ['Uakari'],
    V: ['Vampire Bat', 'Velociraptor', 'Viper', 'Vole', 'Vulture'],
    W: ['Wallaby', 'Walrus', 'Warthog', 'Wasp', 'Water Buffalo', 'Weasel', 'Whale', 'Whale Shark', 'Whippet', 'White Rhino', 'Wildcat', 'Wildebeest', 'Wolf', 'Wolverine', 'Wombat', 'Woodpecker', 'Wren'],
    X: ['X-Ray Fish'],
    Y: ['Yak', 'Yorkshire Terrier'],
    Z: ['Zebra', 'Zebu'],
  },
  thing: {
    A: ['Accordion', 'Acorn', 'Airplane', 'Alarm', 'Album', 'Ambulance', 'Anchor', 'Antenna', 'Apple', 'Apron', 'Aquarium', 'Arm', 'Armchair', 'Arrow', 'Axe'],
    B: ['Backpack', 'Badge', 'Bag', 'Ball', 'Balloon', 'Banana', 'Band', 'Bandage', 'Bank', 'Banner', 'Barrel', 'Basket', 'Bat', 'Bath', 'Battery', 'Bead', 'Beam', 'Bean', 'Bed', 'Bell', 'Belt', 'Bench', 'Bicycle', 'Binoculars', 'Blanket', 'Blender', 'Block', 'Boat', 'Bolt', 'Bomb', 'Bone', 'Book', 'Bookshelf', 'Boomerang', 'Boot', 'Bottle', 'Bowl', 'Box', 'Bracelet', 'Brake', 'Branch', 'Bread', 'Brick', 'Bridge', 'Briefcase', 'Broom', 'Brush', 'Bubble', 'Bucket', 'Building', 'Bulb', 'Bullet', 'Bus', 'Bush', 'Button'],
    C: ['Cabinet', 'Cable', 'Cage', 'Cake', 'Calculator', 'Calendar', 'Camera', 'Can', 'Candle', 'Candy', 'Cane', 'Cannon', 'Canoe', 'Cap', 'Car', 'Card', 'Carpet', 'Carrot', 'Cart', 'Case', 'Castle', 'Cat', 'Ceiling', 'Cell', 'Chain', 'Chair', 'Chalk', 'Chart', 'Cheese', 'Chest', 'Chip', 'Chocolate', 'Circle', 'Clamp', 'Clip', 'Clock', 'Cloth', 'Cloud', 'Coat', 'Coin', 'Collar', 'Comb', 'Compass', 'Computer', 'Cone', 'Container', 'Cookie', 'Cord', 'Cork', 'Corner', 'Couch', 'Counter', 'Cover', 'Crayon', 'Cream', 'Crown', 'Cube', 'Cup', 'Curtain', 'Cushion', 'Cylinder'],
    D: ['Dart', 'Desk', 'Diamond', 'Dice', 'Dictionary', 'Dish', 'Disk', 'Doll', 'Dollar', 'Door', 'Doorbell', 'Dot', 'Drawer', 'Dress', 'Drill', 'Drink', 'Drum', 'Dryer'],
    E: ['Earring', 'Egg', 'Elastic', 'Elbow', 'Elevator', 'Engine', 'Envelope', 'Eraser', 'Eye'],
    F: ['Fabric', 'Face', 'Fan', 'Faucet', 'Feather', 'Fence', 'File', 'Film', 'Filter', 'Finger', 'Fire', 'Flag', 'Flame', 'Flashlight', 'Flask', 'Floor', 'Flower', 'Flute', 'Foam', 'Folder', 'Food', 'Foot', 'Football', 'Fork', 'Frame', 'Freezer', 'Fridge', 'Fruit', 'Funnel', 'Fur', 'Furniture'],
    G: ['Game', 'Garage', 'Garbage', 'Garden', 'Garlic', 'Gas', 'Gate', 'Gauge', 'Gear', 'Gem', 'Gift', 'Glass', 'Glasses', 'Globe', 'Glove', 'Glue', 'Goal', 'Gold', 'Golf', 'Gong', 'Grain', 'Grape', 'Graph', 'Grass', 'Grater', 'Gravel', 'Grill', 'Grip', 'Grocery', 'Ground', 'Guitar', 'Gum', 'Gun'],
    H: ['Hair', 'Hammer', 'Handle', 'Hanger', 'Hardware', 'Harmonica', 'Harp', 'Hat', 'Headphones', 'Heart', 'Heater', 'Hedge', 'Helmet', 'Highlighter', 'Hinge', 'Hole', 'Hook', 'Hoop', 'Horn', 'Hose', 'House'],
    I: ['Ice', 'Icicle', 'Ink', 'Instrument', 'Iron', 'Island', 'Ivory'],
    J: ['Jacket', 'Jar', 'Jeans', 'Jeep', 'Jelly', 'Jet', 'Jewel', 'Jewelry', 'Jigsaw', 'Journal', 'Joystick', 'Jug', 'Juice', 'Junk'],
    K: ['Kayak', 'Keg', 'Kettle', 'Key', 'Keyboard', 'Keychain', 'Kiosk', 'Kit', 'Kitchen', 'Kite', 'Knife', 'Knob', 'Knot'],
    L: ['Label', 'Lace', 'Ladder', 'Ladle', 'Lake', 'Lamp', 'Lantern', 'Laptop', 'Latch', 'Laundry', 'Lawn', 'Leaf', 'Leather', 'Leg', 'Lemon', 'Lens', 'Letter', 'Lever', 'Library', 'Lid', 'Light', 'Lighter', 'Line', 'Link', 'Lip', 'Lipstick', 'Liquid', 'List', 'Lock', 'Log', 'Loop', 'Lotion', 'Luggage'],
    M: ['Machine', 'Magazine', 'Magnet', 'Mail', 'Mailbox', 'Map', 'Marble', 'Marker', 'Mask', 'Mat', 'Match', 'Mattress', 'Medal', 'Medicine', 'Menu', 'Metal', 'Meter', 'Microphone', 'Microscope', 'Microwave', 'Milk', 'Mill', 'Mirror', 'Missile', 'Mitt', 'Mixer', 'Mobile', 'Model', 'Money', 'Monitor', 'Moon', 'Mop', 'Motor', 'Mountain', 'Mouse', 'Mouth', 'Mug', 'Muscle', 'Mushroom', 'Music'],
    N: ['Nail', 'Name', 'Napkin', 'Necklace', 'Needle', 'Net', 'Newspaper', 'Nickel', 'Night', 'Noodle', 'Nose', 'Note', 'Notebook', 'Number', 'Nut', 'Nutcracker'],
    O: ['Oar', 'Object', 'Ocean', 'Office', 'Oil', 'Olive', 'Onion', 'Orange', 'Ornament', 'Oven', 'Owl'],
    P: ['Package', 'Pad', 'Paddle', 'Padlock', 'Page', 'Pail', 'Paint', 'Painting', 'Pan', 'Pancake', 'Panel', 'Paper', 'Parachute', 'Park', 'Pasta', 'Patch', 'Path', 'Pattern', 'Paw', 'Peach', 'Pear', 'Pearl', 'Pebble', 'Pedal', 'Peg', 'Pen', 'Pencil', 'Penny', 'Pepper', 'Perfume', 'Phone', 'Photo', 'Piano', 'Picture', 'Pie', 'Piece', 'Pier', 'Pig', 'Pillow', 'Pin', 'Pipe', 'Pitcher', 'Pizza', 'Plane', 'Plant', 'Plaster', 'Plastic', 'Plate', 'Platform', 'Platter', 'Player', 'Playground', 'Pliers', 'Plow', 'Plug', 'Plum', 'Pocket', 'Pod', 'Poem', 'Point', 'Poker', 'Pole', 'Pond', 'Pool', 'Popcorn', 'Porch', 'Poster', 'Pot', 'Potato', 'Pouch', 'Powder', 'Power', 'Present', 'Press', 'Pretzel', 'Price', 'Print', 'Printer', 'Prism', 'Prize', 'Projector', 'Pudding', 'Pump', 'Pumpkin', 'Puppet', 'Purse', 'Puzzle'],
    Q: ['Quart', 'Quarter', 'Quilt'],
    R: ['Rack', 'Racket', 'Radio', 'Raft', 'Rag', 'Rail', 'Rainbow', 'Raincoat', 'Rake', 'Ram', 'Ramp', 'Range', 'Razor', 'Receipt', 'Record', 'Rectangle', 'Refrigerator', 'Remote', 'Ribbon', 'Rice', 'Ring', 'Road', 'Robot', 'Rock', 'Rocket', 'Rod', 'Roof', 'Room', 'Rope', 'Rose', 'Rug', 'Ruler'],
    S: ['Sack', 'Safe', 'Salt', 'Sand', 'Sandal', 'Sandwich', 'Satellite', 'Sauce', 'Saucer', 'Saw', 'Scale', 'Scarf', 'Scissors', 'Scooter', 'Screen', 'Screw', 'Screwdriver', 'Seal', 'Seat', 'Seed', 'Server', 'Shade', 'Shadow', 'Shampoo', 'Shape', 'Shark', 'Sheet', 'Shelf', 'Shell', 'Shield', 'Ship', 'Shirt', 'Shoe', 'Shop', 'Shorts', 'Shoulder', 'Shovel', 'Shower', 'Shrimp', 'Sign', 'Silk', 'Silver', 'Sink', 'Skate', 'Ski', 'Skin', 'Skirt', 'Sled', 'Sleeve', 'Slide', 'Slipper', 'Slot', 'Smoke', 'Snack', 'Snap', 'Snow', 'Snowflake', 'Soap', 'Sock', 'Soda', 'Sofa', 'Soil', 'Soldier', 'Soup', 'Space', 'Spaceship', 'Spade', 'Speaker', 'Spear', 'Sphere', 'Spice', 'Spider', 'Spinach', 'Sponge', 'Spoon', 'Sport', 'Spot', 'Spray', 'Spring', 'Sprinkler', 'Square', 'Squid', 'Stable', 'Stadium', 'Staff', 'Stage', 'Stair', 'Stamp', 'Stand', 'Stapler', 'Star', 'Station', 'Statue', 'Steak', 'Steam', 'Steel', 'Stem', 'Step', 'Stereo', 'Stick', 'Sticker', 'Stock', 'Stocking', 'Stomach', 'Stone', 'Stool', 'Stop', 'Store', 'Storm', 'Story', 'Stove', 'Straw', 'Stream', 'Street', 'String', 'Stripe', 'Stroller', 'Structure', 'Stud', 'Studio', 'Submarine', 'Sugar', 'Suit', 'Suitcase', 'Sun', 'Sunflower', 'Sunglasses', 'Surfboard', 'Sweater', 'Switch', 'Sword', 'Syringe', 'System'],
    T: ['Table', 'Tablet', 'Tack', 'Tail', 'Tank', 'Tape', 'Target', 'Tarp', 'Tea', 'Teapot', 'Television', 'Tent', 'Terminal', 'Thermometer', 'Thread', 'Throne', 'Thumb', 'Ticket', 'Tie', 'Tiger', 'Tile', 'Timer', 'Tin', 'Tire', 'Toast', 'Toe', 'Toilet', 'Tomato', 'Tongue', 'Tool', 'Tooth', 'Toothbrush', 'Toothpaste', 'Top', 'Torch', 'Tornado', 'Torpedo', 'Tower', 'Town', 'Toy', 'Track', 'Tractor', 'Traffic', 'Trail', 'Trailer', 'Train', 'Trap', 'Trash', 'Tray', 'Treasure', 'Tree', 'Triangle', 'Tricycle', 'Tripod', 'Trolley', 'Trophy', 'Truck', 'Trumpet', 'Trunk', 'Tub', 'Tube', 'Tulip', 'Tunnel', 'Turkey', 'Twig', 'Typewriter'],
    U: ['Umbrella', 'Underwear', 'Uniform', 'Unit', 'Universe'],
    V: ['Vacuum', 'Valley', 'Van', 'Vase', 'Vault', 'Vegetable', 'Vehicle', 'Veil', 'Vein', 'Velvet', 'Vent', 'Vest', 'Video', 'Village', 'Vine', 'Vinegar', 'Violin', 'Visor', 'Voice', 'Volcano', 'Volleyball'],
    W: ['Waffle', 'Wagon', 'Wall', 'Wallet', 'Wand', 'Wardrobe', 'Warehouse', 'Washer', 'Watch', 'Water', 'Waterfall', 'Watermelon', 'Wave', 'Wax', 'Weapon', 'Weather', 'Web', 'Wedge', 'Weed', 'Weight', 'Well', 'Wheat', 'Wheel', 'Whip', 'Whisker', 'Whistle', 'Wick', 'Wig', 'Wind', 'Window', 'Wine', 'Wing', 'Wire', 'Wok', 'Wood', 'Wool', 'Word', 'Work', 'Worm', 'Wreath', 'Wrench', 'Wrist'],
    X: ['X-ray', 'Xylophone'],
    Y: ['Yacht', 'Yard', 'Yarn', 'Year', 'Yeast', 'Yo-yo', 'Yogurt'],
    Z: ['Zebra', 'Zeppelin', 'Zero', 'Zinc', 'Zip', 'Zipper', 'Zone', 'Zoo'],
  },
  sports_games: {
    A: ['Acrobatics', 'Aerobics', 'Aikido', 'Air Hockey', 'Airsoft', 'American Football', 'Archery', 'Arm Wrestling', 'Athletics', 'Australian Football', 'Auto Racing'],
    B: ['Backgammon', 'Badminton', 'Baseball', 'Basketball', 'Battleship', 'Beach Volleyball', 'Biathlon', 'Billiards', 'Bingo', 'Blackjack', 'BMX', 'Bobsled', 'Bocce', 'Bodybuilding', 'Boggle', 'Bowling', 'Boxing', 'Bridge', 'Bull Riding', 'Bungee Jumping'],
    C: ['Canoeing', 'Capture the Flag', 'Card Games', 'Cards', 'Catch', 'Charades', 'Checkers', 'Cheerleading', 'Chess', 'Climbing', 'Clue', 'Connect Four', 'Cornhole', 'Cricket', 'Croquet', 'Cross Country', 'Crossfit', 'Curling', 'Cycling'],
    D: ['Dance', 'Dancing', 'Darts', 'Decathlon', 'Dice', 'Discus', 'Disc Golf', 'Diving', 'Dodgeball', 'Dominoes', 'Double Dutch', 'Downhill Skiing', 'Duck Duck Goose'],
    E: ['Eight Ball', 'Equestrian', 'Esports', 'Exercise'],
    F: ['Fencing', 'Field Hockey', 'Figure Skating', 'Fishing', 'Fitness', 'Flag Football', 'Floor Hockey', 'Foosball', 'Football', 'Formula One', 'Four Square', 'Free Diving', 'Freeze Tag', 'Frisbee', 'Frisbee Golf', 'Futsal'],
    G: ['Gaelic Football', 'Gin Rummy', 'Go', 'Go Fish', 'Go Kart Racing', 'Golf', 'Gymnastics'],
    H: ['Hacky Sack', 'Hammer Throw', 'Handball', 'Hang Gliding', 'Hangman', 'Hearts', 'Heptathlon', 'Hide and Seek', 'High Jump', 'Hiking', 'Hockey', 'Hopscotch', 'Horse Racing', 'Horseback Riding', 'Horseshoes', 'Hot Potato', 'Hula Hoop', 'Hunting', 'Hurdles', 'Hurling'],
    I: ['Ice Climbing', 'Ice Dancing', 'Ice Hockey', 'Ice Skating', 'Indoor Soccer', 'Inline Skating'],
    J: ['Jacks', 'Jai Alai', 'Javelin', 'Jenga', 'Jet Skiing', 'Jigsaw Puzzle', 'Jogging', 'Judo', 'Jujitsu', 'Jump Rope', 'Jumping', 'Jumping Jacks'],
    K: ['Kabaddi', 'Karate', 'Kayaking', 'Kendo', 'Kickball', 'Kickboxing', 'King of the Hill', 'Kiteboarding', 'Kite Flying', 'Kung Fu'],
    L: ['Lacrosse', 'Laser Tag', 'Lawn Bowling', 'Leapfrog', 'Limbo', 'Long Jump', 'Ludo', 'Luge'],
    M: ['Mahjong', 'Mancala', 'Marathon', 'Marbles', 'Martial Arts', 'Mini Golf', 'Mixed Martial Arts', 'MMA', 'Monopoly', 'Motocross', 'Motor Racing', 'Mountain Biking', 'Mountain Climbing', 'Mountaineering', 'Mother May I', 'Muay Thai', 'Musical Chairs'],
    N: ['NASCAR', 'Netball', 'Nine Ball'],
    O: ['Obstacle Course', 'Old Maid', 'Olympics', 'Operation', 'Orienteering', 'Othello'],
    P: ['Paddleball', 'Paddleboarding', 'Paintball', 'Parachuting', 'Parcheesi', 'Parkour', 'Pentathlon', 'Pictionary', 'Pickleball', 'Pilates', 'Pin the Tail', 'Pinball', 'Ping Pong', 'Platform Diving', 'Poker', 'Pole Vault', 'Polo', 'Pool', 'Powerlifting', 'Puzzles'],
    Q: ['Quidditch', 'Quoits'],
    R: ['Race Walking', 'Racing', 'Racquetball', 'Rafting', 'Rally Racing', 'Rappelling', 'Red Light Green Light', 'Red Rover', 'Relay', 'Relay Race', 'Rhythmic Gymnastics', 'Ring Around the Rosie', 'Ring Toss', 'Risk', 'Rock Climbing', 'Rock Paper Scissors', 'Rodeo', 'Roller Derby', 'Roller Hockey', 'Roller Skating', 'Rollerblading', 'Rowing', 'Rugby', 'Rummy', 'Running'],
    S: ['Sack Race', 'Sailing', 'Sardines', 'Scavenger Hunt', 'Scrabble', 'Scuba Diving', 'Shooting', 'Shot Put', 'Shuffleboard', 'Simon Says', 'Skateboarding', 'Skating', 'Skeet Shooting', 'Skeleton', 'Ski Jumping', 'Skiing', 'Skipping', 'Skydiving', 'Slalom', 'Sledding', 'Snooker', 'Snorkeling', 'Snowball Fight', 'Snowboarding', 'Soccer', 'Softball', 'Solitaire', 'Sorry', 'Spades', 'Speed Skating', 'Spinning', 'Spoons', 'Sprint', 'Sprinting', 'Squash', 'Steeplechase', 'Sumo Wrestling', 'Surfing', 'Swimming', 'Synchronized Swimming'],
    T: ['Table Football', 'Table Tennis', 'Taekwondo', 'Tag', 'Tai Chi', 'Target Shooting', 'Telephone', 'Tennis', 'Tetherball', 'Texas Hold Em', 'Tic Tac Toe', 'Touch Football', 'Track', 'Track and Field', 'Trampoline', 'Trampolining', 'Trap Shooting', 'Trekking', 'Triathlon', 'Triple Jump', 'Trivia', 'Trivial Pursuit', 'Tug of War', 'Tumbling', 'Twister'],
    U: ['Ultimate Frisbee', 'Underwater Hockey', 'Unicycle', 'Uno'],
    V: ['Vault', 'Video Games', 'Volleyball'],
    W: ['Wakeboarding', 'Walking', 'Wall Ball', 'Water Aerobics', 'Water Polo', 'Water Skiing', 'Weightlifting', 'Whack a Mole', 'Whiffleball', 'White Water Rafting', 'Windsurfing', 'Wrestling'],
    X: ['X Games', 'Xbox'],
    Y: ['Yacht Racing', 'Yachting', 'Yahtzee', 'Yard Games', 'Yoga'],
    Z: ['Ziplining', 'Zorbing', 'Zumba'],
  },
  brands: {
    A: ['Adidas', 'Adobe', 'Airbnb', 'Alibaba', 'Amazon', 'AMD', 'American Express', 'Apple', 'Armani', 'Asics', 'AT&T', 'Audi', 'Avon'],
    B: ['Balenciaga', 'Barbie', 'Beats', 'Bentley', 'Best Buy', 'BMW', 'Boeing', 'Bosch', 'Boss', 'Budweiser', 'Bulgari', 'Burberry', 'Burger King'],
    C: ['Calvin Klein', 'Canon', 'Cartier', 'Caterpillar', 'Chanel', 'Chevrolet', 'Cisco', 'Citibank', 'Coach', 'Coca-Cola', 'Colgate', 'Comcast', 'Corona', 'Costco', 'Crest'],
    D: ['Dell', 'Delta', 'Dior', 'Discovery', 'Disney', 'DKNY', 'Dodge', 'Dolce & Gabbana', 'Domino', 'Doritos', 'Dove', 'Dropbox', 'Dunkin'],
    E: ['EA', 'eBay', 'Emirates', 'Epson', 'ESPN', 'Estee Lauder', 'Etsy', 'Expedia', 'ExxonMobil'],
    F: ['Facebook', 'FedEx', 'Fendi', 'Ferrari', 'Fila', 'Firefox', 'Ford', 'Forever 21', 'Fossil', 'Fox'],
    G: ['Gap', 'Gatorade', 'General Electric', 'General Motors', 'Gillette', 'Giorgio Armani', 'Givenchy', 'GM', 'Goldman Sachs', 'Google', 'Goodyear', 'GoPro', 'Gucci', 'Guess'],
    H: ['H&M', 'Haagen-Dazs', 'Hasbro', 'HBO', 'Heineken', 'Heinz', 'Hello Kitty', 'Hennessy', 'Hershey', 'Hertz', 'Hewlett Packard', 'Hilton', 'Honda', 'HP', 'HSBC', 'Huawei', 'Hulu', 'Hyundai'],
    I: ['IBM', 'IKEA', 'Instagram', 'Intel', 'Intuit'],
    J: ['Jaguar', 'JBL', 'JCPenney', 'JD', 'JD Sports', 'Jeep', 'Jif', 'Jimmy Choo', 'Jiffy', 'John Deere', 'Johnson & Johnson', 'Jollibee', 'Jordan', 'Jose Cuervo', 'JPMorgan', 'JVC'],
    K: ['Kate Spade', 'Kellogg', 'KFC', 'Kia', 'Kleenex', 'Kodak', 'Kraft', 'Kroger'],
    L: ['Lacoste', 'Lamborghini', 'Land Rover', 'Lay', 'Lego', 'Lenovo', 'Levi', 'LG', 'LinkedIn', 'Logitech', 'Longchamp', 'Loreal', 'Louis Vuitton', 'Lowe', 'Lufthansa', 'Lululemon', 'Lyft'],
    M: ['MAC', 'Macy', 'Marriott', 'Mars', 'Maserati', 'Mastercard', 'Mattel', 'Maybelline', 'Mazda', 'McDonald', 'Mercedes', 'Meta', 'Microsoft', 'Mini', 'MLB', 'Monster', 'Motorola', 'MTV'],
    N: ['NBA', 'NBC', 'Nestle', 'Netflix', 'New Balance', 'NFL', 'Nike', 'Nikon', 'Nintendo', 'Nissan', 'Nokia', 'Nordstrom', 'North Face', 'Nvidia'],
    O: ['Office Depot', 'Old Navy', 'Omega', 'OnePlus', 'Oppo', 'Oracle', 'Oreo', 'Oscar'],
    P: ['Pampers', 'Panasonic', 'Pandora', 'Panera', 'Paramount', 'Patagonia', 'Paypal', 'Pepsi', 'Pfizer', 'Philips', 'Pinterest', 'Pixar', 'Pizza Hut', 'PlayStation', 'Polo', 'Porsche', 'Prada', 'Pringles', 'Puma'],
    Q: ['Quaker', 'Qualcomm'],
    R: ['Ralph Lauren', 'Ray-Ban', 'Red Bull', 'Reebok', 'Renault', 'Revlon', 'Ritz', 'Rolex', 'Rolls Royce', 'Roku'],
    S: ['Salesforce', 'Samsung', 'SAP', 'Sephora', 'Shell', 'Shopify', 'Siemens', 'Skype', 'Slack', 'Snapchat', 'Sony', 'Southwest', 'Spotify', 'Sprint', 'Square', 'Starbucks', 'Stripe', 'Subaru', 'Subway', 'Supreme', 'Suzuki', 'Swarovski'],
    T: ['T-Mobile', 'Taco Bell', 'Target', 'Tesla', 'Texas Instruments', 'TikTok', 'Tinder', 'Tommy Hilfiger', 'Toshiba', 'Toyota', 'Tropicana', 'Tumblr', 'Twitter', 'Tylenol'],
    U: ['Uber', 'UGG', 'Under Armour', 'Unilever', 'United', 'UPS'],
    V: ['Valentino', 'Vans', 'Verizon', 'Versace', 'Victoria Secret', 'Vimeo', 'Visa', 'Vitamin Water', 'Vivo', 'Volkswagen', 'Volvo'],
    W: ['Walgreens', 'Walmart', 'Warner Bros', 'Wells Fargo', 'Wendy', 'Whirlpool', 'Wikipedia', 'Windows', 'Wix', 'WordPress'],
    X: ['Xbox', 'Xerox', 'Xiaomi'],
    Y: ['Yahoo', 'Yamaha', 'Yeezy', 'Yelp', 'Yeti', 'YouTube'],
    Z: ['Zalando', 'Zara', 'Zendesk', 'Zillow', 'Zipcar', 'Zoom', 'Zumba'],
  },
  health_issues: {
    A: ['Acne', 'AIDS', 'Allergies', 'Alopecia', 'Alzheimer', 'Anemia', 'Angina', 'Anorexia', 'Anthrax', 'Anxiety', 'Appendicitis', 'Arthritis', 'Asthma', 'Atherosclerosis', 'Autism'],
    B: ['Backache', 'Back pain', 'Bacterial infection', 'Bipolar disorder', 'Bladder infection', 'Blindness', 'Bloating', 'Blood clot', 'Botulism', 'Breast cancer', 'Bronchitis', 'Bruise', 'Bulimia', 'Burns', 'Bursitis'],
    C: ['Cancer', 'Candida', 'Cardiomyopathy', 'Cataracts', 'Celiac disease', 'Cerebral palsy', 'Chickenpox', 'Chlamydia', 'Cholera', 'Cholesterol', 'Chronic fatigue', 'Cirrhosis', 'Cold', 'Colitis', 'Colon cancer', 'Concussion', 'Conjunctivitis', 'Constipation', 'COPD', 'Coronavirus', 'Cough', 'COVID', 'Cramps', 'Crohn', 'Croup', 'Cystic fibrosis', 'Cystitis'],
    D: ['Deafness', 'Dehydration', 'Dementia', 'Dengue', 'Depression', 'Dermatitis', 'Diabetes', 'Diarrhea', 'Diphtheria', 'Diverticulitis', 'Dizziness', 'Down syndrome', 'Dysentery', 'Dyslexia'],
    E: ['Earache', 'Ebola', 'Eczema', 'Edema', 'Emphysema', 'Encephalitis', 'Endometriosis', 'Epilepsy', 'Erectile dysfunction', 'Exhaustion'],
    F: ['Fainting', 'Fatigue', 'Fatty liver', 'Fever', 'Fibromyalgia', 'Flu', 'Food poisoning', 'Fracture', 'Frostbite'],
    G: ['Gallstones', 'Gangrene', 'Gastritis', 'Gastroenteritis', 'Gingivitis', 'Glaucoma', 'Gout', 'Graves disease'],
    H: ['Halitosis', 'Hay fever', 'Headache', 'Heart attack', 'Heart disease', 'Heartburn', 'Heat stroke', 'Hemophilia', 'Hemorrhoids', 'Hepatitis', 'Hernia', 'Herpes', 'High blood pressure', 'HIV', 'Hives', 'Huntington', 'Hyperthyroidism', 'Hypoglycemia', 'Hypothermia', 'Hypothyroidism'],
    I: ['IBS', 'Impetigo', 'Incontinence', 'Indigestion', 'Infection', 'Infertility', 'Inflammation', 'Influenza', 'Insomnia', 'Irritable bowel', 'Itching'],
    J: ['Jaundice', 'Joint pain'],
    K: ['Kidney disease', 'Kidney failure', 'Kidney infection', 'Kidney stones'],
    L: ['Laryngitis', 'Lead poisoning', 'Legionnaires', 'Leprosy', 'Leukemia', 'Lice', 'Liver cancer', 'Liver disease', 'Lockjaw', 'Lou Gehrig', 'Lung cancer', 'Lupus', 'Lyme disease', 'Lymphoma'],
    M: ['Malaria', 'Malnutrition', 'Mania', 'Measles', 'Melanoma', 'Memory loss', 'Meningitis', 'Menopause', 'Migraine', 'Mononucleosis', 'Multiple sclerosis', 'Mumps', 'Muscle pain', 'Muscular dystrophy', 'Myocarditis'],
    N: ['Narcolepsy', 'Nausea', 'Nearsightedness', 'Neck pain', 'Nephritis', 'Neuralgia', 'Neuropathy', 'Norovirus', 'Nosebleed', 'Numbness'],
    O: ['Obesity', 'OCD', 'Osteoarthritis', 'Osteoporosis', 'Otitis', 'Ovarian cancer', 'Overweight'],
    P: ['Pain', 'Palsy', 'Pancreatitis', 'Paralysis', 'Paranoia', 'Parkinson', 'Pelvic inflammatory', 'Peritonitis', 'Pharyngitis', 'Phlebitis', 'Phobia', 'Pink eye', 'Plague', 'Pleurisy', 'Pneumonia', 'Poisoning', 'Polio', 'Polyps', 'Post-traumatic stress', 'Preeclampsia', 'Pregnancy', 'Prostate cancer', 'Psoriasis', 'PTSD', 'Pulmonary embolism'],
    Q: ['Q fever'],
    R: ['Rabies', 'Rash', 'Raynaud', 'Renal failure', 'Restless leg', 'Rheumatism', 'Rheumatoid arthritis', 'Rickets', 'Ringworm', 'Rosacea', 'Rotavirus', 'RSV', 'Rubella', 'Runny nose'],
    S: ['Salmonella', 'Scabies', 'Scarlet fever', 'Schizophrenia', 'Sciatica', 'Scoliosis', 'Scurvy', 'Seizure', 'Sepsis', 'Shingles', 'Sickle cell', 'SIDS', 'Sinusitis', 'Skin cancer', 'Sleep apnea', 'Smallpox', 'Snoring', 'Sore throat', 'Spina bifida', 'Sprain', 'Staph infection', 'STD', 'Stomach ulcer', 'Stomachache', 'Strep throat', 'Stress', 'Stroke', 'Stuttering', 'Sunburn', 'Swelling', 'Swine flu', 'Syphilis'],
    T: ['Tachycardia', 'Tapeworm', 'TB', 'Tendinitis', 'Tetanus', 'Thrombosis', 'Thrush', 'Thyroid', 'Tinnitus', 'Tiredness', 'Tonsillitis', 'Tooth decay', 'Toothache', 'Tourette', 'Toxic shock', 'Trauma', 'Tremor', 'Trichomoniasis', 'Tuberculosis', 'Tumor', 'Typhoid', 'Typhus'],
    U: ['Ulcer', 'Uremia', 'Urinary infection', 'Urticaria', 'UTI'],
    V: ['Varicose veins', 'Vertigo', 'Viral infection', 'Vitiligo', 'Vomiting'],
    W: ['Warts', 'Weakness', 'West Nile', 'Whiplash', 'Whooping cough', 'Wound'],
    X: ['Xerosis'],
    Y: ['Yeast infection', 'Yellow fever'],
    Z: ['Zika', 'Zoster'],
  },
  // Advanced categories - now with local data for hints
  countries: {
    A: ['Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan'],
    B: ['Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi'],
    C: ['Cambodia', 'Cameroon', 'Canada', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic'],
    D: ['Denmark', 'Djibouti', 'Dominica', 'Dominican Republic'],
    E: ['Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia'],
    F: ['Fiji', 'Finland', 'France'],
    G: ['Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guyana'],
    H: ['Haiti', 'Honduras', 'Hungary'],
    I: ['Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Ivory Coast'],
    J: ['Jamaica', 'Japan', 'Jordan'],
    K: ['Kazakhstan', 'Kenya', 'Kiribati', 'Kuwait', 'Kyrgyzstan'],
    L: ['Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg'],
    M: ['Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Mauritania', 'Mauritius', 'Mexico', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar'],
    N: ['Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'Norway'],
    O: ['Oman'],
    P: ['Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal'],
    Q: ['Qatar'],
    R: ['Romania', 'Russia', 'Rwanda'],
    S: ['Samoa', 'San Marino', 'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria'],
    T: ['Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Togo', 'Tonga', 'Trinidad', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu'],
    U: ['Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan'],
    V: ['Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam'],
    W: ['Wales'],
    Y: ['Yemen'],
    Z: ['Zambia', 'Zimbabwe'],
  },
  movies: {
    A: ['Avatar', 'Avengers', 'Alien', 'Aladdin', 'Amadeus', 'Airplane', 'Armageddon', 'Annie', 'Amélie', 'Apollo 13'],
    B: ['Batman', 'Brave', 'Bambi', 'Beetlejuice', 'Braveheart', 'Back to the Future', 'Black Panther', 'Blade Runner', 'Birds', 'Beauty and the Beast'],
    C: ['Casablanca', 'Cinderella', 'Cars', 'Coco', 'Chinatown', 'Cast Away', 'Cleopatra', 'Clueless', 'Contact', 'Chicago'],
    D: ['Dumbo', 'Dune', 'Die Hard', 'Django', 'Despicable Me', 'Deadpool', 'Dances with Wolves', 'Drive', 'Dirty Dancing', 'District 9'],
    E: ['E.T.', 'Encanto', 'Elf', 'Exodus', 'Eight Mile', 'Emperor', 'Equilibrium', 'Everest', 'Edge of Tomorrow'],
    F: ['Frozen', 'Forrest Gump', 'Finding Nemo', 'Fargo', 'Fight Club', 'Fantasia', 'Fury', 'Free Guy', 'Frankenstein', 'Freaky Friday'],
    G: ['Gladiator', 'Ghost', 'Grease', 'Gravity', 'Godzilla', 'Goodfellas', 'Get Out', 'Gone Girl', 'Ghostbusters', 'Green Mile'],
    H: ['Harry Potter', 'Home Alone', 'Hercules', 'Heat', 'Hook', 'Her', 'Hugo', 'Hulk', 'Hacksaw Ridge', 'Happy Feet'],
    I: ['Inception', 'Interstellar', 'Iron Man', 'It', 'Ice Age', 'Indiana Jones', 'Incredibles', 'I Am Legend', 'Inside Out'],
    J: ['Jaws', 'Jurassic Park', 'Joker', 'Jungle Book', 'Jerry Maguire', 'John Wick', 'Jackie', 'Jumanji', 'Justice League'],
    K: ['King Kong', 'Karate Kid', 'Kill Bill', 'Knives Out', 'Kung Fu Panda', 'Kramer vs Kramer'],
    L: ['Lion King', 'Logan', 'Life of Pi', 'La La Land', 'Lord of the Rings', 'Léon', 'Legally Blonde', 'Lilo and Stitch', 'Lucy', 'Luca'],
    M: ['Matrix', 'Moana', 'Mulan', 'Minions', 'Moonlight', 'Mad Max', 'Memento', 'Mission Impossible', 'Men in Black', 'Monsters Inc'],
    N: ['Nemo', 'Nightmare Before Christmas', 'Night at the Museum', 'No Country for Old Men', 'Notting Hill', 'Napoleon Dynamite'],
    O: ['Ocean\'s Eleven', 'Oppenheimer', 'Old Boy', 'Once', 'Oliver', 'Onward'],
    P: ['Parasite', 'Pirates of the Caribbean', 'Psycho', 'Pulp Fiction', 'Peter Pan', 'Pocahontas', 'Paddington', 'Pinocchio', 'Predator', 'Planet of the Apes'],
    Q: ['Quantum of Solace'],
    R: ['Rocky', 'Ratatouille', 'Raiders of the Lost Ark', 'Rambo', 'Requiem for a Dream', 'Rain Man', 'Rogue One', 'Rush Hour', 'Rio'],
    S: ['Star Wars', 'Shrek', 'Spider-Man', 'Scarface', 'Skyfall', 'Schindler\'s List', 'Silence of the Lambs', 'Saving Private Ryan', 'Soul', 'Sing'],
    T: ['Titanic', 'Toy Story', 'Terminator', 'Top Gun', 'Thor', 'Transformers', 'Tangled', 'The Godfather', 'The Shining', 'Tarzan'],
    U: ['Up', 'Unforgiven', 'Us', 'Upgrade', 'Uncle Buck', 'Underworld'],
    V: ['Vertigo', 'V for Vendetta', 'Venom', 'Vice'],
    W: ['Wonder Woman', 'Wall-E', 'Wreck-It Ralph', 'Wizard of Oz', 'Wolverine', 'Whiplash', 'Wedding Crashers', 'Wolf of Wall Street'],
    X: ['X-Men'],
    Y: ['Yes Man'],
    Z: ['Zootopia', 'Zodiac', 'Zombieland', 'Zero Dark Thirty'],
  },
  songs: {
    A: ['All of Me', 'American Pie', 'Ain\'t No Sunshine', 'Africa', 'Angel', 'Apologize', 'As It Was', 'Attention', 'All Star', 'Another One Bites the Dust', 'All Along the Watchtower', 'All You Need Is Love', 'All I Want for Christmas Is You', 'Always on My Mind', 'At Last', 'Against the Wind', 'Autumn Leaves', 'Adventure of a Lifetime', 'American Girl', 'American Idiot', 'American Woman', 'Angel of the Morning', 'A Thousand Miles', 'A Hard Day\'s Night', 'A Natural Woman', 'A Whole New World', 'A Day in the Life', 'A Horse with No Name', 'A Sky Full of Stars'],
    B: ['Bohemian Rhapsody', 'Bad Guy', 'Blinding Lights', 'Boulevard of Broken Dreams', 'Born This Way', 'Beat It', 'Black', 'Bad Romance', 'Back in Black', 'Back in the USSR', 'Back to Black', 'Bad', 'Bad Blood', 'Baker Street', 'Beautiful', 'Beautiful Day', 'Believe', 'Bittersweet Symphony', 'Blue Suede Shoes', 'Born in the USA', 'Born to Run', 'Bridge Over Troubled Water', 'Bring Me to Life', 'Brown Eyed Girl', 'Burn', 'Blue', 'Behind Blue Eyes', 'Be My Baby', 'Banana Boat Song'],
    C: ['Crazy', 'Circles', 'Creep', 'California Dreamin', 'Closer', 'Can\'t Help Falling in Love', 'Complicated', 'Counting Stars', 'Clocks', 'Chandelier', 'Careless Whisper', 'Call Me', 'Call Me Maybe', 'Can\'t Get You Out of My Head', 'Can\'t Stop the Feeling', 'Candle in the Wind', 'Come Together', 'Crazy in Love', 'Crazy Little Thing Called Love', 'California Girls', 'California Love', 'Cats in the Cradle', 'Chasing Cars', 'Come as You Are', 'Champagne Supernova', 'Comfortably Numb', 'Cheap Thrills', 'Cherry Pie', 'Cruel Summer'],
    D: ['Dancing Queen', 'Despacito', 'Don\'t Stop Believin', 'Dreams', 'Drivers License', 'Dynamite', 'Dance Monkey', 'Demons', 'Drops of Jupiter', 'Dancing in the Dark', 'Daughters', 'Day Tripper', 'Diamonds', 'Don\'t Fear the Reaper', 'Don\'t Look Back in Anger', 'Don\'t Speak', 'Don\'t Start Now', 'Don\'t Stop Me Now', 'Down Under', 'Drive', 'Dark Horse', 'Dear Mama', 'December Will Be Magic Again'],
    E: ['Easy', 'Every Breath You Take', 'Empire State of Mind', 'Enter Sandman', 'Electric Feel', 'Everybody Wants to Rule the World', 'Eye of the Tiger', 'Eternal Flame', 'Everybody Hurts', 'Enjoy the Silence', 'Everything I Do I Do It for You', 'Edge of Glory'],
    F: ['Firework', 'Fix You', 'Fly Me to the Moon', 'Fortunate Son', 'Free Fallin', 'Feeling Good', 'Faith', 'Flowers', 'Feel Good Inc', 'Fade to Black', 'Fight for Your Right', 'Fight Song', 'Flashdance', 'Footloose', 'Forever Young', 'Free Bird', 'Friends in Low Places', 'Fields of Gold', 'Fire', 'Fire and Rain'],
    G: ['Gangsta\'s Paradise', 'Girls Just Want to Have Fun', 'God\'s Plan', 'Gold Digger', 'Good Vibrations', 'Goosebumps', 'Glad You Came', 'Get Back', 'Get Lucky', 'Gimme Shelter', 'Glory Days', 'Good Riddance', 'Go Your Own Way', 'Gravity', 'Goodbye Yellow Brick Road', 'Good Times', 'God Only Knows', 'Grenade', 'Groove Is in the Heart', 'Hallelujah'],
    H: ['Happy', 'Hello', 'Hotel California', 'Hallelujah', 'Hey Jude', 'Hips Don\'t Lie', 'Hotline Bling', 'Here Comes the Sun', 'Humble', 'Heart of Glass', 'Halo', 'Havana', 'Heaven', 'Help', 'Hey Joe', 'Hey Ya', 'High Hopes', 'Highway to Hell', 'Hit Me Baby One More Time', 'How Deep Is Your Love', 'How to Save a Life', 'Hurt', 'Heroes', 'Heartbreak Hotel', 'Heart of Gold'],
    I: ['Imagine', 'I Will Always Love You', 'In the End', 'I Gotta Feeling', 'Iris', 'I Will Survive', 'It\'s My Life', 'I Can See Clearly Now', 'I Can\'t Get No Satisfaction', 'I Feel Good', 'I Heard It Through the Grapevine', 'I Just Called to Say I Love You', 'I Kissed a Girl', 'I Love Rock \'n\' Roll', 'I Put a Spell on You', 'I Still Haven\'t Found What I\'m Looking For', 'I Wanna Dance with Somebody', 'I Want to Break Free', 'I Want to Hold Your Hand', 'I Want You Back', 'I Wish', 'Ice Ice Baby', 'If I Ain\'t Got You', 'In Da Club', 'In My Life', 'In the Air Tonight', 'It\'s Now or Never', 'Ignition'],
    J: ['Just Dance', 'Just the Way You Are', 'Just You and Me', 'Jealous', 'Jump', 'Jailhouse Rock', 'Johnny B. Goode', 'Jeremy', 'Joy to the World', 'Just Give Me a Reason', 'Julia', 'Jolene', 'Jumpin\' Jack Flash'],
    K: ['Karma Chameleon', 'Killing Me Softly', 'Kiss', 'Kids', 'Knocking on Heaven\'s Door', 'Kryptonite', 'Kashmir', 'Kickstart My Heart'],
    L: ['Levitating', 'Livin\' on a Prayer', 'Love Story', 'Lean on Me', 'Let It Be', 'Locked Out of Heaven', 'Lose Yourself', 'Lucky', 'Lemon', 'Like a Prayer', 'Like a Rolling Stone', 'Like a Virgin', 'Living for the City', 'La Bamba', 'Landslide', 'Last Christmas', 'Le Freak', 'Let It Go', 'Life Is a Highway', 'Light My Fire', 'Little Wing', 'Love Me Do', 'Love Me Tender', 'Love Story', 'Love Will Tear Us Apart', 'Leave the Door Open'],
    M: ['Mr. Brightside', 'My Heart Will Go On', 'Music', 'Monster', 'Money', 'Memories', 'Mad World', 'Man in the Mirror', 'Material Girl', 'Message in a Bottle', 'More Than a Feeling', 'More Than Words', 'My Girl', 'My Way', 'Manic Monday', 'Maps', 'Mercy', 'Midnight Train to Georgia', 'Move Like Jagger', 'My Generation', 'My Hero', 'My Immortal', 'My Love'],
    N: ['No Woman No Cry', 'Never Gonna Give You Up', 'Night Fever', 'New Rules', 'Nothing Compares', 'Nothing Else Matters', 'November Rain', 'No Scrubs', 'Need You Now', 'Night Moves', 'Nights in White Satin', 'Numb', 'Nice for What'],
    O: ['Old Town Road', 'One', 'Ordinary People', 'Oops I Did It Again', 'On Broadway', 'Once in a Lifetime', 'One Dance', 'One More Time', 'Only You', 'One Love', 'Overjoyed', 'Owner of a Lonely Heart'],
    P: ['Purple Rain', 'Perfect', 'Piano Man', 'Paradise', 'Poker Face', 'Photograph', 'Party Rock Anthem', 'Pumped Up Kicks', 'Paint It Black', 'Papa Don\'t Preach', 'People Are Strange', 'Pompeii', 'Pretty Woman', 'Pride in the Name of Love', 'Proud Mary', 'Purple Haze', 'Patience', 'Payphone', 'Poison', 'Power of Love'],
    Q: ['Quit Playing Games', 'Queen of Hearts'],
    R: ['Royals', 'Respect', 'Rolling in the Deep', 'Rocket Man', 'Riptide', 'Radioactive', 'Roar', 'Ring of Fire', 'Radio Ga Ga', 'Raise Your Glass', 'Rapper\'s Delight', 'Redemption Song', 'Rehab', 'Right Round', 'Rock and Roll All Nite', 'Rock Around the Clock', 'Roxanne', 'Run', 'Running Up That Hill', 'Real Love', 'Runaway'],
    S: ['Shape of You', 'Smells Like Teen Spirit', 'Stairway to Heaven', 'Superstition', 'Sweet Child O Mine', 'Shallow', 'Stay', 'Someone Like You', 'Sorry', 'Smooth', 'Seven Nation Army', 'Say My Name', 'September', 'Shake It Off', 'She Loves You', 'She Will Be Loved', 'Signed Sealed Delivered', 'Space Oddity', 'Stayin Alive', 'Stand by Me', 'Stay with Me', 'Stressed Out', 'Stronger', 'Sultans of Swing', 'Summer of 69', 'Sunflower', 'Sweet Caroline', 'Sweet Home Alabama', 'Sound of Silence', 'Sailing', 'Since U Been Gone', 'Sunday Bloody Sunday', 'Super Bass'],
    T: ['Thriller', 'Take On Me', 'Toxic', 'The Scientist', 'Tik Tok', 'Timber', 'Thunder', 'Time After Time', 'True Colors', 'Torn', 'Take Me Home Country Roads', 'Take Me to Church', 'Telephone', 'The Chain', 'The House of the Rising Sun', 'The Joker', 'The Show Must Go On', 'The Winner Takes It All', 'Thinking Out Loud', 'Total Eclipse of the Heart', 'Tiny Dancer', 'True Blue', 'Truly Madly Deeply', 'Twist and Shout', 'Teenage Dream', 'Thank You', 'The Boys Are Back in Town', 'The Power of Love', 'The Reason', 'Ticket to Ride'],
    U: ['Umbrella', 'Under Pressure', 'Uptown Funk', 'Unchained Melody', 'Use Somebody', 'U Can\'t Touch This', 'Under the Bridge', 'Uptown Girl'],
    V: ['Viva la Vida', 'Valerie', 'Video Games', 'Vogue', 'Venus', 'Video Killed the Radio Star'],
    W: ['Wonderwall', 'We Will Rock You', 'Wake Me Up', 'Wrecking Ball', 'What\'s Going On', 'Watermelon Sugar', 'Wild Thing', 'Wish You Were Here', 'Wake Me Up Before You Go Go', 'Walking on Sunshine', 'Wannabe', 'We Are the Champions', 'We Are the World', 'Welcome to the Jungle', 'What a Wonderful World', 'What\'s Love Got to Do with It', 'When Doves Cry', 'White Wedding', 'With or Without You', 'Without Me', 'Woman', 'Wrecking Ball', 'Working Class Hero'],
    X: ['XO'],
    Y: ['YMCA', 'Yesterday', 'You Belong with Me', 'Yellow', 'You\'re Beautiful', 'Yellow Submarine', 'You Give Love a Bad Name', 'You Shook Me All Night Long', 'You Are the Sunshine of My Life', 'Your Song', 'You Will Be Found', 'Young Turks', 'You Oughta Know'],
    Z: ['Zombie', 'Zoot Suit Riot', 'Ziggy Stardust'],
  },
  professions: {
    A: ['Accountant', 'Actor', 'Architect', 'Artist', 'Astronaut', 'Attorney', 'Auditor', 'Author'],
    B: ['Baker', 'Banker', 'Barber', 'Bartender', 'Biologist', 'Blacksmith', 'Bookkeeper', 'Butcher', 'Butler'],
    C: ['Carpenter', 'Cashier', 'Chef', 'Chemist', 'Chiropractor', 'Coach', 'Comedian', 'Consultant', 'Cook', 'Counselor'],
    D: ['Dancer', 'Dentist', 'Designer', 'Detective', 'Developer', 'Director', 'Doctor', 'Driver', 'Drummer'],
    E: ['Economist', 'Editor', 'Electrician', 'Engineer', 'Entrepreneur', 'Executive'],
    F: ['Farmer', 'Firefighter', 'Fisherman', 'Florist', 'Foreman'],
    G: ['Gardener', 'Geologist', 'Graphic Designer', 'Guard', 'Guitarist'],
    H: ['Hairdresser', 'Handyman', 'Historian', 'Host', 'Housekeeper'],
    I: ['Illustrator', 'Inspector', 'Instructor', 'Intern', 'Interpreter', 'Investigator'],
    J: ['Janitor', 'Jeweler', 'Journalist', 'Judge'],
    K: ['Kennel Worker'],
    L: ['Landscaper', 'Lawyer', 'Lecturer', 'Librarian', 'Lifeguard', 'Locksmith', 'Logistician'],
    M: ['Machinist', 'Manager', 'Marketer', 'Mechanic', 'Mediator', 'Midwife', 'Model', 'Musician'],
    N: ['Nanny', 'Narrator', 'Navigator', 'Negotiator', 'Neurologist', 'Nurse', 'Nutritionist'],
    O: ['Obstetrician', 'Occupational Therapist', 'Officer', 'Operator', 'Optician', 'Orthodontist'],
    P: ['Painter', 'Paralegal', 'Paramedic', 'Pastor', 'Pediatrician', 'Pharmacist', 'Photographer', 'Physician', 'Pilot', 'Plumber', 'Police Officer', 'Politician', 'Porter', 'Principal', 'Producer', 'Professor', 'Programmer', 'Psychiatrist', 'Psychologist'],
    Q: ['Quality Controller'],
    R: ['Radiologist', 'Realtor', 'Receptionist', 'Recruiter', 'Reporter', 'Researcher', 'Roofer'],
    S: ['Sailor', 'Salesperson', 'Scientist', 'Secretary', 'Security Guard', 'Singer', 'Social Worker', 'Soldier', 'Stockbroker', 'Surgeon', 'Surveyor'],
    T: ['Tailor', 'Teacher', 'Technician', 'Therapist', 'Trainer', 'Translator', 'Truck Driver', 'Tutor'],
    U: ['Umpire', 'Underwriter', 'Upholsterer', 'Urban Planner', 'Urologist', 'Usher'],
    V: ['Veterinarian', 'Videographer', 'Vocalist'],
    W: ['Waiter', 'Waitress', 'Warden', 'Welder', 'Writer'],
    X: ['X-ray Technician'],
    Y: ['Yoga Instructor'],
    Z: ['Zookeeper', 'Zoologist'],
  },
  food_dishes: {
    A: ['Apple Pie', 'Alfredo', 'Arancini', 'Avocado Toast', 'Antipasto'],
    B: ['Burrito', 'Burger', 'Biryani', 'Bruschetta', 'Brownies', 'Bacon', 'Bagel', 'Banana Bread', 'Baklava', 'BBQ'],
    C: ['Carbonara', 'Curry', 'Caesar Salad', 'Cake', 'Cheesecake', 'Chicken', 'Chili', 'Chips', 'Chocolate', 'Churros', 'Couscous', 'Croissant', 'Croquettes'],
    D: ['Dumplings', 'Donut', 'Dal', 'Dim Sum'],
    E: ['Enchiladas', 'Eggs Benedict', 'Edamame', 'Empanadas'],
    F: ['Fajitas', 'Fish and Chips', 'Fondue', 'French Fries', 'French Toast', 'Fried Rice', 'Frittata'],
    G: ['Gnocchi', 'Grilled Cheese', 'Guacamole', 'Gumbo', 'Gyoza', 'Gyros'],
    H: ['Hamburger', 'Hot Dog', 'Hummus', 'Hash Browns'],
    I: ['Ice Cream', 'Irish Stew'],
    J: ['Jambalaya', 'Jelly', 'Jerky'],
    K: ['Kebab', 'Kimchi', 'Kung Pao Chicken'],
    L: ['Lasagna', 'Lemon Chicken', 'Lobster', 'Lo Mein'],
    M: ['Macaroni', 'Meatballs', 'Moussaka', 'Muffin', 'Miso Soup'],
    N: ['Nachos', 'Naan', 'Noodles', 'Nuggets'],
    O: ['Omelette', 'Onion Rings', 'Orange Chicken'],
    P: ['Paella', 'Pancakes', 'Pasta', 'Pad Thai', 'Pho', 'Pizza', 'Pork Chops', 'Pot Roast', 'Pretzel', 'Pudding'],
    Q: ['Quesadilla', 'Quiche'],
    R: ['Ramen', 'Ravioli', 'Risotto', 'Ribs', 'Roast Beef', 'Roti'],
    S: ['Salad', 'Salmon', 'Sandwich', 'Sashimi', 'Sausage', 'Soup', 'Spaghetti', 'Spring Rolls', 'Steak', 'Stew', 'Stir Fry', 'Sushi'],
    T: ['Taco', 'Tandoori', 'Tempura', 'Teriyaki', 'Tiramisu', 'Toast', 'Tofu', 'Tortilla', 'Turkey'],
    U: ['Udon'],
    V: ['Vindaloo'],
    W: ['Waffle', 'Wings', 'Wonton', 'Wrap'],
    X: ['Xiaolongbao'],
    Y: ['Yakitori', 'Yogurt'],
    Z: ['Ziti', 'Zucchini Bread'],
  },
  famous_people: {
    A: ['Abraham Lincoln', 'Alexander the Great', 'Aristotle', 'Albert Einstein', 'Anne Frank', 'Augustus', 'Archimedes', 'Attila'],
    B: ['Benjamin Franklin', 'Buddha', 'Beethoven', 'Bismarck', 'Boudica'],
    C: ['Cleopatra', 'Columbus', 'Caesar', 'Confucius', 'Churchill', 'Catherine the Great', 'Charlemagne', 'Che Guevara'],
    D: ['Darwin', 'Da Vinci', 'Descartes'],
    E: ['Einstein', 'Edison', 'Elizabeth I', 'Eleanor Roosevelt', 'Eisenhower'],
    F: ['Franklin', 'Frederick the Great', 'Freud', 'Ferdinand Magellan'],
    G: ['Gandhi', 'Galileo', 'Genghis Khan', 'George Washington', 'Gutenberg'],
    H: ['Hannibal', 'Helen Keller', 'Henry VIII', 'Hippocrates', 'Hitler', 'Homer'],
    I: ['Isaac Newton', 'Ivan the Terrible'],
    J: ['Jefferson', 'Joan of Arc', 'Julius Caesar', 'John F Kennedy'],
    K: ['King Tut', 'King Arthur', 'Kublai Khan'],
    L: ['Lenin', 'Lincoln', 'Louis XIV', 'Leonardo da Vinci'],
    M: ['Mandela', 'Marco Polo', 'Marie Curie', 'Martin Luther King', 'Marx', 'Michelangelo', 'Mozart', 'Muhammad Ali', 'Mussolini'],
    N: ['Napoleon', 'Nelson Mandela', 'Newton', 'Nero', 'Nightingale'],
    O: ['Obama', 'Oppenheimer'],
    P: ['Plato', 'Picasso', 'Pythagoras', 'Pericles', 'Peter the Great'],
    Q: ['Queen Victoria', 'Queen Elizabeth'],
    R: ['Roosevelt', 'Rembrandt', 'Rosa Parks', 'Rasputin'],
    S: ['Shakespeare', 'Socrates', 'Stalin', 'Sun Tzu'],
    T: ['Tesla', 'Tutankhamun', 'Thatcher', 'Truman'],
    U: ['Ulysses S Grant'],
    V: ['Van Gogh', 'Voltaire', 'Victoria'],
    W: ['Washington', 'William Shakespeare', 'Winston Churchill', 'Wright Brothers'],
    X: ['Xerxes'],
    Y: ['Yuri Gagarin'],
    Z: ['Zeus', 'Zedong'],
  },
  music_artists: {
    A: ['ABBA', 'AC/DC', 'Adele', 'Aerosmith', 'Alicia Keys', 'Ariana Grande', 'Arctic Monkeys', 'Avicii', 'Avril Lavigne'],
    B: ['Beyonce', 'Beatles', 'Billie Eilish', 'Bob Dylan', 'Bob Marley', 'Bon Jovi', 'Bruno Mars', 'Black Sabbath', 'Blur'],
    C: ['Coldplay', 'Calvin Harris', 'Cardi B', 'Childish Gambino', 'Chris Brown', 'Corinne Bailey Rae'],
    D: ['Drake', 'David Bowie', 'Dua Lipa', 'Demi Lovato', 'Deftones'],
    E: ['Ed Sheeran', 'Eminem', 'Eagles', 'Elton John', 'Elvis Presley', 'Enya'],
    F: ['Frank Ocean', 'Frank Sinatra', 'Foo Fighters', 'Fleetwood Mac'],
    G: ['Green Day', 'Guns N Roses', 'Glass Animals'],
    H: ['Harry Styles', 'Halsey', 'Hozier'],
    I: ['Ice Cube', 'Imagine Dragons'],
    J: ['Jay-Z', 'Justin Bieber', 'Justin Timberlake', 'Jonas Brothers'],
    K: ['Kanye West', 'Katy Perry', 'Kendrick Lamar', 'Kings of Leon'],
    L: ['Lady Gaga', 'Led Zeppelin', 'Lil Wayne', 'Linkin Park'],
    M: ['Madonna', 'Maroon 5', 'Metallica', 'Michael Jackson', 'Miley Cyrus'],
    N: ['Nirvana', 'Nicki Minaj', 'Nine Inch Nails'],
    O: ['One Direction', 'Oasis', 'Olivia Rodrigo'],
    P: ['Pink Floyd', 'Post Malone', 'Prince'],
    Q: ['Queen'],
    R: ['Radiohead', 'Rihanna', 'Red Hot Chili Peppers'],
    S: ['Shakira', 'Selena Gomez', 'Snoop Dogg', 'System of a Down'],
    T: ['Taylor Swift', 'The Weeknd', 'Twenty One Pilots'],
    U: ['U2'],
    V: ['Van Halen'],
    W: ['Whitney Houston', 'The Who'],
    X: ['XXXTENTACION'],
    Y: ['Ye', 'Yungblud'],
    Z: ['ZZ Top', 'Zayn'],
  },
  fruits_vegetables: {
    A: ['Apple', 'Apricot', 'Artichoke', 'Asparagus', 'Avocado', 'Acorn squash', 'Açaí'],
    B: ['Banana', 'Blueberry', 'Blackberry', 'Broccoli', 'Brussels sprout', 'Beet', 'Bok choy', 'Butternut squash', 'Breadfruit'],
    C: ['Cherry', 'Cranberry', 'Carrot', 'Cauliflower', 'Celery', 'Cucumber', 'Corn', 'Cabbage', 'Cantaloupe', 'Coconut', 'Clementine', 'Cassava', 'Chard'],
    D: ['Date', 'Dragon fruit', 'Dragonfruit', 'Durian', 'Damson'],
    E: ['Elderberry', 'Eggplant', 'Endive', 'Edamame'],
    F: ['Fig', 'Fennel', 'Feijoa'],
    G: ['Grape', 'Guava', 'Grapefruit', 'Garlic', 'Ginger', 'Gooseberry', 'Green bean', 'Green pepper'],
    H: ['Honeydew', 'Horseradish'],
    I: ['Iceberg lettuce'],
    J: ['Jackfruit', 'Jalapeño', 'Jicama'],
    K: ['Kiwi', 'Kumquat', 'Kale', 'Kohlrabi', 'Key lime'],
    L: ['Lemon', 'Lime', 'Lychee', 'Lettuce', 'Leek', 'Longan'],
    M: ['Mango', 'Melon', 'Mandarin', 'Mulberry', 'Mushroom', 'Mustard greens'],
    N: ['Nectarine', 'Navel orange'],
    O: ['Orange', 'Olive', 'Onion', 'Okra'],
    P: ['Peach', 'Pear', 'Pineapple', 'Plum', 'Pomegranate', 'Papaya', 'Passion fruit', 'Potato', 'Parsnip', 'Pumpkin', 'Pea', 'Pepper', 'Pak choi'],
    Q: ['Quince'],
    R: ['Raspberry', 'Radish', 'Rhubarb', 'Rutabaga'],
    S: ['Strawberry', 'Spinach', 'Squash', 'Sweet potato', 'Starfruit', 'Soursop', 'Shallot', 'Spring onion'],
    T: ['Tomato', 'Tangerine', 'Turnip', 'Tamarind', 'Taro'],
    U: ['Ugli fruit'],
    V: ['Vanilla bean'],
    W: ['Watermelon', 'Watercress'],
    X: ['Ximenia'],
    Y: ['Yam', 'Yuzu'],
    Z: ['Zucchini'],
  },
};


// Get a random valid answer for a category and letter (for bots and hints)
// Only uses single letters - no two-letter combos supported
export const getRandomAnswer = (category: CategoryType, letter: string): string | null => {
  const categoryData = WORD_DATABASE[category];
  const upperLetter = letter.toUpperCase();

  // Only support single letters
  if (upperLetter.length !== 1) {
    return null;
  }

  const words = categoryData[upperLetter];
  if (words && words.length > 0) {
    const validWords = words.filter(w => w.toUpperCase().startsWith(upperLetter));
    if (validWords.length > 0) {
      return validWords[Math.floor(Math.random() * validWords.length)];
    }
  }

  return null;
};

// Check if a hint is available for a category and letter (local only)
export const isHintAvailable = (category: CategoryType, letter: string): boolean => {
  return getRandomAnswer(category, letter) !== null;
};

/**
 * Get a hint - Uses Supabase ONLY (no Wikipedia fallback)
 * Supabase is the source of truth for all hints
 */
export const getHintAsync = async (
  category: CategoryType,
  letter: string,
  constraint?: LevelConstraintCheck | null
): Promise<string | null> => {
  const letterUpper = letter.toUpperCase();
  console.log(`[Hint] Getting hint for category=${category}, letter=${letterUpper}, constraint=${constraint?.type || 'none'}${constraint?.value ? `=${constraint.value}` : ''}`);

  // Helper to check if hint passes constraint
  const passesConstraint = (hint: string): boolean => {
    if (!constraint) return true;
    const result = validateConstraint(hint, constraint);
    if (!result.passes) {
      console.log(`[Hint] "${hint}" failed constraint: ${result.reason}`);
    }
    return result.passes;
  };

  // Helper to check if hint is valid (starts with letter AND passes constraint)
  const isValidHint = (hint: string): boolean => {
    if (!hint.toUpperCase().startsWith(letterUpper)) {
      return false;
    }
    return passesConstraint(hint);
  };

  // Use Supabase database (only source)
  if (hasSupabaseSupport(category)) {
    try {
      console.log(`[Hint] Checking Supabase for ${category}/${letterUpper}...`);
      const supabaseHints = await getHintsFromSupabase(category, letter, 100);
      if (supabaseHints.length > 0) {
        // Shuffle and find first valid hint
        const shuffled = [...supabaseHints].sort(() => Math.random() - 0.5);
        for (const hint of shuffled) {
          if (isValidHint(hint)) {
            console.log(`[Hint] Using Supabase hint: ${hint}`);
            return hint;
          }
        }
        console.log(`[Hint] No valid Supabase hint for ${category}/${letterUpper} (${supabaseHints.length} checked, none passed constraints)`);
      } else {
        console.log(`[Hint] No Supabase hints found for ${category}/${letterUpper}`);
      }
    } catch (err) {
      console.log(`[Hint] Supabase hint fetch failed:`, err);
    }
  } else {
    console.log(`[Hint] No Supabase support for ${category}`);
  }

  console.log(`[Hint] No hint found for ${category}/${letterUpper}`);
  return null;
};

// Check if an answer is valid for the given category
// Returns true if the answer matches known words in the database
export const isValidCategoryAnswer = (
  answer: string,
  letter: string,
  category: CategoryType
): boolean => {
  const trimmedAnswer = answer.trim().toLowerCase();

  if (!trimmedAnswer || trimmedAnswer.length < 2) {
    return false;
  }

  if (!trimmedAnswer.startsWith(letter.toLowerCase())) {
    return false;
  }

  // Reject category names as answers (e.g., "vegetable" for fruits_vegetables category)
  if (isCategoryName(trimmedAnswer, category)) {
    return false;
  }

  // Get singular form for plural validation in certain categories
  const singularForm = getSingularForm(trimmedAnswer);
  const singularStartsWithLetter = singularForm?.startsWith(letter.toLowerCase());

  // Get spelling variants (British/American) + normalized variants (abbreviations, punctuation)
  const spellingVariants = getAllVariants(trimmedAnswer);
  const singularSpellingVariants = singularForm ? getAllVariants(singularForm) : [];

  // Helper to check if any spelling variant exists in a set
  const existsInSet = (set: Set<string>, variants: string[]): boolean => {
    return variants.some(v => set.has(v));
  };

  // Check against extended databases first (comprehensive sets)
  switch (category) {
    case 'places':
      if (existsInSet(WORLD_PLACES_SET, spellingVariants)) {
        return true;
      }
      break;
    case 'names': {
      if (existsInSet(WORLD_NAMES_SET, spellingVariants)) {
        return true;
      }
      // Accept multi-word names where all parts are in the database (e.g., "John Peter")
      const nameParts = trimmedAnswer.split(' ');
      if (nameParts.length >= 2 && nameParts.every(part => WORLD_NAMES_SET.has(part))) {
        return true;
      }
      break;
    }
    case 'animal':
      if (existsInSet(ANIMALS_SET, spellingVariants)) {
        return true;
      }
      // Accept plural forms (tigers, cats, dogs)
      if (singularForm && singularStartsWithLetter && existsInSet(ANIMALS_SET, singularSpellingVariants)) {
        return true;
      }
      break;
    case 'thing':
      if (existsInSet(THINGS_SET, spellingVariants)) {
        return true;
      }
      // Accept plural forms (pens, books, chairs)
      if (singularForm && singularStartsWithLetter && existsInSet(THINGS_SET, singularSpellingVariants)) {
        return true;
      }
      break;
    case 'sports_games':
      if (existsInSet(SPORTS_GAMES_SET, spellingVariants)) {
        return true;
      }
      // Accept plural forms
      if (singularForm && singularStartsWithLetter && existsInSet(SPORTS_GAMES_SET, singularSpellingVariants)) {
        return true;
      }
      break;
    case 'brands':
      if (existsInSet(BRANDS_SET, spellingVariants)) {
        return true;
      }
      // Accept plural forms
      if (singularForm && singularStartsWithLetter && existsInSet(BRANDS_SET, singularSpellingVariants)) {
        return true;
      }
      break;
    case 'health_issues':
      if (existsInSet(HEALTH_ISSUES_SET, spellingVariants)) {
        return true;
      }
      // Accept plural forms (ulcers, allergies, headaches)
      if (singularForm && singularStartsWithLetter && existsInSet(HEALTH_ISSUES_SET, singularSpellingVariants)) {
        return true;
      }
      break;
  }

  // Get the database for this category
  const categoryData = WORD_DATABASE[category];
  const validWords = categoryData[letter.toUpperCase()] || [];

  // Check if the answer matches any known word (case-insensitive)
  const isKnown = validWords.some(
    (word) => word.toLowerCase() === trimmedAnswer ||
              trimmedAnswer.includes(word.toLowerCase()) ||
              word.toLowerCase().includes(trimmedAnswer)
  );

  // For more flexibility, also allow answers that are at least 3 characters
  // and start with the correct letter (in case our database is incomplete)
  // But give preference to known answers in scoring
  return isKnown || trimmedAnswer.length >= 3;
};

// Calculate Levenshtein distance between two strings (for fuzzy matching)
const levenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

// Check if answer has minor spelling error (1-2 character difference)
// Returns: { isClose: boolean, matchedWord: string | null }
export const findCloseMatch = (
  answer: string,
  letter: string,
  category: CategoryType
): { isClose: boolean; matchedWord: string | null; distance: number } => {
  const trimmedAnswer = answer.trim().toLowerCase();

  if (!trimmedAnswer || trimmedAnswer.length < 2) {
    return { isClose: false, matchedWord: null, distance: 999 };
  }

  if (!trimmedAnswer.startsWith(letter.toLowerCase())) {
    return { isClose: false, matchedWord: null, distance: 999 };
  }

  // Get all valid words for this category and letter
  const allWords: string[] = [];

  // Check extended databases
  const extendedSets: Partial<Record<CategoryType, Set<string>>> = {
    places: WORLD_PLACES_SET,
    names: WORLD_NAMES_SET,
    animal: ANIMALS_SET,
    thing: THINGS_SET,
    sports_games: SPORTS_GAMES_SET,
    brands: BRANDS_SET,
    health_issues: HEALTH_ISSUES_SET,
    fruits_vegetables: FRUITS_VEGETABLES_SET,
    // Advanced categories - use online validation only (no local sets)
    countries: new Set<string>(),
    movies: new Set<string>(),
    songs: new Set<string>(),
    professions: new Set<string>(),
    food_dishes: new Set<string>(),
    famous_people: new Set<string>(),
  };

  const extendedSet = extendedSets[category];
  if (extendedSet) {
    extendedSet.forEach(word => {
      if (word.startsWith(letter.toLowerCase())) {
        allWords.push(word);
      }
    });
  }

  // Also check WORD_DATABASE
  const categoryData = WORD_DATABASE[category];
  const validWords = categoryData[letter.toUpperCase()] || [];
  validWords.forEach(word => allWords.push(word.toLowerCase()));

  // Find closest match
  let closestWord: string | null = null;
  let minDistance = 999;

  for (const word of allWords) {
    // Exact match
    if (word === trimmedAnswer) {
      return { isClose: false, matchedWord: word, distance: 0 };
    }

    const distance = levenshteinDistance(trimmedAnswer, word);

    // Allow 1-2 character difference for words of reasonable length
    // For short words (< 5 chars), only allow 1 char difference
    const maxAllowedDistance = trimmedAnswer.length < 5 ? 1 : 2;

    if (distance <= maxAllowedDistance && distance < minDistance) {
      minDistance = distance;
      closestWord = word;
    }
  }

  return {
    isClose: minDistance > 0 && minDistance <= 2,
    matchedWord: closestWord,
    distance: minDistance
  };
};

// Strict validation - only accepts answers that EXACTLY match our database
// Now also returns spelling penalty info
export const isStrictValidAnswer = (
  answer: string,
  letter: string,
  category: CategoryType
): boolean => {
  const trimmedAnswer = answer.trim().toLowerCase();

  if (!trimmedAnswer || trimmedAnswer.length < 2) {
    return false;
  }

  if (!trimmedAnswer.startsWith(letter.toLowerCase())) {
    return false;
  }

  // Reject category names as answers (e.g., "vegetable" for fruits_vegetables category)
  if (isCategoryName(trimmedAnswer, category)) {
    return false;
  }

  // Get singular form for plural validation in certain categories
  const singularForm = getSingularForm(trimmedAnswer);
  const singularStartsWithLetter = singularForm?.startsWith(letter.toLowerCase());

  const allVariants = getNormalizedVariants(trimmedAnswer);

  // Check against extended databases first (comprehensive sets)
  switch (category) {
    case 'places':
      if (allVariants.some(v => WORLD_PLACES_SET.has(v))) {
        return true;
      }
      break;
    case 'names': {
      if (allVariants.some(v => WORLD_NAMES_SET.has(v))) {
        return true;
      }
      // Accept multi-word names where all parts are in the database (e.g., "John Peter")
      const nameParts = trimmedAnswer.split(' ');
      if (nameParts.length >= 2 && nameParts.every(part => WORLD_NAMES_SET.has(part))) {
        return true;
      }
      break;
    }
    case 'animal':
      if (allVariants.some(v => ANIMALS_SET.has(v))) {
        return true;
      }
      // Accept plural forms (tigers, cats, dogs)
      if (singularForm && singularStartsWithLetter && ANIMALS_SET.has(singularForm)) {
        return true;
      }
      break;
    case 'thing':
      if (allVariants.some(v => THINGS_SET.has(v))) {
        return true;
      }
      // Accept plural forms (pens, books, chairs)
      if (singularForm && singularStartsWithLetter && THINGS_SET.has(singularForm)) {
        return true;
      }
      break;
    case 'sports_games':
      if (allVariants.some(v => SPORTS_GAMES_SET.has(v))) {
        return true;
      }
      break;
    case 'brands':
      if (allVariants.some(v => BRANDS_SET.has(v))) {
        return true;
      }
      break;
    case 'health_issues':
      if (allVariants.some(v => HEALTH_ISSUES_SET.has(v))) {
        return true;
      }
      break;
  }

  // Fall back to the original WORD_DATABASE for additional matches
  const categoryData = WORD_DATABASE[category];
  const validWords = categoryData[letter.toUpperCase()] || [];

  // Check if the answer EXACTLY matches any known word (case-insensitive)
  // No partial matches allowed - spelling must be exact
  if (validWords.some((word) => word.toLowerCase() === trimmedAnswer)) {
    return true;
  }

  // Check for close match (minor spelling error) - still considered valid
  const closeMatch = findCloseMatch(answer, letter, category);
  return closeMatch.isClose;
};

// Check if answer has a spelling penalty (minor error)
export const hasSpellingPenalty = (
  answer: string,
  letter: string,
  category: CategoryType
): boolean => {
  const trimmedAnswer = answer.trim().toLowerCase();

  if (!trimmedAnswer || trimmedAnswer.length < 2) {
    return false;
  }

  if (!trimmedAnswer.startsWith(letter.toLowerCase())) {
    return false;
  }

  const penaltyVariants = getNormalizedVariants(trimmedAnswer);

  // First check if it's an exact/normalized match (no penalty)
  // Check extended databases
  switch (category) {
    case 'places':
      if (penaltyVariants.some(v => WORLD_PLACES_SET.has(v))) return false;
      break;
    case 'names': {
      if (penaltyVariants.some(v => WORLD_NAMES_SET.has(v))) return false;
      // No penalty for valid multi-word names (e.g., "John Peter")
      const parts = trimmedAnswer.split(' ');
      if (parts.length >= 2 && parts.every(part => WORLD_NAMES_SET.has(part))) return false;
      break;
    }
    case 'animal':
      if (penaltyVariants.some(v => ANIMALS_SET.has(v))) return false;
      break;
    case 'thing':
      if (penaltyVariants.some(v => THINGS_SET.has(v))) return false;
      break;
    case 'sports_games':
      if (penaltyVariants.some(v => SPORTS_GAMES_SET.has(v))) return false;
      break;
    case 'brands':
      if (penaltyVariants.some(v => BRANDS_SET.has(v))) return false;
      break;
    case 'health_issues':
      if (penaltyVariants.some(v => HEALTH_ISSUES_SET.has(v))) return false;
      break;
  }

  // Check WORD_DATABASE
  const categoryData = WORD_DATABASE[category];
  const validWords = categoryData[letter.toUpperCase()] || [];
  if (validWords.some((word) => word.toLowerCase() === trimmedAnswer)) {
    return false;
  }

  // If not exact match, check if it's a close match (has penalty)
  const closeMatch = findCloseMatch(answer, letter, category);
  return closeMatch.isClose;
};

// Basic validation - checks if answer starts with the correct letter
export const validateAnswer = (
  answer: string,
  letter: string,
  _category: CategoryType
): { isValid: boolean; reason?: string } => {
  const trimmedAnswer = answer.trim();

  if (!trimmedAnswer) {
    return { isValid: false, reason: 'Empty answer' };
  }

  if (!trimmedAnswer.toLowerCase().startsWith(letter.toLowerCase())) {
    return { isValid: false, reason: `Must start with "${letter}"` };
  }

  // Must have at least 3 characters for a real word (rejects two-letter combos like "lo", "za")
  if (trimmedAnswer.length < 3) {
    return { isValid: false, reason: 'Answer too short' };
  }

  return { isValid: true };
};

// Get category display name
export const getCategoryName = (category: CategoryType): string => {
  const names: Record<CategoryType, string> = {
    names: 'Names',
    places: 'Places',
    animal: 'Animal',
    thing: 'Thing',
    sports_games: 'Sports & Games',
    brands: 'Brands',
    health_issues: 'Health Issues',
    countries: 'Countries',
    movies: 'Movies',
    songs: 'Songs',
    professions: 'Professions',
    food_dishes: 'Food & Dishes',
    famous_people: 'Famous People',
    music_artists: 'Music Artists/Bands',
    fruits_vegetables: 'Fruits & Vegetables',
  };
  return names[category];
};

// ============================================
// ============================================
// VALIDATION DATA (exclusions/whitelists for categories)
// ============================================

// Words to EXCLUDE from "fruits_vegetables" category (slang terms, fake fruits, non-food items)
const FRUITS_VEGETABLES_EXCLUSIONS = [
  // Slang/vulgar terms that are NOT actual fruits or vegetables
  'dingleberry', 'dingleberries',
  // Other non-food items
  'fruitcake', // person, not a fruit
];

// Words to EXCLUDE from "sports_games" category (adjectives, generic terms, not actual sports/games)
const SPORTS_GAMES_EXCLUSIONS = [
  // Adjectives and generic descriptors (not actual sports or games)
  'indoor', 'outdoor', 'athletic', 'physical', 'competitive', 'recreational',
  'professional', 'amateur', 'extreme', 'traditional', 'modern', 'classic',
  'international', 'national', 'local', 'popular', 'individual', 'interactive',
  // Generic terms
  'team', 'player', 'game', 'sport', 'match', 'play', 'competition', 'tournament',
  'championship', 'league', 'season', 'round', 'score', 'point', 'goal', 'win',
  'loss', 'tie', 'draw', 'victory', 'defeat', 'training', 'practice', 'exercise',
  'fitness', 'workout', 'warmup', 'warm up', 'cooldown', 'cool down',
  // Equipment/concepts (not sports themselves)
  'ball', 'bat', 'racket', 'net', 'goal', 'field', 'court', 'pitch', 'arena',
  'stadium', 'gym', 'pool', 'track', 'ring', 'rink', 'course',
  // Abstract concepts
  'strategy', 'tactic', 'technique', 'skill', 'speed', 'strength', 'endurance',
  'agility', 'flexibility', 'balance', 'coordination', 'stamina', 'power',
  // Countries/places that are NOT sports (prevent false positives)
  'malta', 'volle', 'polo', // 'polo' is a sport but 'volle' is not, 'malta' is a country
];

// Words to EXCLUDE from "thing" category (verbs, adjectives, abstract concepts, non-physical nouns)
const THING_EXCLUSIONS = [
  // E verbs
  'elope', 'escape', 'enter', 'exit', 'eat', 'enjoy', 'explore', 'examine', 'execute', 'exercise',
  'elaborate', 'eliminate', 'embrace', 'emerge', 'emit', 'employ', 'enable', 'encourage', 'end',
  'engage', 'enhance', 'ensure', 'entertain', 'establish', 'estimate', 'evaluate', 'evolve', 'exceed',
  'exchange', 'excite', 'exclude', 'excuse', 'expand', 'expect', 'experience', 'explain', 'express',
  'extend', 'extract',
  // E adjectives
  'eager', 'early', 'easy', 'economic', 'effective', 'efficient', 'elderly',
  'electric', 'elegant', 'emotional', 'empty', 'endless', 'enormous', 'entire', 'equal', 'essential',
  'eternal', 'ethical', 'evident', 'evil', 'exact', 'excellent', 'excessive', 'exciting', 'exclusive',
  'expensive', 'expert', 'explicit', 'extreme',
  // E abstract nouns
  'emotion', 'energy', 'effort', 'effect', 'event', 'example', 'experience', 'expression',
  'education', 'environment', 'economy', 'element', 'era', 'existence', 'evolution',
  // R verbs
  'race', 'run', 'read', 'reach', 'react', 'realize', 'receive', 'recognize', 'recommend', 'record',
  'recover', 'reduce', 'refer', 'reflect', 'refuse', 'regard', 'regret', 'relate', 'relax', 'release',
  'rely', 'remain', 'remember', 'remind', 'remove', 'rent', 'repair', 'repeat', 'replace', 'reply',
  'report', 'represent', 'require', 'rescue', 'research', 'resist', 'resolve', 'respect', 'respond',
  'rest', 'restore', 'result', 'retain', 'retire', 'return', 'reveal', 'review', 'revise', 'reward',
  'ride', 'rise', 'risk', 'roll', 'rotate', 'ruin', 'rule', 'rush',
  // R adjectives
  'rapid', 'rare', 'raw', 'ready', 'real', 'realistic', 'reasonable', 'recent', 'red', 'regular',
  'relative', 'relevant', 'reliable', 'religious', 'remarkable', 'remote', 'representative', 'resident',
  'resistant', 'responsible', 'rich', 'right', 'rigid', 'romantic', 'rough', 'round', 'royal', 'rude',
  // R abstract nouns
  'racism', 'rage', 'rain', 'range', 'rank', 'rate', 'ratio', 'reaction', 'reading', 'reality',
  'reason', 'reasoning', 'rebellion', 'recession', 'recognition', 'recovery', 'reduction', 'reference',
  'reflection', 'reform', 'refuge', 'region', 'regret', 'regulation', 'relation', 'relationship',
  'relaxation', 'relief', 'religion', 'reluctance', 'remainder', 'remark', 'remedy', 'reminder',
  'removal', 'rent', 'repetition', 'replacement', 'reply', 'representation', 'reputation', 'request',
  'requirement', 'rescue', 'resemblance', 'reservation', 'residence', 'resignation', 'resistance',
  'resolution', 'resource', 'respect', 'response', 'responsibility', 'rest', 'restoration', 'restraint',
  'restriction', 'result', 'retirement', 'retreat', 'return', 'reunion', 'revenge', 'revenue', 'reversal',
  'review', 'revision', 'revolution', 'rhythm', 'right', 'riot', 'rivalry', 'romance', 'routine', 'rumor',
  // Common abstract concepts for other letters
  'ability', 'absence', 'access', 'accident', 'account', 'action', 'activity', 'addition', 'address',
  'advantage', 'advice', 'affair', 'age', 'agreement', 'aim', 'anger', 'anxiety', 'appearance',
  'approach', 'argument', 'arrangement', 'aspect', 'assumption', 'atmosphere', 'attempt', 'attention',
  'attitude', 'authority', 'awareness',
  'balance', 'basis', 'beauty', 'behavior', 'belief', 'benefit', 'birth', 'blame', 'bond',
  'care', 'career', 'cause', 'challenge', 'chance', 'chaos', 'character', 'choice', 'circumstance',
  'claim', 'climate', 'comfort', 'comment', 'commitment', 'communication', 'community', 'company',
  'comparison', 'competition', 'complaint', 'concept', 'concern', 'conclusion', 'condition', 'confidence',
  'conflict', 'confusion', 'connection', 'consequence', 'consideration', 'content', 'context', 'contrast',
  'contribution', 'control', 'conversation', 'conviction', 'cooperation', 'cost', 'courage', 'crisis',
  'criticism', 'culture', 'curiosity', 'custom',
  'danger', 'deal', 'death', 'debate', 'debt', 'decision', 'decline', 'defeat', 'defence', 'definition',
  'degree', 'delay', 'demand', 'democracy', 'depression', 'desire', 'detail', 'determination',
  'development', 'difference', 'difficulty', 'dignity', 'dimension', 'direction', 'disadvantage',
  'discipline', 'discovery', 'discussion', 'disease', 'dispute', 'distance', 'distinction', 'distribution',
  'diversity', 'division', 'doubt', 'drama', 'dream', 'duty',
  'faith', 'fame', 'fate', 'fault', 'favor', 'fear', 'feeling', 'fiction', 'figure', 'finance',
  'focus', 'force', 'form', 'formation', 'formula', 'fortune', 'foundation', 'freedom', 'friendship',
  'frustration', 'function', 'future',
  'gain', 'gap', 'generation', 'glory', 'goal', 'goodness', 'government', 'grace', 'grade', 'gratitude',
  'grief', 'growth', 'guarantee', 'guess', 'guidance', 'guilt',
  'habit', 'happiness', 'harm', 'harmony', 'hate', 'health', 'height', 'help', 'heritage', 'history',
  'honor', 'hope', 'horror', 'hostility', 'humanity', 'humor', 'hunger', 'hypothesis',
  'idea', 'identity', 'ignorance', 'illusion', 'image', 'imagination', 'impact', 'implication',
  'importance', 'impression', 'improvement', 'incident', 'income', 'increase', 'independence',
  'indication', 'industry', 'influence', 'information', 'initiative', 'injury', 'injustice', 'innocence',
  'innovation', 'insight', 'inspiration', 'instance', 'instinct', 'institution', 'instruction',
  'integrity', 'intelligence', 'intention', 'interest', 'interpretation', 'intervention', 'introduction',
  'investigation', 'investment', 'involvement', 'irony', 'isolation', 'issue',
  'jealousy', 'job', 'joke', 'journey', 'joy', 'judgment', 'justice',
  'kind', 'kindness', 'knowledge',
  'lack', 'language', 'law', 'leadership', 'league', 'learning', 'legacy', 'length', 'lesson', 'level',
  'liability', 'liberty', 'lie', 'life', 'likelihood', 'limit', 'limitation', 'line', 'literature',
  'living', 'logic', 'loneliness', 'loss', 'love', 'luck', 'luxury',
  'magic', 'maintenance', 'majority', 'management', 'manner', 'marriage', 'mass', 'master', 'match',
  'matter', 'meaning', 'measure', 'media', 'membership', 'memory', 'mention', 'mercy', 'merit',
  'message', 'method', 'mind', 'minority', 'miracle', 'misery', 'mission', 'mistake', 'mixture',
  'mode', 'moment', 'mood', 'morality', 'motion', 'motivation', 'movement', 'murder', 'mystery', 'myth',
  'name', 'nation', 'nature', 'necessity', 'need', 'neglect', 'negotiation', 'network', 'news',
  'nightmare', 'noise', 'norm', 'note', 'notion', 'number',
  'object', 'objective', 'obligation', 'observation', 'occasion', 'occupation', 'offence', 'offer',
  'office', 'operation', 'opinion', 'opportunity', 'opposition', 'option', 'order', 'organization',
  'origin', 'outcome', 'output', 'ownership',
  'pace', 'pain', 'panic', 'paradise', 'part', 'participation', 'partnership', 'party', 'passage',
  'passion', 'past', 'patience', 'pattern', 'pause', 'payment', 'peace', 'perception', 'performance',
  'period', 'permission', 'personality', 'perspective', 'phase', 'phenomenon', 'philosophy', 'pity',
  'place', 'plan', 'pleasure', 'plot', 'point', 'policy', 'politics', 'poll', 'popularity', 'population',
  'portion', 'position', 'possession', 'possibility', 'potential', 'poverty', 'power', 'practice',
  'praise', 'prayer', 'precedent', 'prediction', 'preference', 'prejudice', 'premise', 'preparation',
  'presence', 'pressure', 'pride', 'principle', 'priority', 'privacy', 'privilege', 'probability',
  'problem', 'procedure', 'process', 'production', 'profession', 'profit', 'progress', 'promise',
  'promotion', 'proof', 'property', 'proportion', 'proposal', 'prospect', 'protection', 'protest',
  'provision', 'psychology', 'publicity', 'punishment', 'purpose', 'pursuit',
  'qualification', 'quality', 'quantity', 'question', 'quote',
  'safety', 'sale', 'salvation', 'sample', 'satisfaction', 'scale', 'scandal', 'scene', 'schedule',
  'scheme', 'scholarship', 'science', 'scope', 'score', 'search', 'season', 'secret', 'section',
  'sector', 'security', 'selection', 'self', 'sense', 'sentence', 'sentiment', 'sequence', 'series',
  'service', 'session', 'setting', 'settlement', 'sex', 'shame', 'shape', 'share', 'shift', 'shock',
  'shortage', 'show', 'side', 'significance', 'silence', 'similarity', 'simplicity', 'sin', 'situation',
  'size', 'skill', 'sleep', 'smile', 'society', 'solution', 'sort', 'soul', 'sound', 'source', 'space',
  'species', 'spectrum', 'speech', 'speed', 'spirit', 'spot', 'stability', 'staff', 'stage', 'stake',
  'standard', 'start', 'state', 'statement', 'statistics', 'status', 'step', 'stock', 'stop', 'story',
  'strain', 'strategy', 'strength', 'stress', 'stretch', 'strike', 'struggle', 'structure', 'study',
  'stuff', 'style', 'subject', 'submission', 'substance', 'substitute', 'success', 'suffering',
  'suggestion', 'sum', 'summary', 'summer', 'supply', 'support', 'surface', 'surprise', 'survey',
  'survival', 'suspicion', 'sympathy', 'symptom', 'system',
  'talent', 'talk', 'target', 'task', 'taste', 'tax', 'teaching', 'technique', 'technology', 'teenager',
  'temperature', 'tendency', 'tension', 'term', 'territory', 'terror', 'test', 'testimony', 'text',
  'theme', 'theory', 'therapy', 'thing', 'thinking', 'thought', 'threat', 'threshold', 'time', 'title',
  'tone', 'topic', 'total', 'touch', 'tour', 'tourism', 'tournament', 'trace', 'track', 'trade',
  'tradition', 'traffic', 'tragedy', 'training', 'transfer', 'transformation', 'transition', 'transmission',
  'transport', 'travel', 'treatment', 'treaty', 'trend', 'trial', 'tribe', 'tribute', 'trick', 'trip',
  'trouble', 'trust', 'truth', 'turn', 'type',
  'uncertainty', 'understanding', 'unemployment', 'union', 'unity', 'universe', 'university', 'update',
  'urgency', 'usage', 'use', 'utility',
  'vacation', 'validity', 'value', 'variable', 'variation', 'variety', 'version', 'victory', 'view',
  'village', 'violation', 'violence', 'virtue', 'vision', 'visit', 'vocabulary', 'voice', 'volume', 'vote',
  'wage', 'wait', 'walk', 'war', 'warning', 'waste', 'wave', 'way', 'weakness', 'wealth', 'weather',
  'weekend', 'weight', 'welfare', 'west', 'will', 'win', 'window', 'winter', 'wisdom', 'wish', 'wonder',
  'word', 'work', 'worker', 'workshop', 'world', 'worry', 'worship', 'worth', 'writing',
  'year', 'youth', 'zone'
];

// Words that are definitely physical things (whitelist)
const THING_WHITELIST = [
  // E things
  'elephant', 'egg', 'eraser', 'envelope', 'engine', 'elevator', 'ear', 'eye', 'elbow',
  'earring', 'easel', 'eggplant', 'elastic', 'ember', 'emerald', 'emblem', 'enclosure',
  // R things
  'rack', 'racket', 'radio', 'raft', 'rag', 'rail', 'railroad', 'railway', 'raincoat',
  'rake', 'ramp', 'range', 'razor', 'receipt', 'recorder', 'rectangle', 'refrigerator',
  'remote', 'ribbon', 'rice', 'rifle', 'ring', 'road', 'robot', 'rock', 'rocket', 'rod',
  'roller', 'roof', 'room', 'rope', 'rose', 'rotor', 'router', 'rug', 'ruler',
  // A things
  'accordion', 'acorn', 'airplane', 'alarm', 'album', 'ambulance', 'anchor', 'antenna',
  'apple', 'apron', 'aquarium', 'arm', 'armchair', 'arrow', 'axe',
  // B things
  'backpack', 'badge', 'bag', 'ball', 'balloon', 'banana', 'bandage', 'barrel', 'basket',
  'bat', 'bath', 'battery', 'bead', 'bed', 'bell', 'belt', 'bench', 'bicycle', 'blanket',
  'blender', 'block', 'boat', 'bolt', 'bomb', 'bone', 'book', 'bookshelf', 'boot', 'bottle',
  'bowl', 'box', 'bracelet', 'brick', 'bridge', 'briefcase', 'broom', 'brush', 'bucket',
  'building', 'bulb', 'bullet', 'bus', 'button',
  // C things
  'cabinet', 'cable', 'cage', 'cake', 'calculator', 'calendar', 'camera', 'can', 'candle',
  'candy', 'cane', 'cannon', 'canoe', 'cap', 'car', 'card', 'carpet', 'carrot', 'cart',
  'case', 'castle', 'ceiling', 'cell', 'chain', 'chair', 'chalk', 'chart', 'cheese', 'chest',
  'chip', 'chocolate', 'clock', 'cloth', 'coat', 'coin', 'collar', 'comb', 'compass',
  'computer', 'container', 'cookie', 'cord', 'cork', 'couch', 'counter', 'cover', 'crayon',
  'crown', 'cube', 'cup', 'curtain', 'cushion',
  // D things
  'dart', 'desk', 'diamond', 'dice', 'dictionary', 'dish', 'disk', 'doll', 'dollar', 'door',
  'doorbell', 'drawer', 'dress', 'drill', 'drum', 'dryer',
  // F things
  'fan', 'faucet', 'feather', 'fence', 'file', 'film', 'filter', 'flag', 'flashlight',
  'flask', 'floor', 'flower', 'flute', 'folder', 'football', 'fork', 'frame', 'freezer',
  'fridge', 'fruit', 'funnel', 'furniture',
  // G things
  'gun', 'guitar', 'glass', 'globe', 'glove', 'glue', 'goggles',
  // H things
  'hammer', 'hat', 'helmet', 'hose', 'house',
  // I things
  'iron', 'ink',
  // J things
  'jar', 'jeans', 'jet', 'jewel', 'jewelry', 'jug', 'juice',
  // K things
  'key', 'keyboard', 'kettle', 'knife', 'kite',
  // L things
  'ladder', 'lamp', 'laptop', 'leaf', 'lens', 'letter', 'light', 'lock', 'log',
  // M things
  'machine', 'magnet', 'map', 'mask', 'mat', 'match', 'mattress', 'medal', 'microphone',
  'mirror', 'money', 'mop', 'motor', 'mug',
  // N things
  'nail', 'napkin', 'necklace', 'needle', 'net', 'newspaper', 'notebook', 'nut',
  // O things
  'oil', 'oven',
  // P things
  'pad', 'paint', 'pan', 'paper', 'pen', 'pencil', 'phone', 'piano', 'picture', 'pillow',
  'pipe', 'plate', 'plug', 'pocket', 'pole', 'pot', 'printer', 'pump',
  // Q things
  'quilt',
  // S things
  'safe', 'salt', 'sand', 'saw', 'scale', 'scissors', 'screen', 'screw', 'seat', 'shelf',
  'ship', 'shirt', 'shoe', 'shovel', 'sink', 'soap', 'sock', 'sofa', 'spoon', 'stamp',
  'stapler', 'stick', 'stone', 'stool', 'stove', 'string', 'suitcase', 'sword',
  // T things
  'table', 'tape', 'television', 'tent', 'thread', 'tie', 'tire', 'tissue', 'toaster',
  'toilet', 'tool', 'toothbrush', 'towel', 'toy', 'tray', 'tree', 'truck', 'tube',
  // U things
  'umbrella',
  // V things
  'van', 'vase', 'vest', 'violin',
  // W things
  'wagon', 'wallet', 'watch', 'water', 'wheel', 'window', 'wire', 'wood', 'wool', 'wrench',
  // Y things
  'yarn',
  // Z things
  'zipper'
];

// Category names and generic terms that should NOT be accepted as answers
// These describe the category itself, not a specific item in the category
const CATEGORY_NAME_EXCLUSIONS: Record<CategoryType, string[]> = {
  names: ['name', 'names', 'first name', 'last name', 'surname', 'given name'],
  places: ['place', 'places', 'location', 'locations', 'city', 'country', 'town', 'village', 'state', 'area'],
  animal: ['animal', 'animals', 'creature', 'creatures', 'beast', 'beasts', 'pet', 'pets', 'mammal', 'mammals'],
  thing: ['thing', 'things', 'object', 'objects', 'item', 'items', 'stuff'],
  sports_games: ['sport', 'sports', 'game', 'games', 'play', 'activity', 'activities', 'exercise', 'exercises'],
  brands: ['brand', 'brands', 'company', 'companies', 'corporation', 'corporations', 'business', 'businesses'],
  health_issues: ['health', 'health issue', 'health issues', 'disease', 'diseases', 'illness', 'illnesses', 'sickness', 'condition', 'conditions', 'medical', 'symptom', 'symptoms'],
  countries: ['country', 'countries', 'nation', 'nations', 'state', 'states', 'land'],
  movies: ['movie', 'movies', 'film', 'films', 'cinema', 'motion picture'],
  songs: ['song', 'songs', 'music', 'track', 'tracks', 'tune', 'tunes'],
  professions: ['profession', 'professions', 'job', 'jobs', 'career', 'careers', 'occupation', 'occupations', 'work'],
  food_dishes: ['food', 'foods', 'dish', 'dishes', 'meal', 'meals', 'cuisine', 'recipe'],
  famous_people: ['famous person', 'famous people', 'person', 'people', 'figure', 'figures', 'leader'],
  music_artists: ['music artist', 'music artists', 'band', 'bands', 'singer', 'musician', 'artist', 'group'],
  fruits_vegetables: ['fruit', 'fruits', 'vegetable', 'vegetables', 'produce'],
};

// Check if an answer is a category name (generic term that describes the category)
const isCategoryName = (answer: string, category: CategoryType): boolean => {
  const trimmed = answer.trim().toLowerCase();
  const exclusions = CATEGORY_NAME_EXCLUSIONS[category];
  return exclusions.includes(trimmed);
};

// Nationality adjectives - these are NOT valid standalone answers for any category
// They describe origin/nationality but aren't places, names, things, etc.
const NATIONALITY_ADJECTIVES = [
  'swiss', 'french', 'german', 'italian', 'spanish', 'british', 'english', 'irish',
  'scottish', 'welsh', 'dutch', 'belgian', 'austrian', 'swedish', 'danish', 'norwegian',
  'finnish', 'polish', 'russian', 'ukrainian', 'czech', 'greek', 'turkish', 'egyptian',
  'moroccan', 'nigerian', 'kenyan', 'ethiopian', 'south african', 'australian',
  'canadian', 'american', 'mexican', 'brazilian', 'argentinian', 'chilean', 'colombian',
  'peruvian', 'venezuelan', 'cuban', 'jamaican', 'chinese', 'japanese', 'korean',
  'vietnamese', 'thai', 'malaysian', 'indonesian', 'indian', 'pakistani', 'bangladeshi',
  'sri lankan', 'filipino', 'singaporean', 'taiwanese', 'mongolian', 'israeli', 'iranian',
  'iraqi', 'saudi', 'emirati', 'qatari', 'kuwaiti', 'lebanese', 'syrian', 'jordanian',
  'portuguese', 'romanian', 'hungarian', 'bulgarian', 'croatian', 'serbian', 'slovenian',
  'slovak', 'lithuanian', 'latvian', 'estonian', 'icelandic', 'luxembourgish'
];

// Category-specific REQUIRED indicators (must have at least one)
const CATEGORY_REQUIRED_INDICATORS: Record<CategoryType, string[]> = {
  names: ['given name', 'first name', 'surname', 'born', 'politician', 'actor', 'actress', 'singer', 'musician', 'author', 'writer', 'player', 'athlete', 'president', 'minister', 'celebrity', 'footballer', 'basketball', 'baseball', 'swimmer', 'director', 'comedian', 'entertainer', 'rapper', 'composer', 'painter', 'artist', 'scientist', 'inventor', 'entrepreneur', 'model', 'chef', 'journalist', 'lawyer', 'professor', 'philosopher', 'known for'],
  places: ['city', 'country', 'town', 'village', 'state', 'province', 'region', 'capital', 'located', 'population', 'continent', 'island', 'mountain', 'river', 'lake', 'district', 'municipality', 'county', 'territory', 'inhabitants', 'bordered', 'prefecture', 'suburb', 'metropolitan', 'borough', 'township', 'census'],
  animal: ['species', 'mammal', 'bird', 'fish', 'reptile', 'amphibian', 'insect', 'animal', 'genus', 'family', 'wildlife', 'predator', 'prey', 'habitat', 'carnivore', 'herbivore', 'omnivore', 'vertebrate', 'invertebrate', 'primate', 'rodent', 'canine', 'feline', 'marine', 'aquatic', 'endemic'],
  thing: ['object', 'tool', 'device', 'item', 'equipment', 'furniture', 'appliance', 'instrument', 'container', 'material', 'made of', 'used for', 'machine', 'product', 'structure', 'weapon', 'clothing', 'fabric', 'household', 'kitchen', 'utensil'],
  sports_games: ['sport', 'game', 'play', 'team', 'player', 'ball', 'competition', 'athletic', 'olympic', 'championship', 'tournament', 'match', 'league', 'board game', 'card game', 'children', 'outdoor', 'indoor', 'physical', 'recreational'],
  brands: ['company', 'brand', 'corporation', 'business', 'founded', 'headquarter', 'manufacturer', 'trademark', 'subsidiary', 'conglomerate', 'enterprise', 'multinational', 'retail', 'products', 'airline', 'airline company', 'flag carrier', 'aviation', 'airways', 'air transport', 'hong kong', 'carrier', 'flights', 'destinations', 'hub', 'oneworld', 'star alliance', 'skyteam'],
  health_issues: ['disease', 'medical', 'condition', 'syndrome', 'disorder', 'symptom', 'treatment', 'diagnosis', 'infection', 'illness', 'chronic', 'acute', 'therapy', 'clinical', 'pathology', 'causes', 'inflammation', 'virus', 'bacteria', 'genetic', 'congenital', 'psychiatric', 'phobia', 'characterized'],
  countries: ['country', 'nation', 'sovereign', 'republic', 'kingdom', 'state', 'government', 'capital', 'population', 'bordered', 'continent', 'independence', 'territory', 'official language'],
  movies: ['film', 'movie', 'directed', 'starring', 'released', 'box office', 'screenplay', 'cinema', 'academy award', 'production', 'sequel', 'premiere', 'cast'],
  songs: ['song', 'single', 'album', 'released', 'chart', 'billboard', 'music video', 'lyrics', 'performed by', 'written by', 'recorded', 'hit', 'track'],
  professions: ['occupation', 'profession', 'career', 'job', 'work', 'employment', 'specialist', 'professional', 'trained', 'certified', 'licensed', 'practice', 'umpire', 'referee', 'official', 'operator', 'technician', 'engineer', 'worker', 'employee'],
  food_dishes: ['dish', 'cuisine', 'recipe', 'ingredient', 'cooked', 'prepared', 'served', 'traditional', 'originated', 'culinary', 'meal', 'food', 'dessert', 'sweet', 'frozen', 'eaten', 'snack', 'breakfast', 'lunch', 'dinner', 'appetizer', 'edible', 'consume', 'delicacy', 'pastry', 'confection', 'dairy', 'cream', 'flavor'],
  famous_people: ['born', 'died', 'century', 'historical', 'reign', 'ruled', 'emperor', 'king', 'queen', 'leader', 'revolutionary', 'war', 'famous for', 'known for', 'secretary-general', 'secretary general', 'diplomat', 'statesman', 'politician', 'prime minister', 'president', 'general', 'admiral', 'commander', 'philosopher', 'scientist', 'inventor', 'explorer', 'reformer', 'activist', 'united nations', 'nobel', 'burmese', 'myanmar', 'actor', 'actress', 'singer', 'musician', 'athlete', 'entrepreneur', 'celebrity'],
  music_artists: ['band', 'singer', 'musician', 'group', 'artist', 'album', 'song', 'music', 'vocalist', 'rapper', 'duo', 'trio', 'formed', 'genre', 'record', 'debut', 'tour', 'concert', 'frontman', 'lead singer'],
  // fruits_vegetables should not overlap with food_dishes validation
  fruits_vegetables: ['is a fruit', 'is a vegetable', 'is a type of fruit', 'is a type of vegetable', 'is a cultivar', 'is a variety of', 'edible', 'plant', 'tropical', 'berry', 'citrus', 'grown'],
};

// Category-specific REJECTION indicators - strong signals that it's NOT this category
const CATEGORY_REJECTION_INDICATORS: Record<CategoryType, string[]> = {
  names: ['is a city', 'is a town', 'is a country', 'is a village', 'square kilomet', 'population of', 'is a species', 'is a genus'],
  places: ['was born', 'is an actor', 'is an actress', 'is a singer', 'is a musician', 'is a footballer', 'is a politician', 'is an author', 'is a writer', 'is a player', 'career began', 'known for his role', 'known for her role', 'starred in', 'is a band', 'musical group', 'is a species', 'is a given name', 'is a surname'],
  animal: ['is a band', 'musical group', 'rock band', 'is a city', 'is a town', 'is a country', 'was born', 'is an actor', 'is a singer', 'is a company', 'is a given name'],
  thing: ['is a band', 'is a singer', 'is a company', 'was born', 'is an actor', 'is a species', 'is a city', 'is a country'],
  sports_games: ['was born', 'is an actor', 'is a singer', 'is a city', 'is a country', 'is a species', 'is a given name', 'is a fruit', 'is a vegetable'],
  brands: ['was born', 'is a city', 'is a country', 'is an actor', 'is a singer', 'is a species', 'is a given name'],
  health_issues: ['was born', 'is an actor', 'is a singer', 'is a city', 'is a country', 'is a band', 'is a company', 'is a species', 'is a given name'],
  countries: ['was born', 'is an actor', 'is a singer', 'is a species', 'is a given name', 'is a film', 'is a song'],
  movies: ['was born', 'is a city', 'is a country', 'is a species', 'is a given name', 'is a song', 'is a band'],
  songs: ['was born', 'is a city', 'is a country', 'is a species', 'is a given name', 'is a film', 'is a movie'],
  professions: ['is a city', 'is a country', 'is a species', 'is a film', 'is a song', 'is a given name'],
  food_dishes: ['was born', 'is an actor', 'is a city', 'is a country', 'is a species', 'is a given name', 'is a film'],
  famous_people: ['is a city', 'is a country', 'is a species', 'is a film', 'is a song', 'is a dish', 'is a food'],
  music_artists: ['is a city', 'is a country', 'is a species', 'is a film', 'is a movie', 'is a food', 'is a dish'],
  // fruits_vegetables should not be accepted for food_dishes validation (they are raw produce, not prepared dishes)
  fruits_vegetables: ['was born', 'is an actor', 'is a singer', 'is a city', 'is a country', 'is a band', 'is a company', 'is a dish', 'is a meal'],
};

/**
 * Validates answers with priority: Supabase -> Local Database
 * Supabase is checked first as the primary source of truth
 * No Wikipedia fallback - keeping validation simple and reliable
 */
export const validateWithFallback = async (
  answer: string,
  letter: string,
  category: CategoryType
): Promise<{ isValid: boolean; source: 'supabase' | 'local' | 'online' | 'none' }> => {
  // Basic validation (starts with letter, min length)
  const trimmed = answer.trim().toLowerCase();
  const letterLower = letter.toLowerCase();

  // For movies/songs, strip leading articles ("The", "A", "An") for letter-matching purposes
  const articleCategories: CategoryType[] = ['movies', 'songs'];
  const shouldIgnoreArticles = articleCategories.includes(category);
  const strippedAnswer = shouldIgnoreArticles
    ? trimmed.replace(/^(the|a|an)\s+/i, '')
    : trimmed;
  // The answer passes the letter check if EITHER the full answer or the article-stripped version starts with the letter
  const startsWithLetter = trimmed.startsWith(letterLower) || (shouldIgnoreArticles && strippedAnswer.startsWith(letterLower));

  if (!trimmed || trimmed.length < 2 || !startsWithLetter) {
    return { isValid: false, source: 'none' };
  }

  // Reject if answer is EXACTLY the letter prefix (user didn't type anything beyond pre-fill)
  // This handles both single letters ("S") and two-letter combos ("LO", "CH", etc.)
  if (trimmed === letterLower) {
    return { isValid: false, source: 'none' };
  }

  // Must have at least 3 characters for a real word (rejects "lo", "ch", etc.)
  if (trimmed.length < 3) {
    return { isValid: false, source: 'none' };
  }

  // Reject category names as answers (e.g., "vegetable" for fruits_vegetables category)
  if (isCategoryName(trimmed, category)) {
    console.log(`[Validation] "${answer}" - rejected (category name for ${category})`);
    return { isValid: false, source: 'none' };
  }

  // Normalize the answer for matching (handle spaces, hyphens, etc.)
  const normalizedAnswer = trimmed;
  const noSpaceAnswer = trimmed.replace(/[\s-]+/g, ''); // "ice cream" -> "icecream"
  const spacedAnswer = trimmed.replace(/-/g, ' '); // "ice-cream" -> "ice cream"
  const hyphenatedAnswer = trimmed.replace(/\s+/g, '-'); // "ice cream" -> "ice-cream"

  // Get singular form for plural validation
  const singularForm = getSingularForm(trimmed);
  const singularStartsWithLetter = singularForm?.startsWith(letter.toLowerCase());

  // FIRST: Check Supabase database (primary source)
  if (hasSupabaseSupport(category)) {
    try {
      const supabaseResult = await validateWordFuzzyInSupabase(answer, category);
      if (supabaseResult.found) {
        console.log(`[Validation] "${answer}" - accepted from Supabase (matched: ${supabaseResult.matchedWord})`);
        return { isValid: true, source: 'supabase' };
      }
      console.log(`[Validation] "${answer}" - not found in Supabase for ${category}, checking local...`);
    } catch (err) {
      console.log(`[Validation] Supabase check failed, falling back to local:`, err);
    }
  }

  // SECOND: Check local database with multiple variations
  const localSets: Partial<Record<CategoryType, Set<string>>> = {
    places: WORLD_PLACES_SET,
    names: WORLD_NAMES_SET,
    animal: ANIMALS_SET,
    thing: THINGS_SET,
    sports_games: SPORTS_GAMES_SET,
    brands: BRANDS_SET,
    health_issues: HEALTH_ISSUES_SET,
    fruits_vegetables: FRUITS_VEGETABLES_SET,
    // Advanced categories use online validation only
  };

  const localSet = localSets[category];

  // Categories that accept plural forms (not names/places which are proper nouns)
  const acceptsPluralCategories: CategoryType[] = [
    'animal', 'thing', 'health_issues',
    'sports_games', 'brands', 'countries', 'movies', 'songs',
    'professions', 'food_dishes', 'famous_people'
  ];

  if (localSet) {
    // Direct match
    if (localSet.has(normalizedAnswer)) {
      console.log(`[Validation] "${answer}" - accepted from local database (direct match)`);
      return { isValid: true, source: 'local' };
    }
    // Try spaced version
    if (localSet.has(spacedAnswer)) {
      console.log(`[Validation] "${answer}" - accepted from local database (spaced match)`);
      return { isValid: true, source: 'local' };
    }
    // Try hyphenated version
    if (localSet.has(hyphenatedAnswer)) {
      console.log(`[Validation] "${answer}" - accepted from local database (hyphenated match)`);
      return { isValid: true, source: 'local' };
    }
    // Try no-space version (check if any entry matches when spaces removed)
    for (const entry of localSet) {
      if (entry.replace(/[\s-]+/g, '') === noSpaceAnswer) {
        console.log(`[Validation] "${answer}" - accepted from local database (normalized match: ${entry})`);
        return { isValid: true, source: 'local' };
      }
    }
    // Try singular form for categories that accept plurals (e.g., "dates" -> "date", "oranges" -> "orange")
    if (acceptsPluralCategories.includes(category) && singularForm && singularStartsWithLetter) {
      if (localSet.has(singularForm)) {
        console.log(`[Validation] "${answer}" - accepted from local database (plural->singular: ${singularForm})`);
        return { isValid: true, source: 'local' };
      }
      // Try singular with spaces/hyphens
      const singularSpaced = singularForm.replace(/-/g, ' ');
      const singularHyphenated = singularForm.replace(/\s+/g, '-');
      if (localSet.has(singularSpaced) || localSet.has(singularHyphenated)) {
        console.log(`[Validation] "${answer}" - accepted from local database (plural->singular normalized)`);
        return { isValid: true, source: 'local' };
      }
    }
  }

  // Also check WORD_DATABASE for the category
  const categoryData = WORD_DATABASE[category];
  const letterUpper = letter.toUpperCase();

  // For two-letter combos, check both the exact combo and the first letter
  // e.g., for "BU", check categoryData['BU'] and categoryData['B']
  const lettersToCheck = letterUpper.length === 2
    ? [letterUpper, letterUpper[0]]
    : [letterUpper];

  for (const letterKey of lettersToCheck) {
    const validWords = categoryData[letterKey] || [];
    for (const word of validWords) {
      const wordLower = word.toLowerCase();
      // For two-letter combo, make sure the word actually starts with the combo
      if (letterUpper.length === 2 && !wordLower.startsWith(letterUpper.toLowerCase())) {
        continue;
      }
      if (wordLower === normalizedAnswer ||
          wordLower === spacedAnswer ||
          wordLower === hyphenatedAnswer ||
          wordLower.replace(/[\s-]+/g, '') === noSpaceAnswer) {
        console.log(`[Validation] "${answer}" - accepted from WORD_DATABASE (match: ${word})`);
        return { isValid: true, source: 'local' };
      }
    }
  }

  // For movies/songs: also check WORD_DATABASE entries after stripping articles
  // e.g., user types "Godfather" for letter "G" → match "The Godfather" under "T" key
  if (shouldIgnoreArticles) {
    const articlePattern = /^(the|a|an)\s+/i;
    for (const [_letterKey, validWords] of Object.entries(categoryData)) {
      for (const word of validWords) {
        const wordLower = word.toLowerCase();
        const wordWithoutArticle = wordLower.replace(articlePattern, '');
        // Only check entries that actually had an article stripped
        if (wordWithoutArticle !== wordLower) {
          if (wordWithoutArticle === normalizedAnswer ||
              wordWithoutArticle === spacedAnswer ||
              wordWithoutArticle === hyphenatedAnswer ||
              wordWithoutArticle.replace(/[\s-]+/g, '') === noSpaceAnswer) {
            console.log(`[Validation] "${answer}" - accepted from WORD_DATABASE (article-stripped match: ${word})`);
            return { isValid: true, source: 'local' };
          }
        }
      }
    }
  }

  // THIRD: No more Wikipedia fallback - if not in Supabase or local, it's invalid
  console.log(`[Validation] "${answer}" - not found in any database for ${category}`);
  return { isValid: false, source: 'none' };
};

/**
 * Constraint validation interface
 */
export interface LevelConstraintCheck {
  type: 'none' | 'no_common_words' | 'min_word_length' | 'no_repeat_letters' | 'time_pressure' | 'survival' | 'ends_with_letter' | 'double_letters' | 'max_word_length' | 'combo';
  value?: number;
  endLetter?: string;
  comboConstraints?: Array<{ type: string; value?: number; endLetter?: string }>;
}

/**
 * Validates if an answer meets the level constraint requirements
 * Returns { passes: true } if constraint is met, or { passes: false, reason: string } if not
 */
export const validateConstraint = (
  answer: string,
  constraint: LevelConstraintCheck | null | undefined
): { passes: boolean; reason?: string } => {
  if (!constraint || constraint.type === 'none' || constraint.type === 'time_pressure' || constraint.type === 'survival') {
    // These constraints don't affect individual word validation
    return { passes: true };
  }

  const trimmed = answer.trim();
  // Count letters only (exclude spaces, hyphens, etc.)
  const lettersOnly = trimmed.replace(/[^a-zA-Z]/g, '');

  // Handle combo constraints (multiple constraints combined)
  if (constraint.type === 'combo' && constraint.comboConstraints) {
    for (const subConstraint of constraint.comboConstraints) {
      const result = validateConstraint(answer, subConstraint as LevelConstraintCheck);
      if (!result.passes) {
        return result;
      }
    }
    return { passes: true };
  }

  switch (constraint.type) {
    case 'min_word_length':
      const minLength = constraint.value || 4;
      if (lettersOnly.length < minLength) {
        return {
          passes: false,
          reason: `Must be ${minLength}+ letters (got ${lettersOnly.length})`
        };
      }
      break;

    case 'max_word_length':
      const maxLength = constraint.value || 10;
      if (lettersOnly.length > maxLength) {
        return {
          passes: false,
          reason: `Must be ${maxLength} letters or less (got ${lettersOnly.length})`
        };
      }
      break;

    case 'no_repeat_letters':
      const lowerLetters = lettersOnly.toLowerCase();
      const letterSet = new Set<string>();
      for (const char of lowerLetters) {
        if (letterSet.has(char)) {
          return {
            passes: false,
            reason: `Letter "${char}" is repeated`
          };
        }
        letterSet.add(char);
      }
      break;

    case 'ends_with_letter':
      const endLetter = constraint.endLetter?.toLowerCase();
      if (endLetter && !trimmed.toLowerCase().endsWith(endLetter)) {
        return {
          passes: false,
          reason: `Must end with "${endLetter.toUpperCase()}"`
        };
      }
      break;

    case 'double_letters':
      const lower = lettersOnly.toLowerCase();
      let hasDouble = false;
      for (let i = 0; i < lower.length - 1; i++) {
        if (lower[i] === lower[i + 1]) {
          hasDouble = true;
          break;
        }
      }
      if (!hasDouble) {
        return {
          passes: false,
          reason: 'Must contain double letters (ee, ll, ss, etc.)'
        };
      }
      break;

    case 'no_common_words':
      // This is harder to validate client-side, so we'll be lenient
      // The idea is to reject very common/obvious answers
      // For now, just pass - could add a common words list later
      break;
  }

  return { passes: true };
};
