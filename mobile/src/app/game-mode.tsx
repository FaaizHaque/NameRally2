import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StatusBar, ActivityIndicator, Modal, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeIn, FadeInDown, useSharedValue, withRepeat, withSequence, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import { useRouter, useFocusEffect } from 'expo-router';
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

  // Dismiss any open intro modals on blur so they never flash during navigation
  useFocusEffect(
    useCallback(() => {
      return () => { setShowSpIntro(false); setShowMpIntro(false); };
    }, [])
  );

  const startGame = useCallback(async () => {
    setGameMode('single');
    setIsStartingGame(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/levels/${levelProgress.unlockedLevel}`);
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
    const shown = await AsyncStorage.getItem('npat_sp_intro_shown');
    if (!shown) {
      setShowSpIntro(true);
      return; // startGame called from modal dismiss
    }
    startGame();
  }, [isStartingGame, levelLoaded, startGame]);

  const handleMultiplayer = async () => {
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

      {/* Single Player first-time intro */}
      <Modal visible={showSpIntro} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
          <View style={{
            backgroundColor: '#1f2d50', borderRadius: 20, padding: 26,
            borderWidth: 2, borderColor: 'rgba(120,170,255,0.4)',
            shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 24,
            elevation: 20, width: '100%',
          }}>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 18 }}>
              Single Player 🎮
            </Text>
            <View style={{ gap: 10, marginBottom: 24 }}>
              {[
                'A letter drops each round',
                'Type a word for every category before time runs out',
                '10 pts for a valid answer',
                '+2 bonus for words over 10 letters',
                'Score enough to unlock the next level',
              ].map((line, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#60a5fa', marginTop: 7 }} />
                  <Text style={{ color: 'rgba(160,200,255,0.9)', fontSize: 14, lineHeight: 20, flex: 1 }}>{line}</Text>
                </View>
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
      </Modal>

      {/* Multiplayer first-time intro */}
      <Modal visible={showMpIntro} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
          <View style={{
            backgroundColor: '#1f2d50', borderRadius: 20, padding: 26,
            borderWidth: 2, borderColor: 'rgba(252,211,77,0.4)',
            shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 24,
            elevation: 20, width: '100%',
          }}>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 18 }}>
              Multiplayer 🎲
            </Text>
            <View style={{ gap: 10, marginBottom: 24 }}>
              {[
                'Same letter and categories for everyone',
                'Unique answers score full points',
                'Shared answers split the points',
                'Hit STOP when done — others get 5 more seconds',
                'Use the game code to rejoin if you disconnect',
              ].map((line, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#FCD34D', marginTop: 7 }} />
                  <Text style={{ color: 'rgba(255,240,180,0.9)', fontSize: 14, lineHeight: 20, flex: 1 }}>{line}</Text>
                </View>
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
              <View style={{ backgroundColor: '#b45309', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>Let's Play</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
