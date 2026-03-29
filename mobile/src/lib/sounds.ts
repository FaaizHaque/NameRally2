import { Audio } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SOUND_PREF_KEY = 'npat_sound_enabled';

let soundEnabled = true;
let audioModeSet = false;

// One background track at a time
let bgMusic: Audio.Sound | null = null;
let bgMusicLoading = false;
let bgMusicType: BackgroundType | null = null;

type BackgroundType = 'home' | 'game' | 'lobby_mp' | 'game_mp' | 'daily_challenge';

async function ensureAudioMode() {
  if (audioModeSet) return;
  audioModeSet = true;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
  } catch {
    // non-critical
  }
}

export function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
  AsyncStorage.setItem(SOUND_PREF_KEY, enabled ? '1' : '0').catch(() => {});
}

export function isSoundEnabled() {
  return soundEnabled;
}

// Call once early in app startup to restore persisted preference
export async function initSounds() {
  try {
    const val = await AsyncStorage.getItem(SOUND_PREF_KEY);
    if (val !== null) soundEnabled = val === '1';
  } catch {
    // non-critical
  }
}

async function playSound(source: number, volume: number = 0.3) {
  if (!soundEnabled) return;
  try {
    await ensureAudioMode();
    const { sound } = await Audio.Sound.createAsync(
      source,
      { shouldPlay: true, volume }
    );
    sound.setOnPlaybackStatusUpdate((s) => {
      if ('didJustFinish' in s && s.didJustFinish) {
        sound.unloadAsync();
      }
    });
  } catch {
    // Silent fail
  }
}

// ─── Bundled sound assets ──────────────────────────────────────────────────────

const S = {
  TAP:            require('../assets/sounds/tap.wav'),
  NAVIGATE:       require('../assets/sounds/navigate.wav'),
  TYPING:         require('../assets/sounds/typing.wav'),
  PENCIL_TYPING:  require('../assets/sounds/pencil_typing.wav'),
  ANSWER_DONE:    require('../assets/sounds/answer_done.wav'),
  TIMER_TICK:     require('../assets/sounds/timer_tick.wav'),
  ROUND_START:    require('../assets/sounds/round_start.wav'),
  ROUND_END:      require('../assets/sounds/round_end.wav'),
  SUCCESS:        require('../assets/sounds/success.wav'),
  FAIL:           require('../assets/sounds/fail.wav'),
  HINT:           require('../assets/sounds/hint.wav'),
  JOIN:           require('../assets/sounds/join.wav'),
  LETTER_LOCK:    require('../assets/sounds/letter_lock.wav'),
  // Background tracks — each mode has its own vibe
  BG_HOME:            require('../assets/sounds/bg_lobby_silkroad.wav'),  // home screen — Silk Road ambient
  BG_GAME:            require('../assets/sounds/bg_game.mp3'),          // single player lo-fi
  BG_LOBBY_MP:        require('../assets/sounds/bg_lobby_silkroad.wav'), // multiplayer lobby — Silk Road ambient
  BG_GAME_MP:         require('../assets/sounds/bg_game_mp.mp3'),       // multiplayer game — chill but prominent
  BG_DAILY_CHALLENGE: require('../assets/sounds/bg_daily_challenge.mp3'), // daily challenge — fun, slight pressure
};

// Volume per background type — kept consistent so switching screens doesn't jar
const BG_VOLUME: Record<BackgroundType, number> = {
  home:            0.32,
  game:            0.34,
  lobby_mp:        0.32,
  game_mp:         0.34,
  daily_challenge: 0.34,
};

const BG_SOURCE: Record<BackgroundType, number> = {
  home:            S.BG_HOME,
  game:            S.BG_GAME,
  lobby_mp:        S.BG_LOBBY_MP,
  game_mp:         S.BG_GAME_MP,
  daily_challenge: S.BG_DAILY_CHALLENGE,
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const Sounds = {
  // UI & navigation
  tap:          () => playSound(S.TAP, 0.18),
  navigate:     () => playSound(S.NAVIGATE, 0.14),

  // Typing in answer field — throttle at the call site
  typing:        () => playSound(S.TYPING, 0.12),
  pencilTyping:  () => playSound(S.PENCIL_TYPING, 0.22),

  // Game events
  roundStart:      () => playSound(S.ROUND_START, 0.28),
  roundStartLight: () => playSound(S.LETTER_LOCK, 0.22), // softer cue for multiplayer
  answerComplete: () => playSound(S.ANSWER_DONE, 0.22),
  timerWarning:   () => playSound(S.TIMER_TICK, 0.18),
  timerTick:      () => playSound(S.TIMER_TICK, 0.15),
  roundEnd:       () => playSound(S.ROUND_END, 0.22),
  success:        () => playSound(S.SUCCESS, 0.32),
  fail:           () => playSound(S.FAIL, 0.25),
  hint:           () => playSound(S.HINT, 0.28),
  join:           () => playSound(S.JOIN, 0.22),
  letterLock:     () => playSound(S.LETTER_LOCK, 0.25),

  // ─── Background music ────────────────────────────────────────────────────────
  startBackground: async (type: BackgroundType = 'game') => {
    if (!soundEnabled) return;
    // Already playing the right track — do nothing
    if (bgMusic && bgMusicType === type) return;
    // Stop whatever is currently playing first
    if (bgMusic) {
      const old = bgMusic;
      bgMusic = null;
      bgMusicType = null;
      try { await old.stopAsync(); await old.unloadAsync(); } catch { /* non-critical */ }
    }
    if (bgMusicLoading) return;
    bgMusicLoading = true;
    try {
      await ensureAudioMode();
      const { sound } = await Audio.Sound.createAsync(
        BG_SOURCE[type],
        { shouldPlay: true, volume: BG_VOLUME[type], isLooping: true }
      );
      bgMusic = sound;
      bgMusicType = type;
    } catch {
      // Non-critical
    } finally {
      bgMusicLoading = false;
    }
  },

  stopBackground: async () => {
    if (!bgMusic) return;
    const old = bgMusic;
    bgMusic = null;
    bgMusicType = null;
    try {
      await old.stopAsync();
      await old.unloadAsync();
    } catch { /* non-critical */ }
  },

  pauseBackground: async () => {
    if (!bgMusic) return;
    try { await bgMusic.pauseAsync(); } catch { /* non-critical */ }
  },

  resumeBackground: async () => {
    if (!bgMusic || !soundEnabled) return;
    try { await bgMusic.playAsync(); } catch { /* non-critical */ }
  },

  isSoundEnabled: () => soundEnabled,
  setSoundEnabled: (enabled: boolean) => setSoundEnabled(enabled),
};
