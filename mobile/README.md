# NPAT - Name Place Animal Thing

A classic word game for 1-10 players, built with React Native and Expo with real-time multiplayer support via Supabase.

## Game Overview

NPAT (Name Place Animal Thing) is the digital version of the classic pen-and-paper word game. Players compete to come up with words starting with a random letter across various categories.

## Game Modes

### Single Player Mode - 500 Level Progression
- **Sequential progression**: Players start at Level 1 and progress through 500 levels one at a time
- **No level selection screen**: Clicking Single Player goes directly to the current level
- **Starts with 4 classic categories**: Names, Places, Animal, Thing (the original NPAT!)
- **Progressive category introduction** (new category every 5 levels):
  - Levels 1-4: Names, Places, Animal, Thing (4 starter categories, always)
  - Level 5: Sports & Games unlocks (5 categories)
  - Level 10: Brands unlocks (6 categories)
  - Level 15: Countries unlocks (7 categories)
  - Level 20: Food & Dishes unlocks (8 categories)
  - Level 25: Professions unlocks (9 categories)
  - Level 30: Movies unlocks (10 categories)
  - Level 35: Songs unlocks (11 categories)
  - Level 40: Health Issues unlocks (12 categories)
  - Level 45: Famous People unlocks (13 categories)
  - Level 50+: Fruits & Vegetables unlocks (all 14 categories available)

- **Progressive constraint introduction** (one new constraint type every 5 levels):
  - Levels 1-9: No constraints (learn the game with comfortable time)
  - Level 10: Min word length (4+ letters)
  - Level 15: Ends with specific letter
  - Level 20: Max word length
  - Level 25: Double letters required
  - Level 30: No repeat letters
  - Level 40: No common words
  - Level 50: Combo constraints (2 at once)
  - Level 75: Survival mode (one wrong = fail)
  - Level 100: Time pressure mode
  - Level 200+: Multi-letter mode (different letter per category)
  - Level 300+: Up to 3 combo constraints

- **Generous timing with constraints**:
  - Base timer: 18s for levels 1-10, gradually decreasing to 5s by level 400
  - Any constraint adds +3s base bonus time
  - 5+ letter minimum: +3s extra
  - 6+ letter minimum: +5s extra total
  - Ends with letter: +2s extra
  - No repeat letters: +3s extra
  - Double letters: +2s extra
  - Combo constraints: +4s extra
  - Survival mode: +2s extra

- **Difficulty scaling**:
  - Categories per level: 4 at start (levels 1-4), gradually up to 8 at higher levels
  - Pass score: 30% at Level 1-10, 40% at 11-25, 50% at 26-50, 60% at 51-100, up to 95% by Level 400+
  - Letter difficulty: Easy first (S,M,B,T,C,P), then harder (Q,Y,Z,J,K,V) at higher levels
  - Bonus multiplier: 1.0x to 2.0x

- **Level mechanics**:
  - Each level = 1 round
  - Pass requirement: Score minimum % to unlock next level
  - Stars: 1 (pass), 2 (75%+), 3 (90%+)
  - Milestone levels guarantee the newly introduced category appears

### Multiplayer Mode
- **Create Game**: Host a new game session and share the code with friends
- **Join Game**: Enter a 6-character room code to join a friend's game
- **2-10 players** per game session
- Real-time competition with live standings

### Daily Challenge Mode
A new daily challenge every day that all players can attempt:
- **6 random categories** with varying constraints and difficulty levels
- **Single letter only** - no two-letter combos
- **Difficulty varies daily** - easy, medium, or hard letters depending on the day
- **Timed gameplay** - Timer runs continuously
- **Speed Bonus** - +2 extra points for filling each category in 5 seconds or less
- **One attempt per day** - Everyone gets the same challenge
- **Shareable results** - Share your score with friends

## Features

- **Solo & Multiplayer modes** - Play alone with 500-level progression or with friends
- **Progressive difficulty** - 500 levels with smooth difficulty curve
- **Real-time multiplayer** via Supabase
- **1-20 rounds** configurable
- **14 categories**:
  - Names, Places, Animals, Things (starter)
  - Sports & Games, Brands, Countries, Food & Dishes, Professions (mid-game)
  - Movies, Songs, Health Issues, Famous People, Fruits & Vegetables (later levels)
- **Dynamic timer** per round (5-25 seconds per category depending on level and constraints)
- **STOP button** - complete all categories early to trigger a 5-second countdown
- **Smart scoring**:
  - 10 points for unique answers
  - Shared points for duplicates (singular/plural treated as same)
  - +2 bonus points for correct answers with 10+ letters
- **Smart validation**: Supabase database → local database → Wikipedia API fallback
- **Comprehensive datasets**: 1000+ names, 1500+ things, 400+ sports/games, 1000+ brands, 1000+ health conditions

## How to Play

1. **Create Profile** - Enter your username on first launch
2. **Select Game Mode** - Choose Single Player, Multiplayer, or Daily Challenge
3. **For Single Player** - Tap to start your current level immediately
4. **For Multiplayer** - Create a game or Join with a room code → Lobby → Start
5. **Play Round** - Fill in words starting with the given letter
6. **Score Points** - Unique = 10pts, shared = split, 10+ letters = +2 bonus
7. **Results** - See score, stars earned, pass/fail status
8. **Progress** - Play Next Level (if passed) or Retry (if failed)

## Project Structure

```
mobile/src/
├── app/                        # Screens (Expo Router)
│   ├── index.tsx              # Home screen
│   ├── game-mode.tsx          # Single Player vs Multiplayer vs Daily Challenge
│   ├── multiplayer-options.tsx # Create/Join game options (Multiplayer)
│   ├── create-game.tsx        # Game setup
│   ├── join-game.tsx          # Join with code
│   ├── lobby.tsx              # Pre-game lobby
│   ├── game.tsx               # Main gameplay
│   ├── round-results.tsx      # Round scoring
│   ├── final-results.tsx      # Results and progression
│   ├── daily-challenge.tsx    # Daily Challenge entry screen
│   ├── daily-challenge-game.tsx # Daily Challenge gameplay
│   └── daily-challenge-results.tsx # Daily Challenge results
├── components/                # Reusable UI
├── data/                      # Game datasets (JSON files)
│   ├── names.json            # Human names dataset
│   ├── places.json           # World places dataset
│   ├── animals.json          # Animals dataset
│   ├── things.json           # Objects/things dataset
│   ├── sports_games.json     # Sports and games dataset
│   ├── fruits_vegetables.json # Fruits and vegetables dataset
│   ├── brands.json           # Brand names dataset
│   ├── health_issues.json    # Health conditions dataset
│   ├── food_dishes.json      # Food and dishes dataset
│   ├── movies.json           # Movies dataset
│   ├── songs.json            # Songs dataset
│   ├── professions.json      # Professions dataset
│   ├── historical_figures.json # Famous people dataset
│   ├── music_artists.json    # Music artists dataset
│   └── world-places.ts       # Well-known cities (filtered by population)
└── lib/
    ├── supabase.ts            # Supabase client (multiplayer only)
    ├── supabase-categories.ts # Local validation using JSON datasets
    ├── level-types.ts         # Level progression types
    ├── state/
    │   └── game-store.ts      # Zustand game state
    └── word-validation.ts     # Category word validation

backend/src/
├── lib/
│   └── level-generator.ts     # 500-level progression system
├── routes/
│   ├── levels.ts              # API routes for level data
│   └── daily-challenge.ts     # API routes for daily challenge
└── index.ts                   # Hono server
```

## Level Constraints (Single Player)

Higher levels introduce special constraints enforced during validation:
- **None**: Standard gameplay
- **Min Word Length**: Answers must have 4-7+ characters
- **Max Word Length**: Answers must be under a certain length
- **No Common Words**: Avoid obvious/common answers
- **No Repeat Letters**: Each letter can only appear once in answer
- **Ends With Letter**: Words must end with a specific letter
- **Double Letters**: Words must contain double letters (ee, ll, ss, etc.)
- **Time Pressure**: Reduced timer per category
- **Survival Mode**: One invalid answer = level failed
- **Combo**: Multiple constraints combined (up to 3 at highest levels)

## Answer Validation

The game uses a comprehensive validation system:
- **Minimum length**: All answers must be at least 3 characters
- **Local database**: Extensive word lists for all categories
- **Wikipedia API fallback**: Category-specific keyword matching
- **Exclusion lists**: Generic terms blocked
- **Constraint checking**: Level-specific constraints enforced before dictionary validation
- **Article-ignoring for movies/songs**: Leading articles ("The", "A", "An") are ignored when validating movie and song answers. For example, typing "Godfather" for letter "G" will match "The Godfather", and typing "The Godfather" for letter "G" will also be accepted.
