import { Audio } from 'expo-av';

let soundEnabled = true;

// Cache sounds to avoid re-creating
const soundCache: Map<string, Audio.Sound> = new Map();

export function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
}

export function isSoundEnabled() {
  return soundEnabled;
}

async function playSound(uri: string, volume: number = 0.3) {
  if (!soundEnabled) return;
  try {
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
    // Silent fail - sounds are non-critical
  }
}

// Game sounds - short, friendly, nothing crazy
export const Sounds = {
  // Button tap - soft click
  tap: () => playSound('https://cdn.freesound.org/previews/242/242501_4284968-lq.mp3', 0.2),

  // Round start - gentle chime
  roundStart: () => playSound('https://cdn.freesound.org/previews/352/352661_5765337-lq.mp3', 0.25),

  // Answer complete - soft pop
  answerComplete: () => playSound('https://cdn.freesound.org/previews/575/575249_7037-lq.mp3', 0.2),

  // Timer warning - subtle tick
  timerWarning: () => playSound('https://cdn.freesound.org/previews/254/254316_4486188-lq.mp3', 0.15),

  // Round end / stop - whoosh
  roundEnd: () => playSound('https://cdn.freesound.org/previews/411/411089_5121236-lq.mp3', 0.25),

  // Success / level complete - bright ding
  success: () => playSound('https://cdn.freesound.org/previews/320/320655_5260872-lq.mp3', 0.3),

  // Navigate - subtle swoosh
  navigate: () => playSound('https://cdn.freesound.org/previews/242/242501_4284968-lq.mp3', 0.15),
};
