import React, { useEffect, useState, useCallback, useRef } from 'react';
import { navGuard } from '@/lib/nav-guard';
import { View, Text, StatusBar, ActivityIndicator, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeIn, FadeInDown, FadeInUp, useSharedValue, withRepeat, withSequence, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Users, Globe, Pencil, CalendarDays, ChevronRight, Trophy, Heart } from 'lucide-react-native';
import { useRewardedAd } from '@/lib/useRewardedAd';
import { NotebookBackground } from '@/components/NotebookBackground';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useGameStore } from '@/lib/state/game-store';
import { Sounds } from '@/lib/sounds';
import type { LevelData } from '@/lib/level-types';

const BACKEND_URL = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL || 'http://localhost:3000';
const MAX_LEVEL = 100;

export default function GameModeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setGameMode = useGameStore((s) => s.setGameMode);
  const loadLevelProgress = useGameStore((s) => s.loadLevelProgress);
  const levelProgress = useGameStore((s) => s.levelProgress);
  const startLevelGame = useGameStore((s) => s.startLevelGame);
  const setSession = useGameStore((s) => s.setSession);
  const resetLives = useGameStore((s) => s.resetLives);
  const [levelLoaded, setLevelLoaded] = useState(false);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [showSpIntro, setShowSpIntro] = useState(false);
  const [showMpIntro, setShowMpIntro] = useState(false);
  const [showNoLivesModal, setShowNoLivesModal] = useState(false);
  const [livesCountdown, setLivesCountdown] = useState('');

  const { showAd: showLivesAd, loaded: livesAdLoaded } = useRewardedAd();

  const shimmer = useSharedValue(0);
  const shimmerStyle = useAnimatedStyle(() => ({ opacity: 0.3 + shimmer.value * 0.5 }));

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
    loadLevelProgress().finally(() => setLevelLoaded(true));
  }, [loadLevelProgress]);

  useFocusEffect(
    useCallback(() => {
      setSession(null); // Always clear stale session when returning to mode screen
      setShowSpIntro(false);
      setShowMpIntro(false);
      loadLevelProgress();
      return () => { setShowSpIntro(false); setShowMpIntro(false); };
    }, [loadLevelProgress, setSession])
  );

  // Countdown timer for the no-lives modal — reads livesLastReset fresh each tick
  const livesLastResetRef = useRef(levelProgress.livesLastReset);
  useEffect(() => { livesLastResetRef.current = levelProgress.livesLastReset; }, [levelProgress.livesLastReset]);

  useEffect(() => {
    if (!showNoLivesModal) return;
    const RESET_MS = 12 * 60 * 60 * 1000;
    const update = () => {
      const elapsed = Date.now() - (livesLastResetRef.current || 0);
      const remaining = Math.max(0, RESET_MS - elapsed);
      if (remaining === 0) {
        resetLives();
        setShowNoLivesModal(false);
        return;
      }
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setLivesCountdown(`${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [showNoLivesModal, resetLives]);

  const startGame = useCallback(async () => {
    if (levelProgress.unlockedLevel > MAX_LEVEL) return;
    setIsStartingGame(true);
    setGameMode('single');
    try {
      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 12000);
      let response: Response;
      try {
        response = await fetch(`${BACKEND_URL}/api/levels/${levelProgress.unlockedLevel}`, { signal: controller.signal });
      } finally {
        clearTimeout(fetchTimeout);
      }
      if (!response.ok) throw new Error('Failed to fetch level');
      const levelData: LevelData = await response.json();
      await startLevelGame(levelData);
      Sounds.navigate();
      router.push('/game');
    } catch (error: any) {
      console.error('Error starting level:', error?.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsStartingGame(false);
    }
  }, [levelProgress.unlockedLevel, startLevelGame, setGameMode, router]);

  const handleSinglePlayer = useCallback(async () => {
    if (isStartingGame || !levelLoaded) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Sounds.tap();
    if (allLevelsCompleted) {
      navGuard(() => router.push('/completed-levels'));
      return;
    }
    if ((levelProgress.lives ?? 3) <= 0) {
      setShowNoLivesModal(true);
      return;
    }
    const shown = await AsyncStorage.getItem('npat_sp_intro_shown');
    if (!shown) { setShowSpIntro(true); return; }
    startGame();
  }, [isStartingGame, levelLoaded, allLevelsCompleted, levelProgress.lives, startGame, router]);

  const handleMultiplayer = async () => {
    if (!navGuard()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Sounds.navigate();
    const shown = await AsyncStorage.getItem('npat_mp_intro_shown');
    if (!shown) { setShowMpIntro(true); return; }
    setGameMode('multiplayer');
    router.push('/multiplayer-options');
  };

  const handleDaily = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Sounds.tap();
    Sounds.navigate();
    navGuard(() => router.push('/daily-challenge'));
  };

  const handleCompletedLevels = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Sounds.tap();
    Sounds.navigate();
    navGuard(() => router.push('/completed-levels'));
  };

  const completedCount = Math.max(0, Math.min(levelProgress.unlockedLevel - 1, MAX_LEVEL));
  const allLevelsCompleted = levelProgress.unlockedLevel > MAX_LEVEL;
  const progressPct = Math.min(completedCount / MAX_LEVEL, 1);

  return (
    <NotebookBackground lineStartY={160} lineSpacing={36} lineCount={32} marginX={48}>
      <StatusBar barStyle="dark-content" />

      <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom + 20, paddingHorizontal: 20 }}>

        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, marginBottom: 8 }}>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); Sounds.tap(); router.back(); }}
            style={({ pressed }) => ({
              width: 52, height: 52, borderRadius: 13,
              backgroundColor: pressed ? 'rgba(28,18,8,0.12)' : 'rgba(28,18,8,0.06)',
              borderWidth: 1.5, borderColor: 'rgba(100,70,20,0.2)',
              alignItems: 'center', justifyContent: 'center',
            })}
          >
            <ChevronLeft size={26} color="#3C2A10" strokeWidth={2.5} />
          </Pressable>
          <Text style={{ color: '#1C1208', fontSize: 26, fontWeight: '900', marginLeft: 14, letterSpacing: 0.2 }}>
            Select Mode
          </Text>
        </View>

        {/* Cards — stacked, evenly distributed in available space */}
        <View style={{ flex: 1, justifyContent: 'space-evenly' }}>

          {/* ── SINGLE PLAYER ── */}
          <Animated.View entering={FadeInDown.duration(400).delay(0)}>
            <Pressable
              onPress={handleSinglePlayer}
              disabled={isStartingGame}
              style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
            >
              <LinearGradient
                colors={['#1a3d80', '#152e6a', '#102458']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 20, overflow: 'hidden',
                  borderWidth: 4, borderColor: 'rgba(120,170,255,0.85)',
                  padding: 20, flexDirection: 'row', alignItems: 'center',
                  minHeight: 130,
                }}
              >
                {/* Soft inner highlight */}
                <View style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
                  backgroundColor: 'rgba(120,180,255,0.06)',
                  borderTopLeftRadius: 18, borderTopRightRadius: 18,
                }} />

                {/* Left: icon + title */}
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{
                      width: 36, height: 36, borderRadius: 10,
                      backgroundColor: 'rgba(80,140,255,0.2)',
                      borderWidth: 1.5, borderColor: 'rgba(120,170,255,0.4)',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Pencil size={17} color="#90c0ff" strokeWidth={2} />
                    </View>
                    <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: -0.3 }}>
                      Single Player
                    </Text>
                  </View>

                  {/* Progress bar */}
                  {levelLoaded && !allLevelsCompleted && (
                    <Animated.View entering={FadeIn.duration(400)} style={{ gap: 4, marginTop: 4 }}>
                      <View style={{ height: 3.5, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                        <View style={{
                          height: 3.5, borderRadius: 2,
                          backgroundColor: completedCount > 0 ? '#4ADE80' : 'rgba(144,192,255,0.3)',
                          width: `${progressPct * 100}%`,
                        }} />
                      </View>
                      <Text style={{ color: 'rgba(180,210,255,0.8)', fontSize: 10, fontWeight: '600' }}>
                        {completedCount} of {MAX_LEVEL} levels completed
                      </Text>
                    </Animated.View>
                  )}

                  {/* Lives */}
                  {levelLoaded && !allLevelsCompleted && (
                    <Animated.View entering={FadeIn.duration(400)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                      {[1, 2, 3].map((i) => {
                        const alive = i <= (levelProgress.lives ?? 3);
                        return (
                          <Heart
                            key={i}
                            size={13}
                            color={alive ? '#f87171' : 'rgba(144,192,255,0.2)'}
                            fill={alive ? '#f87171' : 'transparent'}
                            strokeWidth={2}
                          />
                        );
                      })}
                      {(levelProgress.lives ?? 3) === 0 && (
                        <Text style={{ color: '#f87171', fontSize: 9, fontWeight: '700', marginLeft: 2 }}>Tap to restore</Text>
                      )}
                    </Animated.View>
                  )}
                </View>

                {/* Right: level stats */}
                <View style={{ alignItems: 'flex-end', marginLeft: 16, gap: 8 }}>
                  {levelLoaded ? (
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      {isStartingGame ? (
                        <ActivityIndicator color="#90c0ff" size="small" />
                      ) : allLevelsCompleted ? (
                        <View style={{ alignItems: 'center' }}>
                          <Text style={{ fontSize: 32 }}>🏆</Text>
                          <Text style={{ color: '#fde68a', fontSize: 11, fontWeight: '800', textAlign: 'center' }}>All Done!</Text>
                        </View>
                      ) : (
                        <>
                          <View style={{
                            alignItems: 'flex-end',
                            backgroundColor: 'rgba(0,8,30,0.55)',
                            borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
                            borderWidth: 1.5, borderColor: 'rgba(120,170,255,0.7)',
                          }}>
                            <Text style={{ color: '#90c0ff', fontSize: 11, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase' }}>Up Next</Text>
                            <Text style={{ color: '#ffffff', fontSize: 40, fontWeight: '900', letterSpacing: -2, lineHeight: 42 }}>
                              {levelProgress.unlockedLevel} ›
                            </Text>
                          </View>
                          {completedCount > 0 && (
                            <Pressable onPress={(e) => { e.stopPropagation?.(); handleCompletedLevels(); }} style={{
                              alignItems: 'flex-end',
                              backgroundColor: 'rgba(0,30,15,0.55)',
                              borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
                              borderWidth: 1.5, borderColor: 'rgba(74,222,128,0.7)',
                            }}>
                              <Text style={{ color: '#4ade80', fontSize: 11, fontWeight: '900', letterSpacing: 1.4, textTransform: 'uppercase' }}>Done</Text>
                              <Text style={{ color: '#4ade80', fontSize: 26, fontWeight: '900', letterSpacing: -1, lineHeight: 28 }}>
                                {completedCount} ✓
                              </Text>
                            </Pressable>
                          )}
                        </>
                      )}
                    </View>
                  ) : (
                    <Animated.View style={[{ alignItems: 'flex-end', gap: 6 }, shimmerStyle]}>
                      <View style={{ width: 36, height: 8, borderRadius: 4, backgroundColor: 'rgba(144,192,255,0.15)' }} />
                      <View style={{ width: 48, height: 36, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)' }} />
                    </Animated.View>
                  )}
                </View>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {/* ── MULTIPLAYER ── */}
          <Animated.View entering={FadeInDown.duration(400).delay(60)}>
            <Pressable
              onPress={handleMultiplayer}
              style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
            >
              <View style={{
                borderRadius: 20, overflow: 'hidden',
                backgroundColor: '#EDE4C4',
                borderWidth: 4, borderColor: '#B8900A',
                padding: 20, flexDirection: 'row', alignItems: 'center',
                minHeight: 112,
              }}>
                {/* Notebook lines */}
                {[0,1,2,3].map(i => (
                  <View key={i} style={{
                    position: 'absolute', left: 0, right: 0,
                    top: 22 + i * 26, height: 1,
                    backgroundColor: 'rgba(140,100,20,0.1)',
                  }} />
                ))}

                {/* Left: icon + title */}
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{
                      width: 36, height: 36, borderRadius: 10,
                      backgroundColor: 'rgba(184,144,10,0.15)',
                      borderWidth: 1.5, borderColor: '#C8A030',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Users size={17} color="#7A5000" strokeWidth={2.5} />
                    </View>
                    <Text style={{ color: '#1C1208', fontSize: 22, fontWeight: '900', letterSpacing: -0.3 }}>
                      Multiplayer
                    </Text>
                  </View>
                </View>

                {/* Right: player count badge */}
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  backgroundColor: '#B8900A',
                  borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
                }}>
                  <Users size={14} color="#fff" strokeWidth={2.5} />
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0.3 }}>2–10 Players</Text>
                </View>
              </View>
            </Pressable>
          </Animated.View>

          {/* ── DAILY CHALLENGE ── */}
          <Animated.View entering={FadeInDown.duration(400).delay(120)}>
            <Pressable
              onPress={handleDaily}
              style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
            >
              <View style={{
                borderRadius: 20, overflow: 'hidden',
                backgroundColor: '#061410',
                borderWidth: 4, borderColor: '#00C840',
                padding: 20, flexDirection: 'row', alignItems: 'center',
                minHeight: 112,
              }}>
                {/* Scanlines */}
                {[0,1,2,3].map(i => (
                  <View key={i} style={{
                    position: 'absolute', left: 0, right: 0,
                    top: 22 + i * 26, height: 1,
                    backgroundColor: 'rgba(0,200,64,0.05)',
                  }} />
                ))}
                {/* Corner accents */}
                <View style={{ position: 'absolute', top: 10, right: 12 }}>
                  <View style={{ width: 12, height: 2.5, backgroundColor: '#00B83A', marginBottom: 2 }} />
                  <View style={{ width: 2.5, height: 12, backgroundColor: '#00B83A', alignSelf: 'flex-end' }} />
                </View>

                {/* Left: icon + title + badge */}
                <View style={{ flex: 1, gap: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{
                      width: 36, height: 36, borderRadius: 10,
                      backgroundColor: 'rgba(0,184,58,0.12)',
                      borderWidth: 1.5, borderColor: 'rgba(0,184,58,0.45)',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <CalendarDays size={17} color="#00C840" strokeWidth={2} />
                    </View>
                    <Text style={{ color: '#00C840', fontSize: 22, fontWeight: '900', letterSpacing: -0.3 }}>
                      Daily Challenge
                    </Text>
                  </View>
                  {/* Global Leaderboard badge — own row to avoid crowding the title */}
                  <View style={{ marginLeft: 44 }}>
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', gap: 4,
                      alignSelf: 'flex-start',
                      backgroundColor: 'rgba(0,200,64,0.12)',
                      borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5,
                      borderWidth: 1.5, borderColor: '#00C840',
                    }}>
                      <Globe size={11} color="#00C840" strokeWidth={2.5} />
                      <Text style={{ color: '#00C840', fontSize: 10, fontWeight: '900', letterSpacing: 0.3 }}>Global Leaderboard</Text>
                    </View>
                  </View>
                </View>
              </View>
            </Pressable>
          </Animated.View>

        </View>
      </View>


      {/* SP first-time intro */}
      {showSpIntro && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, zIndex: 50 }}>
          <Animated.View entering={FadeInUp.duration(350).springify()} style={{
            backgroundColor: '#163468', borderRadius: 22, padding: 26,
            borderWidth: 2.5, borderColor: 'rgba(80,160,255,0.5)',
            shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 24,
            width: '100%',
          }}>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 16 }}>Single Player 🎮</Text>
            <View style={{ marginBottom: 24, gap: 8 }}>
              {['A solo mode designed to test your vocabulary and speed', 'Score points to unlock higher levels', 'Categories get more creative and the rules more demanding'].map((line, i) => (
                <Text key={i} style={{ color: 'rgba(144,192,255,0.85)', fontSize: 14, lineHeight: 20, textAlign: 'center' }}>{line}</Text>
              ))}
            </View>
            <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); AsyncStorage.setItem('npat_sp_intro_shown', '1'); setShowSpIntro(false); startGame(); }} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
              <View style={{ backgroundColor: '#4090e8', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>Let's Play</Text>
              </View>
            </Pressable>
          </Animated.View>
        </View>
      )}

      {/* MP first-time intro */}
      {showMpIntro && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(28,20,10,0.75)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, zIndex: 50 }}>
          <Animated.View entering={FadeInUp.duration(350).springify()} style={{
            backgroundColor: '#F5EDCF', borderRadius: 22, padding: 26,
            borderWidth: 2.5, borderColor: '#D09010',
            width: '100%', overflow: 'hidden',
          }}>
            {[62,84,106,128,150,172,194,216].map((top) => (
              <View key={top} style={{ position: 'absolute', left: 0, right: 0, top, height: 1, backgroundColor: 'rgba(208,144,16,0.15)' }} />
            ))}
            <Text style={{ color: '#1C1208', fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 16 }}>Multiplayer 🎲</Text>
            <View style={{ marginBottom: 24, gap: 8 }}>
              {['A fresh feel of the classic Name Place Animal Things', 'Compete with friends and family in exciting categories', 'Unleash your creativity and outscore your rivals'].map((line, i) => (
                <Text key={i} style={{ color: '#5A3E1B', fontSize: 14, lineHeight: 20, textAlign: 'center' }}>{line}</Text>
              ))}
            </View>
            <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); AsyncStorage.setItem('npat_mp_intro_shown', '1'); setShowMpIntro(false); setGameMode('multiplayer'); router.push('/multiplayer-options'); }} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
              <View style={{ backgroundColor: '#1C1208', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#D09010' }}>
                <Text style={{ color: '#F5EDCF', fontSize: 16, fontWeight: '900' }}>Let's Play</Text>
              </View>
            </Pressable>
          </Animated.View>
        </View>
      )}

      {/* ── NO LIVES MODAL ── */}
      {showNoLivesModal && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.80)',
          alignItems: 'center', justifyContent: 'center',
          paddingHorizontal: 28, zIndex: 60,
        }}>
          <Animated.View entering={FadeInUp.duration(400).springify().damping(14)} style={{
            width: '100%', backgroundColor: '#1a1520',
            borderRadius: 24, padding: 28,
            borderWidth: 2.5, borderColor: '#f87171',
            alignItems: 'center', gap: 14,
            shadowColor: '#f87171', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.35, shadowRadius: 28,
          }}>
            {/* Hearts row */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 4 }}>
              {[1, 2, 3].map((i) => (
                <Heart key={i} size={30} color="rgba(248,113,113,0.25)" fill="transparent" strokeWidth={2} />
              ))}
            </View>

            <Text style={{ color: '#fca5a5', fontSize: 24, fontWeight: '900', textAlign: 'center' }}>
              Out of Lives!
            </Text>
            <Text style={{ color: 'rgba(252,165,165,0.6)', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              You've used all your lives.{'\n'}They refill automatically every 24 hours.
            </Text>

            {/* Countdown */}
            <View style={{ backgroundColor: 'rgba(248,113,113,0.1)', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10, borderWidth: 1.5, borderColor: 'rgba(248,113,113,0.3)' }}>
              <Text style={{ color: 'rgba(252,165,165,0.5)', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textAlign: 'center', marginBottom: 2 }}>NEXT REFILL IN</Text>
              <Text style={{ color: '#fca5a5', fontSize: 26, fontWeight: '900', textAlign: 'center', letterSpacing: 1 }}>{livesCountdown}</Text>
            </View>

            {/* Watch Ad button */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                showLivesAd(
                  () => { resetLives(); setShowNoLivesModal(false); },
                  () => {},
                );
              }}
              style={({ pressed }) => ({ width: '100%', transform: [{ scale: pressed ? 0.97 : 1 }] })}
            >
              <View style={{
                borderRadius: 14, paddingVertical: 16,
                backgroundColor: '#ef4444', borderWidth: 0,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>
                  {livesAdLoaded ? '▶  Watch Ad – Restore All Lives' : '▶  Watch Ad – Restore All Lives'}
                </Text>
              </View>
            </Pressable>

            {/* Dismiss */}
            <Pressable onPress={() => setShowNoLivesModal(false)} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
              <Text style={{ color: 'rgba(252,165,165,0.5)', fontSize: 13, fontWeight: '600' }}>Maybe Later</Text>
            </Pressable>
          </Animated.View>
        </View>
      )}
    </NotebookBackground>
  );
}
