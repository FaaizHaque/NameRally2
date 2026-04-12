import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SKETCH_COLORS } from '@/lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NotebookBackground } from '@/components/NotebookBackground';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { Trophy, Crown, Medal, Home, RotateCcw, Sparkles, Star, Play, ChevronRight, XCircle, CheckCircle, Check, X, User, MapPin, Cat, Box, Apple, ShoppingBag, HeartPulse, Gamepad2, Zap, Globe, Film, Music, Briefcase, Utensils, Landmark } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Sounds } from '@/lib/sounds';
import { useGameStore, CategoryType } from '@/lib/state/game-store';
import { calculateStars, didPassLevel } from '@/lib/level-types';
import { getCategoryName } from '@/lib/word-validation';
import type { LevelData } from '@/lib/level-types';
import { CAT_COLORS } from '@/lib/category-colors';

const CATEGORY_ICONS: Record<CategoryType, React.ReactNode> = {
  names:              <User size={16} color={CAT_COLORS.names.icon} />,
  places:             <MapPin size={16} color={CAT_COLORS.places.icon} />,
  animal:             <Cat size={16} color={CAT_COLORS.animal.icon} />,
  thing:              <Box size={16} color={CAT_COLORS.thing.icon} />,
  sports_games:       <Gamepad2 size={16} color={CAT_COLORS.sports_games.icon} />,
  brands:             <ShoppingBag size={16} color={CAT_COLORS.brands.icon} />,
  health_issues:      <HeartPulse size={16} color={CAT_COLORS.health_issues.icon} />,
  countries:          <Globe size={16} color={CAT_COLORS.countries.icon} />,
  professions:        <Briefcase size={16} color={CAT_COLORS.professions.icon} />,
  food_dishes:        <Utensils size={16} color={CAT_COLORS.food_dishes.icon} />,
  celebrities: <Landmark size={16} color={CAT_COLORS.celebrities.icon} />,
  fruits_vegetables:  <Apple size={16} color={CAT_COLORS.fruits_vegetables.icon} />,
};

const MODERN_CAT_COLORS: Record<string, { bg: string; border: string; icon: string }> = Object.fromEntries(
  Object.entries(CAT_COLORS).map(([k, v]) => [k, { bg: v.darkBg, border: v.darkBorder, icon: v.darkAccent }])
);

const BACKEND_URL = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL || 'http://localhost:3000';

export default function FinalResultsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const session = useGameStore((s) => s.session);
  const currentUser = useGameStore((s) => s.currentUser);
  const leaveGame = useGameStore((s) => s.leaveGame);
  const difficulty = useGameStore((s) => s.difficulty);
  const highScores = useGameStore((s) => s.highScores);
  const saveHighScore = useGameStore((s) => s.saveHighScore);
  const loadHighScores = useGameStore((s) => s.loadHighScores);
  const currentLevel = useGameStore((s) => s.currentLevel);
  const completeLevelWithScore = useGameStore((s) => s.completeLevelWithScore);
  const startLevelGame = useGameStore((s) => s.startLevelGame);
  const gameMode = useGameStore((s) => s.gameMode);
  const levelProgress = useGameStore((s) => s.levelProgress);
  const loadLevelProgress = useGameStore((s) => s.loadLevelProgress);

  const [isLoadingNextLevel, setIsLoadingNextLevel] = useState(false);
  const [levelProcessed, setLevelProcessed] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  // Staged reveal: 0=verdict, 1=score+stars, 2=answers, 3=stats+buttons
  const [revealStage, setRevealStage] = useState(0);

  const isLevelMode = gameMode === 'single' && currentLevel !== null;
  const highScore = highScores[difficulty] || 0;

  const trophyScale = useSharedValue(0);
  const confettiOpacity = useSharedValue(0);
  const soundPlayedRef = React.useRef(false);

  const isSoloMode = session?.players.length === 1;
  const playerScore = session?.players[0]?.totalScore || 0;
  const isNewHighScore = isSoloMode && !isLevelMode && playerScore > highScore;

  const levelPassed = isLevelMode && currentLevel ? didPassLevel(playerScore, currentLevel) : false;
  const starsEarned = isLevelMode && currentLevel ? calculateStars(playerScore, currentLevel.maxPossibleScore, currentLevel.minScoreToPass) : 0;

  useEffect(() => {
    loadHighScores();
    loadLevelProgress();
  }, []);

  // Sound, trophy animation, and score saving — re-runs only when meaningful data changes
  useEffect(() => {
    if (!soundPlayedRef.current) {
      soundPlayedRef.current = true;
      if (isLevelMode) {
        Haptics.notificationAsync(levelPassed ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
        if (levelPassed) Sounds.success();
        else Sounds.fail();
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Sounds.success();
      }
    }
    trophyScale.value = withDelay(300, withSpring(1, { damping: 8, stiffness: 100 }));
    confettiOpacity.value = withDelay(500, withRepeat(withSequence(withTiming(1, { duration: 1000 }), withTiming(0.5, { duration: 1000 })), -1, true));
    if (isLevelMode && currentLevel && !levelProcessed) {
      completeLevelWithScore(playerScore);
      setLevelProcessed(true);
    }
    if (isSoloMode && !isLevelMode && playerScore > 0) {
      saveHighScore(playerScore);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLevelMode]);

  // Staged reveal timers — run ONCE on mount, never cancelled by data updates.
  // Previously these were in the same effect as score-saving; any store update
  // (Supabase Realtime pushing a session change, levelProcessed flipping) would
  // cancel the in-flight timers, leaving revealStage stuck below 3 so buttons
  // never appeared and the screen was unresponsive.
  useEffect(() => {
    if (!isLevelMode) return;
    const t1 = setTimeout(() => { setRevealStage(1); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }, 900);
    const t2 = setTimeout(() => { setRevealStage(2); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }, 1800);
    const t3 = setTimeout(() => setRevealStage(3), 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trophyAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: trophyScale.value }] }));
  const confettiStyle = useAnimatedStyle(() => ({ opacity: confettiOpacity.value }));

  if (isTransitioning) {
    return (
      <LinearGradient colors={['#1a3a6e', '#1e4a8a']} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4090e8" />
        <Text style={{ color: '#90c0ff', marginTop: 12, fontSize: 14 }}>Loading next level...</Text>
      </LinearGradient>
    );
  }

  if (!session || !currentUser) {
    return (
      <LinearGradient colors={['#1a3a6e', '#1e4a8a']} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4090e8" />
      </LinearGradient>
    );
  }

  const latestRound = session.roundResults[session.roundResults.length - 1];
  const sortedPlayers = [...session.players].sort((a, b) => b.totalScore - a.totalScore);
  const winner = sortedPlayers[0];
  const isCurrentUserWinner = winner?.visibleId === currentUser.id;

  const handlePlayAgain = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await leaveGame();
    if (isLevelMode) router.replace('/game-mode');
    else router.replace('/create-game');
  };

  const handleGoHome = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await leaveGame();
    router.replace('/');
  };

  const handleRetryLevel = async () => {
    if (!currentLevel) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoadingNextLevel(true);
    setIsTransitioning(true);
    try {
      await leaveGame();
      await startLevelGame(currentLevel);
      router.replace('/game');
    } catch (error) {
      console.error('Error retrying level:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setIsLoadingNextLevel(false);
      setIsTransitioning(false);
    }
  };

  const handlePlayNextLevel = async () => {
    if (!currentLevel || !levelPassed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoadingNextLevel(true);
    const nextLevelNumber = currentLevel.level + 1;
    if (nextLevelNumber > 500) {
      setIsLoadingNextLevel(false);
      router.replace('/game-mode');
      return;
    }
    try {
      const response = await fetch(`${BACKEND_URL}/api/levels/${nextLevelNumber}`);
      if (!response.ok) throw new Error('Failed to fetch next level');
      const nextLevelData: LevelData = await response.json();
      setIsTransitioning(true);
      await leaveGame();
      await startLevelGame(nextLevelData);
      router.replace('/game');
    } catch (error) {
      console.error('Error starting next level:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setIsLoadingNextLevel(false);
      setIsTransitioning(false);
    }
  };

  const getMedalColor = (index: number) => {
    const colors = [SKETCH_COLORS.amber, '#B8B8B8', '#C89060'];
    return index < 3 ? colors[index] : SKETCH_COLORS.paperLine;
  };

  const getPodiumHeight = (index: number) => {
    const heights = [130, 95, 75];
    return index < 3 ? heights[index] : 0;
  };

  // ── LEVEL MODE: Modern dark theme with staged reveal ──────────────────────────
  if (isLevelMode && currentLevel) {
    const skipToEnd = () => {
      if (revealStage < 3) {
        setRevealStage(3);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    };

    return (
      <LinearGradient colors={['#1a3a6e', '#1e4a8a', '#163468']} style={{ flex: 1 }}>
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 16, paddingHorizontal: 16, gap: 12 }}
            scrollEnabled={revealStage >= 2}
            onTouchEnd={revealStage < 3 ? skipToEnd : undefined}
          >

            {/* ── STAGE 0: Verdict ── */}
            <Animated.View
              entering={FadeInDown.duration(600).springify().damping(14)}
              style={{ alignItems: 'center', paddingBottom: 4 }}
            >
              <View style={{ backgroundColor: '#1a3a6e', paddingHorizontal: 18, paddingVertical: 7, borderRadius: 14, marginBottom: 14, borderWidth: 1.5, borderColor: 'rgba(80,160,255,0.6)' }}>
                <Text style={{ color: '#90c0ff', fontSize: 12, fontWeight: '700', letterSpacing: 2 }}>
                  {'LEVEL '}
                  <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '900', letterSpacing: 0 }}>{currentLevel.level}</Text>
                </Text>
              </View>

              <Animated.View style={trophyAnimStyle}>
                <View style={{
                  width: 110, height: 110, borderRadius: 55,
                  backgroundColor: levelPassed ? '#1a3a6e' : '#2a0a0a',
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 3, borderColor: levelPassed ? '#4090e8' : '#ef4444',
                  shadowColor: levelPassed ? '#4090e8' : '#ef4444',
                  shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 24,
                }}>
                  {levelPassed
                    ? <CheckCircle size={58} color="#4090e8" />
                    : <XCircle size={58} color="#ef4444" />
                  }
                </View>
              </Animated.View>

              <Text style={{
                color: levelPassed ? '#ffffff' : '#fca5a5',
                fontSize: 34, fontWeight: '900', marginTop: 16, letterSpacing: -0.5,
              }}>
                {levelPassed ? `Level ${currentLevel?.level} Complete!` : 'Level Failed'}
              </Text>

              {revealStage < 1 && (
                <Text style={{ color: 'rgba(144,192,255,0.35)', fontSize: 11, marginTop: 12, fontWeight: '600', letterSpacing: 1 }}>
                  tap to skip
                </Text>
              )}
            </Animated.View>

            {/* ── STAGE 1: Score + Stars ── */}
            {revealStage >= 1 && (
              <Animated.View entering={FadeInUp.duration(500).springify().damping(16)} style={{ alignItems: 'center', paddingVertical: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  {[1, 2, 3].map((s) => (
                    <Animated.View key={s} entering={FadeIn.duration(300).delay((s - 1) * 150)}>
                      <Star size={36} color={s <= starsEarned ? '#FCD34D' : '#374151'} fill={s <= starsEarned ? '#FCD34D' : 'transparent'} strokeWidth={2} />
                    </Animated.View>
                  ))}
                </View>

                <Animated.View entering={FadeInDown.duration(400).delay(100)} style={{ alignItems: 'center' }}>
                  <Text style={{ color: 'rgba(144,192,255,0.55)', fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 2 }}>SCORE</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
                    <Text style={{ color: '#ffffff', fontSize: 58, fontWeight: '900', lineHeight: 62 }}>{playerScore}</Text>
                    <Text style={{ color: '#4090e8', fontSize: 24, fontWeight: '700', marginBottom: 9 }}>/{currentLevel.maxPossibleScore}</Text>
                    <Text style={{ color: 'rgba(144,192,255,0.45)', fontSize: 13, fontWeight: '600', marginBottom: 11 }}>pts</Text>
                  </View>
                </Animated.View>

                <Animated.View entering={FadeIn.duration(350).delay(250)} style={{
                  marginTop: 12, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20,
                  backgroundColor: levelPassed ? '#1a3a6e' : '#2a0a0a',
                  borderWidth: 1.5, borderColor: levelPassed ? '#4090e8' : '#ef4444',
                }}>
                  <Text style={{ color: levelPassed ? '#a5b4fc' : '#fca5a5', fontWeight: '800', fontSize: 14 }}>
                    {levelPassed ? `+${starsEarned} star${starsEarned !== 1 ? 's' : ''} earned!` : `Need ${currentLevel.minScoreToPass} to pass`}
                  </Text>
                </Animated.View>
              </Animated.View>
            )}

            {/* ── STAGE 2: Answers ── */}
            {revealStage >= 2 && latestRound && (
              <Animated.View entering={FadeInUp.duration(450).springify().damping(16)}>
                <Text style={{ color: '#90c0ff', fontSize: 11, textAlign: 'center', marginBottom: 8, fontWeight: '700', letterSpacing: 1.5 }}>YOUR ANSWERS</Text>
                <View style={{ backgroundColor: '#0e2040', borderRadius: 14, padding: 10, borderWidth: 1.5, borderColor: 'rgba(80,160,255,0.15)', gap: 6 }}>
                  {session?.settings.selectedCategories.map((category, index) => {
                    const answerData = latestRound?.answers[currentUser?.id || '']?.[category];
                    const answer = answerData?.answer || '';
                    const score = answerData?.score || 0;
                    const isValid = answerData?.isValid || false;
                    const hasBonus = answerData?.hasBonus || false;
                    const isEmpty = !answer || answer.length <= 1;
                    const mc = MODERN_CAT_COLORS[category] || { bg: '#1a3a6e', border: 'rgba(80,160,255,0.6)', icon: '#90c0ff' };

                    return (
                      <Animated.View
                        key={category}
                        entering={FadeInDown.duration(280).delay(index * 60).springify().damping(14)}
                        style={{
                          flexDirection: 'row', alignItems: 'center',
                          padding: 10, borderRadius: 10,
                          backgroundColor: mc.bg,
                          borderWidth: 1.5, borderColor: isValid ? mc.border : '#2a1010',
                        }}
                      >
                        <View style={{ width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 10, backgroundColor: mc.border + '20' }}>
                          {CATEGORY_ICONS[category]}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: mc.icon, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>{getCategoryName(category).toUpperCase()}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <Text style={{ fontSize: 15, fontWeight: '800', color: isEmpty ? '#4b5563' : '#ffffff', fontStyle: isEmpty ? 'italic' : 'normal' }} numberOfLines={1}>
                              {isEmpty ? 'No answer' : answer}
                            </Text>
                            {hasBonus && (
                              <View style={{ backgroundColor: '#2a2010', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, flexDirection: 'row', alignItems: 'center', gap: 2, borderWidth: 1, borderColor: '#f59e0b' }}>
                                <Sparkles size={9} color="#fcd34d" fill="#fcd34d" strokeWidth={2} />
                                <Text style={{ color: '#fcd34d', fontSize: 9, fontWeight: '800' }}>+2</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                          <View style={{
                            width: 24, height: 24, borderRadius: 12,
                            alignItems: 'center', justifyContent: 'center',
                            backgroundColor: isValid ? '#1e3a28' : '#2a0a0a',
                            borderWidth: 1.5, borderColor: isValid ? '#22c55e' : '#ef4444',
                          }}>
                            {isValid
                              ? <Check size={12} color="#22c55e" strokeWidth={3} />
                              : <X size={12} color="#ef4444" strokeWidth={3} />
                            }
                          </View>
                          <Text style={{ fontSize: 15, fontWeight: '900', color: score > 0 ? '#FCD34D' : '#4b5563', minWidth: 28, textAlign: 'right' }}>+{score}</Text>
                        </View>
                      </Animated.View>
                    );
                  })}
                </View>
              </Animated.View>
            )}

            {/* ── STAGE 3: Stats + Progress ── */}
            {revealStage >= 3 && (
              <Animated.View entering={FadeInUp.duration(450).springify().damping(16)} style={{ gap: 12 }}>

                {/* Stats row */}
                <View style={{
                  flexDirection: 'row', justifyContent: 'space-between',
                  backgroundColor: '#0e2040', borderRadius: 14, padding: 14,
                  borderWidth: 1.5, borderColor: 'rgba(80,160,255,0.15)',
                }}>
                  {[
                    { label: 'LEVEL', value: `${currentLevel.level}` },
                    { label: 'LETTER', value: `"${currentLevel.letter}"` },
                  ].map((item, i) => (
                    <React.Fragment key={item.label}>
                      {i > 0 && <View style={{ width: 1, backgroundColor: 'rgba(80,160,255,0.15)' }} />}
                      <View style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={{ color: '#4090e8', fontSize: 9, marginBottom: 4, fontWeight: '700', letterSpacing: 1 }}>{item.label}</Text>
                        <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 16 }} numberOfLines={1}>{item.value}</Text>
                      </View>
                    </React.Fragment>
                  ))}
                </View>

                {/* Constraint row */}
                {currentLevel.constraint?.type !== 'none' && (
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                    backgroundColor: '#0e1e42', borderRadius: 12, padding: 12,
                    borderWidth: 2, borderColor: '#6366f1',
                    shadowColor: '#6366f1', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 8,
                  }}>
                    <View style={{ backgroundColor: '#6366f1', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: '#ffffff', fontSize: 9, fontWeight: '900', letterSpacing: 1 }}>RULE</Text>
                    </View>
                    <Text style={{ color: '#c7d2fe', fontSize: 13, fontWeight: '700', flex: 1 }}>{currentLevel.constraint.description}</Text>
                  </View>
                )}

                {/* Progress card */}
                <LinearGradient
                  colors={['#1e5aa8', '#1a4a98']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={{ borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: 'rgba(80,160,255,0.6)' }}
                >
                  <Text style={{ color: '#90c0ff', fontSize: 11, textAlign: 'center', marginBottom: 12, fontWeight: '700', letterSpacing: 1 }}>TOTAL PROGRESS</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                    <View style={{ alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Trophy size={18} color="#FCD34D" strokeWidth={2.5} />
                        <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: '900' }}>
                          {(levelProgress.totalPoints || 0) + (playerScore > (levelProgress.levelScores[currentLevel.level] || 0) ? playerScore - (levelProgress.levelScores[currentLevel.level] || 0) : 0)}
                        </Text>
                      </View>
                      <Text style={{ color: '#4090e8', fontSize: 10, marginTop: 4 }}>Total Points</Text>
                    </View>
                    <View style={{ width: 1, backgroundColor: 'rgba(64,144,232,0.19)' }} />
                    <View style={{ alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Star size={18} color="#FCD34D" fill="#FCD34D" strokeWidth={2} />
                        <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: '900' }}>
                          {levelProgress.totalStars + (starsEarned > (levelProgress.levelStars[currentLevel.level] || 0) ? starsEarned - (levelProgress.levelStars[currentLevel.level] || 0) : 0)}
                        </Text>
                      </View>
                      <Text style={{ color: '#4090e8', fontSize: 10, marginTop: 4 }}>Total Stars</Text>
                    </View>
                  </View>
                </LinearGradient>

              </Animated.View>
            )}

          </ScrollView>

          {/* ── Sticky action buttons — always visible ── */}
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 16, gap: 10, borderTopWidth: 1, borderTopColor: 'rgba(80,160,255,0.12)', backgroundColor: 'rgba(26,58,110,0.95)' }}>
            {levelPassed ? (
              <>
                <Pressable onPress={handlePlayNextLevel} disabled={isLoadingNextLevel} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.96 : 1 }] })}>
                  <LinearGradient
                    colors={['#5aa0f0', '#3070d8']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={{
                      borderRadius: 16, paddingVertical: 18, paddingHorizontal: 24,
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
                      shadowColor: '#4090e8', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 14, elevation: 10,
                    }}
                  >
                    {isLoadingNextLevel ? <ActivityIndicator color="#ffffff" size="small" /> : (
                      <>
                        <Play size={22} color="#fff" fill="#fff" strokeWidth={2} />
                        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 19, letterSpacing: 0.5 }}>
                          {currentLevel.level >= 500 ? 'All Levels Done! 🏆' : `Next Level  ${currentLevel.level + 1}`}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </Pressable>
                {starsEarned < 3 && (
                  <Pressable onPress={handleRetryLevel} disabled={isLoadingNextLevel} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
                    <View style={{
                      borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24,
                      backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1.5, borderColor: 'rgba(120,180,255,0.3)',
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}>
                      <RotateCcw size={17} color="#a0c8ff" strokeWidth={2.5} />
                      <Text style={{ color: '#a0c8ff', fontWeight: '700', fontSize: 15 }}>Replay Level</Text>
                    </View>
                  </Pressable>
                )}
              </>
            ) : (
              <Pressable onPress={handleRetryLevel} disabled={isLoadingNextLevel} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.96 : 1 }] })}>
                <View style={{
                  borderRadius: 16, paddingVertical: 18, paddingHorizontal: 24,
                  backgroundColor: '#2a0a0a', borderWidth: 2, borderColor: '#ef4444',
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
                  shadowColor: '#ef4444', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8,
                }}>
                  {isLoadingNextLevel ? <ActivityIndicator color="#ef4444" size="small" /> : (
                    <>
                      <RotateCcw size={22} color="#ef4444" strokeWidth={2.5} />
                      <Text style={{ color: '#fca5a5', fontWeight: '900', fontSize: 19 }}>Try Again</Text>
                    </>
                  )}
                </View>
              </Pressable>
            )}
            <Pressable onPress={handleGoHome} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
              <View style={{
                backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingVertical: 16,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                borderWidth: 1.5, borderColor: 'rgba(120,180,255,0.25)',
              }}>
                <Home size={19} color="#a0c8ff" strokeWidth={2.5} />
                <Text style={{ color: '#c0d8ff', fontWeight: '800', fontSize: 16 }}>Back to Home</Text>
              </View>
            </Pressable>
          </View>

      </LinearGradient>
    );
  }

  // ── OG NOTEBOOK THEME: Multiplayer / solo non-level mode ─────────────────────
  return (
    <NotebookBackground lineStartY={160} lineSpacing={36} lineCount={28} showMargin={false}>
      {/* Sparkle confetti (decorative) */}
      <Animated.View style={[confettiStyle, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }]}>
        <View style={{ position: 'absolute', top: 80, left: 40 }}><Sparkles size={20} color={SKETCH_COLORS.amber} /></View>
        <View style={{ position: 'absolute', top: 120, right: 32 }}><Sparkles size={16} color={SKETCH_COLORS.teal} /></View>
        <View style={{ position: 'absolute', top: 200, left: 24 }}><Sparkles size={14} color={SKETCH_COLORS.red} /></View>
        <View style={{ position: 'absolute', top: 160, right: 80 }}><Sparkles size={16} color={SKETCH_COLORS.teal} /></View>
      </Animated.View>

      <View style={{ paddingTop: insets.top, flex: 1 }}>
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(500)} style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 8 }}>
          <View style={{
            backgroundColor: SKETCH_COLORS.amberLight,
            paddingHorizontal: 14, paddingVertical: 4,
            borderRadius: 14, marginBottom: 6,
            borderWidth: 1.5, borderColor: SKETCH_COLORS.amber,
          }}>
            <Text style={{ color: SKETCH_COLORS.inkLight, fontSize: 12, fontWeight: '700' }}>Game Over!</Text>
          </View>
          <Text style={{ color: SKETCH_COLORS.ink, fontSize: 32, fontWeight: '900' }}>Final Results</Text>
        </Animated.View>

        <ScrollView
          style={{ flex: 1, paddingHorizontal: 16 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {isSoloMode ? (
            /* Solo Mode */
            <Animated.View entering={FadeInUp.duration(600).delay(200)} style={{ alignItems: 'center', marginBottom: 20 }}>
              <Animated.View style={trophyAnimStyle}>
                <View style={{
                  width: 110, height: 110, borderRadius: 55,
                  backgroundColor: isNewHighScore ? SKETCH_COLORS.amberLight : SKETCH_COLORS.pastelMint,
                  justifyContent: 'center', alignItems: 'center',
                  borderWidth: 3,
                  borderColor: isNewHighScore ? SKETCH_COLORS.amber : '#3ABAA0',
                  shadowColor: SKETCH_COLORS.ink,
                  shadowOffset: { width: 3, height: 5 },
                  shadowOpacity: 0.2, shadowRadius: 0,
                }}>
                  {isNewHighScore ? <Star size={58} color={SKETCH_COLORS.inkLight} fill={SKETCH_COLORS.inkLight} /> : <Trophy size={58} color={SKETCH_COLORS.teal} />}
                </View>
              </Animated.View>

              <Animated.View entering={FadeIn.duration(400).delay(600)} style={{ alignItems: 'center', marginTop: 14 }}>
                {isNewHighScore && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Star size={18} color={SKETCH_COLORS.amber} fill={SKETCH_COLORS.amber} strokeWidth={2} />
                    <Text style={{ color: SKETCH_COLORS.amber, fontSize: 18, fontWeight: '900' }}>NEW HIGH SCORE!</Text>
                    <Star size={18} color={SKETCH_COLORS.amber} fill={SKETCH_COLORS.amber} strokeWidth={2} />
                  </View>
                )}
                <Text style={{ color: SKETCH_COLORS.inkFaint, fontSize: 15 }}>Your Score</Text>
                <Text style={{ color: SKETCH_COLORS.ink, fontSize: 56, fontWeight: '900', marginTop: 4 }}>{playerScore}</Text>
                <Text style={{ color: SKETCH_COLORS.inkFaint, fontSize: 15 }}>points</Text>
                <View style={{
                  marginTop: 14,
                  backgroundColor: SKETCH_COLORS.amberLight,
                  paddingHorizontal: 20, paddingVertical: 10,
                  borderRadius: 20, borderWidth: 1.5, borderColor: SKETCH_COLORS.amber,
                }}>
                  <Text style={{ color: SKETCH_COLORS.inkLight, fontSize: 14 }}>
                    Best Score: <Text style={{ color: SKETCH_COLORS.ink, fontWeight: '900' }}>{Math.max(highScore, playerScore)}</Text>
                  </Text>
                </View>
              </Animated.View>
            </Animated.View>

          ) : (
            /* Multiplayer winner */
            <Animated.View entering={FadeInUp.duration(600).delay(200)} style={{ alignItems: 'center', marginBottom: 20 }}>
              <Animated.View style={trophyAnimStyle}>
                <View style={{
                  width: 110, height: 110, borderRadius: 55,
                  backgroundColor: SKETCH_COLORS.amberLight,
                  justifyContent: 'center', alignItems: 'center',
                  borderWidth: 3, borderColor: SKETCH_COLORS.amber,
                  shadowColor: SKETCH_COLORS.ink,
                  shadowOffset: { width: 3, height: 5 },
                  shadowOpacity: 0.2, shadowRadius: 0,
                }}>
                  <Trophy size={58} color={SKETCH_COLORS.inkLight} />
                </View>
              </Animated.View>

              <Animated.View entering={FadeIn.duration(400).delay(600)} style={{ alignItems: 'center', marginTop: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Crown size={22} color={SKETCH_COLORS.amber} strokeWidth={2.5} />
                  <Text style={{ color: SKETCH_COLORS.ink, fontSize: 26, fontWeight: '900' }}>{winner.username}</Text>
                  <Crown size={22} color={SKETCH_COLORS.amber} strokeWidth={2.5} />
                </View>
                <Text style={{ color: SKETCH_COLORS.ink, fontSize: 52, fontWeight: '900', marginTop: 4 }}>{winner.totalScore}</Text>
                <Text style={{ color: SKETCH_COLORS.inkFaint, fontSize: 15 }}>points</Text>
                {isCurrentUserWinner && (
                  <View style={{
                    marginTop: 10,
                    backgroundColor: SKETCH_COLORS.amberLight,
                    paddingHorizontal: 16, paddingVertical: 8,
                    borderRadius: 20, borderWidth: 1.5, borderColor: SKETCH_COLORS.amber,
                  }}>
                    <Text style={{ color: SKETCH_COLORS.ink, fontWeight: '800', fontSize: 14 }}>Congratulations! You Won!</Text>
                  </View>
                )}
              </Animated.View>
            </Animated.View>
          )}

          {/* Podium - multiplayer 3+ */}
          {!isSoloMode && sortedPlayers.length >= 3 && (
            <Animated.View entering={FadeInUp.duration(600).delay(400)} style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
              {/* 2nd */}
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: getMedalColor(1), alignItems: 'center', justifyContent: 'center', marginBottom: 6, borderWidth: 2, borderColor: '#A0A0A0' }}>
                  <Medal size={18} color={SKETCH_COLORS.ink} strokeWidth={2.5} />
                </View>
                <Text style={{ color: SKETCH_COLORS.ink, fontSize: 12, fontWeight: '700', marginBottom: 4 }} numberOfLines={1}>{sortedPlayers[1]?.username}</Text>
                <View style={{ width: 76, height: getPodiumHeight(1), borderTopLeftRadius: 10, borderTopRightRadius: 10, backgroundColor: '#D0D0D0', borderWidth: 1.5, borderColor: '#A8A8A8', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: SKETCH_COLORS.ink, fontSize: 26, fontWeight: '900' }}>2</Text>
                  <Text style={{ color: SKETCH_COLORS.inkLight, fontSize: 14, fontWeight: '700' }}>{sortedPlayers[1]?.totalScore}</Text>
                </View>
              </View>
              {/* 1st */}
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: SKETCH_COLORS.amber, alignItems: 'center', justifyContent: 'center', marginBottom: 6, borderWidth: 2, borderColor: '#C09020' }}>
                  <Crown size={22} color={SKETCH_COLORS.ink} strokeWidth={2.5} />
                </View>
                <Text style={{ color: SKETCH_COLORS.ink, fontSize: 12, fontWeight: '700', marginBottom: 4 }} numberOfLines={1}>{sortedPlayers[0]?.username}</Text>
                <View style={{ width: 86, height: getPodiumHeight(0), borderTopLeftRadius: 10, borderTopRightRadius: 10, backgroundColor: SKETCH_COLORS.amberLight, borderWidth: 2, borderColor: SKETCH_COLORS.amber, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: SKETCH_COLORS.ink, fontSize: 32, fontWeight: '900' }}>1</Text>
                  <Text style={{ color: SKETCH_COLORS.inkLight, fontSize: 16, fontWeight: '700' }}>{sortedPlayers[0]?.totalScore}</Text>
                </View>
              </View>
              {/* 3rd */}
              <View style={{ alignItems: 'center' }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: getMedalColor(2), alignItems: 'center', justifyContent: 'center', marginBottom: 6, borderWidth: 2, borderColor: '#A07040' }}>
                  <Medal size={18} color={SKETCH_COLORS.ink} strokeWidth={2.5} />
                </View>
                <Text style={{ color: SKETCH_COLORS.ink, fontSize: 12, fontWeight: '700', marginBottom: 4 }} numberOfLines={1}>{sortedPlayers[2]?.username}</Text>
                <View style={{ width: 76, height: getPodiumHeight(2), borderTopLeftRadius: 10, borderTopRightRadius: 10, backgroundColor: '#E8C898', borderWidth: 1.5, borderColor: '#C09060', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: SKETCH_COLORS.ink, fontSize: 26, fontWeight: '900' }}>3</Text>
                  <Text style={{ color: SKETCH_COLORS.inkLight, fontSize: 14, fontWeight: '700' }}>{sortedPlayers[2]?.totalScore}</Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Full Leaderboard - multiplayer */}
          {!isSoloMode && (
            <Animated.View entering={FadeInUp.duration(500).delay(600)} style={{
              backgroundColor: SKETCH_COLORS.paperDark, borderRadius: 14, padding: 16,
              borderWidth: 1.5, borderColor: SKETCH_COLORS.paperLine,
              shadowColor: SKETCH_COLORS.ink, shadowOffset: { width: 2, height: 3 }, shadowOpacity: 0.1, shadowRadius: 0,
            }}>
              <Text style={{ color: SKETCH_COLORS.ink, fontSize: 18, fontWeight: '900', marginBottom: 12 }}>Final Standings</Text>
              <View style={{ gap: 8 }}>
                {sortedPlayers.map((player, index) => {
                  const isCurrentUser = player.visibleId === currentUser.id;
                  return (
                    <Animated.View
                      key={player.id}
                      entering={FadeIn.duration(400).delay(700 + index * 80)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10,
                        backgroundColor: isCurrentUser ? SKETCH_COLORS.pastelGreen : SKETCH_COLORS.paper,
                        borderWidth: 1.5,
                        borderColor: isCurrentUser ? '#50B870' : SKETCH_COLORS.paperLine,
                      }}
                    >
                      <View style={{
                        width: 36, height: 36, borderRadius: 18,
                        alignItems: 'center', justifyContent: 'center', marginRight: 10,
                        backgroundColor: index < 3 ? getMedalColor(index) : SKETCH_COLORS.paperLine,
                        borderWidth: 1.5, borderColor: index < 3 ? getMedalColor(index) : SKETCH_COLORS.inkFaint,
                      }}>
                        {index === 0 ? <Crown size={18} color={SKETCH_COLORS.ink} strokeWidth={2.5} /> : <Text style={{ color: SKETCH_COLORS.ink, fontWeight: '900', fontSize: 15 }}>{index + 1}</Text>}
                      </View>
                      <Text style={{ flex: 1, color: SKETCH_COLORS.ink, fontWeight: '700', fontSize: 14 }}>
                        {player.username}{isCurrentUser ? ' (You)' : ''}
                      </Text>
                      <Text style={{ color: SKETCH_COLORS.ink, fontSize: 22, fontWeight: '900' }}>{player.totalScore}</Text>
                    </Animated.View>
                  );
                })}
              </View>
            </Animated.View>
          )}

          {/* Game Stats */}
          <Animated.View entering={FadeIn.duration(400).delay(900)} style={{
            marginTop: 12, backgroundColor: SKETCH_COLORS.paperDark, borderRadius: 10, padding: 12,
            borderWidth: 1, borderColor: SKETCH_COLORS.paperLine,
          }}>
            <Text style={{ color: SKETCH_COLORS.inkFaint, textAlign: 'center', fontSize: 12, fontStyle: 'italic' }}>
              {`${session.settings.totalRounds} rounds · ${session.settings.selectedCategories.length} categories · ${isSoloMode ? 'Solo Mode' : `${session.players.length} players`}`}
            </Text>
          </Animated.View>

          {/* Action Buttons */}
          <Animated.View entering={FadeInUp.duration(500).delay(800)} style={{ marginTop: 20, paddingBottom: insets.bottom + 16, gap: 10 }}>
            <Pressable onPress={handlePlayAgain} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.96 : 1 }] })}>
              <View style={{
                borderRadius: 16, paddingVertical: 18,
                backgroundColor: SKETCH_COLORS.ink,
                shadowColor: SKETCH_COLORS.ink, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 10,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}>
                <RotateCcw size={20} color={SKETCH_COLORS.amberLight} strokeWidth={2.5} />
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18, letterSpacing: 1 }}>Play Again</Text>
              </View>
            </Pressable>
            <Pressable onPress={handleGoHome} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
              <View style={{
                borderRadius: 14, paddingVertical: 15,
                backgroundColor: SKETCH_COLORS.paperDark,
                borderWidth: 1.5, borderColor: SKETCH_COLORS.paperLine,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}>
                <Home size={18} color={SKETCH_COLORS.inkLight} strokeWidth={2.5} />
                <Text style={{ color: SKETCH_COLORS.inkLight, fontWeight: '700', fontSize: 15 }}>Back to Home</Text>
              </View>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </View>
    </NotebookBackground>
  );
}
