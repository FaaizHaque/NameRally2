import React, { useEffect, useState, useCallback, useRef } from 'react';
import { navGuard } from '@/lib/nav-guard';
import { View, Text, TouchableOpacity, StatusBar, ActivityIndicator, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeIn, FadeInDown, useSharedValue, withRepeat, withSequence, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Users, Zap, Trophy, Pencil, CalendarDays } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useGameStore } from '@/lib/state/game-store';
import { Sounds } from '@/lib/sounds';
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
  const [showMpIntro, setShowMpIntro] = useState(false);

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
    loadLevelProgress().finally(() => setLevelLoaded(true));
  }, [loadLevelProgress]);

  // Always clear intro overlays when this screen gains or loses focus
  useFocusEffect(
    useCallback(() => {
      setShowSpIntro(false);
      setShowMpIntro(false);
      return () => { setShowSpIntro(false); setShowMpIntro(false); };
    }, [])
  );

  const startGame = useCallback(async () => {
    setGameMode('single');
    // Only show the loading overlay if the fetch is slow — avoids a jarring flash
    // when Railway responds quickly (< 400 ms)
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
    if (!shown) {
      setShowSpIntro(true);
      return; // startGame called from modal dismiss
    }
    startGame();
  }, [isStartingGame, levelLoaded, startGame]);

  const handleMultiplayer = async () => {
    if (!navGuard()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Sounds.navigate();
    const shown = await AsyncStorage.getItem('npat_mp_intro_shown');
    if (!shown) {
      setShowMpIntro(true);
      return;
    }
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
                  borderWidth: 1.5, borderColor: 'rgba(120,170,255,0.4)',
                  padding: 20, justifyContent: 'space-between',
                }}
              >
                {/* Subtle top highlight */}
                <View style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '35%',
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  borderTopLeftRadius: 20, borderTopRightRadius: 20,
                }} />


                {/* Top row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{
                    width: 44, height: 44, borderRadius: 12,
                    backgroundColor: 'rgba(80,140,255,0.2)',
                    borderWidth: 1.5, borderColor: 'rgba(120,170,255,0.4)',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Pencil size={20} color="#90c0ff" strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontSize: 21, fontWeight: '900' }}>Single Player</Text>
                    <Text style={{ color: 'rgba(160,200,255,0.55)', fontSize: 12, marginTop: 2 }}>
                      Level-by-level solo challenge
                    </Text>
                  </View>
                  <ChevronLeft size={18} color="rgba(144,192,255,0.5)" strokeWidth={2.5} style={{ transform: [{ rotate: '180deg' }] }} />
                </View>

                {/* Level info — typographic, bottom of card */}
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  {levelLoaded ? (
                    <Animated.View entering={FadeIn.duration(300)} style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', flex: 1 }}>
                      {isStartingGame ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <ActivityIndicator color="#90c0ff" size="small" />
                          <Text style={{ color: 'rgba(160,200,255,0.7)', fontSize: 14, fontWeight: '700' }}>
                            Loading…
                          </Text>
                        </View>
                      ) : allLevelsCompleted ? (
                        <View>
                          <Text style={{ color: 'rgba(251,191,36,0.6)', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' }}>All done!</Text>
                          <Text style={{ color: '#fde68a', fontSize: 36, fontWeight: '900', letterSpacing: -1, lineHeight: 40 }}>500/500</Text>
                        </View>
                      ) : (
                        <>
                          <View>
                            <Text style={{ color: 'rgba(144,192,255,0.5)', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' }}>Up Next</Text>
                            <Text style={{ color: '#fff', fontSize: 42, fontWeight: '900', letterSpacing: -2, lineHeight: 46 }}>
                              Lvl {levelProgress.unlockedLevel}
                            </Text>
                          </View>
                          {completedCount > 0 && (
                            <TouchableOpacity
                              onPress={(e) => { e.stopPropagation(); handleCompletedLevels(); }}
                              style={{ alignItems: 'flex-end', paddingBottom: 4 }}
                            >
                              <Text style={{ color: 'rgba(52,211,153,0.5)', fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>Completed</Text>
                              <Text style={{ color: 'rgba(52,211,153,0.85)', fontSize: 16, fontWeight: '800' }}>
                                {completedCount} ›
                              </Text>
                            </TouchableOpacity>
                          )}
                        </>
                      )}
                    </Animated.View>
                  ) : (
                    <Animated.View style={[{ gap: 6 }, shimmerStyle]}>
                      <View style={{ width: 60, height: 8, borderRadius: 4, backgroundColor: 'rgba(160,200,255,0.15)' }} />
                      <View style={{ width: 120, height: 36, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)' }} />
                    </Animated.View>
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
              <View style={{
                flex: 1, backgroundColor: '#F2EAD0',
                borderRadius: 20, borderWidth: 2, borderColor: '#C8A84B',
                overflow: 'hidden', padding: 20, justifyContent: 'space-between',
              }}>
                {/* Subtle ruled lines across full width */}
                {[0,1,2,3,4,5].map(i => (
                  <View key={i} style={{
                    position: 'absolute', left: 0, right: 0,
                    top: 32 + i * 28, height: 1,
                    backgroundColor: 'rgba(160,130,60,0.1)',
                  }} />
                ))}

                {/* Top row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{
                    width: 44, height: 44, borderRadius: 12,
                    backgroundColor: 'rgba(208,160,16,0.15)',
                    borderWidth: 1.5, borderColor: '#D09010',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Users size={20} color="#7A5000" strokeWidth={2.5} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#1C120A', fontSize: 21, fontWeight: '900' }}>Multiplayer</Text>
                    <Text style={{ color: '#8A6030', fontSize: 12, marginTop: 2 }}>
                      Host or join with friends
                    </Text>
                  </View>
                  <ChevronLeft size={18} color="#C8A84B" strokeWidth={2.5} style={{ transform: [{ rotate: '180deg' }] }} />
                </View>

                {/* Player avatars row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {['🦊','🐼','🦁','🐯','🦝'].map((emoji, i) => (
                    <View key={i} style={{
                      width: 30, height: 30, borderRadius: 15,
                      backgroundColor: 'rgba(208,160,16,0.12)',
                      borderWidth: 1, borderColor: 'rgba(200,168,75,0.5)',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Text style={{ fontSize: 15 }}>{emoji}</Text>
                    </View>
                  ))}
                  <Text style={{ color: '#A07830', fontSize: 12, fontWeight: '700', marginLeft: 4 }}>
                    2–10 players
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
                    width: 44, height: 44, borderRadius: 10,
                    backgroundColor: '#0a2010',
                    borderWidth: 1.5, borderColor: '#00C840',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CalendarDays size={20} color="#00C840" strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#00C840', fontSize: 21, fontWeight: '900', letterSpacing: 0.5 }}>
                      Daily Challenge
                    </Text>
                    <Text style={{ color: 'rgba(0,200,64,0.5)', fontSize: 12, marginTop: 2 }}>
                      New puzzle every day
                    </Text>
                  </View>
                  <ChevronLeft size={18} color="rgba(0,200,64,0.45)" strokeWidth={2.5} style={{ transform: [{ rotate: '180deg' }] }} />
                </View>

                {/* Bottom inline info */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Zap size={13} color="#00C840" strokeWidth={2.5} fill="#00C840" />
                  <Text style={{ color: 'rgba(0,200,64,0.65)', fontSize: 12, fontWeight: '700', letterSpacing: 0.3 }}>
                    Global leaderboard · Finish fast to climb
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>

        </View>
      </LinearGradient>

      {/* Full-screen loading overlay — shown while fetching level data so user
          never sees a dark unresponsive screen between "Let's Play" and game start */}
      {isStartingGame && (
        <Pressable
          onPress={() => setIsStartingGame(false)}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: '#1a2845',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 99,
          }}
        >
          <ActivityIndicator size="large" color="#90c0ff" />
          <Text style={{ color: '#90c0ff', marginTop: 16, fontSize: 18, fontWeight: '700', letterSpacing: 0.5 }}>
            Loading level…
          </Text>
          <Text style={{ color: 'rgba(144,192,255,0.4)', marginTop: 32, fontSize: 13 }}>
            tap to cancel
          </Text>
        </Pressable>
      )}

      {/* Single Player first-time intro — absolute View, NOT Modal, so it can never
          bleed through to other screens in the navigation stack */}
      {showSpIntro && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, zIndex: 50 }}>
          <View style={{
            backgroundColor: '#163468', borderRadius: 20, padding: 26,
            borderWidth: 2, borderColor: 'rgba(80,160,255,0.5)',
            shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 24,
            elevation: 20, width: '100%',
          }}>
            <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 16 }}>
              Single Player 🎮
            </Text>
            <View style={{ marginBottom: 24, gap: 8 }}>
              {[
                'A solo mode designed to test your vocabulary and speed',
                'Score points to unlock higher levels',
                'Categories get more creative and the rules more demanding',
              ].map((line, i) => (
                <Text key={i} style={{ color: 'rgba(144,192,255,0.9)', fontSize: 14, lineHeight: 20, textAlign: 'center' }}>
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
          </View>
        </View>
      )}

      {/* Multiplayer first-time intro — absolute View, NOT Modal */}
      {showMpIntro && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(28,20,10,0.72)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, zIndex: 50 }}>
          <View style={{
            backgroundColor: '#F2EAD0', borderRadius: 20, padding: 26,
            borderWidth: 2.5, borderColor: '#D09010',
            shadowColor: '#1C1410', shadowOffset: { width: 3, height: 5 }, shadowOpacity: 0.3, shadowRadius: 0,
            elevation: 20, width: '100%', overflow: 'hidden',
          }}>
            {/* Notebook ruled lines */}
            {[62, 84, 106, 128, 150, 172, 194, 216].map((top) => (
              <View key={top} style={{ position: 'absolute', left: 0, right: 0, top, height: 1, backgroundColor: 'rgba(208,144,16,0.18)' }} />
            ))}
            {/* Red margin line */}
            <View style={{ position: 'absolute', left: 44, top: 0, bottom: 0, width: 1.5, backgroundColor: 'rgba(220,60,60,0.22)' }} />
            <Text style={{ color: '#1C1410', fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 16 }}>
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
              <View style={{ backgroundColor: '#1C1410', borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 2, borderColor: '#D09010' }}>
                <Text style={{ color: '#F2EAD0', fontSize: 16, fontWeight: '900' }}>Let's Play</Text>
              </View>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
