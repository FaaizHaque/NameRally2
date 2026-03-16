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

async function playSound(uri: string, volume: number = 0.3) {
  if (!soundEnabled) return;
  try {
    await ensureAudioMode();
    const { sound } = await Audio.Sound.createAsync(
      { uri },
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

// ─── Sound URLs ───────────────────────────────────────────────────────────────
// All from freesound.org CDN previews — distinct sounds per action

const S = {
  // Soft UI click — buttons, taps
  TAP:            'https://cdn.freesound.org/previews/528/528561_Jummit-lq.mp3',
  // Paper rustle / page turn — screen navigation
  NAVIGATE:       'https://cdn.freesound.org/previews/353/353125_BenjaminNelan-lq.mp3',
  // Pencil scratch — typing in answer fields
  TYPING:         'https://cdn.freesound.org/previews/448/448968_groupe1bts-lq.mp3',
  // Satisfying stamp/pop — answer row complete
  ANSWER_DONE:    'https://cdn.freesound.org/previews/448/448474_eddies2000-lq.mp3',
  // Single clock tick — timer warning
  TIMER_TICK:     'https://cdn.freesound.org/previews/174/174721_DrMinky-lq.mp3',
  // Upbeat start chime — round / game begins
  ROUND_START:    'https://cdn.freesound.org/previews/810/810178_mokasza-lq.mp3',
  // Buzzer — round ends / STOP pressed
  ROUND_END:      'https://cdn.freesound.org/previews/211/211103_qubodup-lq.mp3',
  // Short victory jingle — level complete
  SUCCESS:        'https://cdn.freesound.org/previews/688/688273_xkeril-lq.mp3',
  // Descending fail tone — level failed
  FAIL:           'https://cdn.freesound.org/previews/335/335906_LittleRainySeasons-lq.mp3',
  // Sparkle / magic — hint used
  HINT:           'https://cdn.freesound.org/previews/825/825544_newlocknew-lq.mp3',
  // Notification chime — joining a game
  JOIN:           'https://cdn.freesound.org/previews/351/351879_marlonnnnnn-lq.mp3',
  // Lock click — letter locked in
  LETTER_LOCK:    'https://cdn.freesound.org/previews/815/815492_xkeril-lq.mp3',
  // Calm ambient lo-fi — home screen background
  BG_HOME:        'https://cdn.freesound.org/previews/610/610747_kjartan_abel-lq.mp3',
  // Upbeat game loop — in-game background
  BG_GAME:        'https://cdn.freesound.org/previews/506/506893_Mrthenoronha-lq.mp3',
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
      const uri = type === 'home' ? S.BG_HOME : S.BG_GAME;
      const vol = type === 'home' ? 0.10 : 0.13;
      const { sound } = await Audio.Sound.createAsync(
        { uri },
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
