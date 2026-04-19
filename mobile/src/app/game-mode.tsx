import React, { useEffect, useState, useCallback, useRef } from 'react';
import { navGuard } from '@/lib/nav-guard';
import { View, Text, StatusBar, ActivityIndicator, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeIn, FadeInDown, FadeInUp, useSharedValue, withRepeat, withSequence, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Users, Zap, Pencil, CalendarDays, ChevronRight } from 'lucide-react-native';
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
  const [levelLoaded, setLevelLoaded] = useState(false);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [showSpIntro, setShowSpIntro] = useState(false);
  const [showMpIntro, setShowMpIntro] = useState(false);

  const shimmer = useSharedValue(0);
  const shimmerStyle = useAnimatedStyle(() => ({ opacity: 0.3 + shimmer.value * 0.4 }));

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
      setShowSpIntro(false);
      setShowMpIntro(false);
      return () => { setShowSpIntro(false); setShowMpIntro(false); };
    }, [])
  );

  const startGame = useCallback(async () => {
    if (levelProgress.unlockedLevel > MAX_LEVEL) return;
    setGameMode('single');
    const slowTimer = setTimeout(() => setIsStartingGame(true), 400);
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
      clearTimeout(slowTimer);
      setIsStartingGame(false);
    }
  }, [levelProgress.unlockedLevel, startLevelGame, setGameMode, router]);

  const handleSinglePlayer = useCallback(async () => {
    if (isStartingGame || !levelLoaded) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Sounds.tap();
    const shown = await AsyncStorage.getItem('npat_sp_intro_shown');
    if (!shown) { setShowSpIntro(true); return; }
    startGame();
  }, [isStartingGame, levelLoaded, startGame]);

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
    <View style={{ flex: 1, backgroundColor: '#111827' }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#111827', '#1a2235', '#111827']}
        style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom + 20, paddingHorizontal: 16 }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, marginBottom: 12 }}>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); Sounds.tap(); router.back(); }}
            style={({ pressed }) => ({
              width: 40, height: 40, borderRadius: 10,
              backgroundColor: pressed ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
              alignItems: 'center', justifyContent: 'center',
            })}
          >
            <ChevronLeft size={20} color="rgba(255,255,255,0.7)" strokeWidth={2.5} />
          </Pressable>
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 20, fontWeight: '800', marginLeft: 12, letterSpacing: 0.2 }}>
            Select Mode
          </Text>
        </View>

        {/* Layout: SP hero (top) + MP/DC row (bottom) */}
        <View style={{ flex: 1, gap: 12 }}>

          {/* ── SINGLE PLAYER HERO ── */}
          <Animated.View entering={FadeInDown.duration(450).delay(0)} style={{ flex: 2.2 }}>
            <Pressable
              onPress={handleSinglePlayer}
              disabled={isStartingGame}
              style={({ pressed }) => ({ flex: 1, transform: [{ scale: pressed ? 0.985 : 1 }] })}
            >
              <LinearGradient
                colors={['#1b3d7a', '#1a3268', '#142858']}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={{ flex: 1, borderRadius: 24, overflow: 'hidden', padding: 24 }}
              >
                {/* Soft inner glow top */}
                <View style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: 120,
                  backgroundColor: 'rgba(100,160,255,0.07)',
                  borderTopLeftRadius: 24, borderTopRightRadius: 24,
                }} />
                {/* Subtle dot grid */}
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.04 }}>
                  {[...Array(6)].map((_, row) => (
                    <View key={row} style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: row === 0 ? 20 : 28 }}>
                      {[...Array(8)].map((_, col) => (
                        <View key={col} style={{ width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#90c0ff' }} />
                      ))}
                    </View>
                  ))}
                </View>

                {/* Mode label row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 'auto' }}>
                  <View style={{
                    width: 32, height: 32, borderRadius: 9,
                    backgroundColor: 'rgba(80,140,255,0.18)',
                    borderWidth: 1, borderColor: 'rgba(120,170,255,0.3)',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Pencil size={15} color="#90c0ff" strokeWidth={2} />
                  </View>
                  <Text style={{ color: 'rgba(144,192,255,0.7)', fontSize: 12, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                    Single Player
                  </Text>
                  <View style={{ marginLeft: 'auto' }}>
                    <ChevronRight size={16} color="rgba(144,192,255,0.35)" strokeWidth={2.5} />
                  </View>
                </View>

                {/* Main content: level stats */}
                <View style={{ flex: 1, justifyContent: 'center' }}>
                  {levelLoaded ? (
                    <Animated.View entering={FadeIn.duration(400)}>
                      {isStartingGame ? (
                        <View style={{ alignItems: 'center', gap: 10 }}>
                          <ActivityIndicator color="#90c0ff" size="large" />
                          <Text style={{ color: 'rgba(144,192,255,0.6)', fontSize: 14, fontWeight: '600' }}>Loading…</Text>
                        </View>
                      ) : allLevelsCompleted ? (
                        <View style={{ alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 52, lineHeight: 56 }}>🏆</Text>
                          <Text style={{ color: '#fde68a', fontSize: 24, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 }}>
                            All 100 Levels Done!
                          </Text>
                          <Text style={{ color: 'rgba(251,191,36,0.5)', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>
                            More levels coming in the next update
                          </Text>
                        </View>
                      ) : (
                        <View style={{ gap: 20 }}>
                          {/* Two stat columns */}
                          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 0 }}>
                            {/* Current level */}
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: 'rgba(144,192,255,0.5)', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 }}>
                                Up Next
                              </Text>
                              <Text style={{ color: '#ffffff', fontSize: 56, fontWeight: '900', letterSpacing: -3, lineHeight: 58 }}>
                                {levelProgress.unlockedLevel}
                              </Text>
                              <Text style={{ color: 'rgba(144,192,255,0.45)', fontSize: 13, fontWeight: '600', marginTop: 2 }}>
                                Level
                              </Text>
                            </View>

                            {/* Divider */}
                            <View style={{ width: 1, height: 64, backgroundColor: 'rgba(120,170,255,0.12)', marginBottom: 8, marginHorizontal: 16 }} />

                            {/* Completed */}
                            <Pressable
                              onPress={(e) => { e.stopPropagation?.(); handleCompletedLevels(); }}
                              style={{ flex: 1, alignItems: 'flex-end' }}
                            >
                              <Text style={{ color: 'rgba(144,192,255,0.5)', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2 }}>
                                Completed
                              </Text>
                              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
                                <Text style={{ color: completedCount > 0 ? 'rgba(52,211,153,0.9)' : 'rgba(144,192,255,0.3)', fontSize: 56, fontWeight: '900', letterSpacing: -3, lineHeight: 58 }}>
                                  {completedCount}
                                </Text>
                              </View>
                              <Text style={{ color: 'rgba(144,192,255,0.45)', fontSize: 13, fontWeight: '600', marginTop: 2 }}>
                                {completedCount > 0 ? 'tap to review ›' : 'levels'}
                              </Text>
                            </Pressable>
                          </View>

                          {/* Progress bar */}
                          <View style={{ gap: 6 }}>
                            <View style={{ height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                              <View style={{
                                height: 4, borderRadius: 2,
                                backgroundColor: completedCount > 0 ? '#4ADE80' : 'rgba(144,192,255,0.3)',
                                width: `${progressPct * 100}%`,
                              }} />
                            </View>
                            <Text style={{ color: 'rgba(144,192,255,0.35)', fontSize: 11, fontWeight: '600' }}>
                              {completedCount} of {MAX_LEVEL} levels completed
                            </Text>
                          </View>
                        </View>
                      )}
                    </Animated.View>
                  ) : (
                    <Animated.View style={[{ gap: 12 }, shimmerStyle]}>
                      <View style={{ width: '40%', height: 10, borderRadius: 5, backgroundColor: 'rgba(144,192,255,0.12)' }} />
                      <View style={{ width: '70%', height: 52, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)' }} />
                      <View style={{ width: '100%', height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.06)' }} />
                    </Animated.View>
                  )}
                </View>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {/* ── BOTTOM ROW: MP + DC side by side ── */}
          <View style={{ flex: 1, flexDirection: 'row', gap: 12 }}>

            {/* MULTIPLAYER */}
            <Animated.View entering={FadeInDown.duration(450).delay(80)} style={{ flex: 1 }}>
              <Pressable
                onPress={handleMultiplayer}
                style={({ pressed }) => ({ flex: 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}
              >
                <View style={{
                  flex: 1, backgroundColor: '#F5EDCF',
                  borderRadius: 22, overflow: 'hidden',
                  padding: 18, justifyContent: 'space-between',
                }}>
                  {/* Notebook ruled lines */}
                  {[...Array(8)].map((_, i) => (
                    <View key={i} style={{
                      position: 'absolute', left: 0, right: 0,
                      top: 24 + i * 24, height: 1,
                      backgroundColor: 'rgba(160,128,56,0.1)',
                    }} />
                  ))}

                  {/* Icon */}
                  <View style={{
                    width: 40, height: 40, borderRadius: 11,
                    backgroundColor: 'rgba(208,160,16,0.18)',
                    borderWidth: 1.5, borderColor: 'rgba(200,160,60,0.5)',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Users size={19} color="#7A5000" strokeWidth={2.5} />
                  </View>

                  {/* Title + tagline */}
                  <View style={{ gap: 3 }}>
                    <Text style={{ color: '#1C1208', fontSize: 18, fontWeight: '900', letterSpacing: -0.3 }}>
                      Multi-{'\n'}player
                    </Text>
                    <Text style={{ color: '#9A7040', fontSize: 11, fontWeight: '600' }}>
                      Host or join
                    </Text>
                  </View>

                  {/* Avatar row */}
                  <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
                    {['🦊','🐼','🦁'].map((e, i) => (
                      <View key={i} style={{
                        width: 26, height: 26, borderRadius: 13,
                        backgroundColor: 'rgba(208,160,16,0.12)',
                        borderWidth: 1, borderColor: 'rgba(200,168,75,0.4)',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{ fontSize: 13 }}>{e}</Text>
                      </View>
                    ))}
                    <View style={{
                      width: 26, height: 26, borderRadius: 13,
                      backgroundColor: 'rgba(208,160,16,0.08)',
                      borderWidth: 1, borderColor: 'rgba(200,168,75,0.3)',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ color: '#9A7040', fontSize: 10, fontWeight: '800' }}>+7</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            </Animated.View>

            {/* DAILY CHALLENGE */}
            <Animated.View entering={FadeInDown.duration(450).delay(130)} style={{ flex: 1 }}>
              <Pressable
                onPress={handleDaily}
                style={({ pressed }) => ({ flex: 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}
              >
                <View style={{
                  flex: 1, backgroundColor: '#061410',
                  borderRadius: 22, overflow: 'hidden',
                  padding: 18, justifyContent: 'space-between',
                  borderWidth: 1, borderColor: 'rgba(0,200,64,0.2)',
                }}>
                  {/* Scanline overlay */}
                  {[...Array(8)].map((_, i) => (
                    <View key={i} style={{
                      position: 'absolute', left: 0, right: 0,
                      top: 24 + i * 24, height: 1,
                      backgroundColor: 'rgba(0,200,64,0.04)',
                    }} />
                  ))}

                  {/* Icon */}
                  <View style={{
                    width: 40, height: 40, borderRadius: 11,
                    backgroundColor: 'rgba(0,200,64,0.1)',
                    borderWidth: 1.5, borderColor: 'rgba(0,200,64,0.35)',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CalendarDays size={19} color="#00C840" strokeWidth={2} />
                  </View>

                  {/* Title + tagline */}
                  <View style={{ gap: 3 }}>
                    <Text style={{ color: '#00C840', fontSize: 18, fontWeight: '900', letterSpacing: -0.3 }}>
                      Daily{'\n'}Challenge
                    </Text>
                    <Text style={{ color: 'rgba(0,200,64,0.45)', fontSize: 11, fontWeight: '600' }}>
                      New every day
                    </Text>
                  </View>

                  {/* Leaderboard tag */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Zap size={11} color="#00C840" fill="#00C840" strokeWidth={2} />
                    <Text style={{ color: 'rgba(0,200,64,0.55)', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>
                      Global ranks
                    </Text>
                  </View>
                </View>
              </Pressable>
            </Animated.View>

          </View>
        </View>
      </LinearGradient>

      {/* Loading overlay */}
      {isStartingGame && (
        <Pressable
          onPress={() => setIsStartingGame(false)}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: '#111827',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 99,
          }}
        >
          <ActivityIndicator size="large" color="#90c0ff" />
          <Text style={{ color: '#90c0ff', marginTop: 16, fontSize: 17, fontWeight: '700' }}>
            Loading level…
          </Text>
          <Text style={{ color: 'rgba(144,192,255,0.35)', marginTop: 28, fontSize: 12 }}>
            tap to cancel
          </Text>
        </Pressable>
      )}

      {/* SP first-time intro */}
      {showSpIntro && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, zIndex: 50 }}>
          <Animated.View entering={FadeInUp.duration(350).springify()} style={{
            backgroundColor: '#163468', borderRadius: 22, padding: 26,
            borderWidth: 1.5, borderColor: 'rgba(80,160,255,0.45)',
            shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 24,
            width: '100%',
          }}>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 16 }}>
              Single Player 🎮
            </Text>
            <View style={{ marginBottom: 24, gap: 8 }}>
              {[
                'A solo mode designed to test your vocabulary and speed',
                'Score points to unlock higher levels',
                'Categories get more creative and the rules more demanding',
              ].map((line, i) => (
                <Text key={i} style={{ color: 'rgba(144,192,255,0.85)', fontSize: 14, lineHeight: 20, textAlign: 'center' }}>
                  {line}
                </Text>
              ))}
            </View>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                AsyncStorage.setItem('npat_sp_intro_shown', '1');
                setShowSpIntro(false);
                startGame();
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            >
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
            borderWidth: 2, borderColor: '#D09010',
            shadowColor: '#1C1410', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16,
            width: '100%', overflow: 'hidden',
          }}>
            {[62, 84, 106, 128, 150, 172, 194, 216].map((top) => (
              <View key={top} style={{ position: 'absolute', left: 0, right: 0, top, height: 1, backgroundColor: 'rgba(208,144,16,0.15)' }} />
            ))}
            <Text style={{ color: '#1C1208', fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 16 }}>
              Multiplayer 🎲
            </Text>
            <View style={{ marginBottom: 24, gap: 8 }}>
              {[
                'A fresh feel of the classic Name Place Animal Things',
                'Compete with friends and family in exciting categories',
                'Unleash your creativity and outscore your rivals',
              ].map((line, i) => (
                <Text key={i} style={{ color: '#5A3E1B', fontSize: 14, lineHeight: 20, textAlign: 'center' }}>
                  {line}
                </Text>
              ))}
            </View>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                AsyncStorage.setItem('npat_mp_intro_shown', '1');
                setShowMpIntro(false);
                setGameMode('multiplayer');
                router.push('/multiplayer-options');
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            >
              <View style={{ backgroundColor: '#1C1208', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: '#D09010' }}>
                <Text style={{ color: '#F5EDCF', fontSize: 16, fontWeight: '900' }}>Let's Play</Text>
              </View>
            </Pressable>
          </Animated.View>
        </View>
      )}
    </View>
  );
}
