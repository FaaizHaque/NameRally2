import { Audio } from 'expo-av';

let soundEnabled = true;
let audioModeSet = false;

// Two separate background tracks: home (calm ambient) and game (upbeat)
let bgMusic: Audio.Sound | null = null;
let bgMusicLoading = false;
let bgMusicType: 'home' | 'game' | null = null;

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
  if (!enabled) {
    Sounds.stopBackground();
  }
}

export function isSoundEnabled() {
  return soundEnabled;
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
  TAP:          require('../assets/sounds/tap.wav'),
  NAVIGATE:     require('../assets/sounds/navigate.wav'),
  TYPING:       require('../assets/sounds/typing.wav'),
  ANSWER_DONE:  require('../assets/sounds/answer_done.wav'),
  TIMER_TICK:   require('../assets/sounds/timer_tick.wav'),
  ROUND_START:  require('../assets/sounds/round_start.wav'),
  ROUND_END:    require('../assets/sounds/round_end.wav'),
  SUCCESS:      require('../assets/sounds/success.wav'),
  FAIL:         require('../assets/sounds/fail.wav'),
  HINT:         require('../assets/sounds/hint.wav'),
  JOIN:         require('../assets/sounds/join.wav'),
  LETTER_LOCK:  require('../assets/sounds/letter_lock.wav'),
  BG_HOME:      require('../assets/sounds/bg_home.wav'),
  BG_GAME:      require('../assets/sounds/bg_game.wav'),
};

// ─── Public API ───────────────────────────────────────────────────────────────

export const Sounds = {
  // UI & navigation
  tap:          () => playSound(S.TAP, 0.18),
  navigate:     () => playSound(S.NAVIGATE, 0.14),

  // Typing in answer field — throttle at the call site
  typing:       () => playSound(S.TYPING, 0.12),

  // Game events
  roundStart:   () => playSound(S.ROUND_START, 0.28),
  answerComplete: () => playSound(S.ANSWER_DONE, 0.22),
  timerWarning: () => playSound(S.TIMER_TICK, 0.18),
  timerTick:    () => playSound(S.TIMER_TICK, 0.15),
  roundEnd:     () => playSound(S.ROUND_END, 0.22),
  success:      () => playSound(S.SUCCESS, 0.32),
  fail:         () => playSound(S.FAIL, 0.25),
  hint:         () => playSound(S.HINT, 0.28),
  join:         () => playSound(S.JOIN, 0.22),
  letterLock:   () => playSound(S.LETTER_LOCK, 0.25),

  // ─── Background music ────────────────────────────────────────────────────────
  startBackground: async (type: 'home' | 'game' = 'game') => {
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
      const source = type === 'home' ? S.BG_HOME : S.BG_GAME;
      const vol = type === 'home' ? 0.35 : 0.40;
      const { sound } = await Audio.Sound.createAsync(
        source,
        { shouldPlay: true, volume: vol, isLooping: true }
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
