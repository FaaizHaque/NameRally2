import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, DbGameSession, DbPlayer, DbRoundResult } from '../supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { validateWithFallback, validateConstraint, LevelConstraintCheck } from '../word-validation';
import type { LevelData, LevelProgress } from '../level-types';
import { calculateStars, didPassLevel } from '../level-types';

// Helper function to normalize answer for shared points (singular/plural treated as same)
const normalizeAnswerForScoring = (answer: string, category: CategoryType): string => {
  // Strip all internal spaces so "water melon" == "watermelon", "New York" == "newyork"
  const w = answer.toLowerCase().trim().replace(/\s+/g, '');

  // Categories where singular/plural should be treated as the same answer
  const normalizePluralCategories: CategoryType[] = ['animal', 'thing'];

  if (!normalizePluralCategories.includes(category)) {
    return w;
  }

  // Convert plural to singular for comparison
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
    if (withoutEs.endsWith('s') || withoutEs.endsWith('x') ||
        withoutEs.endsWith('z') || withoutEs.endsWith('ch') ||
        withoutEs.endsWith('sh')) {
      return withoutEs;
    }
    // Otherwise try removing just 's'
    return w.slice(0, -1);
  }
  if (w.endsWith('s') && w.length > 2 && !w.endsWith('ss')) {
    // cats -> cat, dogs -> dog, oranges -> orange
    return w.slice(0, -1);
  }

  return w;
};

// Category types - includes base and advanced categories
export type CategoryType =
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

export interface Category {
  id: CategoryType;
  name: string;
  icon: string;
}

export const AVAILABLE_CATEGORIES: Category[] = [
  { id: 'names', name: 'Names', icon: 'user' },
  { id: 'places', name: 'Places', icon: 'map-pin' },
  { id: 'animal', name: 'Animal', icon: 'cat' },
  { id: 'thing', name: 'Thing', icon: 'box' },
  { id: 'fruits_vegetables', name: 'Fruits & Vegetables', icon: 'apple' },
  { id: 'sports_games', name: 'Sports & Games', icon: 'trophy' },
  { id: 'brands', name: 'Brands', icon: 'shopping-bag' },
  { id: 'health_issues', name: 'Health Issues', icon: 'heart-pulse' },
  // Advanced categories
  { id: 'countries', name: 'Countries', icon: 'globe' },
  { id: 'professions', name: 'Professions', icon: 'briefcase' },
  { id: 'food_dishes', name: 'Food & Dishes', icon: 'utensils' },
  { id: 'celebrities', name: 'Famous People', icon: 'landmark' },
];

export interface Player {
  id: string;
  visibleId: string;
  username: string;
  isHost: boolean;
  isReady: boolean;
  totalScore: number;
  currentRoundAnswers: Partial<Record<CategoryType, string>>;
  currentRoundScores: Partial<Record<CategoryType, number>>;
  hasSubmitted: boolean;
}

export interface RoundResult {
  roundNumber: number;
  letter: string;
  playerScores: Record<string, number>;
  answers: Record<string, Record<CategoryType, { answer: string; score: number; isValid: boolean; hasBonus?: boolean }>>;
}

export interface GameSession {
  id: string;
  code: string;
  hostId: string;
  players: Player[];
  settings: {
    totalRounds: number;
    selectedCategories: CategoryType[];
    roundDuration: number;
  };
  currentRound: number;
  currentLetter: string;
  usedLetters: string[]; // Track letters used in this game
  status: 'lobby' | 'picking_letter' | 'playing' | 'round_results' | 'final_results';
  roundResults: RoundResult[];
  roundStartTime: number | null;
  roundEndTime: number | null;
  stopRequested: boolean;
  stopRequestedBy: string | null;
  stopCountdownStart: number | null;
  letterPickerId: string | null; // The player assigned to pick the letter
}

// Game mode types
export type GameMode = 'single' | 'multiplayer';
export type DifficultyLevel = 'easy' | 'medium' | 'hard'; // Kept for multiplayer compatibility

// Re-export level types for convenience
export type { LevelData, LevelProgress } from '../level-types';

interface GameState {
  // User state
  currentUser: { id: string; username: string } | null;

  // Game mode settings
  gameMode: GameMode;
  difficulty: DifficultyLevel;

  // Game session
  session: GameSession | null;

  // Local game state
  localAnswers: Partial<Record<CategoryType, string>>;
  timeRemaining: number;

  // Highscore for solo mode (per difficulty) - kept for backwards compatibility
  highScores: Record<DifficultyLevel, number>;

  // Level progression for single player
  levelProgress: LevelProgress;
  currentLevel: LevelData | null; // Currently playing level

  // Realtime subscription
  realtimeChannel: RealtimeChannel | null;

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Actions
  setCurrentUser: (user: { id: string; username: string }) => void;
  createGame: (settings: { totalRounds: number; selectedCategories: CategoryType[] }) => Promise<string>;
  joinGame: (code: string) => Promise<boolean>;
  leaveGame: () => Promise<void>;


  startGame: () => Promise<void>;
  updateLocalAnswer: (category: CategoryType, answer: string) => void;
  clearLocalAnswers: () => void;
  submitAnswers: () => Promise<void>;
  requestStop: () => Promise<void>;
  nextRound: () => Promise<void>;
  confirmLetterPick: (letter: string) => Promise<void>;
  setTimeRemaining: (time: number) => void;
  endRound: () => Promise<void>;
  endGameEarly: () => Promise<void>;

  // Game mode actions
  setGameMode: (mode: GameMode) => void;
  setDifficulty: (difficulty: DifficultyLevel) => void;

  // Persistence
  loadUser: () => Promise<void>;
  saveUser: () => Promise<void>;
  loadHighScores: () => Promise<void>;
  saveHighScore: (score: number) => Promise<void>;

  // Level progression (Single Player)
  loadLevelProgress: () => Promise<void>;
  saveLevelProgress: () => Promise<void>;
  setCurrentLevel: (level: LevelData | null) => void;
  completeLevelWithScore: (score: number) => Promise<void>;
  startLevelGame: (level: LevelData) => Promise<void>; // Start level directly without lobby
  devUnlockAllLevels: () => Promise<void>; // DEV: Unlock all 500 levels for testing
  spendStars: (amount: number) => boolean; // Spend stars (returns false if not enough)
  loseLife: () => void; // Deduct 1 life on level fail
  resetLives: () => void; // Restore all 3 lives (ad reward or 24h auto-reset)

  // Realtime
  subscribeToSession: (sessionId: string) => void;
  unsubscribeFromSession: () => void;
  refreshSession: () => Promise<void>;
  refreshSessionById: (sessionId: string) => Promise<void>;
  setSession: (session: GameSession | null) => void;
  setError: (error: string | null) => void;
}

// Generate random game code
const generateGameCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Generate random letter (excluding difficult ones and used letters)
const generateRandomLetter = (usedLetters: string[] = []): string => {
  const allLetters = 'ABCDEFGHIJKLMNOPRSTUVW';
  const availableLetters = allLetters
    .split('')
    .filter((l) => !usedLetters.includes(l));

  // If all letters are used, reset (shouldn't happen with max 20 rounds)
  if (availableLetters.length === 0) {
    return allLetters.charAt(Math.floor(Math.random() * allLetters.length));
  }

  return availableLetters[Math.floor(Math.random() * availableLetters.length)];
};

// Deterministically pick the letter-picker for a given round using a seeded shuffle.
// The session code is used as the seed so the result is identical on all clients.
// Players are shuffled once (via the seed) and then iterated round-robin across rounds.
const getPickerForRound = (players: Player[], sessionCode: string, round: number): Player => {
  if (players.length === 0) return players[0]!;

  // Build a stable numeric seed from the session code characters
  let seed = 0;
  for (const c of sessionCode) {
    seed = (seed * 31 + c.charCodeAt(0)) % 1_000_000;
  }

  // Fisher-Yates shuffle of player indices using the seed
  const indices = players.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    // Advance the seed deterministically
    seed = (seed * 1103515245 + 12345) % 2_147_483_647;
    const j = seed % (i + 1);
    [indices[i], indices[j]] = [indices[j]!, indices[i]!];
  }

  // Round-robin through the shuffled order: round 1 → index 0, round 2 → index 1, …
  const position = (round - 1) % players.length;
  return players[indices[position]!]!;
};

// Convert database session to app session
const dbToAppSession = (
  dbSession: DbGameSession,
  dbPlayers: DbPlayer[],
  dbRoundResults: DbRoundResult[]
): GameSession => {
  // Extract used letters from round results
  const usedLetters = dbRoundResults.map((r) => r.letter);
  // Also include current letter if playing
  if (dbSession.current_letter && !usedLetters.includes(dbSession.current_letter)) {
    usedLetters.push(dbSession.current_letter);
  }

  // Build players list first (needed for computing letterPickerId)
  const players = dbPlayers.map((p) => ({
    id: p.id,
    visibleId: p.user_id,
    username: p.username,
    isHost: p.is_host,
    isReady: p.is_ready,
    totalScore: p.total_score,
    currentRoundAnswers: (p.current_round_answers || {}) as Record<CategoryType, string>,
    currentRoundScores: {} as Record<CategoryType, number>,
    hasSubmitted: p.has_submitted,
  }));

  // Compute letterPickerId deterministically from session code and current round
  // This ensures all clients compute the same picker without needing a DB column
  let letterPickerId: string | null = null;
  if (dbSession.status === 'picking_letter' && players.length > 0) {
    const picker = getPickerForRound(players, dbSession.code, dbSession.current_round);
    letterPickerId = picker.visibleId;
  }

  return {
    id: dbSession.id,
    code: dbSession.code,
    hostId: dbSession.host_id,
    players,
    settings: {
      totalRounds: dbSession.total_rounds,
      selectedCategories: dbSession.selected_categories as CategoryType[],
      roundDuration: dbSession.round_duration,
    },
    currentRound: dbSession.current_round,
    currentLetter: dbSession.current_letter,
    usedLetters,
    status: dbSession.status,
    roundResults: dbRoundResults.map((r) => ({
      roundNumber: r.round_number,
      letter: r.letter,
      playerScores: r.player_scores,
      answers: r.answers as Record<string, Record<CategoryType, { answer: string; score: number; isValid: boolean }>>,
    })),
    roundStartTime: dbSession.round_start_time,
    roundEndTime: null,
    stopRequested: dbSession.stop_requested,
    stopRequestedBy: dbSession.stop_requested_by,
    stopCountdownStart: dbSession.stop_countdown_start,
    letterPickerId,
  };
};

export const useGameStore = create<GameState>((set, get) => ({
  currentUser: null,
  gameMode: 'single' as GameMode,
  difficulty: 'medium' as DifficultyLevel,
  session: null,
  localAnswers: {} as Record<CategoryType, string>,
  timeRemaining: 60,
  highScores: { easy: 0, medium: 0, hard: 0 } as Record<DifficultyLevel, number>,
  levelProgress: {
    unlockedLevel: 1,
    levelScores: {},
    levelStars: {},
    totalStars: 0,
    totalPoints: 0,
    lives: 3,
    livesLastReset: 0,
  } as LevelProgress,
  currentLevel: null as LevelData | null,
  realtimeChannel: null,
  isLoading: false,
  error: null,

  setCurrentUser: (user) => {
    set({ currentUser: user });
    get().saveUser();
  },

  setSession: (session) => {
    set({ session });
  },

  setError: (error) => {
    set({ error });
  },

  loadUser: async () => {
    try {
      const userData = await AsyncStorage.getItem('npat_user');
      if (userData) {
        set({ currentUser: JSON.parse(userData) });
      }
    } catch (error) {
      console.log('Error loading user:', error);
    }
  },

  saveUser: async () => {
    try {
      const { currentUser } = get();
      if (currentUser) {
        await AsyncStorage.setItem('npat_user', JSON.stringify(currentUser));
      }
    } catch (error) {
      console.log('Error saving user:', error);
    }
  },

  setGameMode: (mode: GameMode) => {
    set({ gameMode: mode });
  },

  setDifficulty: (difficulty: DifficultyLevel) => {
    set({ difficulty });
  },

  loadHighScores: async () => {
    try {
      const highScoresData = await AsyncStorage.getItem('npat_highscores');
      if (highScoresData) {
        set({ highScores: JSON.parse(highScoresData) });
      }
    } catch (error) {
      console.log('Error loading highscores:', error);
    }
  },

  saveHighScore: async (score: number) => {
    try {
      const { highScores, difficulty } = get();
      const currentHighScore = highScores[difficulty] || 0;
      if (score > currentHighScore) {
        const newHighScores = { ...highScores, [difficulty]: score };
        await AsyncStorage.setItem('npat_highscores', JSON.stringify(newHighScores));
        set({ highScores: newHighScores });
      }
    } catch (error) {
      console.log('Error saving highscore:', error);
    }
  },

  // Level progression actions
  loadLevelProgress: async () => {
    try {
      const progressData = await AsyncStorage.getItem('npat_level_progress');
      console.log('[LevelProgress] Raw data from storage:', progressData);
      if (progressData) {
        const parsed = JSON.parse(progressData);
        console.log('[LevelProgress] Parsed data:', JSON.stringify(parsed));
        console.log('[LevelProgress] Unlocked level:', parsed.unlockedLevel);

        // REPAIR: Check if unlockedLevel is out of sync with completed levels
        // Find the highest level that has been completed (has a score)
        const completedLevels = Object.keys(parsed.levelScores || {}).map(Number).filter(n => !isNaN(n));
        if (completedLevels.length > 0) {
          const highestCompletedLevel = Math.max(...completedLevels);
          // If we have completed levels beyond what's unlocked, fix it (cap at 500)
          if (highestCompletedLevel >= parsed.unlockedLevel) {
            const correctUnlockedLevel = Math.min(highestCompletedLevel + 1, 500);
            console.log('[LevelProgress] REPAIR: Fixing unlockedLevel from', parsed.unlockedLevel, 'to', correctUnlockedLevel);
            parsed.unlockedLevel = correctUnlockedLevel;
          }
        }

        // Backwards compat: seed lives fields for existing saves
        if (parsed.lives === undefined || parsed.lives === null) parsed.lives = 3;
        if (!parsed.livesLastReset) parsed.livesLastReset = 0;

        // Auto-reset lives if 24h+ has elapsed since last reset
        const LIVES_RESET_MS = 12 * 60 * 60 * 1000;
        const now = Date.now();
        if (now - parsed.livesLastReset >= LIVES_RESET_MS) {
          parsed.lives = 3;
          parsed.livesLastReset = now;
          console.log('[Lives] Auto-reset: 24h elapsed, lives restored to 3');
        }

        // Save any repairs / lives reset back to storage
        await AsyncStorage.setItem('npat_level_progress', JSON.stringify(parsed));

        set({ levelProgress: parsed });
      } else {
        console.log('[LevelProgress] No saved progress found, using defaults');
      }
    } catch (error) {
      console.log('Error loading level progress:', error);
    }
  },

  saveLevelProgress: async () => {
    try {
      const { levelProgress } = get();
      console.log('[LevelProgress] Saving progress:', JSON.stringify(levelProgress));
      console.log('[LevelProgress] Saving unlocked level:', levelProgress.unlockedLevel);
      await AsyncStorage.setItem('npat_level_progress', JSON.stringify(levelProgress));
      console.log('[LevelProgress] Progress saved successfully');
    } catch (error) {
      console.log('Error saving level progress:', error);
    }
  },

  setCurrentLevel: (level: LevelData | null) => {
    set({ currentLevel: level });
  },

  completeLevelWithScore: async (score: number) => {
    const { currentLevel } = get();
    if (!currentLevel) {
      console.log('[LevelProgress] completeLevelWithScore called but no currentLevel');
      return;
    }

    // IMPORTANT: Always load the latest progress from storage first to avoid race conditions
    // This ensures we don't overwrite progress with stale in-memory state
    let levelProgress = get().levelProgress;
    try {
      const storedData = await AsyncStorage.getItem('npat_level_progress');
      if (storedData) {
        const parsed = JSON.parse(storedData);
        // Use the stored data if it has a higher unlockedLevel (more up-to-date)
        if (parsed.unlockedLevel > levelProgress.unlockedLevel) {
          levelProgress = parsed;
          console.log('[LevelProgress] Using stored progress with unlockedLevel:', parsed.unlockedLevel);
        }
      }
    } catch (e) {
      console.log('[LevelProgress] Error reading stored progress:', e);
    }

    const levelNum = currentLevel.level;
    const passed = didPassLevel(score, currentLevel);
    const stars = calculateStars(score, currentLevel.maxPossibleScore, currentLevel.minScoreToPass);

    console.log('[LevelProgress] completeLevelWithScore called for level', levelNum, 'with score', score);
    console.log('[LevelProgress] Current unlockedLevel:', levelProgress.unlockedLevel);
    console.log('[LevelProgress] Passed:', passed, 'Stars:', stars);

    // Get current best score for this level
    const currentBestScore = levelProgress.levelScores[levelNum] || 0;
    const currentBestStars = levelProgress.levelStars[levelNum] || 0;

    // Update progress
    const newProgress: LevelProgress = { ...levelProgress };

    // Update score and total points if better
    if (score > currentBestScore) {
      const pointsDiff = score - currentBestScore;
      newProgress.levelScores = { ...newProgress.levelScores, [levelNum]: score };
      newProgress.totalPoints = (newProgress.totalPoints || 0) + pointsDiff;

      // Award milestone stars: every 100 total points = 5 bonus stars
      const prevMilestoneStars = newProgress.milestoneStarsAwarded || 0;
      const newMilestoneStars = Math.floor(newProgress.totalPoints / 100) * 5;
      if (newMilestoneStars > prevMilestoneStars) {
        const bonusStars = newMilestoneStars - prevMilestoneStars;
        newProgress.totalStars = newProgress.totalStars + bonusStars;
        newProgress.milestoneStarsAwarded = newMilestoneStars;
        console.log('[LevelProgress] Milestone bonus! +' + bonusStars + ' stars (total points: ' + newProgress.totalPoints + ')');
      }
    }

    // Update stars if better
    if (stars > currentBestStars) {
      const starDiff = stars - currentBestStars;
      newProgress.levelStars = { ...newProgress.levelStars, [levelNum]: stars };
      newProgress.totalStars = newProgress.totalStars + starDiff;
    }

    // Unlock next level if passed and it's the current frontier
    if (passed && levelNum >= levelProgress.unlockedLevel && levelNum < 500) {
      // If completing a level that's at or beyond the current unlocked level, unlock the next
      const newUnlockedLevel = Math.max(levelProgress.unlockedLevel, levelNum + 1);
      if (newUnlockedLevel > levelProgress.unlockedLevel) {
        console.log('[LevelProgress] Unlocking level:', newUnlockedLevel);
        newProgress.unlockedLevel = newUnlockedLevel;
      }
    }

    console.log('[LevelProgress] New progress after update:', JSON.stringify(newProgress));
    set({ levelProgress: newProgress });
    await get().saveLevelProgress();
  },

  devUnlockAllLevels: async () => {
    console.log('[LevelProgress] DEV: Unlocking all 500 levels + adding 50 stars');
    const { levelProgress } = get();
    const newProgress: LevelProgress = {
      ...levelProgress,
      unlockedLevel: 500,
      totalStars: levelProgress.totalStars + 50,
    };
    set({ levelProgress: newProgress });
    await get().saveLevelProgress();
    console.log('[LevelProgress] DEV: Done! Stars:', newProgress.totalStars);
  },

  spendStars: (amount: number) => {
    const { levelProgress } = get();
    if (levelProgress.totalStars < amount) {
      console.log('[Stars] Not enough stars:', levelProgress.totalStars, 'needed:', amount);
      return false;
    }
    const newProgress: LevelProgress = {
      ...levelProgress,
      totalStars: levelProgress.totalStars - amount,
    };
    set({ levelProgress: newProgress });
    get().saveLevelProgress();
    console.log('[Stars] Spent', amount, 'stars. Remaining:', newProgress.totalStars);
    return true;
  },

  loseLife: () => {
    const { levelProgress } = get();
    if (levelProgress.lives <= 0) return;
    const newProgress: LevelProgress = { ...levelProgress, lives: levelProgress.lives - 1 };
    set({ levelProgress: newProgress });
    get().saveLevelProgress();
    console.log('[Lives] Lost a life. Remaining:', newProgress.lives);
  },

  resetLives: () => {
    const { levelProgress } = get();
    const newProgress: LevelProgress = { ...levelProgress, lives: 3, livesLastReset: Date.now() };
    set({ levelProgress: newProgress });
    get().saveLevelProgress();
    console.log('[Lives] Lives reset to 3');
  },

  startLevelGame: async (level: LevelData) => {
    const { currentUser, session: existingSession } = get();
    if (!currentUser) throw new Error('No user logged in');

    // Clean up any existing session first
    if (existingSession) {
      console.log('[LevelGame] Cleaning up existing session:', existingSession.id);
      get().unsubscribeFromSession();
      set({ session: null });
    }

    set({ isLoading: true, error: null, currentLevel: level });

    try {
      // Calculate round duration — timerSeconds from backend is already the total
      const roundDuration = level.timerSeconds;

      // For single-player level mode, create a LOCAL session only (no Supabase)
      // This avoids column size limitations and is faster
      const localSessionId = `local-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

      // Create local session object directly
      const localSession: GameSession = {
        id: localSessionId,
        code: 'LEVEL',
        hostId: currentUser.id,
        status: 'playing',
        currentRound: 1,
        currentLetter: level.letter,
        usedLetters: [level.letter],
        players: [{
          id: currentUser.id,
          visibleId: currentUser.id,
          username: currentUser.username,
          isHost: true,
          isReady: true,
          totalScore: 0,
          currentRoundAnswers: {},
          currentRoundScores: {},
          hasSubmitted: false,
        }],
        settings: {
          totalRounds: 1,
          selectedCategories: level.categories as CategoryType[],
          roundDuration: roundDuration,
        },
        roundResults: [],
        roundStartTime: Date.now(),
        roundEndTime: null,
        stopRequested: false,
        stopRequestedBy: null,
        stopCountdownStart: null,
        letterPickerId: null,
      };

      // Initialize local answers for all categories
      // In multi-letter mode, each category gets its own letter pre-filled
      const initialAnswers: Partial<Record<CategoryType, string>> = {};
      for (let i = 0; i < level.categories.length; i++) {
        const cat = level.categories[i] as CategoryType;
        const letterForCat = level.isMultiLetterMode && level.lettersPerCategory
          ? level.lettersPerCategory[i] || level.letter
          : level.letter;
        initialAnswers[cat] = letterForCat;
      }

      set({
        session: localSession,
        localAnswers: initialAnswers,
        timeRemaining: roundDuration,
        isLoading: false,
      });

      console.log('[LevelGame] Started local session for level', level.level, 'with letter', level.letter);
    } catch (error: any) {
      console.log('Error starting level game:', JSON.stringify(error, null, 2));
      console.log('Error message:', error?.message);
      console.log('Error code:', error?.code);
      set({ error: 'Failed to start level', isLoading: false });
      throw error;
    }
  },

  createGame: async (settings) => {
    const { currentUser } = get();
    if (!currentUser) throw new Error('No user logged in');

    set({ isLoading: true, error: null });

    try {
      const code = generateGameCode();

      // Create game session in database
      // Round duration = 15 seconds per category
      const roundDuration = settings.selectedCategories.length * 15;

      const { data: sessionData, error: sessionError } = await supabase
        .from('game_sessions')
        .insert({
          code,
          host_id: currentUser.id,
          status: 'lobby',
          current_round: 0,
          current_letter: '',
          total_rounds: settings.totalRounds,
          selected_categories: settings.selectedCategories,
          round_duration: roundDuration,
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Add host as first player
      const { error: playerError } = await supabase.from('players').insert({
        session_id: sessionData.id,
        user_id: currentUser.id,
        username: currentUser.username,
        is_host: true,
        is_ready: true,
        total_score: 0,
      });

      if (playerError) throw playerError;

      // Fetch full session data
      await get().refreshSessionById(sessionData.id);

      // Subscribe to realtime updates
      get().subscribeToSession(sessionData.id);

      set({ isLoading: false, localAnswers: {} as Record<CategoryType, string> });
      return code;
    } catch (error) {
      console.log('Error creating game:', error);
      set({ isLoading: false, error: 'Failed to create game' });
      throw error;
    }
  },

  joinGame: async (code) => {
    const { currentUser } = get();
    if (!currentUser) return false;

    set({ isLoading: true, error: null });

    try {
      // Find game session by code
      const { data: sessionData, error: sessionError } = await supabase
        .from('game_sessions')
        .select('*')
        .eq('code', code.toUpperCase())
        .single();

      if (sessionError || !sessionData) {
        set({ isLoading: false, error: 'Game not found' });
        return false;
      }

      if (sessionData.status !== 'lobby') {
        // Not in lobby — allow rejoin if player was already in this game
        const { data: existingPlayer } = await supabase
          .from('players')
          .select('*')
          .eq('session_id', sessionData.id)
          .eq('user_id', currentUser.id)
          .single();

        if (!existingPlayer || sessionData.status === 'final_results') {
          set({ isLoading: false, error: 'Game already in progress' });
          return false;
        }

        // Rejoin: re-attach to the live session
        await get().refreshSessionById(sessionData.id);
        get().subscribeToSession(sessionData.id);
        set({ isLoading: false, localAnswers: {} as Record<CategoryType, string> });
        return true;
      }

      // Check if already in game (lobby join)
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('*')
        .eq('session_id', sessionData.id)
        .eq('user_id', currentUser.id)
        .single();

      if (!existingPlayer) {
        // Check player count
        const { count } = await supabase
          .from('players')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', sessionData.id);

        if (count && count >= 10) {
          set({ isLoading: false, error: 'Game is full' });
          return false;
        }

        // Add player to game
        const { error: playerError } = await supabase.from('players').insert({
          session_id: sessionData.id,
          user_id: currentUser.id,
          username: currentUser.username,
          is_host: false,
          is_ready: true,
          total_score: 0,
        });

        if (playerError) throw playerError;
      }

      // Fetch full session data
      await get().refreshSessionById(sessionData.id);

      // Subscribe to realtime updates
      get().subscribeToSession(sessionData.id);

      set({ isLoading: false, localAnswers: {} as Record<CategoryType, string> });
      return true;
    } catch (error) {
      console.log('Error joining game:', error);
      set({ isLoading: false, error: 'Failed to join game' });
      return false;
    }
  },

  leaveGame: async () => {
    const { session, currentUser } = get();
    if (!session || !currentUser) return;

    // Check if this is a local session (single-player level mode)
    const isLocalSession = session.id.startsWith('local-');

    if (!isLocalSession) {
      try {
        // Find player record
        const player = session.players.find((p) => p.visibleId === currentUser.id);
        if (player) {
          // Remove player from game
          await supabase.from('players').delete().eq('id', player.id);
        }

        if (session.hostId === currentUser.id) {
          const remaining = session.players.filter(p => p.visibleId !== currentUser.id);
          if (remaining.length === 0) {
            // Last player — delete the session entirely
            await supabase.from('game_sessions').delete().eq('id', session.id);
          } else {
            // Pick a random remaining player as the new host
            const newHost = remaining[Math.floor(Math.random() * remaining.length)];
            await Promise.all([
              supabase.from('game_sessions').update({ host_id: newHost.visibleId }).eq('id', session.id),
              supabase.from('players').update({ is_host: true }).eq('id', newHost.id),
            ]);
          }
        }
      } catch (error) {
        console.log('Error leaving game:', error);
      }

      get().unsubscribeFromSession();
    }

    set({ session: null, localAnswers: {} });
  },

  startGame: async () => {
    const { session } = get();
    if (!session || session.players.length < 1) return; // Allow 1 player mode

    // Determine if this is a single player / local session
    const isLocalSession = session.id.startsWith('local-');
    const isSinglePlayer = isLocalSession || session.players.length <= 1;

    try {
      if (isLocalSession) {
        // For local sessions, update state directly without Supabase
        const letter = generateRandomLetter([]);
        console.log('[GameStore] Starting local single player game with letter:', letter);

        set({
          session: {
            ...session,
            status: 'playing',
            currentRound: 1,
            currentLetter: letter,
            roundStartTime: Date.now(),
            stopRequested: false,
            stopRequestedBy: null,
            stopCountdownStart: null,
            players: session.players.map(p => ({
              ...p,
              currentRoundAnswers: {},
              hasSubmitted: false,
            })),
          },
          localAnswers: {} as Record<CategoryType, string>,
          timeRemaining: session.settings.roundDuration,
        });

        console.log('[GameStore] Local game session updated to playing');
        return;
      }

      // Reset all players in Supabase
      const { error: playersError } = await supabase
        .from('players')
        .update({
          current_round_answers: {},
          has_submitted: false,
        })
        .eq('session_id', session.id);

      if (playersError) {
        console.error('[GameStore] Error resetting players:', JSON.stringify(playersError));
      }

      if (isSinglePlayer) {
        // Single player: auto-generate letter, go straight to playing
        const letter = generateRandomLetter([]);
        console.log('[GameStore] Starting single player game with letter:', letter);

        const { error: sessionError } = await supabase
          .from('game_sessions')
          .update({
            status: 'playing',
            current_round: 1,
            current_letter: letter,
            round_start_time: Date.now(),
            stop_requested: false,
            stop_requested_by: null,
            stop_countdown_start: null,
          })
          .eq('id', session.id);

        if (sessionError) {
          console.error('[GameStore] Error updating session:', JSON.stringify(sessionError));
        } else {
          console.log('[GameStore] Game session updated to playing');
        }
      } else {
        // Multiplayer: pick a player to choose the letter using deterministic round-robin
        const randomPlayer = getPickerForRound(session.players, session.code, 1);
        console.log('[GameStore] Starting multiplayer game, letter picker:', randomPlayer.username);

        const { error: sessionError } = await supabase
          .from('game_sessions')
          .update({
            status: 'picking_letter',
            current_round: 1,
            current_letter: '',
            round_start_time: null,
            stop_requested: false,
            stop_requested_by: null,
            stop_countdown_start: null,
          })
          .eq('id', session.id);

        if (sessionError) {
          console.error('[GameStore] Error updating session:', JSON.stringify(sessionError));
        } else {
          // Set letter picker in local state - computed deterministically so all clients get same value
          set({ session: { ...get().session!, letterPickerId: randomPlayer.visibleId } });
          console.log('[GameStore] Game session updated to picking_letter');
        }
      }

      set({
        localAnswers: {} as Record<CategoryType, string>,
        timeRemaining: session.settings.roundDuration,
      });

      // Refresh to get latest state
      await get().refreshSession();
      console.log('[GameStore] Session refreshed after starting game');
    } catch (error) {
      console.log('[GameStore] Error starting game:', error);
    }
  },

  clearLocalAnswers: () => {
    set({ localAnswers: {} as Record<CategoryType, string> });
  },

  updateLocalAnswer: (category, answer) => {
    set((state) => ({
      localAnswers: {
        ...state.localAnswers,
        [category]: answer,
      },
    }));
  },

  submitAnswers: async () => {
    const { session, localAnswers, currentUser } = get();
    if (!session || !currentUser) return;

    // Check if this is a local session (single-player level mode)
    const isLocalSession = session.id.startsWith('local-');

    if (isLocalSession) {
      // For local sessions, update state directly
      const updatedPlayers = session.players.map(p => {
        if (p.visibleId === currentUser.id) {
          return {
            ...p,
            currentRoundAnswers: { ...localAnswers },
            hasSubmitted: true,
          };
        }
        return p;
      });
      set({ session: { ...session, players: updatedPlayers } });
      return;
    }

    try {
      // Find current player's db id
      const player = session.players.find((p) => p.visibleId === currentUser.id);
      if (!player) return;

      await supabase
        .from('players')
        .update({
          current_round_answers: localAnswers,
          has_submitted: true,
        })
        .eq('id', player.id);
    } catch (error) {
      console.log('Error submitting answers:', error);
    }
  },

  requestStop: async () => {
    const { session, currentUser, localAnswers, timeRemaining } = get();
    if (!session || !currentUser) return;

    // Check if all categories are filled
    const allFilled = session.settings.selectedCategories.every(
      (cat) => localAnswers[cat]?.trim()
    );

    if (!allFilled) return;

    // Check if this is a local session (single-player level mode)
    const isLocalSession = session.id.startsWith('local-');

    // Cap the stop countdown to the actual time remaining — if the timer only
    // has 2s left, the "Ending in 5s" banner should show "Ending in 2s", not 5s.
    const MAX_STOP_COUNTDOWN = 5;
    const cappedCountdown = Math.min(MAX_STOP_COUNTDOWN, Math.max(1, timeRemaining));
    const adjustedCountdownStart = Date.now() - (MAX_STOP_COUNTDOWN - cappedCountdown) * 1000;

    if (isLocalSession) {
      // For local sessions, update state directly
      await get().submitAnswers();
      set({
        session: {
          ...session,
          stopRequested: true,
          stopRequestedBy: currentUser.id,
          stopCountdownStart: adjustedCountdownStart,
        },
      });
      return;
    }

    try {
      // First submit answers
      await get().submitAnswers();

      // Then request stop
      await supabase
        .from('game_sessions')
        .update({
          stop_requested: true,
          stop_requested_by: currentUser.id,
          stop_countdown_start: adjustedCountdownStart,
        })
        .eq('id', session.id);
    } catch (error) {
      console.log('Error requesting stop:', error);
    }
  },

  setTimeRemaining: (time) => {
    set({ timeRemaining: time });
  },

  endRound: async () => {
    const { session, gameMode, currentLevel } = get();
    if (!session) return;

    console.log('[GameStore] Ending round...');

    // Check if this is a local session (single-player level mode)
    const isLocalSession = session.id.startsWith('local-');

    // For non-local sessions, refresh to get latest answers from all players
    if (!isLocalSession) {
      await get().refreshSession();
    }

    const updatedSession = get().session;
    if (!updatedSession) return;

    // Validate ALL answers using hybrid validation (local DB + Wikipedia fallback)
    // This runs in parallel for performance
    const validationResults: Map<string, Map<CategoryType, { isValid: boolean; source: 'supabase' | 'local' | 'online' | 'none' }>> = new Map();

    const validationPromises: Promise<void>[] = [];

    // Get constraint from current level (for single player mode)
    const constraint = currentLevel?.constraint as LevelConstraintCheck | null;

    // Helper to get the correct letter for each category (handles multi-letter mode)
    const getLetterForCategoryIndex = (categoryIndex: number): string => {
      if (currentLevel?.isMultiLetterMode && currentLevel?.lettersPerCategory) {
        return currentLevel.lettersPerCategory[categoryIndex] || updatedSession.currentLetter;
      }
      return updatedSession.currentLetter;
    };

    for (const player of updatedSession.players) {
      validationResults.set(player.visibleId, new Map());

      for (let catIndex = 0; catIndex < updatedSession.settings.selectedCategories.length; catIndex++) {
        const cat = updatedSession.settings.selectedCategories[catIndex];
        const answer = player.currentRoundAnswers[cat]?.trim() || '';
        const letterForCategory = getLetterForCategoryIndex(catIndex);

        const startsWithValid = answer.toLowerCase().startsWith(letterForCategory.toLowerCase());

        if (answer && startsWithValid) {
          // First check constraint (if in single player mode with level constraint)
          if (constraint) {
            const constraintResult = validateConstraint(answer, constraint);
            if (!constraintResult.passes) {
              console.log(`[GameStore] "${answer}" failed constraint: ${constraintResult.reason}`);
              validationResults.get(player.visibleId)!.set(cat, { isValid: false, source: 'none' });
              continue; // Skip Wikipedia validation - constraint failed
            }
          }

          // Create promise to validate this answer with the correct letter for this category
          const promise = validateWithFallback(answer, letterForCategory, cat)
            .then((result) => {
              validationResults.get(player.visibleId)!.set(cat, result);
            })
            .catch(() => {
              // On error, mark as invalid (no local fallback - Wikipedia only)
              validationResults.get(player.visibleId)!.set(cat, {
                isValid: false,
                source: 'none'
              });
            });
          validationPromises.push(promise);
        } else {
          // Empty or wrong letter - mark as invalid immediately
          validationResults.get(player.visibleId)!.set(cat, { isValid: false, source: 'none' });
        }
      }
    }

    // Wait for all validations to complete (Wikipedia calls run in parallel)
    await Promise.all(validationPromises);
    console.log('[GameStore] All validations complete');

    // Calculate scores for this round
    // Use normalized answers so singular/plural are treated as same (e.g., "orange" and "oranges" share points)
    const answerCounts: Record<CategoryType, Record<string, string[]>> = {} as Record<
      CategoryType,
      Record<string, string[]>
    >;

    // Map from player+category to their normalized answer (for looking up shared count later)
    const playerNormalizedAnswers: Map<string, Map<CategoryType, string>> = new Map();

    // First, count valid answers per category (using validated results)
    // Normalize answers so singular/plural share points
    updatedSession.settings.selectedCategories.forEach((cat) => {
      answerCounts[cat] = {};
      updatedSession.players.forEach((player) => {
        const rawAnswer = player.currentRoundAnswers[cat]?.toLowerCase().trim();
        const validation = validationResults.get(player.visibleId)?.get(cat);

        // Only count if validation passed (from local DB or Wikipedia)
        if (rawAnswer && validation?.isValid) {
          // Normalize answer for scoring (singular/plural treated as same)
          const normalizedAnswer = normalizeAnswerForScoring(rawAnswer, cat);

          // Store the normalized answer for this player
          if (!playerNormalizedAnswers.has(player.visibleId)) {
            playerNormalizedAnswers.set(player.visibleId, new Map());
          }
          playerNormalizedAnswers.get(player.visibleId)!.set(cat, normalizedAnswer);

          // Count by normalized answer
          if (!answerCounts[cat][normalizedAnswer]) {
            answerCounts[cat][normalizedAnswer] = [];
          }
          answerCounts[cat][normalizedAnswer].push(player.visibleId);
        }
      });
    });

    // Calculate scores for each player
    const roundScores: Record<string, number> = {};
    const roundAnswerDetails: Record<
      string,
      Record<CategoryType, { answer: string; score: number; isValid: boolean }>
    > = {};

    for (const player of updatedSession.players) {
      let playerRoundScore = 0;
      const playerAnswerDetails: Record<
        CategoryType,
        { answer: string; score: number; isValid: boolean; hasBonus?: boolean }
      > = {} as Record<CategoryType, { answer: string; score: number; isValid: boolean; hasBonus?: boolean }>;

      updatedSession.settings.selectedCategories.forEach((cat) => {
        const rawAnswer = player.currentRoundAnswers[cat]?.toLowerCase().trim() || '';
        const validation = validationResults.get(player.visibleId)?.get(cat);
        const isValidCategoryAnswer = validation?.isValid || false;

        let score = 0;
        let hasBonus = false;
        if (isValidCategoryAnswer) {
          // Use normalized answer to count shared players (so "orange" and "oranges" share points)
          const normalizedAnswer = playerNormalizedAnswers.get(player.visibleId)?.get(cat) || rawAnswer;
          const sameAnswerPlayers = answerCounts[cat][normalizedAnswer]?.length || 0;

          // In solo mode (1 player), always give 10 points for valid answers
          const isSoloMode = updatedSession.players.length === 1;
          if (isSoloMode || sameAnswerPlayers === 1) {
            score = 10; // Unique answer or solo mode
          } else if (sameAnswerPlayers > 1) {
            score = Math.floor(10 / sameAnswerPlayers); // Shared answer
          }

          // Bonus +2 points for valid answers with 10 or more letters (excluding spaces)
          const letterCount = rawAnswer.replace(/\s/g, '').length;
          if (letterCount >= 10) {
            score += 2;
            hasBonus = true;
          }
        }

        playerRoundScore += score;
        playerAnswerDetails[cat] = {
          answer: player.currentRoundAnswers[cat] || '',
          score,
          isValid: isValidCategoryAnswer,
          hasBonus,
        };
      });

      roundScores[player.visibleId] = playerRoundScore;
      roundAnswerDetails[player.visibleId] = playerAnswerDetails;

    }

    // Update all player scores in parallel + save round result (skip for local sessions)
    if (!isLocalSession) {
      const playerUpdates = updatedSession.players.map((player) =>
        supabase
          .from('players')
          .update({
            total_score: player.totalScore + (roundScores[player.visibleId] || 0),
            current_round_answers: {},
            has_submitted: false,
          })
          .eq('id', player.id)
      );

      const roundInsert = supabase.from('round_results').insert({
        session_id: updatedSession.id,
        round_number: updatedSession.currentRound,
        letter: updatedSession.currentLetter,
        player_scores: roundScores,
        answers: roundAnswerDetails,
      });

      await Promise.all([...playerUpdates, roundInsert]);
    }

    // Check if game is over
    const isLastRound = updatedSession.currentRound >= updatedSession.settings.totalRounds;
    console.log('[GameStore] Round ended, isLastRound:', isLastRound);

    if (isLocalSession) {
      // For local sessions, update state directly without Supabase
      const newRoundResult: RoundResult = {
        roundNumber: updatedSession.currentRound,
        letter: updatedSession.currentLetter,
        playerScores: roundScores,
        answers: roundAnswerDetails,
      };

      // Update players with new scores
      const updatedPlayers = updatedSession.players.map(p => ({
        ...p,
        totalScore: p.totalScore + (roundScores[p.visibleId] || 0),
        currentRoundAnswers: {},
        currentRoundScores: {},
        hasSubmitted: false,
      }));

      set({
        session: {
          ...updatedSession,
          status: 'round_results',
          players: updatedPlayers,
          roundResults: [...updatedSession.roundResults, newRoundResult],
          stopRequested: false,
          stopRequestedBy: null,
          stopCountdownStart: null,
        },
      });
      console.log('[GameStore] Local session status updated to: round_results');
    } else {
      // Update session status in Supabase
      const { error: statusError } = await supabase
        .from('game_sessions')
        .update({
          status: 'round_results',
          stop_requested: false,
          stop_requested_by: null,
          stop_countdown_start: null,
        })
        .eq('id', updatedSession.id);

      if (statusError) {
        console.error('[GameStore] Error updating session status:', JSON.stringify(statusError));
      } else {
        console.log('[GameStore] Session status updated to: round_results');
      }

      // Refresh to propagate changes
      await get().refreshSession();
    }
  },

  nextRound: async () => {
    const { session } = get();
    if (!session) return;

    // Determine if this is a single player / local session
    const isLocalSession = session.id.startsWith('local-');
    const isSinglePlayer = isLocalSession || session.players.length <= 1;

    try {
      if (isLocalSession) {
        // For local sessions, update state directly without Supabase
        const letter = generateRandomLetter(session.usedLetters);
        console.log('[GameStore] Starting next round (local) with letter:', letter, 'Used letters:', session.usedLetters);

        set({
          session: {
            ...session,
            status: 'playing',
            currentRound: session.currentRound + 1,
            currentLetter: letter,
            roundStartTime: Date.now(),
            stopRequested: false,
            stopRequestedBy: null,
            stopCountdownStart: null,
            players: session.players.map(p => ({
              ...p,
              currentRoundAnswers: {},
              hasSubmitted: false,
            })),
          },
          localAnswers: {} as Record<CategoryType, string>,
          timeRemaining: session.settings.roundDuration,
        });

        console.log('[GameStore] Local session updated for next round (playing)');
        return;
      }

      // Reset players for new round in Supabase
      const { error: playersError } = await supabase
        .from('players')
        .update({
          current_round_answers: {},
          has_submitted: false,
        })
        .eq('session_id', session.id);

      if (playersError) {
        console.error('[GameStore] Error resetting players for next round:', JSON.stringify(playersError));
      }

      if (isSinglePlayer) {
        // Single player: auto-generate letter, go straight to playing
        const letter = generateRandomLetter(session.usedLetters);
        console.log('[GameStore] Starting next round (single player) with letter:', letter, 'Used letters:', session.usedLetters);

        const { error: sessionError } = await supabase
          .from('game_sessions')
          .update({
            status: 'playing',
            current_round: session.currentRound + 1,
            current_letter: letter,
            round_start_time: Date.now(),
            stop_requested: false,
            stop_requested_by: null,
            stop_countdown_start: null,
          })
          .eq('id', session.id);

        if (sessionError) {
          console.error('[GameStore] Error updating session for next round:', JSON.stringify(sessionError));
        } else {
          console.log('[GameStore] Session updated for next round (playing)');
        }
      } else {
        // Multiplayer: pick a player to choose the letter using deterministic round-robin
        const nextRoundNum = session.currentRound + 1;
        const randomPlayer = getPickerForRound(session.players, session.code, nextRoundNum);
        console.log('[GameStore] Starting next round (multiplayer), letter picker:', randomPlayer.username, 'Used letters:', session.usedLetters);

        const { error: sessionError } = await supabase
          .from('game_sessions')
          .update({
            status: 'picking_letter',
            current_round: nextRoundNum,
            current_letter: '',
            round_start_time: null,
            stop_requested: false,
            stop_requested_by: null,
            stop_countdown_start: null,
          })
          .eq('id', session.id);

        if (sessionError) {
          console.error('[GameStore] Error updating session for next round:', JSON.stringify(sessionError));
        } else {
          // Set letter picker in local state - computed deterministically so all clients get same value
          set({ session: { ...get().session!, letterPickerId: randomPlayer.visibleId } });
          console.log('[GameStore] Session updated for next round (picking_letter)');
        }
      }

      set({
        localAnswers: {} as Record<CategoryType, string>,
        timeRemaining: session.settings.roundDuration,
      });

      // Refresh to get latest state
      await get().refreshSession();
      console.log('[GameStore] Session refreshed after starting next round');
    } catch (error) {
      console.log('[GameStore] Error starting next round:', error);
    }
  },

  endGameEarly: async () => {
    const { session, currentUser } = get();
    if (!session || !currentUser) return;

    // Only host can end the game early
    if (session.hostId !== currentUser.id) {
      console.log('[GameStore] Only host can end the game early');
      return;
    }

    console.log('[GameStore] Host ending game early...');

    // Check if this is a local session (single-player level mode)
    const isLocalSession = session.id.startsWith('local-');

    if (isLocalSession) {
      // For local sessions, update state directly
      set({
        session: {
          ...session,
          status: 'final_results',
          stopRequested: false,
          stopRequestedBy: null,
          stopCountdownStart: null,
        },
      });
      console.log('[GameStore] Local game ended early, status set to final_results');
      return;
    }

    try {
      // Update session status to final_results
      const { error: sessionError } = await supabase
        .from('game_sessions')
        .update({
          status: 'final_results',
          stop_requested: false,
          stop_requested_by: null,
          stop_countdown_start: null,
        })
        .eq('id', session.id);

      if (sessionError) {
        console.error('[GameStore] Error ending game early:', JSON.stringify(sessionError));
      } else {
        console.log('[GameStore] Game ended early, status set to final_results');
      }

      // Refresh to propagate changes
      await get().refreshSession();
    } catch (error) {
      console.log('[GameStore] Error ending game early:', error);
    }
  },

  refreshSessionById: async (sessionId: string) => {
    try {
      const [sessionResult, playersResult, roundResultsResult] = await Promise.all([
        supabase.from('game_sessions').select('*').eq('id', sessionId).single(),
        supabase.from('players').select('*').eq('session_id', sessionId).order('created_at'),
        supabase.from('round_results').select('*').eq('session_id', sessionId).order('round_number'),
      ]);

      const sessionData = sessionResult.data;
      if (!sessionData) return;

      const playersData = playersResult.data;
      const roundResultsData = roundResultsResult.data;

      const newSession = dbToAppSession(
        sessionData,
        playersData || [],
        roundResultsData || []
      );

      // Preserve letterPickerId from existing local state when DB returns null.
      // This is a safety fallback for cases where the DB column does not yet exist
      // or the realtime refresh races ahead of the Supabase write.
      const existingSession = get().session;
      if (!newSession.letterPickerId && existingSession?.id === sessionId) {
        newSession.letterPickerId = existingSession.letterPickerId || null;
      }

      // Preserve roundResults from existing local state when DB returns empty.
      // A polling refresh can race ahead of the DB write and return an empty array,
      // wiping out correct scores that were already displayed.
      if (newSession.roundResults.length === 0 && (existingSession?.roundResults?.length ?? 0) > 0 && existingSession?.id === sessionId) {
        newSession.roundResults = existingSession.roundResults;
      }

      set({ session: newSession });
    } catch (error) {
      console.log('Error refreshing session:', error);
    }
  },

  refreshSession: async () => {
    const { session } = get();
    if (!session) return;

    // Skip Supabase refresh for local sessions (single-player level mode)
    if (session.id.startsWith('local-')) {
      console.log('[GameStore] Skipping refresh for local session');
      return;
    }

    await get().refreshSessionById(session.id);
  },

  subscribeToSession: (sessionId: string) => {
    const { realtimeChannel } = get();

    // Unsubscribe from existing channel
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
    }

    console.log('[GameStore] Setting up realtime subscription for session:', sessionId);

    // Create new subscription
    const channel = supabase
      .channel(`game_${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          console.log('[GameStore] Game session changed:', payload.eventType, payload.new);
          get().refreshSession();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          console.log('[GameStore] Players changed:', payload.eventType);
          get().refreshSession();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round_results',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          console.log('[GameStore] Round results changed:', payload.eventType);
          get().refreshSession();
        }
      )
      .subscribe((status, err) => {
        console.log('[GameStore] Subscription status:', status);
        if (err) {
          console.error('[GameStore] Subscription error:', err);
        }
        if (status === 'SUBSCRIBED') {
          console.log('[GameStore] Successfully subscribed to realtime updates');
        }
      });

    set({ realtimeChannel: channel });
  },

  unsubscribeFromSession: () => {
    const { realtimeChannel } = get();
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      set({ realtimeChannel: null });
    }
  },

  confirmLetterPick: async (letter: string) => {
    const { session, currentUser } = get();
    if (!session || !currentUser) return;

    // Only the assigned picker can confirm
    if (session.letterPickerId !== currentUser.id) return;

    const isLocalSession = session.id.startsWith('local-');
    if (isLocalSession) return; // shouldn't happen for single player

    try {
      const { error } = await supabase
        .from('game_sessions')
        .update({
          status: 'playing',
          current_letter: letter,
          round_start_time: Date.now(),
        })
        .eq('id', session.id);

      if (error) {
        console.error('[GameStore] Error confirming letter pick:', JSON.stringify(error));
        return;
      }

      set({
        localAnswers: {} as Record<CategoryType, string>,
        timeRemaining: session.settings.roundDuration,
      });

      await get().refreshSession();
    } catch (error) {
      console.error('[GameStore] Error in confirmLetterPick:', error);
    }
  },
}));
