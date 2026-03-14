import { Audio } from 'expo-av';

let soundEnabled = true;
let audioModeSet = false;

// One-time audio mode init — called before first sound plays
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
    // Silent fail — sounds are non-critical
  }
}

// ─── Game sounds ─────────────────────────────────────────────────────────────
// All CDN-hosted short clips at comfortable mobile volumes

export const Sounds = {
  // UI tap — soft click for button presses
  tap: () => playSound('https://cdn.freesound.org/previews/242/242501_4284968-lq.mp3', 0.18),

  // Navigate — subtle swoosh for screen changes
  navigate: () => playSound('https://cdn.freesound.org/previews/242/242501_4284968-lq.mp3', 0.13),

  // Round / game start — cheerful chime
  roundStart: () => playSound('https://cdn.freesound.org/previews/352/352661_5765337-lq.mp3', 0.22),

  // Answer complete — satisfying soft pop when a valid word is entered
  answerComplete: () => playSound('https://cdn.freesound.org/previews/575/575249_7037-lq.mp3', 0.18),

  // Timer warning — subtle tick in last 10 seconds
  timerWarning: () => playSound('https://cdn.freesound.org/previews/254/254316_4486188-lq.mp3', 0.14),

  // Round end / STOP pressed — whoosh
  roundEnd: () => playSound('https://cdn.freesound.org/previews/411/411089_5121236-lq.mp3', 0.22),

  // Level/game success — bright ding
  success: () => playSound('https://cdn.freesound.org/previews/320/320655_5260872-lq.mp3', 0.28),

  // Level failed — soft lower tone
  fail: () => playSound('https://cdn.freesound.org/previews/254/254316_4486188-lq.mp3', 0.2),

  // Join game / lobby ready
  join: () => playSound('https://cdn.freesound.org/previews/352/352661_5765337-lq.mp3', 0.18),

  // Letter locked in (letter picker phase)
  letterLock: () => playSound('https://cdn.freesound.org/previews/575/575249_7037-lq.mp3', 0.25),
};
