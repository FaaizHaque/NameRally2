import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StatusBar, ActivityIndicator, Modal, Pressable, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeIn, FadeInDown, ZoomIn, useSharedValue, withRepeat, withSequence, withTiming, useAnimatedStyle, Easing } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Users, Zap, Trophy, Pencil, CalendarDays, User, MapPin, Cat, Box, Gamepad2, ShoppingBag, HeartPulse, Globe, Briefcase, Utensils, Landmark, Apple } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useGameStore, type CategoryType } from '@/lib/state/game-store';
import { Sounds } from '@/lib/sounds';
import { getCategoryName } from '@/lib/word-validation';
import { CAT_COLORS } from '@/lib/category-colors';
import type { LevelData } from '@/lib/level-types';

const BACKEND_URL = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL || 'http://localhost:3000';

export default function GameModeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setGameMode = useGameStore((s) => s.setGameMode);
  const loadLevelProgress = useGameStore((s) => s.loadLevelProgress);
  const levelProgress = useGameStore((s) => s.levelProgress);
  const startLevelGame = useGameStore((s) => s.startLevelGame);
  const setSession = useGameStore((s) => s.setSession);
  const [levelLoaded, setLevelLoaded] = useState(false);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [showSpIntro, setShowSpIntro] = useState(false);

  // Novelty popup — fires BEFORE the game starts (on this screen)
  type NoveltyPopup = { type: string; title: string; message: string; category?: CategoryType; constraintType?: string };
  const [noveltyPopup, setNoveltyPopup] = useState<NoveltyPopup | null>(null);
  const pendingLevelData = useRef<LevelData | null>(null);
  const shownNovelties = useRef<Set<string>>(new Set());
  const noveltiesLoaded = useRef(false);
  const noveltyPulse = useSharedValue(1);
  const noveltyPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: noveltyPulse.value }],
    opacity: (2 - noveltyPulse.value),
  }));

  useEffect(() => {
    if (noveltyPopup) {
      noveltyPulse.value = 1;
      noveltyPulse.value = withRepeat(
        withSequence(withTiming(1.55, { duration: 900, easing: Easing.out(Easing.ease) }), withTiming(1, { duration: 600 })),
        -1, false,
      );
    } else {
      noveltyPulse.value = 1;
    }
  }, [!!noveltyPopup]);

  const markNoveltyShown = (key: string) => {
    shownNovelties.current.add(key);
    AsyncStorage.getItem('npat_seen_novelties_v2').then((raw) => {
      const existing: string[] = raw ? JSON.parse(raw) : [];
      if (!existing.includes(key)) {
        AsyncStorage.setItem('npat_seen_novelties_v2', JSON.stringify([...existing, key]));
      }
    }).catch(() => {});
  };

  function checkLevelNovelty(level: LevelData): NoveltyPopup | null {
    for (const cat of level.categories) {
      const catKey = `novelty_cat_${cat}`;
      if (!shownNovelties.current.has(catKey)) {
        markNoveltyShown(catKey);
        return {
          type: 'category',
          title: 'New Category Unlocked!',
          message: `${getCategoryName(cat as CategoryType)} joins the rally for the first time!`,
          category: cat as CategoryType,
        };
      }
    }
    if (level.constraint?.type && level.constraint.type !== 'none') {
      const cType = level.constraint.type;
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
        markNoveltyShown(constraintKey);
        const info = CONSTRAINT_INFO[cType] ?? { title: 'New Rule!', message: level.constraint.description };
        return { type: 'constraint', title: info.title, message: info.message, constraintType: cType };
      }
    }
    return null;
  }

  // Skeleton shimmer animation
  const shimmer = useSharedValue(0);
  const shimmerStyle = useAnimatedStyle(() => ({ opacity: 0.4 + shimmer.value * 0.4 }));

  // Clear any stale game session when this screen mounts (e.g. after exiting daily challenge,
  // single player, or multiplayer) so the game screen never flashes old content.
  const didClear = useRef(false);
  useEffect(() => {
    if (!didClear.current) {
      didClear.current = true;
      setSession(null);
    }
    shimmer.value = withRepeat(
      withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 700 })),
      -1, true
    );
    // Load seen novelties from AsyncStorage
    AsyncStorage.getItem('npat_seen_novelties_v2').then((raw) => {
      if (raw) {
        try { (JSON.parse(raw) as string[]).forEach((k) => shownNovelties.current.add(k)); } catch { /* ignore */ }
      }
      noveltiesLoaded.current = true;
    }).catch(() => { noveltiesLoaded.current = true; });
    loadLevelProgress().finally(() => setLevelLoaded(true));
  }, [loadLevelProgress]);

  const launchGame = useCallback(async (levelData: LevelData) => {
    setIsStartingGame(true);
    try {
      await startLevelGame(levelData);
      Sounds.navigate();
      router.push('/game');
    } catch (error: any) {
      console.error('Error starting level:', error?.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsStartingGame(false);
    }
  }, [startLevelGame, router]);

  const startGame = useCallback(async () => {
    setGameMode('single');
    setIsStartingGame(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/levels/${levelProgress.unlockedLevel}`);
      if (!response.ok) throw new Error('Failed to fetch level');
      const levelData: LevelData = await response.json();
      // Check for a first-time unlock popup before the game starts
      const novelty = checkLevelNovelty(levelData);
      if (novelty) {
        pendingLevelData.current = levelData;
        setIsStartingGame(false);
        setNoveltyPopup(novelty);
        return;
      }
      await launchGame(levelData);
    } catch (error: any) {
      console.error('Error starting level:', error?.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setIsStartingGame(false);
    }
  }, [levelProgress.unlockedLevel, setGameMode, launchGame]);

  const handleNoveltyDismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setNoveltyPopup(null);
    const data = pendingLevelData.current;
    pendingLevelData.current = null;
    if (data) launchGame(data);
  }, [launchGame]);

  const handleSinglePlayer = useCallback(async () => {
    if (isStartingGame || !levelLoaded) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Sounds.tap();
    const shown = await AsyncStorage.getItem('npat_sp_intro_shown');
    if (!shown) {
      setShowSpIntro(true);
      return; // startGame called from modal dismiss
    }
    startGame();
  }, [isStartingGame, levelLoaded, startGame]);

  const handleMultiplayer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Sounds.navigate();
    setGameMode('multiplayer');
    router.push('/multiplayer-options');
  };

  const handleDaily = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Sounds.tap();
    Sounds.navigate();
    router.push('/daily-challenge');
  };

  const handleCompletedLevels = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Sounds.tap();
    Sounds.navigate();
    router.push('/completed-levels');
  };

  const completedCount = Math.max(0, levelProgress.unlockedLevel - 1);
  // All 500 levels completed: unlockedLevel is capped at 500, but level 500 itself has a score
  const allLevelsCompleted = levelProgress.unlockedLevel >= 500 && !!levelProgress.levelScores[500];

  return (
    <View style={{ flex: 1, backgroundColor: '#1a2540' }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#1f2d50', '#253560', '#1a2845']}
        style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom + 16, paddingHorizontal: 16 }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, marginBottom: 14 }}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Sounds.tap();
              router.back();
            }}
            style={{
              width: 44, height: 44, borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.12)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ChevronLeft size={22} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900', marginLeft: 14, letterSpacing: 0.3 }}>
            Select Mode
          </Text>
        </View>

        {/* Cards — 3 equal flex boxes with even gap */}
        <View style={{ flex: 1, gap: 14 }}>

          {/* ── SINGLE PLAYER ── */}
          <Animated.View entering={FadeInDown.duration(400).delay(0)} style={{ flex: 1 }}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSinglePlayer}
              disabled={isStartingGame}
              style={{ flex: 1 }}
            >
              <LinearGradient
                colors={['#1e4a8a', '#1a3a72', '#163068']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  flex: 1, borderRadius: 20, overflow: 'hidden',
                  borderWidth: 2, borderColor: 'rgba(120,170,255,0.5)',
                  padding: 16, justifyContent: 'space-between',
                }}
              >
                {/* Subtle shimmer stripe */}
                <View style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  borderTopLeftRadius: 20, borderTopRightRadius: 20,
                }} />


                {/* Top row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{
                    width: 46, height: 46, borderRadius: 12,
                    backgroundColor: 'rgba(80,140,255,0.2)',
                    borderWidth: 2, borderColor: 'rgba(120,170,255,0.5)',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Pencil size={21} color="#90c0ff" strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900' }}>Single Player</Text>
                    <Text style={{ color: 'rgba(160,200,255,0.65)', fontSize: 12, marginTop: 2 }}>
                      Jump straight into your next level
                    </Text>
                  </View>
                </View>

                {/* Level badge */}
                <View style={{ gap: 8, marginTop: 10 }}>
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 10,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9,
                    borderWidth: 1.5, borderColor: 'rgba(120,170,255,0.35)',
                  }}>
                    {levelLoaded ? (
                      <Animated.View entering={FadeIn.duration(300)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        {isStartingGame ? (
                          <>
                            <ActivityIndicator color="#90c0ff" size="small" />
                            <Text style={{ color: 'rgba(160,200,255,0.7)', fontSize: 14, fontWeight: '700' }}>
                              Loading level {levelProgress.unlockedLevel}...
                            </Text>
                          </>
                        ) : allLevelsCompleted ? (
                          <>
                            <View style={{
                              width: 36, height: 36, borderRadius: 8,
                              backgroundColor: '#f59e0b',
                              alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Text style={{ color: '#fff', fontSize: 20 }}>🏆</Text>
                            </View>
                            <View>
                              <Text style={{ color: 'rgba(251,191,36,0.7)', fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
                                All done!
                              </Text>
                              <Text style={{ color: '#fde68a', fontSize: 14, fontWeight: '900' }}>
                                500/500 Completed
                              </Text>
                            </View>
                            <View style={{ marginLeft: 'auto', opacity: 0.5 }}>
                              <Text style={{ color: '#fde68a', fontSize: 22 }}>›</Text>
                            </View>
                          </>
                        ) : (
                          <>
                            <View style={{
                              width: 36, height: 36, borderRadius: 8,
                              backgroundColor: '#4090e8',
                              alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>
                                {levelProgress.unlockedLevel}
                              </Text>
                            </View>
                            <View>
                              <Text style={{ color: '#90c0ff', fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
                                Up next
                              </Text>
                              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900' }}>
                                Level {levelProgress.unlockedLevel}
                              </Text>
                            </View>
                            <View style={{ marginLeft: 'auto' }}>
                              <Text style={{ color: '#fff', fontSize: 22 }}>›</Text>
                            </View>
                          </>
                        )}
                      </Animated.View>
                    ) : (
                      <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }, shimmerStyle]}>
                        <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(80,140,255,0.3)' }} />
                        <View style={{ gap: 5 }}>
                          <View style={{ width: 70, height: 8, borderRadius: 4, backgroundColor: 'rgba(160,200,255,0.2)' }} />
                          <View style={{ width: 55, height: 12, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)' }} />
                        </View>
                      </Animated.View>
                    )}
                  </View>

                  {/* Completed levels tab — mirrors "Up next" style */}
                  {completedCount > 0 && (
                    <TouchableOpacity
                      onPress={(e) => { e.stopPropagation(); handleCompletedLevels(); }}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 10,
                        backgroundColor: 'rgba(16,185,129,0.1)',
                        borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9,
                        borderWidth: 1.5, borderColor: 'rgba(16,185,129,0.3)',
                      }}
                    >
                      <View style={{
                        width: 36, height: 36, borderRadius: 8,
                        backgroundColor: 'rgba(16,185,129,0.2)',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Trophy size={18} color="#34d399" strokeWidth={2} />
                      </View>
                      <View>
                        <Text style={{ color: 'rgba(52,211,153,0.55)', fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
                          Completed
                        </Text>
                        <Text style={{ color: '#34d399', fontSize: 14, fontWeight: '900' }}>
                          {completedCount} level{completedCount !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <View style={{ marginLeft: 'auto', opacity: 0.5 }}>
                        <Text style={{ color: '#34d399', fontSize: 22 }}>›</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* ── MULTIPLAYER ── */}
          <Animated.View entering={FadeInDown.duration(400).delay(40)} style={{ flex: 1 }}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handleMultiplayer}
              style={{ flex: 1 }}
            >
              {/* Tape strip */}
              <View style={{
                alignSelf: 'center', width: 60, height: 15,
                backgroundColor: 'rgba(210,190,100,0.7)',
                borderRadius: 3, marginBottom: -7, zIndex: 3,
                borderWidth: 1, borderColor: 'rgba(160,130,50,0.45)',
              }} />
              {/* Offset shadow */}
              <View style={{
                position: 'absolute', top: 4, left: 4, right: -4, bottom: -4,
                backgroundColor: 'rgba(80,50,10,0.16)', borderRadius: 10,
              }} />
              {/* Main card */}
              <View style={{
                flex: 1, backgroundColor: '#F2EAD0',
                borderRadius: 8, borderWidth: 2.5, borderColor: '#8A7040',
                overflow: 'hidden', padding: 16, justifyContent: 'space-between',
              }}>
                {/* Ruled lines */}
                {[0,1,2,3].map(i => (
                  <View key={i} style={{
                    position: 'absolute', left: 44, right: 0,
                    top: 18 + i * 24, height: 1,
                    backgroundColor: 'rgba(138,112,64,0.13)',
                  }} />
                ))}
                {/* Red margin line */}
                <View style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0,
                  width: 5, backgroundColor: 'rgba(190,60,50,0.65)',
                }} />

                {/* Top row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{
                    width: 46, height: 46, borderRadius: 12,
                    backgroundColor: '#FEF0B0',
                    borderWidth: 2, borderColor: '#D09010',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Users size={22} color="#7A5000" strokeWidth={2.5} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#1C120A', fontSize: 20, fontWeight: '900' }}>Multiplayer</Text>
                    <Text style={{ color: '#8A7050', fontSize: 12, marginTop: 2 }}>
                      Host or join a game with friends locally
                    </Text>
                  </View>
                </View>

                {/* Players badge row */}
                <View style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 8, marginTop: 10,
                  backgroundColor: '#FEF0B0',
                  borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8,
                  borderWidth: 1.5, borderColor: '#D09010',
                }}>
                  <Users size={13} color="#7A5000" strokeWidth={2.5} />
                  <Text style={{ color: '#7A5000', fontSize: 12, fontWeight: '800', letterSpacing: 0.5 }}>
                    2 – 10 Players
                  </Text>
                  <Text style={{ color: '#D09010', fontSize: 12, fontWeight: '600' }}>·</Text>
                  <Text style={{ color: '#8A6020', fontSize: 12, fontWeight: '600' }}>
                    Real-time
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* ── DAILY CHALLENGE ── */}
          <Animated.View entering={FadeInDown.duration(400).delay(80)} style={{ flex: 1 }}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleDaily}
              style={{ flex: 1 }}
            >
              <View style={{
                flex: 1, borderRadius: 16, overflow: 'hidden',
                backgroundColor: '#071510',
                borderWidth: 2, borderColor: '#00C840',
                padding: 16, justifyContent: 'space-between',
              }}>
                {/* Corner brackets */}
                <View style={{ position: 'absolute', top: 8, left: 8 }}>
                  <View style={{ width: 14, height: 3, backgroundColor: '#00C840', marginBottom: 2 }} />
                  <View style={{ width: 3, height: 14, backgroundColor: '#00C840' }} />
                </View>
                <View style={{ position: 'absolute', top: 8, right: 8, alignItems: 'flex-end' }}>
                  <View style={{ width: 14, height: 3, backgroundColor: '#00C840', marginBottom: 2 }} />
                  <View style={{ width: 3, height: 14, backgroundColor: '#00C840', alignSelf: 'flex-end' }} />
                </View>

                {/* Top row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{
                    width: 46, height: 46, borderRadius: 10,
                    backgroundColor: '#0a2010',
                    borderWidth: 2, borderColor: '#00C840',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CalendarDays size={21} color="#00C840" strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#00C840', fontSize: 20, fontWeight: '900', letterSpacing: 0.8 }}>
                      Daily Challenge
                    </Text>
                    <Text style={{ color: 'rgba(0,200,64,0.55)', fontSize: 12, marginTop: 2 }}>
                      New puzzle every day — climb the ranks
                    </Text>
                  </View>
                </View>

                {/* Global leaderboard badge */}
                <View style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 7, marginTop: 10,
                  borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8,
                  borderWidth: 1, borderColor: 'rgba(0,200,64,0.35)',
                  backgroundColor: 'rgba(0,200,64,0.08)',
                }}>
                  <Zap size={12} color="#00C840" strokeWidth={2.5} fill="#00C840" />
                  <Text style={{ color: '#00C840', fontSize: 12, fontWeight: '800', letterSpacing: 0.8 }}>
                    Global Leaderboard
                  </Text>
                  <Trophy size={12} color="#00C840" strokeWidth={2} />
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>

        </View>
      </LinearGradient>

      {/* ═══ NOVELTY POPUP — new category / rule unlock, shown before game starts ═══ */}
      {noveltyPopup && (() => {
        const isCat = noveltyPopup.type === 'category' && !!noveltyPopup.category;
        const cat = noveltyPopup.category;
        const cc = cat ? CAT_COLORS[cat] : null;
        const CONSTRAINT_DISPLAY: Record<string, { icon: React.ReactNode; color: string; gradA: string; gradB: string }> = {
          min_word_length:   { icon: <Text style={{ fontSize: 34 }}>📏</Text>, color: '#a78bfa', gradA: '#7c3aed', gradB: '#4c1d95' },
          max_word_length:   { icon: <Text style={{ fontSize: 34 }}>✂️</Text>,  color: '#f472b6', gradA: '#db2777', gradB: '#831843' },
          ends_with_letter:  { icon: <Text style={{ fontSize: 34 }}>🔚</Text>, color: '#34d399', gradA: '#059669', gradB: '#064e3b' },
          double_letters:    { icon: <Text style={{ fontSize: 34 }}>🔤</Text>, color: '#fbbf24', gradA: '#d97706', gradB: '#78350f' },
          contains_vowel:    { icon: <Text style={{ fontSize: 34 }}>🅰️</Text>, color: '#60a5fa', gradA: '#2563eb', gradB: '#1e3a8a' },
          odd_length:        { icon: <Text style={{ fontSize: 34 }}>🔢</Text>, color: '#fb923c', gradA: '#ea580c', gradB: '#7c2d12' },
          no_repeat_letters: { icon: <Text style={{ fontSize: 34 }}>🚫</Text>, color: '#f87171', gradA: '#dc2626', gradB: '#7f1d1d' },
          combo:             { icon: <Text style={{ fontSize: 34 }}>⚡</Text>,  color: '#e879f9', gradA: '#a21caf', gradB: '#4a044e' },
          survival:          { icon: <Text style={{ fontSize: 34 }}>💀</Text>, color: '#fb7185', gradA: '#e11d48', gradB: '#4c0519' },
          time_pressure:     { icon: <Text style={{ fontSize: 34 }}>⏱️</Text>, color: '#facc15', gradA: '#ca8a04', gradB: '#713f12' },
        };
        const cd = noveltyPopup.constraintType ? (CONSTRAINT_DISPLAY[noveltyPopup.constraintType] ?? CONSTRAINT_DISPLAY.combo) : CONSTRAINT_DISPLAY.combo;
        const accentColor = isCat ? cc!.darkAccent  : cd.color;
        const borderColor = isCat ? cc!.darkBorder  : cd.color;
        const bgGradStart = isCat ? cc!.darkBg      : '#0e0820';
        const btnGradA    = isCat ? cc!.gradA       : cd.gradA;
        const btnGradB    = isCat ? cc!.gradB       : cd.gradB;
        const catIconMap: Record<CategoryType, React.ReactNode> = {
          names:             <User        size={40} color={accentColor} strokeWidth={2} />,
          places:            <MapPin      size={40} color={accentColor} strokeWidth={2} />,
          animal:            <Cat         size={40} color={accentColor} strokeWidth={2} />,
          thing:             <Box         size={40} color={accentColor} strokeWidth={2} />,
          sports_games:      <Gamepad2    size={40} color={accentColor} strokeWidth={2} />,
          brands:            <ShoppingBag size={40} color={accentColor} strokeWidth={2} />,
          health_issues:     <HeartPulse  size={40} color={accentColor} strokeWidth={2} />,
          countries:         <Globe       size={40} color={accentColor} strokeWidth={2} />,
          professions:       <Briefcase   size={40} color={accentColor} strokeWidth={2} />,
          food_dishes:       <Utensils    size={40} color={accentColor} strokeWidth={2} />,
          celebrities:       <Landmark    size={40} color={accentColor} strokeWidth={2} />,
          fruits_vegetables: <Apple       size={40} color={accentColor} strokeWidth={2} />,
        };
        const mainIcon = isCat && cat ? catIconMap[cat] : cd.icon;
        return (
          <Modal visible={true} transparent animationType="none">
            <Animated.View entering={FadeIn.duration(180)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 }}>
              <Pressable style={StyleSheet.absoluteFill} onPress={handleNoveltyDismiss} />
              <Animated.View entering={ZoomIn.springify().damping(14).stiffness(160)} style={{ width: '100%', maxWidth: 310 }}>
                <LinearGradient
                  colors={[bgGradStart, '#0a0f1e']}
                  style={{ borderRadius: 28, overflow: 'hidden', borderWidth: 2, borderColor: borderColor + '80' }}
                >
                  <LinearGradient colors={[btnGradA, btnGradB]} style={{ height: 5 }} />
                  <View style={{ padding: 28, alignItems: 'center' }}>
                    <Animated.View entering={FadeInDown.duration(300).delay(120)}>
                      <View style={{
                        backgroundColor: borderColor + '20', borderRadius: 99,
                        paddingHorizontal: 14, paddingVertical: 5,
                        borderWidth: 1, borderColor: borderColor + '55', marginBottom: 22,
                      }}>
                        <Text style={{ color: accentColor, fontSize: 11, fontWeight: '800', letterSpacing: 2.5 }}>
                          {isCat ? 'NEW CATEGORY' : 'NEW RULE'}
                        </Text>
                      </View>
                    </Animated.View>
                    <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                      <Animated.View style={[noveltyPulseStyle, {
                        position: 'absolute',
                        width: 112, height: 112, borderRadius: 56,
                        borderWidth: 2, borderColor: accentColor + '55',
                      }]} />
                      <Animated.View entering={ZoomIn.springify().delay(100).damping(12).stiffness(140)}>
                        <LinearGradient
                          colors={[btnGradA + '30', btnGradB + '15']}
                          style={{
                            width: 84, height: 84, borderRadius: 42,
                            alignItems: 'center', justifyContent: 'center',
                            borderWidth: 2, borderColor: borderColor + '90',
                          }}
                        >
                          {mainIcon}
                        </LinearGradient>
                      </Animated.View>
                    </View>
                    <Animated.View entering={FadeInDown.duration(280).delay(160)} style={{ alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: isCat ? 26 : 20, fontWeight: '900', textAlign: 'center', marginBottom: 6 }}>
                        {isCat && cat ? getCategoryName(cat) : noveltyPopup.title}
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 26 }}>
                        {noveltyPopup.message}
                      </Text>
                    </Animated.View>
                    <Animated.View entering={FadeInDown.duration(260).delay(200)} style={{ width: '100%' }}>
                      <Pressable
                        onPress={handleNoveltyDismiss}
                        style={({ pressed }) => ({ width: '100%', opacity: pressed ? 0.82 : 1 })}
                      >
                        <LinearGradient
                          colors={[btnGradA, btnGradB]}
                          style={{ borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
                        >
                          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 }}>
                            {isCat ? "Let's Go! →" : 'Got It!'}
                          </Text>
                        </LinearGradient>
                      </Pressable>
                    </Animated.View>
                  </View>
                </LinearGradient>
              </Animated.View>
            </Animated.View>
          </Modal>
        );
      })()}

      {/* Single Player first-time intro */}
      <Modal visible={showSpIntro} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
          <View style={{
            backgroundColor: '#1f2d50', borderRadius: 20, padding: 24,
            borderWidth: 2, borderColor: 'rgba(120,170,255,0.4)',
            shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 24,
            elevation: 20, width: '100%',
          }}>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 8 }}>
              Single Player 🎮
            </Text>
            <Text style={{ color: 'rgba(160,200,255,0.85)', fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 20 }}>
              A letter is revealed each round — type words for every category before time runs out.{'\n\n'}
              Valid answer = 10 pts · 10+ letters = +2 bonus{'\n'}
              Score enough to unlock the next level!
            </Text>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                AsyncStorage.setItem('npat_sp_intro_shown', '1');
                setShowSpIntro(false);
                startGame();
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            >
              <View style={{
                backgroundColor: '#4090e8', borderRadius: 14, paddingVertical: 14,
                alignItems: 'center',
              }}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>Got it — let's play!</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
