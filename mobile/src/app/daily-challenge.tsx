import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, KeyboardAvoidingView, Platform, Modal, ActivityIndicator, Share, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import {
  Clock,
  User,
  MapPin,
  Cat,
  Box,
  Trophy,
  Apple,
  ShoppingBag,
  Check,
  LogOut,
  X,
  HeartPulse,
  Gamepad2,
  Globe,
  Film,
  Music,
  Briefcase,
  Utensils,
  Landmark,
  Zap,
  ChevronLeft,
  Share2,
  Home,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Sounds } from '@/lib/sounds';
import { dismissDailyBadge } from '@/lib/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGameStore, CategoryType } from '@/lib/state/game-store';
import { validateWithFallback } from '@/lib/word-validation';
import type { DailyChallenge, DailyChallengeAnswer, DailyChallengeResult } from '@/lib/daily-challenge-types';
import { calculateAnswerScore, SPEED_BONUS_THRESHOLD_MS, getTodayDateString, generateShareMessage } from '@/lib/daily-challenge-types';
import { supabase, type DbDailyChallengeScore } from '@/lib/supabase';
import { CAT_COLORS } from '@/lib/category-colors';

const BACKEND_URL = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL || 'http://localhost:3000';

const CATEGORY_ICONS: Record<CategoryType, React.ReactNode> = {
  names:              <User size={18} color={CAT_COLORS.names.accent} />,
  places:             <MapPin size={18} color={CAT_COLORS.places.accent} />,
  animal:             <Cat size={18} color={CAT_COLORS.animal.accent} />,
  thing:              <Box size={18} color={CAT_COLORS.thing.accent} />,
  sports_games:       <Gamepad2 size={18} color={CAT_COLORS.sports_games.accent} />,
  brands:             <ShoppingBag size={18} color={CAT_COLORS.brands.accent} />,
  health_issues:      <HeartPulse size={18} color={CAT_COLORS.health_issues.accent} />,
  countries:          <Globe size={18} color={CAT_COLORS.countries.accent} />,
  professions:        <Briefcase size={18} color={CAT_COLORS.professions.accent} />,
  food_dishes:        <Utensils size={18} color={CAT_COLORS.food_dishes.accent} />,
  historical_figures: <Landmark size={18} color={CAT_COLORS.historical_figures.accent} />,
  fruits_vegetables:  <Apple size={18} color={CAT_COLORS.fruits_vegetables.accent} />,
};

const CATEGORY_COLORS: Record<CategoryType, { bg: string; border: string; accent: string }> = Object.fromEntries(
  Object.entries(CAT_COLORS).map(([k, v]) => {
    const hex = v.accent.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return [k, {
      bg:     `rgba(${r},${g},${b},0.12)`,
      border: `rgba(${r},${g},${b},0.30)`,
      accent: v.accent,
    }];
  })
) as Record<CategoryType, { bg: string; border: string; accent: string }>;

const CATEGORY_NAMES: Record<CategoryType, string> = {
  names: 'Names',
  places: 'Places',
  animal: 'Animal',
  thing: 'Thing',
  sports_games: 'Sports & Games',
  brands: 'Brands',
  health_issues: 'Health Issues',
  countries: 'Countries',
  professions: 'Professions',
  food_dishes: 'Food & Dishes',
  historical_figures: 'Historical Figures',
  fruits_vegetables: 'Fruits & Vegetables',
};

type GamePhase = 'loading' | 'playing' | 'results' | 'already_completed';

export default function DailyChallengeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentUser = useGameStore((s) => s.currentUser);

  const [phase, setPhase] = useState<GamePhase>('loading');
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [result, setResult] = useState<DailyChallengeResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
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
  const [leaderboard, setLeaderboard] = useState<DbDailyChallengeScore[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [myLeaderboardEntry, setMyLeaderboardEntry] = useState<(DbDailyChallengeScore & { rank: number }) | null>(null);
  const [streak, setStreak] = useState(0);
  const [history, setHistory] = useState<Array<{ date: string; score: number; correct: number; speedBonuses: number; grid: string }>>([]);

  // Game state
  const [answers, setAnswers] = useState<Record<CategoryType, string>>({} as Record<CategoryType, string>);
  const [categoryStartTimes, setCategoryStartTimes] = useState<Record<CategoryType, number>>({} as Record<CategoryType, number>);
  const [answerTimes, setAnswerTimes] = useState<Record<CategoryType, number>>({} as Record<CategoryType, number>);
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Animation values
  const trophyScale = useSharedValue(0);
  const confettiOpacity = useSharedValue(0);

  // Load challenge and check if already completed
  useEffect(() => {
    const loadChallenge = async () => {
      try {
        // Fetch today's challenge
        const response = await fetch(`${BACKEND_URL}/api/daily-challenge`);
        if (!response.ok) throw new Error('Failed to fetch challenge');

        const challengeData: DailyChallenge = await response.json();
        setChallenge(challengeData);

        // Check if already completed
        const storedResult = await AsyncStorage.getItem(`daily_challenge_result_${challengeData.date}`);
        // Calculate streak (count consecutive past days with saved results)
        const calcStreak = async (todayDate: string) => {
          let count = 0;
          let d = new Date(todayDate);
          for (let i = 0; i < 365; i++) {
            const dateStr = d.toISOString().split('T')[0];
            const stored = await AsyncStorage.getItem(`daily_challenge_result_${dateStr}`);
            if (!stored) break;
            count++;
            d.setDate(d.getDate() - 1);
          }
          setStreak(count);
        };

        // Load past results (last 30 days, excluding today)
        const loadHistory = async (todayDate: string) => {
          const items: Array<{ date: string; score: number; correct: number; speedBonuses: number; grid: string }> = [];
          const today = new Date(todayDate);
          for (let i = 1; i <= 30 && items.length < 14; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const stored = await AsyncStorage.getItem(`daily_challenge_result_${dateStr}`);
            if (stored) {
              const r: DailyChallengeResult = JSON.parse(stored);
              const grid = r.answers.map(a => !a.isValid ? '❌' : a.hasSpeedBonus ? '⚡' : '✅').join('');
              items.push({
                date: dateStr,
                score: r.totalScore,
                correct: r.answers.filter(a => a.isValid).length,
                speedBonuses: r.answers.filter(a => a.hasSpeedBonus).length,
                grid,
              });
            }
          }
          setHistory(items);
        };

        if (storedResult) {
          setResult(JSON.parse(storedResult));
          setPhase('already_completed');
          fetchLeaderboard(challengeData.date);
          calcStreak(challengeData.date);
          loadHistory(challengeData.date);
          return;
        }

        // Start the game immediately
        const initialAnswers: Record<CategoryType, string> = {} as Record<CategoryType, string>;
        challengeData.categories.forEach((category) => {
          initialAnswers[category] = challengeData.letter;
        });
        setAnswers(initialAnswers);
        setGameStartTime(Date.now());
        setPhase('playing');
        Sounds.startBackground('daily_challenge');
      } catch (err) {
        console.error('Error loading challenge:', err);
      }
    };

    loadChallenge();
    dismissDailyBadge(); // Clear badge when user opens daily challenge

    // Stop background music when leaving daily challenge screen
    return () => { Sounds.stopBackground(); };
  }, []);

  // Game timer
  useEffect(() => {
    if (phase !== 'playing' || !gameStartTime) return;

    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - gameStartTime) / 1000));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, gameStartTime]);

  // Results animations
  useEffect(() => {
    if (phase === 'results' || phase === 'already_completed') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Sounds.success();
      trophyScale.value = withDelay(300, withSpring(1, { damping: 8, stiffness: 100 }));
      confettiOpacity.value = withDelay(
        500,
        withRepeat(withSequence(withTiming(1, { duration: 1000 }), withTiming(0.5, { duration: 1000 })), -1, true)
      );
    }
  }, [phase]);

  const trophyAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: trophyScale.value }],
  }));

  const confettiStyle = useAnimatedStyle(() => ({
    opacity: confettiOpacity.value,
  }));

  const lastTypeSoundAt = useRef<number>(0);

  const handleAnswerChange = (category: CategoryType, text: string) => {
    if (!challenge) return;

    const upper = text.toUpperCase();
    // Prevent removing or overwriting the starting letter
    if (!upper.startsWith(challenge.letter.toUpperCase())) return;

    // Start timing when user starts typing (beyond just the letter)
    if (upper.length > challenge.letter.length && !categoryStartTimes[category]) {
      setCategoryStartTimes(prev => ({
        ...prev,
        [category]: Date.now(),
      }));
    }

    setAnswers(prev => ({
      ...prev,
      [category]: upper,
    }));

    // Pencil typing sound throttled to feel natural
    const now = Date.now();
    if (now - lastTypeSoundAt.current > 110) {
      lastTypeSoundAt.current = now;
      Sounds.pencilTyping();
    }
  };

  const handleAnswerComplete = (category: CategoryType) => {
    if (categoryStartTimes[category] && !answerTimes[category]) {
      const timeTaken = Date.now() - categoryStartTimes[category];
      setAnswerTimes(prev => ({
        ...prev,
        [category]: timeTaken,
      }));
    }
  };

  const allAnswersFilled = challenge?.categories.every((category) => {
    const answer = answers[category]?.trim();
    if (!answer || answer.length <= challenge.letter.length) return false;
    return answer.toLowerCase().startsWith(challenge.letter.toLowerCase());
  }) ?? false;

  const handleSubmit = async () => {
    if (!challenge || isSubmitting) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Sounds.roundEnd();
    setIsSubmitting(true);

    try {
      const totalTimeMs = gameStartTime ? Date.now() - gameStartTime : 0;

      // Validate all answers
      const validationPromises = challenge.categories.map(async (category) => {
        const answer = answers[category]?.trim() || '';
        const timeTaken = answerTimes[category] || (categoryStartTimes[category] ? Date.now() - categoryStartTimes[category] : totalTimeMs);

        if (!answer || answer.length <= challenge.letter.length) {
          return {
            category,
            letter: challenge.letter,
            answer: '',
            isValid: false,
            score: 0,
            timeMs: timeTaken,
            hasSpeedBonus: false,
          } as DailyChallengeAnswer;
        }

        const validation = await validateWithFallback(answer, challenge.letter, category);
        const { score, hasSpeedBonus } = calculateAnswerScore(validation.isValid, timeTaken);

        return {
          category,
          letter: challenge.letter,
          answer,
          isValid: validation.isValid,
          score,
          timeMs: timeTaken,
          hasSpeedBonus,
        } as DailyChallengeAnswer;
      });

      const validatedAnswers = await Promise.all(validationPromises);
      const totalScore = validatedAnswers.reduce((sum, a) => sum + a.score, 0);

      const username = currentUser?.username ?? 'Guest';

      // Generate share code (only if user is logged in)
      let shareCode = '';
      if (currentUser) {
        try {
          const shareCodeResponse = await fetch(`${BACKEND_URL}/api/daily-challenge/generate-share-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              challengeId: challenge.id,
              username,
            }),
          });
          if (shareCodeResponse.ok) {
            const data = await shareCodeResponse.json();
            shareCode = data.shareCode;
          }
        } catch (e) {
          console.log('Failed to generate share code:', e);
        }
      }

      const newResult: DailyChallengeResult = {
        id: `result-${Date.now()}`,
        challengeId: challenge.id,
        date: challenge.date,
        username,
        answers: validatedAnswers,
        totalScore,
        totalTimeMs,
        completedAt: Date.now(),
        shareCode,
      };

      // Save result locally
      await AsyncStorage.setItem(`daily_challenge_result_${challenge.date}`, JSON.stringify(newResult));
      await AsyncStorage.setItem(`daily_challenge_data_${challenge.date}`, JSON.stringify(challenge));

      // Submit to global Supabase leaderboard (non-blocking, best effort, only if logged in)
      if (currentUser) {
        const correctCount = validatedAnswers.filter(a => a.isValid).length;
        supabase
          .from('daily_challenge_scores')
          .upsert(
            {
              challenge_date: challenge.date,
              username,
              total_score: totalScore,
              total_time_ms: totalTimeMs,
              correct_count: correctCount,
              completed_at: Date.now(),
            },
            { onConflict: 'challenge_date,username' }
          )
          .then(() => { /* ignore errors — leaderboard is best-effort */ });
      }

      setResult(newResult);
      setPhase('results');
      fetchLeaderboard(challenge.date);
      // Recalculate streak now that today is complete
      let streakCount = 0;
      let d2 = new Date(challenge.date);
      for (let i = 0; i < 365; i++) {
        const dateStr = d2.toISOString().split('T')[0];
        const stored = await AsyncStorage.getItem(`daily_challenge_result_${dateStr}`);
        if (!stored && dateStr !== challenge.date) break;
        if (stored || dateStr === challenge.date) streakCount++;
        d2.setDate(d2.getDate() - 1);
      }
      setStreak(streakCount);
      // Load past results for the history section
      const histItems: typeof history = [];
      const hToday = new Date(challenge.date);
      for (let i = 1; i <= 30 && histItems.length < 14; i++) {
        const hd = new Date(hToday);
        hd.setDate(hToday.getDate() - i);
        const hDateStr = hd.toISOString().split('T')[0];
        const hStored = await AsyncStorage.getItem(`daily_challenge_result_${hDateStr}`);
        if (hStored) {
          const hr: DailyChallengeResult = JSON.parse(hStored);
          histItems.push({
            date: hDateStr,
            score: hr.totalScore,
            correct: hr.answers.filter(a => a.isValid).length,
            speedBonuses: hr.answers.filter(a => a.hasSpeedBonus).length,
            grid: hr.answers.map(a => !a.isValid ? '❌' : a.hasSpeedBonus ? '⚡' : '✅').join(''),
          });
        }
      }
      setHistory(histItems);
    } catch (error) {
      console.error('Error submitting challenge:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchLeaderboard = async (date: string) => {
    setLeaderboardLoading(true);
    try {
      const { data, error } = await supabase
        .from('daily_challenge_scores')
        .select('username, total_score, total_time_ms, correct_count, completed_at')
        .eq('challenge_date', date)
        .order('total_score', { ascending: false })
        .order('total_time_ms', { ascending: true })
        .limit(20);

      if (!error && data) {
        const entries = data as DbDailyChallengeScore[];
        setLeaderboard(entries);

        // If user is not in the top 20, fetch their own score + rank
        const username = currentUser?.username;
        const inTop = entries.some(e => e.username === username);
        if (username && !inTop) {
          const [{ data: myRow }, { count }] = await Promise.all([
            supabase
              .from('daily_challenge_scores')
              .select('username, total_score, total_time_ms, correct_count, completed_at')
              .eq('challenge_date', date)
              .eq('username', username)
              .single(),
            supabase
              .from('daily_challenge_scores')
              .select('*', { count: 'exact', head: true })
              .eq('challenge_date', date)
              .or(`total_score.gt.${entries[entries.length - 1]?.total_score ?? 0},and(total_score.eq.${entries[entries.length - 1]?.total_score ?? 0},total_time_ms.lt.${entries[entries.length - 1]?.total_time_ms ?? 0})`),
          ]);
          if (myRow) {
            setMyLeaderboardEntry({ ...(myRow as DbDailyChallengeScore), rank: (count ?? 20) + 1 });
          } else {
            setMyLeaderboardEntry(null);
          }
        } else {
          setMyLeaderboardEntry(null);
        }
      }
    } catch {
      // Silently ignore leaderboard fetch errors
    } finally {
      setLeaderboardLoading(false);
    }
  };

  const handleShare = async () => {
    if (!result || !challenge) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const shareMessage = generateShareMessage(result, challenge);

    // On web, try the Web Share API first (only works with user gesture and HTTPS)
    if (Platform.OS === 'web') {
      // Check if Web Share API is available and we're in a secure context
      if (typeof navigator !== 'undefined' && navigator.share && window.isSecureContext) {
        try {
          await navigator.share({
            title: 'NPAT Daily Challenge',
            text: shareMessage,
          });
          return;
        } catch (error: any) {
          // User cancelled or share failed - fall through to clipboard
          if (error?.name !== 'AbortError') {
            console.log('Web Share failed, using clipboard:', error);
          } else {
            // User cancelled, don't show clipboard fallback
            return;
          }
        }
      }
      // Fallback to clipboard for web
      try {
        await Clipboard.setStringAsync(shareMessage);
        Alert.alert('Copied!', 'Results copied to clipboard.');
      } catch (error) {
        console.error('Error copying to clipboard:', error);
      }
      return;
    }

    // Native platforms - use Share API
    try {
      await Share.share({ message: shareMessage });
    } catch (error) {
      console.error('Error sharing:', error);
      // Fallback to clipboard on native too if share fails
      try {
        await Clipboard.setStringAsync(shareMessage);
        Alert.alert('Copied!', 'Results copied to clipboard.');
      } catch (clipError) {
        console.error('Error copying to clipboard:', clipError);
      }
    }
  };

  const handleGoHome = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/');
  };

  const handleExit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowExitModal(false);
    router.back();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimeMs = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  };

  // Loading state
  if (phase === 'loading' || !challenge) {
    return (
      <View className="flex-1">
        <LinearGradient
          colors={['#0D1F0D', '#1C3A1C', '#0D1F0D']}
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
        >
          <ActivityIndicator size="large" color="#4ADE80" />
          <Text style={{ color: 'rgba(74,222,128,0.6)', marginTop: 16 }}>Loading today's challenge...</Text>
        </LinearGradient>
      </View>
    );
  }

  // Results state (both new results and already completed)
  if (phase === 'results' || phase === 'already_completed') {
    const correctCount = result?.answers.filter(a => a.isValid).length ?? 0;
    const speedBonusCount = result?.answers.filter(a => a.hasSpeedBonus).length ?? 0;

    return (
      <View className="flex-1">
        <LinearGradient
          colors={['#0D1F0D', '#1C3A1C', '#0D1F0D']}
          style={{ flex: 1 }}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={{ paddingTop: insets.top }} className="flex-1">
            {/* Confetti */}
            <Animated.View style={[confettiStyle, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]}>
              <View className="absolute top-20 left-10"><Sparkles size={24} color="#4ADE80" /></View>
              <View className="absolute top-32 right-8"><Sparkles size={20} color="#86EFAC" /></View>
              <View className="absolute top-48 left-6"><Sparkles size={16} color="#D4A84B" /></View>
            </Animated.View>

            <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingBottom: 20 }}>
              {/* Header */}
              <Animated.View entering={FadeInDown.duration(500)} className="items-center pt-4 pb-2">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <View style={{ height: 2, flex: 1, backgroundColor: '#4ADE8040' }} />
                  <Text style={{ color: '#4ADE80', fontSize: 11, fontWeight: '800', letterSpacing: 3, textTransform: 'uppercase' }}>
                    {phase === 'already_completed' ? "Today's Result" : 'Challenge Complete'}
                  </Text>
                  <View style={{ height: 2, flex: 1, backgroundColor: '#4ADE8040' }} />
                </View>
                <Text style={{ color: '#E8FFE8', fontSize: 28, fontWeight: '900', textAlign: 'center' }}>
                  {phase === 'already_completed' ? 'Already Played Today!' : 'Well done! 🎉'}
                </Text>
              </Animated.View>

              {/* Trophy & Score */}
              <Animated.View entering={FadeInUp.duration(600).delay(200)} className="items-center mb-6">
                <Animated.View style={trophyAnimStyle}>
                  <LinearGradient
                    colors={['#2A5A2A', '#3A8A3A', '#2A5A2A']}
                    style={{
                      width: 96, height: 96, borderRadius: 24,
                      justifyContent: 'center', alignItems: 'center',
                      borderWidth: 2, borderColor: '#4ADE80',
                    }}
                  >
                    <Trophy size={48} color="#4ADE80" />
                  </LinearGradient>
                </Animated.View>
                <Text style={{ color: '#E8FFE8', fontSize: 56, fontWeight: '900', marginTop: 12, lineHeight: 60 }}>{result?.totalScore}</Text>
                <Text style={{ color: '#4ADE8080', fontSize: 14 }}>points today</Text>
                {streak > 0 && (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10,
                    backgroundColor: 'rgba(251,146,60,0.15)', paddingHorizontal: 14, paddingVertical: 6,
                    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(251,146,60,0.35)',
                  }}>
                    <Text style={{ fontSize: 16 }}>🔥</Text>
                    <Text style={{ color: '#fb923c', fontSize: 14, fontWeight: '900' }}>
                      {streak} day streak{streak === 1 ? '' : '!'}
                    </Text>
                  </View>
                )}

                {/* Stats row */}
                <View style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 20, marginTop: 16,
                  backgroundColor: 'rgba(74,222,128,0.08)',
                  paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20,
                  borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)',
                }}>
                  <View className="items-center">
                    <View className="flex-row items-center gap-1">
                      <Check size={16} color="#4ADE80" strokeWidth={2.5} />
                      <Text style={{ color: '#E8FFE8', fontWeight: '800', fontSize: 16 }}>{correctCount}/6</Text>
                    </View>
                    <Text style={{ color: 'rgba(74,222,128,0.5)', fontSize: 11, marginTop: 2 }}>Correct</Text>
                  </View>
                  <View style={{ width: 1, height: 32, backgroundColor: 'rgba(74,222,128,0.2)' }} />
                  <View className="items-center">
                    <View className="flex-row items-center gap-1">
                      <Zap size={16} color="#D4A84B" strokeWidth={2.5} />
                      <Text style={{ color: '#E8FFE8', fontWeight: '800', fontSize: 16 }}>{speedBonusCount}</Text>
                    </View>
                    <Text style={{ color: 'rgba(74,222,128,0.5)', fontSize: 11, marginTop: 2 }}>Speed Bonus</Text>
                  </View>
                  <View style={{ width: 1, height: 32, backgroundColor: 'rgba(74,222,128,0.2)' }} />
                  <View className="items-center">
                    <View className="flex-row items-center gap-1">
                      <Clock size={16} color="#86EFAC" strokeWidth={2.5} />
                      <Text style={{ color: '#E8FFE8', fontWeight: '800', fontSize: 16 }}>{formatTimeMs(result?.totalTimeMs ?? 0)}</Text>
                    </View>
                    <Text style={{ color: 'rgba(74,222,128,0.5)', fontSize: 11, marginTop: 2 }}>Total Time</Text>
                  </View>
                </View>
              </Animated.View>

              {/* Answer Details */}
              <Animated.View entering={FadeIn.duration(400).delay(500)} className="mb-4">
                <Text style={{ color: 'rgba(74,222,128,0.6)', fontSize: 12, textAlign: 'center', marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '700' }}>
                  Your Answers · Letter "{challenge.letter}"
                </Text>
                <View style={{ backgroundColor: 'rgba(74,222,128,0.05)', borderRadius: 16, padding: 10, borderWidth: 1, borderColor: 'rgba(74,222,128,0.12)' }}>
                  {result?.answers.map((answer, index) => {
                    const colors = CATEGORY_COLORS[answer.category] ?? { bg: 'rgba(100,180,255,0.12)', border: 'rgba(100,180,255,0.30)', accent: '#60a5fa' };
                    const isEmptyAnswer = !answer.answer || answer.answer.length <= challenge.letter.length;

                    return (
                      <Animated.View
                        key={answer.category}
                        entering={FadeIn.duration(300).delay(600 + index * 80)}
                        style={{
                          flexDirection: 'row', alignItems: 'center',
                          padding: 12, borderRadius: 12, marginBottom: 8,
                          backgroundColor: 'rgba(255,255,255,0.04)',
                          borderWidth: 1, borderColor: 'rgba(74,222,128,0.1)',
                        }}
                      >
                        <View style={{
                          width: 40, height: 40, borderRadius: 10,
                          alignItems: 'center', justifyContent: 'center',
                          marginRight: 12, backgroundColor: `${colors.accent}20`,
                        }}>
                          {CATEGORY_ICONS[answer.category]}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: 'rgba(74,222,128,0.5)', fontSize: 11 }}>{CATEGORY_NAMES[answer.category] ?? answer.category.replace(/_/g, ' ')}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ color: isEmptyAnswer ? 'rgba(255,255,255,0.25)' : '#E8FFE8', fontSize: 15, fontWeight: '700', fontStyle: isEmptyAnswer ? 'italic' : 'normal' }} numberOfLines={1}>
                              {isEmptyAnswer ? 'No answer' : answer.answer}
                            </Text>
                            {answer.hasSpeedBonus && (
                              <View style={{ backgroundColor: 'rgba(251,191,36,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 2, borderWidth: 1, borderColor: 'rgba(251,191,36,0.5)' }}>
                                <Zap size={9} color="#fbbf24" fill="#fbbf24" strokeWidth={0} />
                                <Text style={{ color: '#fbbf24', fontSize: 10, fontWeight: '900' }}>+2</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={{
                            width: 28, height: 28, borderRadius: 14,
                            alignItems: 'center', justifyContent: 'center',
                            backgroundColor: answer.isValid ? '#4ADE80' : 'rgba(255,107,107,0.4)',
                          }}>
                            {answer.isValid
                              ? <Check size={16} color="#0D1F0D" strokeWidth={3} />
                              : <X size={16} color="#fff" strokeWidth={3} />
                            }
                          </View>
                          <Text style={{ color: answer.score > 0 ? '#4ADE80' : 'rgba(255,255,255,0.2)', fontWeight: '800', fontSize: 18 }}>
                            +{answer.score}
                          </Text>
                        </View>
                      </Animated.View>
                    );
                  })}
                </View>
              </Animated.View>

              {/* Leaderboard */}
              <Animated.View entering={FadeInUp.duration(500).delay(900)} style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Trophy size={16} color="#4ADE80" strokeWidth={2.5} />
                  <Text style={{ color: '#4ADE80', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 }}>Today's Leaderboard</Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(74,222,128,0.15)' }} />
                  <Globe size={13} color="rgba(74,222,128,0.45)" strokeWidth={2} />
                </View>
                <View style={{ backgroundColor: 'rgba(74,222,128,0.05)', borderRadius: 16, padding: 10, borderWidth: 1, borderColor: 'rgba(74,222,128,0.12)' }}>
                  {leaderboardLoading ? (
                    <View style={{ alignItems: 'center', paddingVertical: 18 }}>
                      <ActivityIndicator size="small" color="#4ADE80" />
                      <Text style={{ color: 'rgba(74,222,128,0.4)', fontSize: 12, marginTop: 6 }}>Loading scores…</Text>
                    </View>
                  ) : leaderboard.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 18 }}>
                      <Text style={{ color: 'rgba(74,222,128,0.35)', fontSize: 13 }}>No scores yet — you might be first!</Text>
                    </View>
                  ) : (
                    <>
                      {leaderboard.map((entry, idx) => {
                        const isMe = entry.username === currentUser?.username;
                        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                        const timeSec = (entry.total_time_ms / 1000).toFixed(1);
                        return (
                          <View
                            key={`${entry.username}-${idx}`}
                            style={{
                              flexDirection: 'row', alignItems: 'center',
                              paddingVertical: 9, paddingHorizontal: 10, borderRadius: 10, marginBottom: 4,
                              backgroundColor: isMe ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.03)',
                              borderWidth: isMe ? 1 : 0, borderColor: 'rgba(74,222,128,0.35)',
                            }}
                          >
                            <View style={{ width: 28, alignItems: 'center' }}>
                              {medal
                                ? <Text style={{ fontSize: 15 }}>{medal}</Text>
                                : <Text style={{ color: 'rgba(74,222,128,0.35)', fontSize: 12, fontWeight: '700' }}>#{idx + 1}</Text>
                              }
                            </View>
                            <Text
                              style={{ flex: 1, color: isMe ? '#4ADE80' : '#E8FFE8', fontSize: 13, fontWeight: isMe ? '900' : '600', marginLeft: 6 }}
                              numberOfLines={1}
                            >
                              {entry.username}{isMe ? ' (you)' : ''}
                            </Text>
                            <Text style={{ color: 'rgba(74,222,128,0.45)', fontSize: 11, marginRight: 10 }}>{timeSec}s</Text>
                            <View style={{ backgroundColor: 'rgba(74,222,128,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                              <Text style={{ color: '#4ADE80', fontSize: 13, fontWeight: '900' }}>{entry.total_score}</Text>
                            </View>
                          </View>
                        );
                      })}
                      {/* User's own score when outside top 20 */}
                      {myLeaderboardEntry && (
                        <>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 6 }}>
                            <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(74,222,128,0.1)' }} />
                            <Text style={{ color: 'rgba(74,222,128,0.3)', fontSize: 10, fontWeight: '700' }}>YOUR RANK</Text>
                            <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(74,222,128,0.1)' }} />
                          </View>
                          <View style={{
                            flexDirection: 'row', alignItems: 'center',
                            paddingVertical: 9, paddingHorizontal: 10, borderRadius: 10,
                            backgroundColor: 'rgba(74,222,128,0.12)',
                            borderWidth: 1, borderColor: 'rgba(74,222,128,0.35)',
                          }}>
                            <View style={{ width: 28, alignItems: 'center' }}>
                              <Text style={{ color: 'rgba(74,222,128,0.5)', fontSize: 12, fontWeight: '700' }}>#{myLeaderboardEntry.rank}</Text>
                            </View>
                            <Text style={{ flex: 1, color: '#4ADE80', fontSize: 13, fontWeight: '900', marginLeft: 6 }} numberOfLines={1}>
                              {myLeaderboardEntry.username} (you)
                            </Text>
                            <Text style={{ color: 'rgba(74,222,128,0.45)', fontSize: 11, marginRight: 10 }}>
                              {(myLeaderboardEntry.total_time_ms / 1000).toFixed(1)}s
                            </Text>
                            <View style={{ backgroundColor: 'rgba(74,222,128,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                              <Text style={{ color: '#4ADE80', fontSize: 13, fontWeight: '900' }}>{myLeaderboardEntry.total_score}</Text>
                            </View>
                          </View>
                        </>
                      )}
                    </>
                  )}
                </View>
              </Animated.View>

              {/* My History */}
              {(result || history.length > 0) && (
                <Animated.View entering={FadeInUp.duration(400).delay(1000)} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <Clock size={15} color="#4ADE80" strokeWidth={2.5} />
                    <Text style={{ color: '#4ADE80', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 }}>My History</Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(74,222,128,0.15)' }} />
                    {streak > 0 && (
                      <Text style={{ color: 'rgba(251,146,60,0.7)', fontSize: 11, fontWeight: '800' }}>🔥 {streak}-day streak</Text>
                    )}
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingRight: 4 }}
                    style={{ flexGrow: 0 }}
                  >
                    {/* Today's card first */}
                    {result && challenge && (
                      <View
                        key="today"
                        style={{
                          backgroundColor: 'rgba(74,222,128,0.13)',
                          borderRadius: 14, padding: 12, minWidth: 90,
                          borderWidth: 1.5, borderColor: 'rgba(74,222,128,0.4)',
                          alignItems: 'center', gap: 4,
                        }}
                      >
                        <Text style={{ color: '#4ADE80', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>TODAY</Text>
                        <Text style={{ color: '#E8FFE8', fontSize: 22, fontWeight: '900', lineHeight: 26 }}>{result.totalScore}</Text>
                        <Text style={{ color: 'rgba(74,222,128,0.55)', fontSize: 10 }}>{result.answers.filter(a => a.isValid).length}/6</Text>
                        <Text style={{ fontSize: 11, lineHeight: 14 }}>
                          {result.answers.map(a => !a.isValid ? '❌' : a.hasSpeedBonus ? '⚡' : '✅').join('')}
                        </Text>
                      </View>
                    )}
                    {/* Past days */}
                    {history.map((item) => {
                      const d = new Date(item.date + 'T12:00:00');
                      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      return (
                        <View
                          key={item.date}
                          style={{
                            backgroundColor: 'rgba(74,222,128,0.07)',
                            borderRadius: 14, padding: 12, minWidth: 90,
                            borderWidth: 1, borderColor: 'rgba(74,222,128,0.15)',
                            alignItems: 'center', gap: 4,
                          }}
                        >
                          <Text style={{ color: 'rgba(74,222,128,0.5)', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>{label}</Text>
                          <Text style={{ color: '#E8FFE8', fontSize: 22, fontWeight: '900', lineHeight: 26 }}>{item.score}</Text>
                          <Text style={{ color: 'rgba(74,222,128,0.55)', fontSize: 10 }}>{item.correct}/6</Text>
                          <Text style={{ fontSize: 11, lineHeight: 14 }}>{item.grid}</Text>
                        </View>
                      );
                    })}
                  </ScrollView>
                </Animated.View>
              )}

              {/* Actions */}
              <Animated.View entering={FadeInUp.duration(500).delay(800)} style={{ paddingBottom: insets.bottom + 16 }}>
                <Pressable onPress={handleShare} style={{ marginBottom: 10 }} className="active:scale-95">
                  <LinearGradient
                    colors={['#3A8A3A', '#4ADE80']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={{
                      borderRadius: 16, paddingVertical: 18,
                      shadowColor: '#4ADE80', shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                      <Share2 size={22} color="#0D1F0D" strokeWidth={2.5} />
                      <Text style={{ color: '#0D1F0D', fontWeight: '900', fontSize: 18 }}>Share Results</Text>
                    </View>
                  </LinearGradient>
                </Pressable>
                <Pressable onPress={handleGoHome} className="active:scale-95">
                  <View style={{
                    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
                    paddingVertical: 16, flexDirection: 'row', alignItems: 'center',
                    justifyContent: 'center', gap: 8,
                    borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)',
                  }}>
                    <Home size={20} color="#4ADE80" strokeWidth={2.5} />
                    <Text style={{ color: '#E8FFE8', fontWeight: '700', fontSize: 16 }}>Back to Home</Text>
                  </View>
                </Pressable>
                <Text style={{ color: 'rgba(74,222,128,0.35)', textAlign: 'center', fontSize: 12, marginTop: 14 }}>
                  Come back tomorrow for a new challenge!
                </Text>
              </Animated.View>
            </ScrollView>
          </View>
        </LinearGradient>
      </View>
    );
  }

  // Playing state
  return (
    <View className="flex-1">
      {/* Exit Modal */}
      <Modal visible={showExitModal} transparent animationType="fade" onRequestClose={() => setShowExitModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <View style={{
            backgroundColor: '#0D2A0D', borderRadius: 24, padding: 24, width: '100%', maxWidth: 360,
            borderWidth: 1.5, borderColor: 'rgba(74,222,128,0.2)',
          }}>
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,107,107,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <LogOut size={32} color="#FF6B6B" strokeWidth={2} />
              </View>
              <Text style={{ color: '#E8FFE8', fontSize: 20, fontWeight: '800', textAlign: 'center' }}>Quit Challenge?</Text>
              <Text style={{ color: 'rgba(74,222,128,0.5)', textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
                You only get one attempt per day.{'\n'}Your progress will be lost.
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <Pressable onPress={() => setShowExitModal(false)} style={{ flex: 1, backgroundColor: 'rgba(74,222,128,0.1)', paddingVertical: 16, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(74,222,128,0.25)' }}>
                <Text style={{ color: '#4ADE80', fontWeight: '700', textAlign: 'center' }}>Keep Playing</Text>
              </Pressable>
              <Pressable onPress={handleExit} style={{ flex: 1, backgroundColor: '#FF6B6B', paddingVertical: 16, borderRadius: 14 }}>
                <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>Quit</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <LinearGradient colors={['#0D1F0D', '#1C3A1C', '#0D2A0D']} style={{ flex: 1 }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        {/* Subtle top accent line */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: '#4ADE80' }} />

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1" keyboardVerticalOffset={0}>
          <View style={{ paddingTop: insets.top }} className="flex-1">
            {/* Header */}
            <Animated.View entering={FadeInDown.duration(400)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowExitModal(true); }}
                style={{ backgroundColor: 'rgba(74,222,128,0.1)', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)' }}
              >
                <X size={20} color="#4ADE80" strokeWidth={2.5} />
              </Pressable>

              {/* Letter Display — bold green badge */}
              <View style={{
                width: 60, height: 60, borderRadius: 16,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: '#4ADE80',
                shadowColor: '#4ADE80', shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.5, shadowRadius: 12, elevation: 10,
              }}>
                <Text style={{ color: '#0D1F0D', fontSize: 26, fontWeight: '900' }}>{challenge.letter}</Text>
              </View>

              {/* Timer + Sound toggle */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{
                  backgroundColor: 'rgba(74,222,128,0.1)', paddingHorizontal: 14, paddingVertical: 10,
                  borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
                  borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)',
                }}>
                  <Clock size={15} color="#4ADE80" strokeWidth={2.5} />
                  <Text style={{ color: '#4ADE80', fontWeight: '800', fontSize: 15 }}>{formatTime(elapsedTime)}</Text>
                </View>
                <Pressable onPress={toggleSound}
                  style={{ backgroundColor: 'rgba(74,222,128,0.1)', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)' }}>
                  {soundOn
                    ? <Volume2 size={18} color="#4ADE80" strokeWidth={2.5} />
                    : <VolumeX size={18} color="#4a7a4a" strokeWidth={2.5} />}
                </Pressable>
              </View>
            </Animated.View>

            {/* Speed Bonus Info */}
            <Animated.View entering={FadeInDown.duration(400).delay(100)} style={{ marginHorizontal: 16, marginBottom: 10 }}>
              <View style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                backgroundColor: 'rgba(212,168,75,0.12)', paddingHorizontal: 16, paddingVertical: 8,
                borderRadius: 12, borderWidth: 1, borderColor: 'rgba(212,168,75,0.25)',
              }}>
                <Zap size={13} color="#D4A84B" strokeWidth={2.5} />
                <Text style={{ color: '#D4A84B', fontSize: 12, fontWeight: '600' }}>
                  Answer within 5 seconds for <Text style={{ fontWeight: '900' }}>+2 bonus</Text> points
                </Text>
              </View>
            </Animated.View>

            {/* Sticky letter reminder — always visible above keyboard */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 16 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(74,222,128,0.12)' }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(74,222,128,0.08)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(74,222,128,0.2)' }}>
                <Text style={{ color: 'rgba(74,222,128,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>LETTER</Text>
                <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: '#4ADE80', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#0D1F0D', fontSize: 14, fontWeight: '900' }}>{challenge.letter}</Text>
                </View>
              </View>
              <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(74,222,128,0.12)' }} />
            </View>

            {/* Categories Input */}
            <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
              <Animated.View entering={FadeInUp.duration(500).delay(100)}>
                <Text style={{ color: 'rgba(74,222,128,0.5)', fontSize: 12, marginBottom: 12, textAlign: 'center', letterSpacing: 1, textTransform: 'uppercase', fontWeight: '700' }}>
                  Fill words starting with "{challenge.letter}"
                </Text>
              </Animated.View>

              <View className="gap-3">
                {challenge.categories.map((category, index) => {
                  const answer = answers[category] || '';
                  const startsWithLetter = answer.trim().toLowerCase().startsWith(challenge.letter.toLowerCase());
                  const hasAnswer = answer.trim().length > challenge.letter.length;
                  const colors = CATEGORY_COLORS[category] ?? { bg: 'rgba(100,180,255,0.12)', border: 'rgba(100,180,255,0.30)', accent: '#60a5fa' };
                  const startTime = categoryStartTimes[category];
                  const isWithinSpeedBonus = startTime && (Date.now() - startTime) <= SPEED_BONUS_THRESHOLD_MS;

                  return (
                    <Animated.View
                      key={category}
                      entering={FadeInUp.duration(400).delay(150 + index * 50)}
                      style={{
                        borderRadius: 14,
                        backgroundColor: 'rgba(255,255,255,0.04)',
                        borderWidth: 1.5,
                        borderColor: hasAnswer && startsWithLetter ? `${colors.accent}60` : 'rgba(74,222,128,0.15)',
                        flexDirection: 'row',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Left colored tab — mirrors single-player category rows */}
                      <View style={{ width: 5, backgroundColor: hasAnswer && startsWithLetter ? colors.accent : `${colors.accent}55` }} />

                      <View style={{ flex: 1, padding: 12 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <View style={{
                            width: 28, height: 28, borderRadius: 7,
                            alignItems: 'center', justifyContent: 'center',
                            backgroundColor: `${colors.accent}20`,
                          }}>
                            {CATEGORY_ICONS[category]}
                          </View>
                          <Text style={{ color: hasAnswer && startsWithLetter ? colors.accent : `${colors.accent}99`, fontWeight: '800', fontSize: 13, letterSpacing: 0.3 }}>{CATEGORY_NAMES[category] ?? category.replace(/_/g, ' ')}</Text>
                          {hasAnswer && startsWithLetter && (
                            <View style={{ marginLeft: 'auto', backgroundColor: 'rgba(74,222,128,0.15)', borderRadius: 8, padding: 4 }}>
                              <Check size={12} color="#4ADE80" strokeWidth={3} />
                            </View>
                          )}
                        </View>
                        <TextInput
                          style={{
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
                            color: hasAnswer && startsWithLetter ? '#E8FFE8' : 'rgba(232,255,232,0.75)',
                            fontSize: 22, fontWeight: '800',
                            borderWidth: 1,
                            borderColor: hasAnswer && startsWithLetter ? `${colors.accent}50` : 'rgba(255,255,255,0.06)',
                          }}
                          placeholder={`${challenge.letter}...`}
                          placeholderTextColor="rgba(255,255,255,0.18)"
                          value={answer}
                          onChangeText={(text) => handleAnswerChange(category, text)}
                          onBlur={() => handleAnswerComplete(category)}
                          autoCapitalize="characters"
                          autoCorrect={false}
                        />
                        {hasAnswer && !startsWithLetter && (
                          <Text style={{ color: '#fb923c', fontSize: 11, marginTop: 5 }}>Must start with "{challenge.letter}"</Text>
                        )}
                      </View>
                    </Animated.View>
                  );
                })}
              </View>

              {/* Submit Button */}
              <Animated.View entering={FadeInUp.duration(500).delay(400)} style={{ marginTop: 20, paddingHorizontal: 0 }}>
                <Pressable onPress={handleSubmit} disabled={!allAnswersFilled || isSubmitting} className="active:scale-95">
                  <LinearGradient
                    colors={allAnswersFilled && !isSubmitting ? ['#3A8A3A', '#4ADE80'] : ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.08)']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={{
                      borderRadius: 20, padding: 18,
                      shadowColor: allAnswersFilled && !isSubmitting ? '#4ADE80' : 'transparent',
                      shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 8,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                      {isSubmitting ? <ActivityIndicator color="#0D1F0D" /> : (
                        <>
                          <Check size={24} color={allAnswersFilled ? '#0D1F0D' : 'rgba(255,255,255,0.3)'} strokeWidth={2.5} />
                          <Text style={{ fontSize: 20, fontWeight: '900', color: allAnswersFilled ? '#0D1F0D' : 'rgba(255,255,255,0.3)' }}>
                            Submit Challenge
                          </Text>
                        </>
                      )}
                    </View>
                  </LinearGradient>
                </Pressable>
                {!allAnswersFilled && (
                  <Text style={{ color: 'rgba(74,222,128,0.35)', fontSize: 11, textAlign: 'center', marginTop: 6 }}>
                    Fill all categories with valid words to submit
                  </Text>
                )}
              </Animated.View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
}
