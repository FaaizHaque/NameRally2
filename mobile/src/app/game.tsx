import React, { useEffect, useRef, useCallback, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeIn,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
  withSequence,
  withSpring,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { Audio } from 'expo-av';
import {
  Clock, Hand, User, MapPin, Cat, Box, Trophy, Apple,
  ShoppingBag, Check, AlertTriangle, LogOut, X, HeartPulse,
  Gamepad2, Crown, ChevronDown, ChevronUp, Globe, Film, Music,
  Briefcase, Utensils, Info, Landmark, Lightbulb, Star, Pencil, Play,
  Volume2, VolumeX,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useFonts, Caveat_400Regular, Caveat_600SemiBold, Caveat_700Bold } from '@expo-google-fonts/caveat';
import { PatrickHand_400Regular } from '@expo-google-fonts/patrick-hand';
import { ShadowsIntoLight_400Regular } from '@expo-google-fonts/shadows-into-light';
import { PermanentMarker_400Regular } from '@expo-google-fonts/permanent-marker';
import { useGameStore, CategoryType } from '@/lib/state/game-store';
import { getCategoryName, getHintAsync, LevelConstraintCheck } from '@/lib/word-validation';
import { NotebookBackground } from '@/components/NotebookBackground';
import { Sounds } from '@/lib/sounds';
import { useRewardedAd } from '@/lib/useRewardedAd';
import { CAT_COLORS } from '@/lib/category-colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Sparkles } from 'lucide-react-native';

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const P = {
  paper:       '#F2EAD0',   // Warm aged off-white
  paperDark:   '#E8DDB8',   // Darker aged cream
  paperLine:   '#8A7040',   // Sepia rule line (used at low opacity)
  paperDeep:   '#C4A870',
  marginRed:   'rgba(190,80,65,0.28)',
  ink:         '#1C120A',
  inkMed:      '#40301A',
  inkFaint:    '#8A7050',
  sticky:      '#FFE84A',
  stickyDark:  '#C8A800',
  tape:        'rgba(205,190,120,0.6)',
  amber:       '#D09010',
  amberBg:     '#FEF0B0',
  stopRed:     '#C41818',
  stopRedBg:   '#FFE8E8',
  wire:        '#8A7055',
  wireDark:    '#5A4030',
  wireLight:   '#C8B898',
  pencilYellow:'#FFD93D',
  pencilPink:  '#E8786A',
  pencilTip:   '#2A1A0A',
};

// Category colors — all derived from shared CAT_COLORS palette
type CC = { tab: string; border: string; icon: string; vivid: string };
const CATEGORY_COLORS: Record<CategoryType, CC> = Object.fromEntries(
  Object.entries(CAT_COLORS).map(([k, v]) => [k, { tab: v.tab, border: v.border, icon: v.icon, vivid: v.accent }])
) as Record<CategoryType, CC>;

const CATEGORY_ICONS: Record<CategoryType, (color: string) => React.ReactNode> = {
  names:              (c: string) => <User size={20} color={c} strokeWidth={2.5} />,
  places:             (c: string) => <MapPin size={20} color={c} strokeWidth={2.5} />,
  animal:             (c: string) => <Cat size={20} color={c} strokeWidth={2.5} />,
  thing:              (c: string) => <Box size={20} color={c} strokeWidth={2.5} />,
  sports_games:       (c: string) => <Gamepad2 size={20} color={c} strokeWidth={2.5} />,
  brands:             (c: string) => <ShoppingBag size={20} color={c} strokeWidth={2.5} />,
  health_issues:      (c: string) => <HeartPulse size={20} color={c} strokeWidth={2.5} />,
  countries:          (c: string) => <Globe size={20} color={c} strokeWidth={2.5} />,
  professions:        (c: string) => <Briefcase size={20} color={c} strokeWidth={2.5} />,
  food_dishes:        (c: string) => <Utensils size={20} color={c} strokeWidth={2.5} />,
  celebrities:      (c: string) => <Landmark size={20} color={c} strokeWidth={2.5} />,
  fruits_vegetables:  (c: string) => <Apple size={20} color={c} strokeWidth={2.5} />,
};

// ─── Sound helpers ─────────────────────────────────────────────────────────────
async function playTick() {
  try {
    const { sound } = await Audio.Sound.createAsync(
      { uri: 'https://www.soundjay.com/buttons/sounds/button-09.mp3' },
      { shouldPlay: true, volume: 0.4 }
    );
    sound.setOnPlaybackStatusUpdate(s => { if ('didJustFinish' in s && s.didJustFinish) sound.unloadAsync(); });
  } catch { /* silent fail */ }
}

// ─── Category input row (full-width card on notebook paper) ─────────────────
const CategoryRow = React.memo(({
  category, index, answer, letter, fontsLoaded,
  onChangeText, usedHint, canUseHint, isLoadingHint, onHint, isSinglePlayer, inputDisabled, isMultiplayer,
}: {
  category: CategoryType; index: number; answer: string; letter: string; fontsLoaded: boolean;
  onChangeText: (t: string) => void; usedHint?: boolean;
  canUseHint?: boolean; isLoadingHint?: boolean;
  onHint?: () => void; isSinglePlayer?: boolean; inputDisabled?: boolean; isMultiplayer?: boolean;
}) => {
  const c = CATEGORY_COLORS[category] || CATEGORY_COLORS.thing;
  const hasAnswer = answer.trim().length > letter.length;
  const startsOk = answer.trim().toLowerCase().startsWith(letter.toLowerCase());
  const isComplete = hasAnswer && startsOk;
  const handFont    = fontsLoaded ? 'Caveat_700Bold'    : undefined;
  const handFontReg = fontsLoaded ? 'Caveat_400Regular' : undefined;
  const inputFont   = fontsLoaded ? 'PatrickHand_400Regular' : undefined;

  // Typing sound throttle — max once per 80ms to feel like pencil scratching
  const lastTypeSoundAt = useRef<number>(0);

  // Pencil writing animation — follows cursor position
  const [isFocused, setIsFocused] = useState(false);
  const [inputZoneWidth, setInputZoneWidth] = useState(0);

  // Animated cursor X position (0 = left edge of input zone)
  const pencilCursorX = useSharedValue(0);
  const pencilOpacity = useSharedValue(0);
  const pencilScale   = useSharedValue(0.8);
  // Micro-wobble while writing
  const pencilWobbleY = useSharedValue(0);
  const pencilWobbleR = useSharedValue(0);

  // Estimate pixel width of typed text
  const CHAR_WIDTH_FACTOR = 0.62;
  const FONT_SIZE = 27;

  // Move pencil to follow end of typed text
  useEffect(() => {
    const estimatedTextWidth = answer.length * FONT_SIZE * CHAR_WIDTH_FACTOR;
    const maxX = Math.max(0, inputZoneWidth - 20);
    const targetX = Math.min(estimatedTextWidth + 4, maxX);
    pencilCursorX.value = withSpring(targetX, { damping: 18, stiffness: 280 });

    if (isFocused && answer.length > 0) {
      pencilWobbleY.value = withSequence(
        withTiming(-2, { duration: 60, easing: Easing.out(Easing.quad) }),
        withTiming(0,  { duration: 100, easing: Easing.inOut(Easing.quad) }),
      );
      pencilWobbleR.value = withSequence(
        withTiming(3,  { duration: 60, easing: Easing.out(Easing.quad) }),
        withTiming(0,  { duration: 100, easing: Easing.inOut(Easing.quad) }),
      );
    }
  }, [answer, inputZoneWidth, isFocused]);

  useEffect(() => {
    if (isFocused) {
      pencilOpacity.value = withTiming(1, { duration: 160 });
      pencilScale.value   = withSpring(1,  { damping: 10, stiffness: 320 });
      pencilWobbleY.value = withRepeat(
        withSequence(
          withTiming(-1, { duration: 500, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.5, { duration: 400, easing: Easing.inOut(Easing.sin) }),
        ), -1, true
      );
    } else {
      pencilOpacity.value = withTiming(0, { duration: 160 });
      pencilScale.value   = withTiming(0.8, { duration: 120 });
      pencilWobbleY.value = withTiming(0, { duration: 120 });
      pencilWobbleR.value = withTiming(0, { duration: 120 });
    }
  }, [isFocused]);

  const PENCIL_ANGLE = 40;
  const TIP_X_OFFSET = 2;
  const animatedPencilStyle = useAnimatedStyle(() => ({
    opacity: pencilOpacity.value,
    transform: [
      { translateX: pencilCursorX.value + TIP_X_OFFSET },
      { translateY: pencilWobbleY.value },
      { rotate: `${PENCIL_ANGLE + pencilWobbleR.value}deg` },
      { scale: pencilScale.value },
    ],
  }));

  // Bounce when answer becomes valid (visual + haptic only — sound plays on blur)
  const scaleAnim = useSharedValue(1);
  const glowAnim  = useSharedValue(0);
  const prevComplete = useRef(false);
  useEffect(() => {
    if (isComplete && !prevComplete.current) {
      scaleAnim.value = withSequence(
        withSpring(1.025, { damping: 5, stiffness: 300 }),
        withSpring(1, { damping: 10 })
      );
      glowAnim.value = withSequence(withTiming(1, { duration: 200 }), withTiming(0, { duration: 600 }));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    prevComplete.current = isComplete;
  }, [isComplete]);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowAnim.value * 0.5,
    borderColor: c.vivid,
  }));

  return (
    <Animated.View
      entering={FadeInDown.duration(280).delay(60 + index * 50).springify().damping(14)}
      style={[s.catCard, rowStyle, { transform: [{ scale: scaleAnim.value }] }]}
    >
      {/* Glow halo when completed — a colored tint across the input zone only */}
      <Animated.View style={[s.catCardGlow, glowStyle, { backgroundColor: c.vivid + '12' }]} />

      {/* ── LEFT GUTTER (0 → 62px): category label lives here, in the margin ── */}
      <View style={s.catCardGutter} pointerEvents="none">
        {/* Colored icon circle — lighter before writing, darker when answer entered */}
        <View style={[s.catCardIcon, {
          backgroundColor: isComplete ? c.vivid + '22' : hasAnswer ? c.tab : c.tab + '55',
          borderColor: isComplete ? c.vivid : hasAnswer ? c.border : c.border + '40',
        }]}>
          {CATEGORY_ICONS[category](isComplete ? c.vivid : hasAnswer ? c.icon : c.icon + '60')}
        </View>
        {/* Category name — always bold and bright */}
        <Text
          style={[s.catCardGutterLabel, {
            color: isComplete ? c.vivid : c.icon,
            fontFamily: handFont,
            fontWeight: 'bold',
          }]}
          numberOfLines={2}
        >
          {getCategoryName(category)}
        </Text>
      </View>

      {/* ── RIGHT ZONE (after margin at 62px): input on the ruled line ── */}
      <View style={s.catCardContent}>
        {/* Hint button top-right */}
        {isSinglePlayer && !usedHint && (
          <Pressable onPress={onHint} disabled={!canUseHint && !isLoadingHint} style={[s.hintBtn, canUseHint && s.hintBtnActive]} hitSlop={8}>
            {isLoadingHint
              ? <ActivityIndicator size="small" color={P.amber} style={{ width: 16, height: 16 }} />
              : <Lightbulb size={16} color={canUseHint ? '#FFF' : P.inkFaint + '55'} strokeWidth={2.2} fill={canUseHint ? P.amber : 'transparent'} />
            }
          </Pressable>
        )}

        {/* Input zone — sits directly on notebook ruled line */}
        <View style={s.catCardInputWrap} onLayout={e => setInputZoneWidth(e.nativeEvent.layout.width)}>
          {/* Pencil writing animation */}
          <Animated.View style={[s.writingPencilWrap, animatedPencilStyle]} pointerEvents="none">
            <View style={s.wPencilEraser} />
            <View style={s.wPencilFerrule} />
            <View style={s.wPencilBody}>
              <View style={s.wPencilStripe} />
            </View>
            <View style={s.wPencilWood} />
            <View style={s.wPencilTip} />
          </Animated.View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            {/* Starting letter shown in single player mode */}
            {isSinglePlayer && (
              <Text style={{
                fontFamily: inputFont,
                fontSize: 28,
                fontWeight: '900',
                color: usedHint ? P.amber : isComplete ? c.vivid : P.inkMed,
                opacity: 0.75,
                marginRight: -2,
                lineHeight: 34,
              }} pointerEvents="none">
                {letter.toUpperCase()}
              </Text>
            )}
            <TextInput
              style={[s.catCardInput, {
                fontFamily: inputFont,
                color: usedHint ? P.amber : isComplete ? c.icon : P.ink,
              }]}
              placeholder={`${letter}...`}
              placeholderTextColor={P.inkFaint + '40'}
              value={answer}
              onChangeText={t => {
                if (inputDisabled) return;
                const upper = t.toUpperCase();
                if (!upper.startsWith(letter.toUpperCase())) return;
                onChangeText(upper);
                const now = Date.now();
                if (now - lastTypeSoundAt.current > 80) {
                  lastTypeSoundAt.current = now;
                  Sounds.pencilTyping();
                }
              }}
              onFocus={() => setIsFocused(true)}
              onBlur={() => {
                setIsFocused(false);
                // Play the "answer done" chime when leaving a completed field
                if (isComplete) {
                  Sounds.answerComplete();
                }
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!usedHint && !inputDisabled}
              underlineColorAndroid="transparent"
            />
          </View>
          {/* Ruled-line underline — matches notebook line color when idle, colors on state */}
          <View style={[s.catCardLine, {
            backgroundColor: isComplete ? c.vivid
              : hasAnswer && !startsOk ? '#C87020'
              : P.paperLine,
            height: isComplete || (hasAnswer && !startsOk) ? 2 : 1,
            opacity: isComplete ? 0.9 : (hasAnswer && !startsOk) ? 1 : 0.35,
          }]} />
          {hasAnswer && !startsOk && (
            <Text style={[s.errNote, { fontFamily: handFontReg, color: '#C87020' }]}>must start with "{letter}"</Text>
          )}
          {usedHint && (
            <View style={s.hintUsedRow}>
              <Lightbulb size={11} color={P.amber} strokeWidth={2} />
              <Text style={[s.hintUsedTxt, { fontFamily: handFontReg }]}>hint used</Text>
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
});
CategoryRow.displayName = 'CategoryRow';

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function GameScreen() {
  const [fontsLoaded] = useFonts({ Caveat_400Regular, Caveat_600SemiBold, Caveat_700Bold, PatrickHand_400Regular, ShadowsIntoLight_400Regular, PermanentMarker_400Regular });
  const router       = useRouter();
  const insets       = useSafeAreaInsets();
  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopCountdownRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasEndedRound     = useRef(false);
  const prevTimeRef       = useRef<number>(999);
  const prevStopCountdownRef = useRef<number>(999);

  const session           = useGameStore(s => s.session);
  const localAnswers      = useGameStore(s => s.localAnswers);
  const timeRemaining     = useGameStore(s => s.timeRemaining);
  const currentUser       = useGameStore(s => s.currentUser);
  const updateLocalAnswer = useGameStore(s => s.updateLocalAnswer);
  const setTimeRemaining  = useGameStore(s => s.setTimeRemaining);
  const requestStop       = useGameStore(s => s.requestStop);
  const submitAnswers     = useGameStore(s => s.submitAnswers);
  const endRound          = useGameStore(s => s.endRound);
  const leaveGame         = useGameStore(s => s.leaveGame);
  const refreshSession    = useGameStore(s => s.refreshSession);
  const endGameEarly      = useGameStore(s => s.endGameEarly);
  const confirmLetterPick = useGameStore(s => s.confirmLetterPick);
  const gameMode          = useGameStore(s => s.gameMode);
  const currentLevel      = useGameStore(s => s.currentLevel);
  const levelProgress     = useGameStore(s => s.levelProgress);
  const spendStars        = useGameStore(s => s.spendStars);
  const isLoading         = useGameStore(s => s.isLoading);

  const isLevelMode = gameMode === 'single' && currentLevel !== null;
  const HINT_COST = 5;

  const [showExitModal,    setShowExitModal]    = useState(false);
  const [showEndGameModal, setShowEndGameModal] = useState(false);
  const [stopCountdown,    setStopCountdown]    = useState(5);
  const [showLeaderboard,  setShowLeaderboard]  = useState(false);
  const [usedHints,    setUsedHints]    = useState<Set<CategoryType>>(new Set());
  const [loadingHints, setLoadingHints] = useState<Set<CategoryType>>(new Set());
  const [pendingHint,  setPendingHint]  = useState<{ category: CategoryType; index: number } | null>(null);
  const [keyboardVisible,  setKeyboardVisible]  = useState(false);
  // Immediately disables inputs when timer hits 0, before handleRoundEnd is called
  const [roundInputDisabled, setRoundInputDisabled] = useState(false);
  const roundEndScheduled = useRef(false);
  const adPauseOffset = useRef(0);
  const adPauseStart  = useRef<number | null>(null);
  const { showAd } = useRewardedAd();

  // Novelty popup state — persisted to AsyncStorage so each feature is announced exactly once
  const [noveltyPopup, setNoveltyPopup] = useState<{ type: string; title: string; message: string; icon: React.ReactNode } | null>(null);
  const shownNovelties = useRef<Set<string>>(new Set());
  const noveltiesLoaded = useRef(false);
  // Queued novelty — fires after the letter reveal overlay disappears
  const pendingNovelty = useRef<{ type: string; title: string; message: string; icon: React.ReactNode } | null>(null);

  // Load persisted seen-novelties from AsyncStorage once
  useEffect(() => {
    AsyncStorage.getItem('npat_seen_novelties').then((raw) => {
      if (raw) {
        try {
          const arr: string[] = JSON.parse(raw);
          arr.forEach((k) => shownNovelties.current.add(k));
        } catch { /* ignore corrupt data */ }
      }
      noveltiesLoaded.current = true;
    });
  }, []);

  const markNoveltyShown = (key: string) => {
    shownNovelties.current.add(key);
    AsyncStorage.getItem('npat_seen_novelties').then((raw) => {
      const existing: string[] = raw ? JSON.parse(raw) : [];
      if (!existing.includes(key)) {
        AsyncStorage.setItem('npat_seen_novelties', JSON.stringify([...existing, key]));
      }
    }).catch(() => {});
  };

  // Track keyboard to control STOP button visibility
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  // Queue novelty popup when level starts — fires after letter reveal animation
  // Only in single player mode — multiplayer has no level progression
  useEffect(() => {
    if (!currentLevel || gameMode !== 'single') return;
    // Reset any pending novelty from the previous level
    pendingNovelty.current = null;

    if (!noveltiesLoaded.current) {
      // Retry after a short delay to allow AsyncStorage to load
      const t = setTimeout(() => {
        if (noveltiesLoaded.current) checkNovelty();
      }, 300);
      return () => clearTimeout(t);
    }
    checkNovelty();

    function checkNovelty() {
      if (!currentLevel) return;

      // Check each category in this level — queue a popup the very first time
      // any category is encountered, regardless of level number.
      for (const cat of currentLevel.categories) {
        const catKey = `novelty_cat_${cat}`;
        if (!shownNovelties.current.has(catKey)) {
          const catName = getCategoryName(cat as CategoryType);
          markNoveltyShown(catKey);
          pendingNovelty.current = {
            type: 'category',
            title: 'New Category Unlocked!',
            message: `${catName} joins the rally for the first time!`,
            icon: <Sparkles size={36} color="#FCD34D" strokeWidth={2} />,
          };
          return;
        }
      }

      // Check for new constraint type (key: constraint type, fires once ever)
      if (currentLevel.constraint?.type && currentLevel.constraint.type !== 'none') {
        const cType = currentLevel.constraint.type;
        const constraintKey = `novelty_constraint_${cType}`;
        if (!shownNovelties.current.has(constraintKey)) {
          const CONSTRAINT_INFO: Record<string, { title: string; message: string }> = {
            min_word_length:   { title: 'New Rule: Long Words',       message: 'Answers must be 4+ letters long' },
            max_word_length:   { title: 'New Rule: Short Words',      message: 'Answers must be short — keep it brief!' },
            ends_with_letter:  { title: 'New Rule: Ending Letter',    message: 'Each answer must end with a specific letter' },
            double_letters:    { title: 'New Rule: Double Letters',   message: 'Answers must contain double letters (ee, ll, ss…)' },
            contains_vowel:    { title: 'New Rule: Contains Vowel',   message: 'Answers must contain a specific vowel letter' },
            odd_length:        { title: 'New Rule: Odd Letters',      message: 'Answers must have an odd number of letters (3, 5, 7…)' },
            no_repeat_letters: { title: 'New Rule: No Repeats',       message: 'No letter can appear more than once in your answer' },
            no_common_words:   { title: 'New Rule: No Common Words',  message: 'Avoid obvious, common answers — get creative!' },
            combo:             { title: 'New Rule: Multi-Constraint', message: 'Multiple rules apply at the same time' },
            survival:          { title: 'New Rule: Survival Mode',    message: 'One invalid answer ends the level instantly' },
            time_pressure:     { title: 'New Rule: Time Pressure',    message: 'The clock is tighter — think fast!' },
          };
          const info = CONSTRAINT_INFO[cType] ?? { title: 'New Rule!', message: currentLevel.constraint.description };
          markNoveltyShown(constraintKey);
          pendingNovelty.current = {
            type: 'constraint',
            title: info.title,
            message: info.message,
            icon: <AlertTriangle size={36} color="#a78bfa" strokeWidth={2} />,
          };
        }
      }
    }
  }, [currentLevel?.level, currentLevel?.constraint?.type]);

  // Fire queued novelty popup right after the letter reveal overlay fades out
  useEffect(() => {
    if (showReveal || gameMode !== 'single') return;
    if (!pendingNovelty.current) return;
    const popup = pendingNovelty.current;
    pendingNovelty.current = null;
    const t = setTimeout(() => setNoveltyPopup(popup), 350);
    return () => clearTimeout(t);
  }, [showReveal]);

  // Sound toggle
  const [soundOn, setSoundOn] = useState(Sounds.isSoundEnabled());
  const toggleSound = () => {
    const next = !soundOn;
    Sounds.setSoundEnabled(next);
    setSoundOn(next);
    if (next) {
      Sounds.tap();
      Sounds.resumeBackground();
    } else {
      Sounds.pauseBackground();
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Letter reveal overlay
  const [showReveal,    setShowReveal]    = useState(true);
  const [shuffleLetter, setShuffleLetter] = useState('A');
  const [revealDone,    setRevealDone]    = useState(false);

  // Letter picker (multiplayer)
  const [pickerCycling,   setPickerCycling]   = useState(true);
  const [pickerLetter,    setPickerLetter]    = useState('A');
  const [pickerCountdown, setPickerCountdown] = useState(15);
  const [pickerLocked,    setPickerLocked]    = useState(false);
  const pickerCycleRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const pickerTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const letterPickerId  = session?.letterPickerId || null;
  const isPicker        = currentUser?.id === letterPickerId;

  // Animations
  const timerPulse  = useSharedValue(0);
  const timerWiggle = useSharedValue(0);
  const stampBounce = useSharedValue(1);
  const stickyFloat = useSharedValue(0);
  const timerBarWidth = useSharedValue(1);   // 0–1 fraction of full width
  const timerBarPulse = useSharedValue(1);   // scale pulse when urgent

  const isHost = session?.hostId === currentUser?.id;
  const handFont    = fontsLoaded ? 'Caveat_700Bold'    : undefined;
  const handFontSem = fontsLoaded ? 'Caveat_600SemiBold' : undefined;
  const handFontReg = fontsLoaded ? 'Caveat_400Regular' : undefined;
  const titleFont   = fontsLoaded ? 'ShadowsIntoLight_400Regular' : undefined;

  // Sticky note gentle float
  useEffect(() => {
    stickyFloat.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        withTiming(3, { duration: 1800, easing: Easing.inOut(Easing.sin) })
      ), -1, true
    );
  }, []);

  const stickyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: stickyFloat.value }, { rotate: '2deg' }],
  }));

  // Pulsing animation for the waiting screen
  const waitingPulse = useSharedValue(1);
  useEffect(() => {
    if (session?.status === 'picking_letter' && !isPicker) {
      waitingPulse.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 800, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.95, { duration: 800, easing: Easing.inOut(Easing.sin) }),
        ), -1, true
      );
    }
  }, [session?.status, isPicker]);

  const waitingPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: waitingPulse.value }],
  }));

  // Letter picker cycling effect (multiplayer)
  const PICKER_ALPHABET = 'ABCDEFGHIJKLMNOPRSTUVW';
  const usedLetters = session?.usedLetters || [];
  const availableLetters = PICKER_ALPHABET.split('').filter(l => !usedLetters.includes(l));

  useEffect(() => {
    if (session?.status !== 'picking_letter' || !isPicker || !pickerCycling || pickerLocked) return;
    if (availableLetters.length === 0) return;

    pickerCycleRef.current = setInterval(() => {
      const randomIdx = Math.floor(Math.random() * availableLetters.length);
      setPickerLetter(availableLetters[randomIdx]);
    }, 80);

    return () => {
      if (pickerCycleRef.current) clearInterval(pickerCycleRef.current);
    };
  }, [session?.status, isPicker, pickerCycling, pickerLocked, availableLetters.join('')]);

  // Picker 15-second countdown timer
  useEffect(() => {
    if (session?.status !== 'picking_letter' || !isPicker || pickerLocked) {
      if (pickerTimerRef.current) clearInterval(pickerTimerRef.current);
      return;
    }

    setPickerCountdown(15);
    pickerTimerRef.current = setInterval(() => {
      setPickerCountdown(prev => {
        if (prev <= 1) {
          // Auto-pick a random available letter
          if (pickerTimerRef.current) clearInterval(pickerTimerRef.current);
          if (pickerCycleRef.current) clearInterval(pickerCycleRef.current);
          const randomLetter = availableLetters[Math.floor(Math.random() * availableLetters.length)] || 'A';
          setPickerCycling(false);
          setPickerLetter(randomLetter);
          setPickerLocked(true);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setTimeout(() => {
            confirmLetterPick(randomLetter);
          }, 500);
          return 0;
        }
        if (prev <= 5) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (pickerTimerRef.current) clearInterval(pickerTimerRef.current);
    };
  }, [session?.status, isPicker, pickerLocked, availableLetters.join('')]);

  // Reset picker state when entering picking_letter status
  useEffect(() => {
    if (session?.status === 'picking_letter') {
      setPickerCycling(true);
      setPickerLocked(false);
      setPickerCountdown(15);
      setShowReveal(true);
      setRevealDone(false);
    }
  }, [session?.status, session?.currentRound]);

  // Handle STOP button press for picker
  const handlePickerStop = useCallback(() => {
    if (!pickerCycling || pickerLocked) return;
    if (pickerCycleRef.current) clearInterval(pickerCycleRef.current);
    if (pickerTimerRef.current) clearInterval(pickerTimerRef.current);
    setPickerCycling(false);
    setPickerLocked(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Sounds.letterLock();
    const chosenLetter = pickerLetter;
    setTimeout(() => {
      confirmLetterPick(chosenLetter);
    }, 500);
  }, [pickerCycling, pickerLocked, pickerLetter, confirmLetterPick]);

  // Letter reveal shuffle effect
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const revealOpacity = useSharedValue(1);
  const shuffleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!session?.currentLetter) return;
    // For multiplayer, only run when status just became 'playing' (letter was picked)
    if (gameMode === 'multiplayer' && session.status !== 'playing') return;
    // Reset reveal for the shuffle animation
    setShowReveal(true);
    setRevealDone(false);
    revealOpacity.value = 1;
    const targetLetter = session.currentLetter;

    // Clear any running shuffle
    if (shuffleTimeoutRef.current) clearTimeout(shuffleTimeoutRef.current);

    // Slot-machine deceleration: start fast, slow down, then snap to target
    // Never show target letter until final step — no premature flashes
    const totalSteps = 20;
    let step = 0;
    const initialDelay = 45; // ms — starting speed

    const runStep = (delay: number) => {
      step++;
      if (step >= totalSteps) {
        // Final step: lock to target
        setShuffleLetter(targetLetter);
        setRevealDone(true);
        if (gameMode === 'single') {
          shuffleTimeoutRef.current = setTimeout(() => {
            revealOpacity.value = withTiming(0, { duration: 350 });
            setTimeout(() => setShowReveal(false), 350);
          }, 800);
        }
        return;
      }
      // Show a random letter that is NOT the target (avoids premature flashes)
      let randomIdx = Math.floor(Math.random() * 26);
      let randomLetter = ALPHABET[randomIdx];
      if (randomLetter === targetLetter) {
        randomLetter = ALPHABET[(randomIdx + 1) % 26];
      }
      setShuffleLetter(randomLetter);
      // Exponential slowdown: each step 10% slower than the previous
      const nextDelay = Math.min(delay * 1.10, 200);
      shuffleTimeoutRef.current = setTimeout(() => runStep(nextDelay), delay);
    };

    shuffleTimeoutRef.current = setTimeout(() => runStep(initialDelay), 0);
    return () => {
      if (shuffleTimeoutRef.current) clearTimeout(shuffleTimeoutRef.current);
    };
  }, [session?.currentLetter, session?.status]);

  const revealOverlayStyle = useAnimatedStyle(() => ({ opacity: revealOpacity.value }));

  const getLetterForCategory = (i: number) => {
    if (currentLevel?.isMultiLetterMode && currentLevel?.lettersPerCategory)
      return currentLevel.lettersPerCategory[i] || session?.currentLetter || '';
    return session?.currentLetter || '';
  };

  const allAnswersFilled = session?.settings.selectedCategories.every((cat, i) => {
    const a = localAnswers[cat]?.trim();
    if (!a || a.length <= 1) return false;
    return a.toLowerCase().startsWith(getLetterForCategory(i).toLowerCase());
  });

  // Bounce stamp when all filled
  const prevFilledRef = useRef(false);
  useEffect(() => {
    if (allAnswersFilled && !prevFilledRef.current) {
      stampBounce.value = withSequence(
        withSpring(1.12, { damping: 4, stiffness: 400 }),
        withSpring(0.95, { damping: 8 }),
        withSpring(1.05, { damping: 10 }),
        withSpring(1, { damping: 12 })
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    prevFilledRef.current = !!allAnswersFilled;
  }, [allAnswersFilled]);

  // Play round start sound + background music when status changes to playing
  const prevStatusRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (session?.status === 'playing' && prevStatusRef.current !== 'playing') {
      if (gameMode === 'multiplayer') {
        Sounds.roundStartLight();
      } else {
        Sounds.roundStart();
      }
      Sounds.startBackground(gameMode === 'multiplayer' ? 'game_mp' : 'game');
    }
    prevStatusRef.current = session?.status;
  }, [session?.status]);

  // Stop background music when leaving the game screen
  useEffect(() => {
    return () => {
      Sounds.stopBackground();
    };
  }, []);

  const stampStyle = useAnimatedStyle(() => ({ transform: [{ scale: stampBounce.value }, { rotate: '-1deg' }] }));

  const handleUseHint = (category: CategoryType, i: number) => {
    if (!session || usedHints.has(category) || loadingHints.has(category)) return;
    const existing = localAnswers[category]?.trim();
    if (existing && existing.length > session.currentLetter.length) return;
    setPendingHint({ category, index: i });
  };

  const executeHint = async (category: CategoryType, i: number) => {
    setLoadingHints(p => new Set(p).add(category));
    try {
      const letter = getLetterForCategory(i);
      const hint = await getHintAsync(category, letter, currentLevel?.constraint as LevelConstraintCheck | null);
      if (hint && hint.toUpperCase().startsWith(letter.toUpperCase())) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Sounds.hint();
        updateLocalAnswer(category, hint.toUpperCase());
        setUsedHints(p => new Set(p).add(category));
      } else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); }
    finally { setLoadingHints(p => { const n = new Set(p); n.delete(category); return n; }); }
  };

  const handleHintViaAd = () => {
    if (!pendingHint) return;
    const { category, index } = pendingHint;
    setPendingHint(null);
    adPauseStart.current = Date.now();
    showAd(
      () => { executeHint(category, index); },
      () => {
        if (adPauseStart.current !== null) {
          adPauseOffset.current += Date.now() - adPauseStart.current;
          adPauseStart.current = null;
        }
      },
    );
  };

  const handleHintViaStars = () => {
    if (!pendingHint) return;
    const { category, index } = pendingHint;
    setPendingHint(null);
    if (levelProgress.totalStars < HINT_COST) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (!spendStars(HINT_COST)) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); return; }
    executeHint(category, index);
  };

  useEffect(() => {
    if (!session || session.status !== 'playing') return;
    const iv = setInterval(() => { if (Object.values(localAnswers).some(a => a?.trim())) submitAnswers(); }, 3000);
    return () => clearInterval(iv);
  }, [session?.status, session?.currentRound, localAnswers, submitAnswers]);

  useEffect(() => {
    if (session) pollingRef.current = setInterval(() => refreshSession(), 1500);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [session?.id]);

  useEffect(() => {
    if (!session || (session?.status !== 'round_results' && session?.status !== 'final_results')) return;
    [timerRef, stopCountdownRef, pollingRef].forEach(r => { if (r.current) clearInterval(r.current); });
    // Hide the reveal overlay immediately to prevent flash during navigation
    setShowReveal(false);
    // Use setTimeout to ensure navigation happens after state settles
    const navTimer = setTimeout(() => {
      router.replace(isLevelMode ? '/final-results' : '/round-results');
    }, 100);
    return () => clearTimeout(navTimer);
  }, [session?.status]);

  const handleRoundEnd = useCallback(async () => {
    if (hasEndedRound.current) return;
    hasEndedRound.current = true;
    try {
      await submitAnswers();
      if (isHost) {
        if (!isLevelMode) await new Promise(r => setTimeout(r, 1500));
        await endRound();
      }
    } catch (error) {
      console.error('Error in handleRoundEnd:', error);
      hasEndedRound.current = false;
    }
  }, [endRound, submitAnswers, isHost, isLevelMode]);

  useEffect(() => {
    hasEndedRound.current = false;
    roundEndScheduled.current = false;
    adPauseOffset.current = 0;
    adPauseStart.current = null;
    setRoundInputDisabled(false);
  }, [session?.currentRound]);

  useEffect(() => {
    if (!session || session.status !== 'playing') return;
    // Skip prefill on letterOptions levels — player picks which option to use
    if (currentLevel?.letterOptions) return;
    const needsPrefill = session.settings.selectedCategories.every(cat => !localAnswers[cat] || !localAnswers[cat].startsWith(session.currentLetter));
    if (needsPrefill) session.settings.selectedCategories.forEach(cat => updateLocalAnswer(cat, session.currentLetter));
  }, [session?.currentRound, session?.currentLetter, session?.status]);

  useEffect(() => {
    if (!session || session.status !== 'playing' || !session.roundStartTime) return;
    const tick = () => {
      const pausedSoFar = adPauseOffset.current + (adPauseStart.current ? Date.now() - adPauseStart.current : 0);
      const remaining = Math.max(0, session.settings.roundDuration - Math.floor((Date.now() - session.roundStartTime! - pausedSoFar) / 1000));
      setTimeRemaining(remaining);
      // Haptics + timer warning sound in last 10 seconds
      if (remaining <= 10 && remaining < prevTimeRef.current && remaining > 0) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid);
        Sounds.timerWarning();
      }
      prevTimeRef.current = remaining;
      if (remaining === 0 && !hasEndedRound.current && !roundEndScheduled.current) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        // Immediately disable inputs so last keystrokes don't get lost
        roundEndScheduled.current = true;
        setRoundInputDisabled(true);
        // Small delay lets any pending onChangeText events flush before submit
        setTimeout(() => {
          roundEndScheduled.current = false;
          handleRoundEnd();
        }, 150);
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [session?.status, session?.roundStartTime, session?.currentRound, handleRoundEnd]);

  useEffect(() => {
    if (!session?.stopRequested || !session?.stopCountdownStart) return;
    const start = session.stopCountdownStart;
    prevStopCountdownRef.current = 999;
    stopCountdownRef.current = setInterval(() => {
      const remaining = Math.max(0, 5 - Math.floor((Date.now() - start) / 1000));
      setStopCountdown(remaining);
      // Play tick sound each second during countdown
      if (remaining < prevStopCountdownRef.current && remaining > 0) {
        Sounds.timerTick();
      }
      prevStopCountdownRef.current = remaining;
      if (remaining === 0 && !hasEndedRound.current) { if (stopCountdownRef.current) clearInterval(stopCountdownRef.current); handleRoundEnd(); }
    }, 100);
    return () => { if (stopCountdownRef.current) clearInterval(stopCountdownRef.current); };
  }, [session?.stopRequested, session?.stopCountdownStart, handleRoundEnd]);

  // Update timer bar width
  useEffect(() => {
    if (!session?.settings.roundDuration) return;
    const fraction = Math.max(0, Math.min(1, timeRemaining / session.settings.roundDuration));
    timerBarWidth.value = withTiming(fraction, { duration: 900 });
    if (timeRemaining <= 10 && timeRemaining > 0) {
      timerBarPulse.value = withRepeat(
        withSequence(withTiming(1.03, { duration: 300 }), withTiming(1, { duration: 300 })),
        -1, true
      );
    } else {
      timerBarPulse.value = withTiming(1, { duration: 200 });
    }
  }, [timeRemaining]);

  const timerBarStyle = useAnimatedStyle(() => ({
    width: `${timerBarWidth.value * 100}%` as any,
    transform: [{ scaleY: timerBarPulse.value }],
  }));

  // Timer pulse + wiggle when <= 10
  useEffect(() => {
    if (timeRemaining <= 10) {
      timerPulse.value = withRepeat(withSequence(withTiming(1, { duration: 280 }), withTiming(0, { duration: 280 })), -1, false);
      timerWiggle.value = withRepeat(
        withSequence(
          withTiming(-4, { duration: 80 }),
          withTiming(4, { duration: 80 }),
          withTiming(-3, { duration: 80 }),
          withTiming(0, { duration: 80 })
        ), -1, false
      );
    }
  }, [timeRemaining <= 10]);

  const timerBgStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(timerPulse.value, [0, 1], [P.paperDark, '#FFD0D0']),
    transform: [{ translateX: timerWiggle.value }],
  }));

  const handleStop = async () => {
    if (!allAnswersFilled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Sounds.roundEnd();
    if (isLevelMode) {
      await handleRoundEnd();
      return;
    }
    await requestStop();
  };

  const handleExit = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowExitModal(false);
    await leaveGame();
    router.replace('/');
  };

  const handleEndGame = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setShowEndGameModal(false);
    await endGameEarly();
  };

  if (!session || isLoading) {
    // Show loading screen instead of white screen
    return (
      <View style={{ flex: 1, backgroundColor: '#142d58', alignItems: 'center', justifyContent: 'center' }}>
        <LinearGradient colors={['#1a3a6e', '#1e4a8a', '#163468']} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <ActivityIndicator size="large" color="#90c0ff" />
        <Text style={{ color: '#90c0ff', marginTop: 16, fontSize: 16, fontWeight: '600' }}>Loading game...</Text>
      </View>
    );
  }
  const fmt = (sec: number) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;

  // ── SINGLE PLAYER (level mode) — modern dark UI ──
  if (isLevelMode && currentLevel) {
    const modernCategoryColors: Record<string, { bg: string; border: string; accent: string }> = {
      names:              { bg: CAT_COLORS.names.darkBg,             border: CAT_COLORS.names.darkBorder,             accent: CAT_COLORS.names.darkAccent },
      places:             { bg: CAT_COLORS.places.darkBg,             border: CAT_COLORS.places.darkBorder,             accent: CAT_COLORS.places.darkAccent },
      animal:             { bg: CAT_COLORS.animal.darkBg,             border: CAT_COLORS.animal.darkBorder,             accent: CAT_COLORS.animal.darkAccent },
      thing:              { bg: CAT_COLORS.thing.darkBg,              border: CAT_COLORS.thing.darkBorder,              accent: CAT_COLORS.thing.darkAccent },
      sports_games:       { bg: CAT_COLORS.sports_games.darkBg,       border: CAT_COLORS.sports_games.darkBorder,       accent: CAT_COLORS.sports_games.darkAccent },
      brands:             { bg: CAT_COLORS.brands.darkBg,             border: CAT_COLORS.brands.darkBorder,             accent: CAT_COLORS.brands.darkAccent },
      health_issues:      { bg: CAT_COLORS.health_issues.darkBg,      border: CAT_COLORS.health_issues.darkBorder,      accent: CAT_COLORS.health_issues.darkAccent },
      countries:          { bg: CAT_COLORS.countries.darkBg,          border: CAT_COLORS.countries.darkBorder,          accent: CAT_COLORS.countries.darkAccent },
      professions:        { bg: CAT_COLORS.professions.darkBg,        border: CAT_COLORS.professions.darkBorder,        accent: CAT_COLORS.professions.darkAccent },
      food_dishes:        { bg: CAT_COLORS.food_dishes.darkBg,        border: CAT_COLORS.food_dishes.darkBorder,        accent: CAT_COLORS.food_dishes.darkAccent },
      celebrities: { bg: CAT_COLORS.celebrities.darkBg, border: CAT_COLORS.celebrities.darkBorder, accent: CAT_COLORS.celebrities.darkAccent },
      fruits_vegetables:  { bg: CAT_COLORS.fruits_vegetables.darkBg,  border: CAT_COLORS.fruits_vegetables.darkBorder,  accent: CAT_COLORS.fruits_vegetables.darkAccent },
    };
    const urgentTimer = timeRemaining <= 10;
    return (
      <View style={{ flex: 1, backgroundColor: '#142d58' }}>
        <LinearGradient colors={['#1a3a6e', '#1e4a8a', '#163468']} style={{ flex: 1 }}>
          {/* Header */}
          <View style={{ paddingTop: insets.top + 4, borderBottomWidth: 1, borderBottomColor: 'rgba(99,102,241,0.2)', backgroundColor: 'rgba(13,13,26,0.95)' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 12, paddingTop: 2 }}>
              {/* Exit */}
              <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowExitModal(true); }}
                style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: '#1a3a6e', borderWidth: 1.5, borderColor: 'rgba(80,160,255,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                <X size={16} color="#a5b4fc" strokeWidth={2.5} />
              </Pressable>

              {/* Level badge */}
              <View style={{ backgroundColor: '#1a3a6e', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(80,160,255,0.6)' }}>
                <Text style={{ color: '#90c0ff', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 }}>
                  Level {currentLevel.level}
                </Text>
              </View>

              {/* Timer + Sound toggle */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Animated.View style={[
                  { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5 },
                  urgentTimer
                    ? { backgroundColor: '#2d1a1a', borderColor: '#ef4444' }
                    : { backgroundColor: '#1a3a6e', borderColor: 'rgba(80,160,255,0.6)' },
                ]}>
                  <Clock size={13} color={urgentTimer ? '#ef4444' : '#a5b4fc'} strokeWidth={2.5} />
                  <Text style={{ color: urgentTimer ? '#ef4444' : '#a5b4fc', fontSize: 17, fontWeight: '700' }}>{fmt(timeRemaining)}</Text>
                </Animated.View>
                <Pressable onPress={toggleSound}
                  style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: '#1a3a6e', borderWidth: 1.5, borderColor: 'rgba(80,160,255,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                  {soundOn
                    ? <Volume2 size={16} color="#a5b4fc" strokeWidth={2.5} />
                    : <VolumeX size={16} color="#6b7280" strokeWidth={2.5} />}
                </Pressable>
              </View>
            </View>

            {/* Letter display */}
            <View style={{ alignItems: 'center', paddingBottom: 14 }}>
              <Text style={{ color: 'rgba(144,192,255,0.6)', fontSize: 11, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>
                Fill Out Words Starting With
              </Text>
              <View style={{
                width: 70, height: 70, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                backgroundColor: '#1a3a6e', borderWidth: 2.5, borderColor: 'rgba(80,160,255,0.5)',
                shadowColor: '#4090e8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 14,
              }}>
                <Text style={{ fontSize: 38, fontWeight: '900', color: '#e0e7ff', letterSpacing: 2 }}>
                  {currentLevel?.isMultiLetterMode ? '\u2605' : session.currentLetter}
                </Text>
              </View>
              {currentLevel?.isMultiLetterMode && (
                <Text style={{ color: 'rgba(144,192,255,0.5)', fontSize: 11, fontWeight: '600', marginTop: 6 }}>
                  Wild Round — different letter per category
                </Text>
              )}
            </View>
          </View>

          {/* Timer progress bar — full-width, 9px, color shifts red when urgent */}
          <View style={{ height: 9, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <Animated.View
              style={[{
                height: '100%',
                backgroundColor: urgentTimer ? '#ef4444' : '#4090e8',
                borderRadius: 0,
                shadowColor: urgentTimer ? '#ef4444' : '#4090e8',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: urgentTimer ? 0.9 : 0.5,
                shadowRadius: urgentTimer ? 6 : 4,
              }, timerBarStyle]}
            />
          </View>

          {/* Stars row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }}>
            <Star size={16} color="#FCD34D" fill="#FCD34D" strokeWidth={1} />
            <Text style={{ color: '#FCD34D', fontSize: 15, fontWeight: '800' }}>{levelProgress.totalStars}</Text>
            <Text style={{ color: 'rgba(253,211,77,0.4)', fontSize: 14 }}>|</Text>
            <Lightbulb size={15} color="rgba(253,211,77,0.65)" strokeWidth={1.5} />
            <Text style={{ color: 'rgba(253,211,77,0.65)', fontSize: 14, fontWeight: '700' }}>hint</Text>
          </View>

          {/* Constraint banner */}
          {currentLevel.constraint?.type !== 'none' && (
            <Animated.View entering={FadeInDown.duration(350).delay(100)} style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              marginHorizontal: 14, marginTop: 6, marginBottom: 2,
              backgroundColor: '#0e1e42',
              paddingHorizontal: 16, paddingVertical: 12,
              borderRadius: 10, borderWidth: 2, borderColor: '#6366f1',
              shadowColor: '#6366f1', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 10,
            }}>
              <View style={{ backgroundColor: '#6366f1', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>RULE</Text>
              </View>
              <Text style={{ color: '#c7d2fe', fontSize: 16, fontWeight: '700', flex: 1 }}>{currentLevel.constraint.description}</Text>
            </Animated.View>
          )}

          {/* Stop banner */}
          {session.stopRequested && (
            <Animated.View entering={ZoomIn.duration(300)} style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              marginHorizontal: 14, marginTop: 6,
              backgroundColor: '#2d1a1a', paddingHorizontal: 14, paddingVertical: 10,
              borderRadius: 8, borderWidth: 2, borderColor: '#ef4444',
            }}>
              <AlertTriangle size={16} color="#ef4444" strokeWidth={2.5} />
              <Text style={{ color: '#fca5a5', fontSize: 16, fontWeight: '800' }}>Ending in {stopCountdown}s...</Text>
            </Animated.View>
          )}

          {/* Category rows */}
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 160, gap: 8 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {session.settings.selectedCategories.map((cat, i) => {
                const answer = localAnswers[cat] || '';
                const letter = currentLevel.isMultiLetterMode && currentLevel.lettersPerCategory
                  ? (currentLevel.lettersPerCategory[i] || session.currentLetter)
                  : session.currentLetter;
                const hasAnswer = answer.trim().length > letter.length;
                const startsOk = answer.trim().toLowerCase().startsWith(letter.toLowerCase());
                const isComplete = hasAnswer && startsOk;
                const isLoad = loadingHints.has(cat);
                const canHint = !hasAnswer && !usedHints.has(cat) && !isLoad;
                const mc = modernCategoryColors[cat] || { bg: '#12305a', border: '#6366f1', accent: '#a5b4fc' };

                return (
                  <Animated.View
                    key={cat}
                    entering={FadeInDown.duration(280).delay(60 + i * 50).springify().damping(14)}
                    style={{
                      borderRadius: 12, overflow: 'hidden',
                      borderWidth: 1.5,
                      borderColor: isComplete ? mc.border : (hasAnswer && !startsOk) ? '#f97316' : 'rgba(99,102,241,0.2)',
                      backgroundColor: isComplete ? mc.bg : '#0e2040',
                      shadowColor: isComplete ? mc.border : 'transparent',
                      shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 8,
                    }}
                  >
                    {/* Category label row */}
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4,
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: mc.bg, borderWidth: 1.5, borderColor: mc.border, alignItems: 'center', justifyContent: 'center' }}>
                          {CATEGORY_ICONS[cat](mc.accent)}
                        </View>
                        <Text style={{ color: isComplete ? mc.accent : 'rgba(165,180,252,0.7)', fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                          {getCategoryName(cat)}
                        </Text>
                      </View>
                      {/* Hint button */}
                      {!usedHints.has(cat) && (
                        <Pressable
                          onPress={() => handleUseHint(cat, i)}
                          disabled={!canHint && !isLoad}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 4,
                            paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
                            backgroundColor: canHint ? '#1e1b4b' : 'transparent',
                            borderWidth: canHint ? 1 : 0, borderColor: 'rgba(80,160,255,0.5)',
                            opacity: canHint || isLoad ? 1 : 0.3,
                          }}
                        >
                          {isLoad
                            ? <ActivityIndicator size="small" color="#a5b4fc" style={{ width: 14, height: 14 }} />
                            : <Lightbulb size={13} color={canHint ? '#FCD34D' : '#6b7280'} strokeWidth={2} fill={canHint ? '#FCD34D' : 'transparent'} />
                          }
                          {canHint && <Text style={{ color: '#FCD34D', fontSize: 11, fontWeight: '700' }}>Hint</Text>}
                        </Pressable>
                      )}
                      {usedHints.has(cat) && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          <Lightbulb size={11} color="#FCD34D" strokeWidth={2} />
                          <Text style={{ color: '#FCD34D', fontSize: 11, fontWeight: '600' }}>hint used</Text>
                        </View>
                      )}
                    </View>

                    {/* Input */}
                    <View style={{ paddingHorizontal: 12, paddingBottom: 10 }}>
                      <TextInput
                        style={{
                          fontSize: 22, fontWeight: '800',
                          color: usedHints.has(cat) ? '#FCD34D' : isComplete ? mc.accent : '#e0e7ff',
                          paddingVertical: 6,
                          borderBottomWidth: 1.5,
                          borderBottomColor: isComplete ? mc.border : (hasAnswer && !startsOk) ? '#f97316' : 'rgba(99,102,241,0.3)',
                          letterSpacing: 1,
                        }}
                        placeholder={`${letter}...`}
                        placeholderTextColor="rgba(99,102,241,0.3)"
                        value={answer}
                        onChangeText={t => {
                          if (roundInputDisabled) return;
                          const upper = t.toUpperCase();
                          if (!upper.startsWith(letter.toUpperCase())) return;
                          updateLocalAnswer(cat, upper);
                        }}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        editable={!usedHints.has(cat) && timeRemaining > 0 && !roundInputDisabled}
                        underlineColorAndroid="transparent"
                      />
                      {hasAnswer && !startsOk && (
                        <Text style={{ color: '#f97316', fontSize: 11, fontWeight: '600', marginTop: 3 }}>must start with "{letter}"</Text>
                      )}
                    </View>
                  </Animated.View>
                );
              })}
            </ScrollView>

            {/* Submit button — hidden while keyboard is open, shown once keyboard dismissed */}
            {!keyboardVisible ? (
              <View style={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: insets.bottom + 16 }}>
                {!allAnswersFilled && (
                  <Text style={{ color: 'rgba(144,192,255,0.4)', textAlign: 'center', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>
                    Fill all categories to submit
                  </Text>
                )}
                <Pressable onPress={handleStop} disabled={!allAnswersFilled || !!session.stopRequested}>
                  <LinearGradient
                    colors={allAnswersFilled ? ['#2060b8', '#1a4a98'] : ['#1a3a6e', '#1a3a6e']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{
                      borderRadius: 16, paddingVertical: 18,
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                      borderWidth: 1.5, borderColor: allAnswersFilled ? 'rgba(100,160,255,0.4)' : 'rgba(99,102,241,0.2)',
                      shadowColor: allAnswersFilled ? '#4090e8' : 'transparent',
                      shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 14,
                    }}
                  >
                    {session.stopRequested
                      ? <ActivityIndicator color={allAnswersFilled ? '#fff' : '#6366f1'} />
                      : <>
                          <Check size={22} color={allAnswersFilled ? '#fff' : 'rgba(99,102,241,0.4)'} strokeWidth={3} />
                          <Text style={{ color: allAnswersFilled ? '#fff' : 'rgba(99,102,241,0.4)', fontSize: 19, fontWeight: '900', letterSpacing: 0.5 }}>
                            Submit
                          </Text>
                        </>
                    }
                  </LinearGradient>
                </Pressable>
              </View>
            ) : (
              /* Keyboard visible — show a slim status bar */
              <View style={{ paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center' }}>
                {allAnswersFilled ? (
                  <Pressable
                    onPress={() => { Keyboard.dismiss(); handleStop(); }}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 8,
                      backgroundColor: 'rgba(64,144,232,0.22)', borderRadius: 12,
                      paddingVertical: 10, paddingHorizontal: 24,
                      borderWidth: 1.5, borderColor: 'rgba(64,144,232,0.55)',
                    }}
                  >
                    <Check size={16} color="#90c0ff" strokeWidth={2.5} />
                    <Text style={{ color: '#a0d0ff', fontSize: 14, fontWeight: '800' }}>
                      Submit Answers
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={{ color: 'rgba(144,192,255,0.3)', fontSize: 12, fontWeight: '500' }}>
                    Filling answers...
                  </Text>
                )}
              </View>
            )}
          </KeyboardAvoidingView>

          {/* Exit Modal */}
          <Modal visible={showExitModal} transparent animationType="fade" onRequestClose={() => setShowExitModal(false)}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' }}>
              <Animated.View entering={ZoomIn.duration(280).springify()} style={{
                width: '85%', backgroundColor: '#0e2040', borderRadius: 20, padding: 24,
                borderWidth: 1.5, borderColor: 'rgba(80,160,255,0.3)',
                shadowColor: '#4090e8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 20,
              }}>
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#2d1a1a', borderWidth: 1.5, borderColor: '#ef4444', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12 }}>
                  <LogOut size={22} color="#ef4444" strokeWidth={2.5} />
                </View>
                <Text style={{ color: '#e0e7ff', fontSize: 20, fontWeight: '900', textAlign: 'center', marginBottom: 6 }}>Leave Game?</Text>
                <Text style={{ color: 'rgba(144,192,255,0.7)', fontSize: 14, textAlign: 'center', marginBottom: 20 }}>Your progress is saved.</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable onPress={() => setShowExitModal(false)} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#1a3a6e', borderWidth: 1.5, borderColor: 'rgba(80,160,255,0.6)', alignItems: 'center' }}>
                    <Text style={{ color: '#90c0ff', fontWeight: '800', fontSize: 15 }}>Stay</Text>
                  </Pressable>
                  <Pressable onPress={handleExit} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#2d1a1a', borderWidth: 1.5, borderColor: '#ef4444', alignItems: 'center' }}>
                    <Text style={{ color: '#fca5a5', fontWeight: '800', fontSize: 15 }}>Leave</Text>
                  </Pressable>
                </View>
              </Animated.View>
            </View>
          </Modal>

          {/* Letter Reveal Overlay — fully opaque, blocks game until dismissed */}
          {showReveal && (
            <Animated.View
              style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#142d58', alignItems: 'center', justifyContent: 'center' }, revealOverlayStyle]}
              pointerEvents="auto"
            >
              <Pressable
                style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}
                onPress={() => {
                  if (!revealDone) return;
                  revealOpacity.value = withTiming(0, { duration: 250 });
                  setTimeout(() => setShowReveal(false), 250);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <View style={{ alignItems: 'center', gap: 16 }}>
                  <Text style={{ color: 'rgba(144,192,255,0.7)', fontSize: 13, fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase' }}>
                    Level {currentLevel.level} — fill words starting with
                  </Text>
                  <View style={{
                    width: 130, height: 130, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: '#1a3a6e', borderWidth: 3, borderColor: 'rgba(80,160,255,0.5)',
                    shadowColor: '#4090e8', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 28,
                  }}>
                    <Text style={{ fontSize: 78, fontWeight: '900', color: '#e0e7ff', letterSpacing: 2 }}>{shuffleLetter}</Text>
                  </View>
                  {revealDone && (
                    <Animated.View entering={FadeInUp.duration(300)}>
                      <Text style={{ color: 'rgba(144,192,255,0.45)', fontSize: 12, fontWeight: '600', letterSpacing: 1 }}>tap to start</Text>
                    </Animated.View>
                  )}
                </View>
              </Pressable>
            </Animated.View>
          )}
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={s.root}>

      {/* ════ HEADER ════ */}
      <View style={[s.header, { paddingTop: insets.top + 4 }]}>
        {/* Clean notebook top border — two ruled lines */}
        <View style={s.headerBorder}>
          <View style={s.headerBorderLine1} />
          <View style={s.headerBorderLine2} />
        </View>
        {/* Timer progress bar */}
        <View style={{ height: 8, backgroundColor: P.paperDark, overflow: 'hidden' }}>
          <Animated.View style={[{
            height: '100%',
            backgroundColor: timeRemaining <= 10 ? P.stopRed : P.amber,
            shadowColor: timeRemaining <= 10 ? P.stopRed : P.amber,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.6, shadowRadius: 4,
          }, timerBarStyle]} />
        </View>

        {/* Controls bar */}
        <View style={s.topBar}>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowExitModal(true); }}
            style={s.exitBtn}
          >
            <X size={15} color={P.inkMed} strokeWidth={2.5} />
          </Pressable>

          <View style={s.roundPill}>
            <Text style={[s.roundTxt, { fontWeight: '800' }]}>
              {isLevelMode && currentLevel
                ? `Level ${currentLevel.level}`
                : `Round ${session.currentRound}/${session.settings.totalRounds}`}
            </Text>
          </View>

          {/* Floating sticky letter */}
          <View style={s.stickyOuter}>
            <View style={s.tapePiece} />
            <Animated.View style={[s.stickyBody, stickyStyle]}>
              {/* Shading gradient — top-left lighter, bottom-right darker */}
              <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', backgroundColor: 'rgba(255,255,255,0.18)', borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />
              <View style={{ position: 'absolute', bottom: 0, right: 0, left: 0, height: '30%', backgroundColor: 'rgba(160,120,0,0.1)' }} />
              {/* Corner fold — bottom-right */}
              <View style={{ position: 'absolute', bottom: 0, right: 0, width: 0, height: 0, borderLeftWidth: 12, borderTopWidth: 12, borderLeftColor: 'transparent', borderTopColor: 'rgba(160,120,0,0.25)' }} />
              <View style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, backgroundColor: 'rgba(200,160,10,0.35)', borderTopLeftRadius: 4 }} />
              {/* Pencil mark lines on sticky — like someone wrote on it */}
              <View style={{ position: 'absolute', top: 8, left: 6, right: 6, height: 1, backgroundColor: P.stickyDark, opacity: 0.18, transform: [{ rotate: '-1deg' }] }} />
              <View style={{ position: 'absolute', bottom: 10, left: 8, right: 8, height: 1, backgroundColor: P.stickyDark, opacity: 0.12 }} />
              <Text style={[s.stickyLetter, { fontWeight: '900' }]}>
                {currentLevel?.letterOptions
                  ? currentLevel.letterOptions.join(' / ')
                  : session.currentLetter}
              </Text>
            </Animated.View>
          </View>

          {/* Timer + Sound toggle */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Animated.View style={[s.timerPill, timeRemaining <= 10 && timerBgStyle]}>
              <Clock size={12} color={timeRemaining <= 10 ? P.stopRed : P.inkFaint} strokeWidth={2.5} />
              <Text style={[s.timerTxt, { fontWeight: '700' }, timeRemaining <= 10 && { color: P.stopRed, fontWeight: '800' }]}>
                {fmt(timeRemaining)}
              </Text>
            </Animated.View>
            <Pressable onPress={toggleSound} style={s.exitBtn}>
              {soundOn
                ? <Volume2 size={14} color={P.inkMed} strokeWidth={2.5} />
                : <VolumeX size={14} color={P.inkFaint} strokeWidth={2.5} />}
            </Pressable>
          </View>
        </View>
      </View>

      {/* ════ PAPER BODY ════ */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <NotebookBackground lineStartY={32} lineSpacing={30} lineCount={45} marginX={62} showMargin={true}>
          {/* ── Static notebook doodles — pointerEvents none, purely decorative ── */}
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
            {/* Top-left corner: NPAT initials scrawled in margin */}
            <Text style={{ position: 'absolute', top: 8, left: 4, fontSize: 11, color: '#2A1A0A', opacity: 0.55, fontStyle: 'italic', transform: [{ rotate: '-3deg' }] }}>N</Text>
            <Text style={{ position: 'absolute', top: 20, left: 5, fontSize: 11, color: '#2A1A0A', opacity: 0.55, fontStyle: 'italic', transform: [{ rotate: '1deg' }] }}>P</Text>
            <Text style={{ position: 'absolute', top: 32, left: 4, fontSize: 11, color: '#2A1A0A', opacity: 0.55, fontStyle: 'italic', transform: [{ rotate: '-2deg' }] }}>A</Text>
            <Text style={{ position: 'absolute', top: 44, left: 6, fontSize: 11, color: '#2A1A0A', opacity: 0.55, fontStyle: 'italic', transform: [{ rotate: '1.5deg' }] }}>T</Text>

            {/* Top-right corner: little star cluster */}
            <Text style={{ position: 'absolute', top: 10, right: 12, fontSize: 14, color: P.amber, opacity: 0.55, transform: [{ rotate: '12deg' }] }}>★</Text>
            <Text style={{ position: 'absolute', top: 22, right: 22, fontSize: 9, color: P.amber, opacity: 0.4, transform: [{ rotate: '-8deg' }] }}>★</Text>
            <Text style={{ position: 'absolute', top: 6, right: 26, fontSize: 8, color: P.amber, opacity: 0.35 }}>✦</Text>

            {/* Small arrow doodle top-right pointing down */}
            <View style={{ position: 'absolute', top: 38, right: 14, opacity: 0.5 }}>
              <View style={{ width: 1.5, height: 14, backgroundColor: '#2A1A0A', alignSelf: 'center' }} />
              <View style={{ width: 0, height: 0, borderLeftWidth: 4, borderRightWidth: 4, borderTopWidth: 7, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#2A1A0A', alignSelf: 'center' }} />
            </View>

            {/* Mid-right margin: circled doodle */}
            <View style={{ position: 'absolute', top: 180, right: 8, width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#2A1A0A', opacity: 0.35 }} />
            <View style={{ position: 'absolute', top: 184, right: 12, width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: '#B07820', opacity: 0.45 }} />

            {/* Left margin: heavy pencil scribble lines — graphite style */}
            <View style={{ position: 'absolute', top: 122, left: 10, width: 24, height: 2, backgroundColor: '#2A1A0A', opacity: 0.4, transform: [{ rotate: '-3deg' }] }} />
            <View style={{ position: 'absolute', top: 126, left: 12, width: 18, height: 1.5, backgroundColor: '#2A1A0A', opacity: 0.3, transform: [{ rotate: '2deg' }] }} />
            <View style={{ position: 'absolute', top: 130, left: 14, width: 12, height: 1, backgroundColor: '#2A1A0A', opacity: 0.2, transform: [{ rotate: '-1deg' }] }} />

            <View style={{ position: 'absolute', top: 212, left: 10, width: 26, height: 2, backgroundColor: '#2A1A0A', opacity: 0.38, transform: [{ rotate: '2deg' }] }} />
            <View style={{ position: 'absolute', top: 216, left: 13, width: 16, height: 1.5, backgroundColor: '#2A1A0A', opacity: 0.28 }} />
            <View style={{ position: 'absolute', top: 220, left: 16, width: 10, height: 1, backgroundColor: '#2A1A0A', opacity: 0.18 }} />

            {/* Heavy cross-hatch shading patch — left margin mid */}
            {[0,1,2,3,4].map(i => (
              <View key={`hatchL${i}`} style={{
                position: 'absolute', top: 300 + i * 6, left: 4,
                width: 36, height: 1.5,
                backgroundColor: '#2A1A0A', opacity: 0.22,
                transform: [{ rotate: '-35deg' }],
              }} />
            ))}
            {[0,1,2,3].map(i => (
              <View key={`hatchLr${i}`} style={{
                position: 'absolute', top: 303 + i * 6, left: 4,
                width: 28, height: 1,
                backgroundColor: '#2A1A0A', opacity: 0.14,
                transform: [{ rotate: '35deg' }],
              }} />
            ))}

            {/* Tiny check mark doodle in margin */}
            <Text style={{ position: 'absolute', top: 272, left: 8, fontSize: 13, color: '#206030', opacity: 0.55, transform: [{ rotate: '-4deg' }] }}>✓</Text>

            {/* Small bracket in margin */}
            <View style={{ position: 'absolute', top: 155, left: 8, width: 8, height: 30, borderLeftWidth: 2, borderTopWidth: 2, borderBottomWidth: 2, borderColor: '#2A1A0A', borderRadius: 3, opacity: 0.35 }} />

            {/* Graphite shading patch — right side, lower */}
            {[0,1,2,3,4,5].map(i => (
              <View key={`hatchR${i}`} style={{
                position: 'absolute', bottom: 200 + i * 7, right: 6,
                width: 30, height: 1.5,
                backgroundColor: '#2A1A0A', opacity: 0.18,
                transform: [{ rotate: '-40deg' }],
              }} />
            ))}
            {[0,1,2,3,4].map(i => (
              <View key={`hatchRr${i}`} style={{
                position: 'absolute', bottom: 204 + i * 7, right: 6,
                width: 24, height: 1,
                backgroundColor: '#2A1A0A', opacity: 0.1,
                transform: [{ rotate: '40deg' }],
              }} />
            ))}

            {/* Bottom corner: doodle circle/face */}
            <Text style={{ position: 'absolute', bottom: 170, right: 16, fontSize: 18, color: '#2A1A0A', opacity: 0.3, transform: [{ rotate: '8deg' }] }}>◯</Text>
            <Text style={{ position: 'absolute', bottom: 168, right: 18, fontSize: 10, color: '#2A1A0A', opacity: 0.25 }}>··</Text>
            <View style={{ position: 'absolute', bottom: 162, right: 21, width: 8, height: 2, borderBottomWidth: 2, borderColor: '#2A1A0A', opacity: 0.28, borderRadius: 2 }} />

            {/* Hatching in top-left corner — denser and darker */}
            {[0,1,2,3,4,5].map(i => (
              <View key={`hatch${i}`} style={{
                position: 'absolute', top: 8 + i * 5, left: 0,
                width: 48, height: 1.5,
                backgroundColor: '#2A1A0A', opacity: 0.14,
                transform: [{ rotate: '-45deg' }, { translateX: i * 3 }],
              }} />
            ))}
            {/* Cross-hatch overlay on top-left */}
            {[0,1,2,3].map(i => (
              <View key={`hatchX${i}`} style={{
                position: 'absolute', top: 8 + i * 6, left: 0,
                width: 36, height: 1,
                backgroundColor: '#2A1A0A', opacity: 0.09,
                transform: [{ rotate: '45deg' }, { translateX: i * 2 }],
              }} />
            ))}

            {/* Scribble underline near top — like someone underlined something */}
            <View style={{ position: 'absolute', top: 66, left: 68, width: 60, height: 2, backgroundColor: '#2A1A0A', opacity: 0.3, transform: [{ rotate: '-0.5deg' }] }} />
            <View style={{ position: 'absolute', top: 69, left: 72, width: 44, height: 1, backgroundColor: '#2A1A0A', opacity: 0.18, transform: [{ rotate: '0.3deg' }] }} />

            {/* Random dash marks in right margin */}
            <View style={{ position: 'absolute', top: 95, right: 10, width: 14, height: 2, backgroundColor: '#2A1A0A', opacity: 0.35, transform: [{ rotate: '-5deg' }] }} />
            <View style={{ position: 'absolute', top: 99, right: 12, width: 10, height: 1.5, backgroundColor: '#2A1A0A', opacity: 0.25, transform: [{ rotate: '3deg' }] }} />
            <View style={{ position: 'absolute', top: 250, right: 9, width: 16, height: 2, backgroundColor: '#2A1A0A', opacity: 0.3, transform: [{ rotate: '-2deg' }] }} />
            <View style={{ position: 'absolute', top: 254, right: 14, width: 9, height: 1.5, backgroundColor: '#2A1A0A', opacity: 0.2, transform: [{ rotate: '4deg' }] }} />
          </View>

          <View style={[s.paper, { backgroundColor: 'transparent' }]}>

          {/* ── Instruction text ── */}
          <Animated.View entering={FadeInDown.duration(300).delay(80)} style={s.instrBar}>
            <Pencil size={14} color={P.inkFaint} strokeWidth={2} />
            <Text style={[s.instrBarTxt, { fontWeight: '700' }]}>
              Fill Out Words Starting With:
            </Text>
          </Animated.View>

          {/* ── Banners ── */}
          {isLevelMode && currentLevel?.constraint?.type !== 'none' && (
            <Animated.View entering={FadeInDown.duration(300).delay(100)} style={s.constraintBanner}>
              <Info size={16} color="#604898" strokeWidth={2.5} />
              <Text style={s.constraintTxt}>{currentLevel!.constraint.description}</Text>
            </Animated.View>
          )}
          {session.stopRequested && (
            <Animated.View entering={ZoomIn.duration(300)} style={s.stopBanner}>
              <AlertTriangle size={15} color="#8B4000" strokeWidth={2.5} />
              <Text style={[s.stopBannerTxt, { fontWeight: '800' }]}>STOP! Ending in {stopCountdown}s</Text>
            </Animated.View>
          )}

          {/* ── Leaderboard ── */}
          {session.players.length > 1 && (
            <Animated.View entering={FadeInDown.duration(400).delay(200)} style={s.lbWrap}>
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowLeaderboard(v => !v); }}
                style={s.lbToggle}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Trophy size={12} color={P.amber} strokeWidth={2.5} />
                  <Text style={[s.lbToggleTxt, { fontWeight: '700' }]}>Live Standings</Text>
                </View>
                {showLeaderboard
                  ? <ChevronUp size={12} color={P.inkFaint} strokeWidth={2} />
                  : <ChevronDown size={12} color={P.inkFaint} strokeWidth={2} />}
              </Pressable>
              {showLeaderboard && (
                <Animated.View entering={FadeIn.duration(200)} style={s.lbBody}>
                  {[...session.players].sort((a, b) => b.totalScore - a.totalScore).map((p, i) => {
                    const isMe = p.visibleId === currentUser?.id;
                    return (
                      <View key={p.id} style={[s.lbRow, isMe && s.lbRowMe]}>
                        <Text style={[s.lbRank, { fontWeight: '800' }, i === 0 && { color: P.amber }]}>{i + 1}</Text>
                        <Text style={[s.lbName, { fontWeight: '500' }, isMe && { color: '#2A7060' }]} numberOfLines={1}>{p.username}{isMe ? ' (you)' : ''}</Text>
                        <Text style={[s.lbScore, { fontWeight: '800' }]}>{p.totalScore}</Text>
                      </View>
                    );
                  })}
                </Animated.View>
              )}
            </Animated.View>
          )}

          {/* ── Category rows ── */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {gameMode === 'single' && (
              <Animated.View entering={FadeIn.duration(400).delay(50)} style={s.starsRow}>
                <Star size={12} color={P.amber} fill={P.amber} strokeWidth={1} />
                <Text style={[s.starsTxt, { fontWeight: '700' }]}>{levelProgress.totalStars}</Text>
                <Text style={[s.starsTxt, { color: P.inkFaint, fontSize: 11 }]}>|</Text>
                <Lightbulb size={11} color={P.inkFaint} strokeWidth={1.5} />
                <Text style={[s.starsTxt, { color: P.inkFaint, fontSize: 11 }]}>hint</Text>
              </Animated.View>
            )}
            {session.settings.selectedCategories.map((cat, i) => {
              const answer  = localAnswers[cat] || '';
              const letter  = currentLevel?.isMultiLetterMode && currentLevel?.lettersPerCategory
                ? (currentLevel.lettersPerCategory[i] || session.currentLetter)
                : session.currentLetter;
              const hasAns  = answer.trim().length > letter.length;
              const isLoad  = loadingHints.has(cat);
              const canHint = gameMode === 'single' && !hasAns && !usedHints.has(cat) && !isLoad;
              return (
                <CategoryRow
                  key={cat}
                  category={cat} index={i} answer={answer} letter={letter}
                  fontsLoaded={!!fontsLoaded}
                  onChangeText={t => updateLocalAnswer(cat, t)}
                  usedHint={usedHints.has(cat)}
                  canUseHint={canHint}
                  isLoadingHint={isLoad}
                  onHint={() => handleUseHint(cat, i)}
                  isSinglePlayer={gameMode === 'single'}
                  isMultiplayer={gameMode === 'multiplayer'}
                  inputDisabled={roundInputDisabled}
                />
              );
            })}
            <View style={{ height: 24 }} />
          </ScrollView>

          {/* ════ STOP / SUBMIT BUTTON ════
               Only fully shown when keyboard is DOWN.
               When keyboard visible: show a compact "dismiss keyboard" hint.
               When keyboard hidden + all filled: show the main action button. ════ */}
          <View style={[s.stampArea, { paddingBottom: insets.bottom + 10 }]}>
            {keyboardVisible ? (
              /* Keyboard is open — show a slim, static info row */
              allAnswersFilled ? (
                <Pressable
                  onPress={() => Keyboard.dismiss()}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                    backgroundColor: P.paperDark, borderRadius: 10,
                    paddingVertical: 10, paddingHorizontal: 20,
                    borderWidth: 1, borderColor: P.amber,
                  }}
                >
                  <Check size={16} color={P.amber} strokeWidth={2.5} />
                  <Text style={{ color: P.amber, fontSize: 14, fontWeight: '800' }}>
                    {gameMode === 'single' ? 'Done — tap Submit' : 'Done — tap STOP!'}
                  </Text>
                </Pressable>
              ) : (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                  paddingVertical: 8,
                }}>
                  <Text style={{ color: P.inkFaint, fontSize: 13, fontWeight: '500', fontStyle: 'italic' }}>
                    Fill all categories to {gameMode === 'single' ? 'submit' : 'stop'}
                  </Text>
                </View>
              )
            ) : (
              /* Keyboard hidden — show the full action button */
              <>
                {!allAnswersFilled && (
                  <Text style={[s.stampHint, { fontWeight: '500' }]}>
                    Fill all categories to {gameMode === 'single' ? 'submit' : 'stop'}
                  </Text>
                )}
                <Pressable
                  onPress={handleStop}
                  disabled={!allAnswersFilled || !!session.stopRequested}
                >
                  <Animated.View style={[s.stampRing, !allAnswersFilled && s.stampRingOff, stampStyle]}>
                    <View style={[s.stampBody, !allAnswersFilled && s.stampBodyOff]}>
                      {session.stopRequested
                        ? <ActivityIndicator color={allAnswersFilled ? '#FFF' : P.inkFaint} />
                        : gameMode === 'single'
                          ? <View style={s.stampInner}>
                              <Check size={20} color={allAnswersFilled ? '#FFF' : P.inkFaint} strokeWidth={3} />
                              <Text style={[s.stampTxt, { fontWeight: '900' }, !allAnswersFilled && { color: P.inkFaint }]}>Submit</Text>
                            </View>
                          : <View style={s.stampInner}>
                              <Hand size={20} color={allAnswersFilled ? '#FFF' : P.inkFaint} strokeWidth={2} />
                              <Text style={[s.stampTxt, { fontWeight: '900' }, !allAnswersFilled && { color: P.inkFaint }]}>STOP!</Text>
                            </View>
                      }
                    </View>
                  </Animated.View>
                </Pressable>
              </>
            )}
          </View>
        </View>
        </NotebookBackground>
      </KeyboardAvoidingView>

      {/* ════ MODALS ════ */}
      <Modal visible={showExitModal} transparent animationType="fade" onRequestClose={() => setShowExitModal(false)}>
        <View style={s.backdrop}>
          <Animated.View entering={ZoomIn.duration(280).springify()} style={s.modalCard}>
            <View style={s.modalIconWrap}><LogOut size={22} color={P.stopRed} strokeWidth={2.5} /></View>
            <Text style={[s.modalTitle, { fontWeight: '800' }]}>Leave Game?</Text>
            <Text style={[s.modalBody, { fontWeight: '500' }]}>{isLevelMode ? 'Your progress is saved.' : "You'll lose your progress."}</Text>
            <View style={s.modalRow}>
              <Pressable onPress={() => setShowExitModal(false)} style={[s.mBtn, s.mBtnSec]}>
                <Text style={[s.mBtnSecTxt, { fontWeight: '700' }]}>Stay</Text>
              </Pressable>
              <Pressable onPress={handleExit} style={[s.mBtn, s.mBtnRed]}>
                <Text style={[s.mBtnLightTxt, { fontWeight: '700' }]}>Leave</Text>
              </Pressable>
            </View>
            {isHost && !isLevelMode && (
              <Pressable onPress={() => { setShowExitModal(false); setShowEndGameModal(true); }} style={s.mBtnGhost}>
                <Text style={[s.mBtnGhostTxt, { fontWeight: '700' }]}>End Game for Everyone</Text>
              </Pressable>
            )}
          </Animated.View>
        </View>
      </Modal>

      {/* ════ HINT CHOICE MODAL ════ */}
      <Modal visible={!!pendingHint} transparent animationType="fade" onRequestClose={() => setPendingHint(null)}>
        <View style={s.backdrop}>
          <Animated.View entering={ZoomIn.duration(260).springify()} style={s.modalCard}>
            <View style={[s.modalIconWrap, { backgroundColor: '#1e2d50', borderColor: '#FCD34D' }]}>
              <Lightbulb size={22} color="#FCD34D" strokeWidth={2} />
            </View>
            <Text style={[s.modalTitle, { fontWeight: '800' }]}>Get a Hint</Text>
            <Text style={[s.modalBody, { fontWeight: '500' }]}>Choose how you'd like to unlock this hint.</Text>
            <View style={s.modalRow}>
              <Pressable onPress={() => setPendingHint(null)} style={[s.mBtn, s.mBtnSec]}>
                <Text style={[s.mBtnSecTxt, { fontWeight: '700' }]}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleHintViaStars} style={[s.mBtn, { backgroundColor: '#1e2d50', borderWidth: 2, borderColor: '#FCD34D', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }]}>
                <Star size={13} color="#FCD34D" fill="#FCD34D" strokeWidth={1} />
                <Text style={{ color: '#FCD34D', fontWeight: '800', fontSize: 14 }}> {HINT_COST}★</Text>
              </Pressable>
            </View>
            <Pressable onPress={handleHintViaAd} style={{ marginTop: 6, backgroundColor: '#10b981', borderRadius: 10, paddingVertical: 13, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Watch Ad — Free</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>

      <Modal visible={showEndGameModal} transparent animationType="fade" onRequestClose={() => setShowEndGameModal(false)}>
        <View style={s.backdrop}>
          <Animated.View entering={ZoomIn.duration(280).springify()} style={s.modalCard}>
            <View style={[s.modalIconWrap, { backgroundColor: P.amberBg, borderColor: P.amber }]}>
              <Crown size={22} color={P.amber} strokeWidth={2.5} />
            </View>
            <Text style={[s.modalTitle, { fontWeight: '800' }]}>End Game?</Text>
            <Text style={[s.modalBody, { fontWeight: '500' }]}>This ends the game for all players.</Text>
            <View style={s.modalRow}>
              <Pressable onPress={() => setShowEndGameModal(false)} style={[s.mBtn, s.mBtnSec]}>
                <Text style={[s.mBtnSecTxt, { fontWeight: '700' }]}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleEndGame} style={[s.mBtn, s.mBtnAmber]}>
                <Text style={[s.mBtnLightTxt, { fontWeight: '700' }]}>End Game</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* ════ LETTER PICKER OVERLAY (multiplayer picking_letter phase) ════ */}
      {gameMode === 'multiplayer' && session?.status === 'picking_letter' && (
        <View style={s.revealOverlay} pointerEvents="auto">
          {isPicker ? (
            /* ── PICKER VIEW ── */
            <View style={s.revealCard}>
              <Text style={[s.revealLabel, { fontWeight: '700', fontSize: 22, marginBottom: 4, color: P.ink }]}>
                Choose a letter!
              </Text>
              <Text style={[s.revealLabel, { fontWeight: '600', fontSize: 14, marginBottom: 4, color: P.amber }]}>
                You are the letter picker this round!
              </Text>
              <Text style={[s.revealLabel, { fontWeight: '500', fontSize: 14, marginBottom: 16, color: P.inkFaint }]}>
                {pickerCountdown}s remaining
              </Text>

              {/* Cycling letter tile */}
              <View style={s.revealTileWrap}>
                <Text style={[s.revealTile, { fontWeight: '900' }]}>
                  {pickerLocked ? pickerLetter : pickerLetter}
                </Text>
              </View>

              {/* STOP button */}
              {!pickerLocked ? (
                <Pressable
                  style={[s.revealStopBtn, { backgroundColor: P.stopRed, borderColor: '#901010' }]}
                  onPress={handlePickerStop}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Hand size={20} color="#FFF" strokeWidth={2.5} />
                    <Text style={[s.revealStopTxt, { fontWeight: '900', letterSpacing: 2 }]}>STOP!</Text>
                  </View>
                </Pressable>
              ) : (
                <Animated.View entering={ZoomIn.duration(300).springify()}>
                  <Text style={{ color: P.amber, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
                    Locked in!
                  </Text>
                </Animated.View>
              )}

              {/* Used letters display */}
              {usedLetters.length > 0 && (
                <View style={s.usedLettersRow}>
                  {PICKER_ALPHABET.split('').map(letter => {
                    const isUsed = usedLetters.includes(letter);
                    return (
                      <Text
                        key={letter}
                        style={[
                          s.usedLetterChar,
                          isUsed && s.usedLetterStruck,
                          { fontWeight: '700' },
                        ]}
                      >
                        {letter}
                      </Text>
                    );
                  })}
                </View>
              )}
            </View>
          ) : (
            /* ── WAITING VIEW (other players) ── */
            <View style={s.revealCard}>
              <Animated.View style={[{ alignItems: 'center', marginBottom: 20 }, waitingPulseStyle]}>
                <View style={[s.revealTileWrap, { width: 80, height: 80, borderRadius: 14, marginBottom: 0 }]}>
                  <Text style={{ fontSize: 36, color: P.ink, fontWeight: '900' }}>?</Text>
                </View>
              </Animated.View>

              <Text style={[s.revealLabel, { fontWeight: '700', fontSize: 19, marginBottom: 6, color: P.ink }]}>
                {session.players.find(p => p.visibleId === letterPickerId)?.username || 'A player'} is choosing a letter...
              </Text>
              <Text style={[s.revealLabel, { fontWeight: '400', fontSize: 14, marginBottom: 12, color: P.inkFaint }]}>
                Hang tight!
              </Text>

              <ActivityIndicator size="small" color={P.amber} style={{ marginBottom: 16 }} />

              {/* Used letters display */}
              {usedLetters.length > 0 && (
                <View style={s.usedLettersRow}>
                  {PICKER_ALPHABET.split('').map(letter => {
                    const isUsed = usedLetters.includes(letter);
                    return (
                      <Text
                        key={letter}
                        style={[
                          s.usedLetterChar,
                          isUsed && s.usedLetterStruck,
                          { fontWeight: '700' },
                        ]}
                      >
                        {letter}
                      </Text>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* ════ LETTER REVEAL OVERLAY (plays after letter is picked, or for single player) ════ */}
      {showReveal && session?.status === 'playing' && (
        <Animated.View style={[s.revealOverlay, revealOverlayStyle]} pointerEvents={revealDone && gameMode === 'multiplayer' ? 'auto' : 'none'}>
          <View style={s.revealCard}>
            <Text style={[s.revealLabel, { fontWeight: '500' }]}>Fill Out Words Starting With:</Text>
            <View style={s.revealTileWrap}>
              <Text style={[s.revealTile, { fontWeight: '900' }]}>{shuffleLetter}</Text>
            </View>
            {gameMode === 'multiplayer' && revealDone && (
              <Pressable
                style={s.revealStopBtn}
                onPress={() => {
                  revealOpacity.value = withTiming(0, { duration: 300 });
                  setTimeout(() => setShowReveal(false), 300);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Play size={18} color="#FFF" fill="#FFF" strokeWidth={1} />
                  <Text style={[s.revealStopTxt, { fontWeight: '800' }]}>Let's Play!</Text>
                </View>
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}

      {/* ═══ NOVELTY POPUP (New Features — shown once ever, tap to dismiss) ═══ */}
      {noveltyPopup && (
        <Modal visible={true} transparent animationType="fade">
          <Pressable
            style={[s.backdrop, { justifyContent: 'center', alignItems: 'center' }]}
            onPress={() => setNoveltyPopup(null)}
          >
            <Animated.View entering={ZoomIn.springify()}>
              <View style={[s.modalCard, { maxWidth: 300, alignItems: 'center' }]}>
                <View style={{
                  width: 72, height: 72, borderRadius: 36,
                  backgroundColor: noveltyPopup.type === 'category' ? 'rgba(253,211,77,0.15)' : 'rgba(167,139,250,0.15)',
                  alignItems: 'center', justifyContent: 'center',
                  marginBottom: 14,
                  borderWidth: 2,
                  borderColor: noveltyPopup.type === 'category' ? 'rgba(253,211,77,0.4)' : 'rgba(167,139,250,0.4)',
                }}>
                  {noveltyPopup.icon}
                </View>
                <Text style={[s.modalTitle, { fontSize: 19, marginBottom: 8, textAlign: 'center' }]}>
                  {noveltyPopup.title}
                </Text>
                <Text style={[s.modalBody, { fontSize: 14, textAlign: 'center', marginBottom: 18 }]}>
                  {noveltyPopup.message}
                </Text>
                <Pressable
                  onPress={() => setNoveltyPopup(null)}
                  style={({ pressed }) => ({
                    backgroundColor: noveltyPopup.type === 'category' ? '#4090e8' : '#6366f1',
                    borderRadius: 10, paddingVertical: 11, paddingHorizontal: 28,
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Got it!</Text>
                </Pressable>
              </View>
            </Animated.View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: P.paper },

  // ── Header ──
  header: {
    backgroundColor: P.paper,
    borderBottomWidth: 1.5,
    borderBottomColor: P.paperDeep,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },

  // ── Clean header border ──
  headerBorder: {
    paddingHorizontal: 0,
    marginBottom: 2,
  },
  headerBorderLine1: {
    height: 3,
    backgroundColor: P.paperDeep,
    opacity: 0.7,
    marginBottom: 3,
  },
  headerBorderLine2: {
    height: 1.5,
    backgroundColor: P.paperLine,
    opacity: 0.9,
  },

  // ── Top bar ──
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 2,
    paddingBottom: 12,
    gap: 6,
  },
  exitBtn: {
    width: 32, height: 32, borderRadius: 7,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderWidth: 1, borderColor: P.paperLine,
    alignItems: 'center', justifyContent: 'center',
  },
  roundPill: {
    backgroundColor: P.paperDark,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1, borderColor: P.paperLine,
  },
  roundTxt: { color: P.inkMed, fontSize: 16 },

  // Sticky note
  stickyOuter: { alignItems: 'center' },
  tapePiece: {
    width: 34, height: 11, borderRadius: 2,
    backgroundColor: P.tape, marginBottom: -5, zIndex: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 1,
  },
  stickyBody: {
    width: 72, height: 72,
    backgroundColor: P.sticky,
    borderRadius: 3,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 4, height: 6 }, shadowOpacity: 0.38, shadowRadius: 7,
    elevation: 8,
    borderWidth: 0.5, borderColor: P.stickyDark + '60',
    overflow: 'hidden',
  },
  stickyLetter: {
    fontSize: 46, color: P.ink, lineHeight: 52,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 1, height: 2 },
    textShadowRadius: 0,
  },

  timerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1.5, borderColor: P.paperLine,
    backgroundColor: P.paperDark,
  },
  timerTxt: { color: P.inkMed, fontSize: 17 },

  // ── Paper ──
  paper: { flex: 1, backgroundColor: P.paper },
  ruleLine: {
    position: 'absolute', left: 0, right: 0, height: 1,
    backgroundColor: P.paperLine,
  },
  marginLine: {
    position: 'absolute', top: 0, bottom: 0, left: 62,
    width: 1.5, backgroundColor: P.marginRed,
  },
  // Paper grain smudge / aging effect
  smudge: {
    position: 'absolute',
    borderRadius: 8,
    backgroundColor: 'rgba(160,130,70,0.07)',
  },

  // ── Banners ──
  constraintBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 14, marginTop: 10,
    backgroundColor: '#EAE0FF',
    paddingHorizontal: 14, paddingVertical: 11,
    borderRadius: 8, borderWidth: 1.5, borderColor: '#B090D8',
    transform: [{ rotate: '-0.5deg' }],
    shadowColor: '#B090D8', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 0.3, shadowRadius: 0,
    zIndex: 2,
  },
  constraintTxt: { color: '#604898', fontSize: 17, flex: 1, fontWeight: '600' },

  stopBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 14, marginTop: 8,
    backgroundColor: P.amberBg,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 5, borderWidth: 2.5, borderColor: P.amber,
    transform: [{ rotate: '0.4deg' }],
    shadowColor: P.amber, shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.35, shadowRadius: 0,
    zIndex: 2,
  },
  stopBannerTxt: { color: '#7A3800', fontSize: 18 },

  // ── Leaderboard ──
  lbWrap: { marginHorizontal: 14, marginTop: 8, zIndex: 2 },
  lbToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: P.paperDark, borderRadius: 6,
    borderWidth: 1.5, borderColor: P.paperLine,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  lbToggleTxt: { color: P.inkMed, fontSize: 15 },
  lbBody: {
    backgroundColor: P.paperDark, paddingHorizontal: 8, paddingVertical: 6,
    gap: 3, borderRadius: 6, borderWidth: 1.5, borderTopWidth: 0,
    borderTopLeftRadius: 0, borderTopRightRadius: 0, borderColor: P.paperLine,
  },
  lbRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, paddingHorizontal: 4, borderRadius: 4 },
  lbRowMe: { backgroundColor: '#D0EEE0' },
  lbRank: { width: 20, color: P.inkFaint, fontSize: 16 },
  lbName: { flex: 1, color: P.inkMed, fontSize: 15 },
  lbScore: { color: P.ink, fontSize: 17 },

  // paddingTop=8 aligns first row's input baseline with the first notebook ruled line
  scrollContent: { paddingTop: 8, paddingBottom: 160, paddingHorizontal: 0 },

  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  starsTxt: { color: P.amber, fontSize: 17 },
  instrRow: { marginBottom: 12, paddingHorizontal: 2, paddingVertical: 4 },
  instrTxt: { color: P.ink, fontSize: 21, fontFamily: 'Comic Sans MS', fontWeight: '700' },

  // ── Instruction bar ──
  instrBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginHorizontal: 14, marginTop: 10, marginBottom: 2,
    paddingVertical: 6,
  },
  instrBarTxt: { color: P.inkMed, fontSize: 18 },

  // ── Category card — transparent, full-width, exactly 60px = 2 ruled lines ──
  catCard: {
    height: 60,          // exactly 2 × lineSpacing(30) so input baseline lands on a ruled line
    marginBottom: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
    overflow: 'visible',
    position: 'relative',
    flexDirection: 'row',
  },
  catCardGlow: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 0,
    borderWidth: 0,
    borderBottomWidth: 2,
    borderColor: 'transparent',
  },
  catCardAccent: {
    position: 'absolute',
    top: 0, left: -14, bottom: 0,
    width: 3,
  },
  catCardGutter: {
    width: 68,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    gap: 2,
    flexShrink: 0,
  },
  catCardGutterLabel: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
    textAlign: 'center',
    lineHeight: 17,
  },
  catCardContent: {
    flex: 1,
    // Input baseline sits at the bottom ruled line of the 60px row.
    // paddingLeft=8 gives breathing room after the margin line.
    paddingLeft: 8,
    paddingRight: 14,
    // Push input text down so its baseline (fontSize 28, lineHeight ~34) lands
    // on the bottom ruled line: 60 - 34 = 26px from top, minus paddingBottom 2
    paddingTop: 20,
    paddingBottom: 0,
    justifyContent: 'flex-end',
  },
  catCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  catCardLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  catCardIcon: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  catCardLabel: {
    fontSize: 16,
    letterSpacing: 0.3,
  },
  catCardInputWrap: {
    paddingTop: 0,
    paddingBottom: 2,
  },
  catCardInput: {
    fontSize: 27,
    color: P.ink,
    padding: 0,
    margin: 0,
    height: 34,
    flex: 1,
    textShadowColor: 'rgba(20,12,4,0.18)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  catCardLine: {
    marginTop: 0,
    borderRadius: 0,
  },

  // ── Legacy category row styles (kept for compatibility) ──
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    minHeight: 56,
    position: 'relative',
  },
  catGlow: {
    position: 'absolute',
    top: -3, left: -54, right: -6, bottom: -3,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  catTab: {
    width: 50,
    marginLeft: -54,
    marginRight: 6,
    borderRadius: 6,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
    borderWidth: 1.5,
    paddingVertical: 6,
    paddingHorizontal: 3,
    alignItems: 'center',
    overflow: 'hidden',
    minHeight: 56,
    justifyContent: 'center',
    gap: 3,
    shadowColor: 'rgba(60,40,10,0.3)',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1, shadowRadius: 0,
    elevation: 2,
  },
  // Pencil hatching diagonals
  shadeA: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, transform: [{ skewX: '-20deg' }] },
  shadeB: { position: 'absolute', top: 0, left: '35%', right: '-35%', bottom: 0, transform: [{ skewX: '-20deg' }] },
  shadeC: { position: 'absolute', top: 0, left: '65%', right: '-65%', bottom: 0, transform: [{ skewX: '-20deg' }] },
  tabIcon: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  tabLabel: { fontSize: 13, textAlign: 'center', lineHeight: 16, paddingHorizontal: 2 },
  hintBtn: { marginTop: 2, padding: 4, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  hintBtnActive: { backgroundColor: P.amber, shadowColor: P.amber, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 3 },

  // Input on paper — baseline sits directly on the ruled line
  inputZone: { flex: 1, paddingTop: 6, paddingBottom: 0 },
  handInput: {
    fontSize: 27, color: P.ink,
    padding: 0, margin: 0, minHeight: 34,
    textShadowColor: 'rgba(20,12,4,0.22)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
    // No background, no border — text sits naked on paper
  },

  // ── Writing pencil animation (small pencil that appears on input focus) ──
  writingPencilWrap: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    width: 10,
    height: 50,
    alignItems: 'center',
    zIndex: 10,
  },
  wPencilEraser: {
    width: 10, height: 7,
    backgroundColor: '#F0C0B0',
    borderRadius: 2,
  },
  wPencilFerrule: {
    width: 10, height: 5,
    backgroundColor: '#B8A890',
  },
  wPencilBody: {
    width: 10, height: 20,
    backgroundColor: P.pencilYellow,
    overflow: 'hidden',
  },
  wPencilStripe: {
    position: 'absolute',
    top: 0, left: 3,
    width: 1.5, height: '100%',
    backgroundColor: 'rgba(180,130,0,0.4)',
  },
  wPencilWood: {
    width: 10, height: 6,
    backgroundColor: '#C8905A',
  },
  wPencilTip: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderTopColor: P.pencilTip,
  },
  // Mirrors the notebook ruled line exactly when idle
  // Thickens + colors on completion or error
  inputLine: {
    marginTop: 0,
    borderRadius: 0,   // flat, like a ruled line — no capsule
  },
  errNote: { color: P.stopRed, fontSize: 15, marginTop: 3, fontStyle: 'italic' },
  hintUsedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  hintUsedTxt: { color: P.amber, fontSize: 15 },

  // ── Stamp ──
  stampArea: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    alignItems: 'center', paddingTop: 8, paddingHorizontal: 16,
    backgroundColor: P.paper,
    borderTopWidth: 1, borderTopColor: P.paperLine + '80',
    shadowColor: 'rgba(50,35,10,0.1)',
    shadowOffset: { width: 0, height: -2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 4,
  },
  stampHint: { color: P.inkFaint, fontSize: 13, fontStyle: 'italic', marginBottom: 8, textAlign: 'center' },
  stampRing: {
    borderRadius: 14, borderWidth: 2.5, borderColor: P.stopRed,
    padding: 3, backgroundColor: P.stopRedBg,
    shadowColor: P.stopRed, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55, shadowRadius: 12, elevation: 8,
  },
  stampRingOff: { borderColor: P.paperLine, shadowOpacity: 0, backgroundColor: P.paperDark },
  stampBody: {
    borderRadius: 11, paddingVertical: 14, paddingHorizontal: 44,
    backgroundColor: P.stopRed, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  stampBodyOff: { backgroundColor: P.paperDeep },
  stampInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stampTxt: { color: '#FFF', fontSize: 22, letterSpacing: 1.5 },

  // ── Modals ──
  backdrop: {
    flex: 1, backgroundColor: 'rgba(24,16,6,0.65)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: P.paper, borderRadius: 14, padding: 22,
    width: '100%', maxWidth: 320,
    borderWidth: 2, borderColor: P.paperLine,
    shadowColor: P.ink, shadowOffset: { width: 4, height: 5 }, shadowOpacity: 0.2, shadowRadius: 0, elevation: 6,
    transform: [{ rotate: '-0.5deg' }],
  },
  modalIconWrap: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#FFEAEA', alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 12, borderWidth: 2, borderColor: '#E09090',
  },
  modalTitle: { color: P.ink, fontSize: 25, textAlign: 'center', marginBottom: 6 },
  modalBody: { color: P.inkMed, fontSize: 17, textAlign: 'center', lineHeight: 22, marginBottom: 18 },
  modalRow: { flexDirection: 'row', gap: 10 },
  mBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1.5 },
  mBtnSec: { backgroundColor: P.paperDark, borderColor: P.paperLine },
  mBtnSecTxt: { color: P.inkMed, fontSize: 18 },
  mBtnRed: { backgroundColor: P.stopRed, borderColor: '#901010' },
  mBtnAmber: { backgroundColor: P.amber, borderColor: '#906010' },
  mBtnLightTxt: { color: '#FFF', fontSize: 18 },
  mBtnGhost: { marginTop: 10, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, borderColor: P.amber, alignItems: 'center' },
  mBtnGhostTxt: { color: P.amber, fontSize: 17 },

  // ── Letter reveal overlay ──
  revealOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgb(24,16,6)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 100,
    elevation: 100,
  },
  revealCard: {
    backgroundColor: P.paper,
    borderRadius: 24,
    paddingHorizontal: 40, paddingVertical: 36,
    alignItems: 'center',
    borderWidth: 2.5, borderColor: P.paperDeep,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 20, elevation: 12,
    minWidth: 240,
  },
  revealLabel: {
    color: P.inkMed, fontSize: 18, textAlign: 'center', marginBottom: 20,
  },
  revealTileWrap: {
    width: 110, height: 110, borderRadius: 18,
    backgroundColor: P.sticky,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: P.stickyDark,
    shadowColor: P.stickyDark, shadowOffset: { width: 3, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 0, elevation: 6,
    marginBottom: 28,
  },
  revealTile: {
    fontSize: 72, color: P.ink, lineHeight: 80,
  },
  revealStopBtn: {
    backgroundColor: '#2D7A2D',
    borderRadius: 50, paddingVertical: 13, paddingHorizontal: 56,
    borderWidth: 2, borderColor: '#1A5A1A',
    shadowColor: '#2D7A2D', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 8, elevation: 6,
  },
  revealStopTxt: { color: '#FFF', fontSize: 20, letterSpacing: 1 },

  // ── Used letters display ──
  usedLettersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
    marginTop: 20,
    paddingHorizontal: 8,
  },
  usedLetterChar: {
    fontSize: 15,
    color: P.inkMed,
    letterSpacing: 1,
  },
  usedLetterStruck: {
    textDecorationLine: 'line-through',
    opacity: 0.35,
    color: P.inkFaint,
  },
});
