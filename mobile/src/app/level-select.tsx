import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Star, RotateCcw } from 'lucide-react-native';
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
  const [loadingLevel, setLoadingLevel] = useState<number | null>(null);
  const [isProgressLoaded, setIsProgressLoaded] = useState(false);

  useEffect(() => {
    const load = async () => {
      await loadLevelProgress();
      setIsProgressLoaded(true);
    };
    load();
  }, [loadLevelProgress]);

  const handleSelectLevel = useCallback(async (levelNumber: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoadingLevel(levelNumber);
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
      setLoadingLevel(null);
    }
  }, [startLevelGame, router]);

  // Only levels the player has already completed (strictly before current)
  const completedLevels = Array.from(
    { length: Math.max(0, levelProgress.unlockedLevel - 1) },
    (_, i) => i + 1
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

          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>Completed Levels</Text>
          </View>

          {/* Total stars */}
          {isProgressLoaded && (
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
          )}
        </View>

        {/* Content */}
        {!isProgressLoaded ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="rgba(160,200,255,0.6)" size="large" />
          </View>

        ) : completedLevels.length === 0 ? (
          /* Empty state */
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
            <View style={{
              width: 64, height: 64, borderRadius: 18,
              backgroundColor: 'rgba(80,140,255,0.12)',
              borderWidth: 2, borderColor: 'rgba(80,140,255,0.2)',
              alignItems: 'center', justifyContent: 'center', marginBottom: 18,
            }}>
              <RotateCcw size={28} color="rgba(120,170,255,0.5)" strokeWidth={1.5} />
            </View>
            <Text style={{
              color: '#fff', fontSize: 18, fontWeight: '900',
              textAlign: 'center', marginBottom: 8,
            }}>
              No completed levels yet
            </Text>
            <Text style={{
              color: 'rgba(160,200,255,0.5)', fontSize: 14,
              textAlign: 'center', lineHeight: 20,
            }}>
              Finish your first level and it&apos;ll appear here for you to replay.
            </Text>
          </View>

        ) : (
          /* Completed levels grid */
          <ScrollView
            contentContainerStyle={{
              flexDirection: 'row', flexWrap: 'wrap',
              gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16,
              justifyContent: 'flex-start',
            }}
            showsVerticalScrollIndicator={false}
          >
            {completedLevels.map((lvl) => {
              const stars = levelProgress.levelStars[lvl] || 0;
              const isLoading = loadingLevel === lvl;
              return (
                <Pressable
                  key={lvl}
                  onPress={() => !loadingLevel && handleSelectLevel(lvl)}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.75 : loadingLevel && !isLoading ? 0.5 : 1,
                  })}
                >
                  <View style={{
                    alignItems: 'center',
                    backgroundColor: isLoading ? 'rgba(80,140,255,0.2)' : 'rgba(255,255,255,0.07)',
                    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12,
                    borderWidth: 1.5,
                    borderColor: isLoading ? 'rgba(120,170,255,0.5)' : 'rgba(255,255,255,0.12)',
                    minWidth: 56,
                  }}>
                    {isLoading ? (
                      <ActivityIndicator color="#90c0ff" size="small" style={{ marginVertical: 4 }} />
                    ) : (
                      <>
                        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '800' }}>
                          {lvl}
                        </Text>
                        <View style={{ flexDirection: 'row', marginTop: 4, gap: 2 }}>
                          {[1, 2, 3].map(s => (
                            <Star
                              key={s}
                              size={9}
                              color={s <= stars ? '#FBBF24' : 'rgba(255,255,255,0.15)'}
                              fill={s <= stars ? '#FBBF24' : 'transparent'}
                              strokeWidth={2}
                            />
                          ))}
                        </View>
                      </>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </LinearGradient>
    </View>
  );
}
