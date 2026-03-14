import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StatusBar, ActivityIndicator } from 'react-native';
import Animated, { FadeIn, useSharedValue, withRepeat, withSequence, withTiming, useAnimatedStyle } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Users, Zap, Trophy, Lock } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useGameStore } from '@/lib/state/game-store';
import type { LevelData } from '@/lib/level-types';
import { Sounds } from '@/lib/sounds';

const BACKEND_URL = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL || 'http://localhost:3000';

export default function GameModeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setGameMode = useGameStore((s) => s.setGameMode);
  const loadLevelProgress = useGameStore((s) => s.loadLevelProgress);
  const levelProgress = useGameStore((s) => s.levelProgress);
  const startLevelGame = useGameStore((s) => s.startLevelGame);
  const [isLoadingSingle, setIsLoadingSingle] = useState(false);
  const [levelLoaded, setLevelLoaded] = useState(false);

  // Skeleton shimmer animation
  const shimmer = useSharedValue(0);
  const shimmerStyle = useAnimatedStyle(() => ({ opacity: 0.4 + shimmer.value * 0.4 }));

  useEffect(() => {
    shimmer.value = withRepeat(
      withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 700 })),
      -1, true
    );
    loadLevelProgress().finally(() => setLevelLoaded(true));
  }, [loadLevelProgress]);

  const handleStartSinglePlayer = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Sounds.tap();
    setGameMode('single');
    setIsLoadingSingle(true);
    try {
      const levelNumber = levelProgress.unlockedLevel;
      const response = await fetch(`${BACKEND_URL}/api/levels/${levelNumber}`);
      if (!response.ok) throw new Error('Failed to fetch level');
      const levelData: LevelData = await response.json();
      await startLevelGame(levelData);
      Sounds.roundStart();
      router.push('/game');
    } catch (error: any) {
      console.error('Error starting single player:', error?.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoadingSingle(false);
    }
  }, [levelProgress.unlockedLevel, startLevelGame, router, setGameMode]);

  const handlePress = (key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Sounds.tap();
    if (key === 'single') {
      handleStartSinglePlayer();
    } else if (key === 'multi') {
      setGameMode('multiplayer');
      Sounds.navigate();
      router.push('/multiplayer-options');
    } else if (key === 'daily') {
      Sounds.navigate();
      router.push('/daily-challenge');
    }
  };

  // Lighter warm-dark background — noticeably brighter than before
  return (
    <View style={{ flex: 1, backgroundColor: '#1a2540' }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#1f2d50', '#253560', '#1a2845']}
        style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom + 16, paddingHorizontal: 16 }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, marginBottom: 12 }}>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Sounds.tap();
              router.back();
            }}
            style={{
              width: 40, height: 40, borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ChevronLeft size={22} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900', marginLeft: 12, letterSpacing: 0.3 }}>
            Select Mode
          </Text>
        </View>

        {/* Cards */}
        <View style={{ flex: 1, gap: 14 }}>

          {/* ── SINGLE PLAYER ── */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handlePress('single')}
            disabled={isLoadingSingle}
            style={{ flex: 1 }}
          >
            <LinearGradient
              colors={['#1e4a8a', '#1a3a72', '#1630608']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                flex: 1, borderRadius: 20, overflow: 'hidden',
                borderWidth: 2, borderColor: 'rgba(120,170,255,0.5)',
                paddingHorizontal: 20, paddingVertical: 20,
              }}
            >
              {/* Subtle shimmer at top */}
              <View style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '40%',
                backgroundColor: 'rgba(255,255,255,0.06)',
                borderTopLeftRadius: 20, borderTopRightRadius: 20,
              }} />

              <View style={{ flex: 1, justifyContent: 'space-between' }}>
                {/* Top row: icon + title */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{
                    width: 56, height: 56, borderRadius: 16,
                    backgroundColor: 'rgba(80,140,255,0.25)',
                    borderWidth: 2, borderColor: 'rgba(120,170,255,0.5)',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isLoadingSingle
                      ? <ActivityIndicator color="#90c0ff" />
                      : <Text style={{ fontSize: 28 }}>✍️</Text>
                    }
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 0.2 }}>
                      Single Player
                    </Text>
                    <Text style={{ color: 'rgba(160,200,255,0.7)', fontSize: 13, marginTop: 2 }}>
                      Progress through 500 levels
                    </Text>
                  </View>
                </View>

                {/* Level badge — big and prominent, with skeleton while loading */}
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  backgroundColor: 'rgba(255,255,255,0.12)',
                  borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
                  borderWidth: 1.5, borderColor: 'rgba(120,170,255,0.4)',
                  marginTop: 10,
                }}>
                  {levelLoaded ? (
                    <Animated.View entering={FadeIn.duration(300)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <View style={{
                        width: 42, height: 42, borderRadius: 10,
                        backgroundColor: '#4090e8',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>
                          {levelProgress.unlockedLevel}
                        </Text>
                      </View>
                      <View>
                        <Text style={{ color: 'rgba(160,200,255,0.6)', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
                          Current Level
                        </Text>
                        <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900', marginTop: 1 }}>
                          Level {levelProgress.unlockedLevel}
                        </Text>
                      </View>
                      <View style={{ marginLeft: 'auto', opacity: 0.5 }}>
                        <Text style={{ color: '#fff', fontSize: 24 }}>›</Text>
                      </View>
                    </Animated.View>
                  ) : (
                    <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }, shimmerStyle]}>
                      <View style={{ width: 42, height: 42, borderRadius: 10, backgroundColor: 'rgba(80,140,255,0.3)' }} />
                      <View style={{ gap: 6 }}>
                        <View style={{ width: 80, height: 10, borderRadius: 5, backgroundColor: 'rgba(160,200,255,0.25)' }} />
                        <View style={{ width: 60, height: 14, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.2)' }} />
                      </View>
                    </Animated.View>
                  )}
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* ── MULTIPLAYER ── */}
          <TouchableOpacity
            activeOpacity={0.88}
            onPress={() => handlePress('multi')}
            style={{ flex: 1 }}
          >
            {/* Tape strip */}
            <View style={{
              alignSelf: 'center', width: 64, height: 16,
              backgroundColor: 'rgba(210,190,100,0.75)',
              borderRadius: 3, marginBottom: -8, zIndex: 3,
              borderWidth: 1, borderColor: 'rgba(160,130,50,0.5)',
            }} />
            {/* Offset shadow */}
            <View style={{
              position: 'absolute', top: 5, left: 4, right: -4, bottom: -5,
              backgroundColor: 'rgba(80,50,10,0.18)', borderRadius: 10,
            }} />
            {/* Main card */}
            <View style={{
              flex: 1, backgroundColor: '#F2EAD0',
              borderRadius: 8, borderWidth: 2.5, borderColor: '#8A7040',
              overflow: 'hidden', paddingHorizontal: 20, paddingVertical: 18, gap: 10,
            }}>
              {/* Ruled lines */}
              {[0,1,2,3,4].map(i => (
                <View key={i} style={{
                  position: 'absolute', left: 44, right: 0,
                  top: 16 + i * 22, height: 1,
                  backgroundColor: 'rgba(138,112,64,0.15)',
                }} />
              ))}
              {/* Red margin line */}
              <View style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: 5, backgroundColor: 'rgba(190,60,50,0.7)',
              }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{
                  width: 52, height: 52, borderRadius: 12,
                  backgroundColor: '#FEF0B0',
                  borderWidth: 2, borderColor: '#D09010',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Users size={28} color="#7A5000" strokeWidth={2.5} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#1C120A', fontSize: 22, fontWeight: '900', letterSpacing: 0.3 }}>
                    Multiplayer
                  </Text>
                  <View style={{
                    backgroundColor: '#FEF0B0', paddingHorizontal: 10, paddingVertical: 3,
                    borderRadius: 6, alignSelf: 'flex-start', marginTop: 4,
                    borderWidth: 1.5, borderColor: '#D09010',
                  }}>
                    <Text style={{ color: '#7A5000', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 }}>
                      2–10 PLAYERS
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </TouchableOpacity>

          {/* ── DAILY CHALLENGE ── */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handlePress('daily')}
            style={{ flex: 1 }}
          >
            <View style={{
              flex: 1, borderRadius: 16, overflow: 'hidden',
              backgroundColor: '#071510',
              borderWidth: 2, borderColor: '#00C840',
              paddingHorizontal: 20, paddingVertical: 18,
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

              <View style={{ flex: 1, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={{
                  width: 56, height: 56, borderRadius: 10,
                  backgroundColor: '#0a2010',
                  borderWidth: 2, borderColor: '#00C840',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Trophy size={28} color="#00C840" strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{
                    color: '#00C840', fontSize: 20, fontWeight: '900',
                    letterSpacing: 1.5, textTransform: 'uppercase',
                  }}>
                    Daily Challenge
                  </Text>
                  <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5,
                    paddingHorizontal: 8, paddingVertical: 3,
                    borderRadius: 6, alignSelf: 'flex-start',
                    borderWidth: 1, borderColor: 'rgba(0,200,64,0.4)',
                  }}>
                    <Zap size={10} color="#00C840" strokeWidth={2.5} fill="#00C840" />
                    <Text style={{ color: '#00C840', fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>
                      GLOBAL LEADERBOARD
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </TouchableOpacity>

        </View>
      </LinearGradient>
    </View>
  );
}
