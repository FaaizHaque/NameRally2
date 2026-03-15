import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Star, Play, Unlock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useGameStore } from '@/lib/state/game-store';
import type { LevelData } from '@/lib/level-types';

const BACKEND_URL = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL || 'http://localhost:3000';

export default function LevelSelectScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const levelProgress = useGameStore((s) => s.levelProgress);
  const loadLevelProgress = useGameStore((s) => s.loadLevelProgress);
  const startLevelGame = useGameStore((s) => s.startLevelGame);
  const devUnlockAllLevels = useGameStore((s) => s.devUnlockAllLevels);
  const [isLoading, setIsLoading] = useState(false);
  const [isProgressLoaded, setIsProgressLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      await loadLevelProgress();
      setIsProgressLoaded(true);
    };
    load();
  }, [loadLevelProgress]);

  const handleSelectLevel = useCallback(async (levelNumber: number) => {
    if (levelNumber > levelProgress.unlockedLevel) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/levels/${levelNumber}`);
      if (!response.ok) throw new Error('Failed to fetch level');
      const levelData: LevelData = await response.json();
      await startLevelGame(levelData);
      router.replace('/game');
    } catch (error: any) {
      console.error('Error starting level:', error?.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsLoading(false);
    }
  }, [levelProgress.unlockedLevel, startLevelGame, router]);

  const handlePlayNext = useCallback(() => {
    handleSelectLevel(levelProgress.unlockedLevel);
  }, [handleSelectLevel, levelProgress.unlockedLevel]);

  const handleDevUnlockAll = useCallback(async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await devUnlockAllLevels();
    await loadLevelProgress();
  }, [devUnlockAllLevels, loadLevelProgress]);

  const currentLevel = levelProgress.unlockedLevel;
  const currentStars = levelProgress.levelStars[currentLevel] || 0;

  // All completed levels (excluding current unlocked one), newest first
  const completedLevels = Array.from(
    { length: Math.max(0, currentLevel - 1) },
    (_, i) => currentLevel - 1 - i
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#1a2540' }}>
      <LinearGradient
        colors={['#1f2d50', '#253560', '#1a2845']}
        style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom + 16 }}
      >
        {/* Header */}
        <View style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 16, paddingVertical: 14,
        }}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {/* Dev unlock button */}
            <Pressable
              onPress={handleDevUnlockAll}
              style={{
                backgroundColor: 'rgba(251,191,36,0.1)', padding: 10, borderRadius: 10,
                borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
              }}
            >
              <Unlock size={15} color="#FBBF24" strokeWidth={2.5} />
            </Pressable>
            {/* Total stars */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              backgroundColor: 'rgba(251,191,36,0.12)',
              paddingHorizontal: 12, paddingVertical: 7,
              borderRadius: 20, borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
            }}>
              <Star size={14} color="#FBBF24" fill="#FBBF24" strokeWidth={2} />
              <Text style={{ color: '#FBBF24', fontWeight: '800', fontSize: 13 }}>
                {levelProgress.totalStars}
              </Text>
            </View>
          </View>
        </View>

        {/* Main content — centered */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>

          {/* Level label */}
          <Text style={{
            color: 'rgba(160,200,255,0.55)',
            fontSize: 12, fontWeight: '800',
            letterSpacing: 3, textTransform: 'uppercase',
            marginBottom: 8,
          }}>
            Single Player
          </Text>

          {/* Big level number */}
          <View style={{
            alignItems: 'center',
            backgroundColor: 'rgba(80,140,255,0.1)',
            borderRadius: 28, paddingVertical: 36, paddingHorizontal: 52,
            borderWidth: 2, borderColor: 'rgba(80,140,255,0.25)',
            marginBottom: 24,
            width: '100%',
          }}>
            {isProgressLoaded ? (
              <>
                <Text style={{
                  color: 'rgba(160,200,255,0.5)',
                  fontSize: 13, fontWeight: '700', letterSpacing: 2,
                  textTransform: 'uppercase', marginBottom: 6,
                }}>
                  Level
                </Text>
                <Text style={{
                  color: '#fff',
                  fontSize: 80, fontWeight: '900',
                  lineHeight: 84,
                }}>
                  {currentLevel}
                </Text>
                {/* Stars for current level if already played */}
                {currentStars > 0 && (
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
                    {[1, 2, 3].map(s => (
                      <Star
                        key={s}
                        size={20}
                        color={s <= currentStars ? '#FBBF24' : 'rgba(255,255,255,0.15)'}
                        fill={s <= currentStars ? '#FBBF24' : 'transparent'}
                        strokeWidth={2}
                      />
                    ))}
                  </View>
                )}
              </>
            ) : (
              <ActivityIndicator color="rgba(160,200,255,0.6)" size="large" />
            )}
          </View>

          {/* PLAY button */}
          <Pressable
            onPress={handlePlayNext}
            disabled={isLoading || !isProgressLoaded}
            style={({ pressed }) => ({
              width: '100%',
              transform: [{ scale: pressed ? 0.97 : 1 }],
              opacity: isLoading || !isProgressLoaded ? 0.7 : 1,
            })}
          >
            <LinearGradient
              colors={['#4a80e8', '#3060c8']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 18, paddingVertical: 20,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                shadowColor: '#4a80e8',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.45, shadowRadius: 16, elevation: 10,
              }}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Play size={22} color="#fff" fill="#fff" strokeWidth={2} />
                  <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 1 }}>
                    Play
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>

        </View>

        {/* Completed levels — scrollable grid */}
        {isProgressLoaded && completedLevels.length > 0 && (
          <View style={{ paddingHorizontal: 16 }}>
            <Text style={{
              color: 'rgba(160,200,255,0.4)',
              fontSize: 10, fontWeight: '800', letterSpacing: 2,
              textTransform: 'uppercase', marginBottom: 10,
              textAlign: 'center',
            }}>
              Completed Levels
            </Text>
            <ScrollView
              horizontal={false}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 160 }}
              contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', paddingBottom: 4 }}
            >
              {completedLevels.map((lvl) => {
                const stars = levelProgress.levelStars[lvl] || 0;
                return (
                  <Pressable
                    key={lvl}
                    onPress={() => handleSelectLevel(lvl)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <View style={{
                      alignItems: 'center',
                      backgroundColor: 'rgba(255,255,255,0.07)',
                      borderRadius: 10, paddingVertical: 7, paddingHorizontal: 9,
                      borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
                      minWidth: 44,
                    }}>
                      <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: '700' }}>
                        {lvl}
                      </Text>
                      <View style={{ flexDirection: 'row', marginTop: 3, gap: 1 }}>
                        {[1, 2, 3].map(s => (
                          <Star
                            key={s}
                            size={7}
                            color={s <= stars ? '#FBBF24' : 'rgba(255,255,255,0.15)'}
                            fill={s <= stars ? '#FBBF24' : 'transparent'}
                            strokeWidth={2}
                          />
                        ))}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}
