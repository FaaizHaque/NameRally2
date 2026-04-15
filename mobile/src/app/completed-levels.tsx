import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StatusBar, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Star } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useGameStore } from '@/lib/state/game-store';
import { Sounds } from '@/lib/sounds';
import type { LevelData } from '@/lib/level-types';

const BACKEND_URL = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL || 'http://localhost:3000';
const COLS = 4;

// ⚠️ TESTING FLAG — set to false to revert to showing only completed levels
const SHOW_ALL_LEVELS = true;
const ALL_LEVELS_COUNT = 100; // how many levels to show when flag is on

export default function CompletedLevelsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const levelProgress = useGameStore((s) => s.levelProgress);
  const setGameMode = useGameStore((s) => s.setGameMode);
  const startLevelGame = useGameStore((s) => s.startLevelGame);
  const [loadingLevel, setLoadingLevel] = useState<number | null>(null);

  // Get list of completed level numbers
  const completedLevels = SHOW_ALL_LEVELS
    ? Array.from({ length: ALL_LEVELS_COUNT }, (_, i) => i + 1)
    : Object.keys(levelProgress.levelScores || {})
        .map(Number)
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b);

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Sounds.navigate();
    router.back();
  };

  const handleLevelPress = useCallback(async (levelNum: number) => {
    if (loadingLevel !== null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Sounds.tap();
    setLoadingLevel(levelNum);
    try {
      const response = await fetch(`${BACKEND_URL}/api/levels/${levelNum}`);
      if (!response.ok) throw new Error('Failed to fetch level');
      const levelData: LevelData = await response.json();
      setGameMode('single');
      await startLevelGame(levelData);
      Sounds.navigate();
      router.replace('/game');
    } catch (error: any) {
      console.error('Error starting level:', error?.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', 'Failed to load level. Please try again.');
    } finally {
      setLoadingLevel(null);
    }
  }, [loadingLevel, setGameMode, startLevelGame, router]);

  const renderLevelCard = ({ item: levelNum }: { item: number }) => {
    const score = levelProgress.levelScores[levelNum] || 0;
    const stars = levelProgress.levelStars?.[levelNum] || 0;
    const isPlayed = !!levelProgress.levelScores[levelNum];
    const isThisLoading = loadingLevel === levelNum;

    return (
      <View style={{ width: `${100 / COLS}%`, padding: 6, aspectRatio: 1 }}>
        <Pressable
          onPress={() => handleLevelPress(levelNum)}
          disabled={loadingLevel !== null}
          style={{ flex: 1 }}
        >
          <LinearGradient
            colors={isPlayed
              ? ['rgba(100,150,255,0.3)', 'rgba(60,120,200,0.2)']
              : ['rgba(40,50,80,0.5)', 'rgba(30,40,70,0.3)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flex: 1,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: isPlayed ? 'rgba(120,170,255,0.4)' : 'rgba(80,100,160,0.25)',
              padding: 8,
              justifyContent: 'space-between',
              alignItems: 'center',
              opacity: isThisLoading ? 0.6 : 1,
            }}
          >
            {isThisLoading ? (
              <ActivityIndicator color="#90c0ff" size="small" />
            ) : (
              <>
                <Text style={{
                  color: isPlayed ? '#90c0ff' : 'rgba(120,150,220,0.45)',
                  fontSize: 20,
                  fontWeight: '900',
                  marginBottom: 4,
                }}>
                  {levelNum}
                </Text>
                {stars > 0 && (
                  <View style={{ flexDirection: 'row', gap: 2 }}>
                    {[...Array(Math.min(stars, 3))].map((_, i) => (
                      <Star
                        key={i}
                        size={12}
                        color="#fbbf24"
                        fill="#fbbf24"
                        strokeWidth={2}
                      />
                    ))}
                  </View>
                )}
                <Text style={{
                  color: 'rgba(160,200,255,0.6)',
                  fontSize: 10,
                  marginTop: 4,
                  textAlign: 'center',
                }}>
                  {score} pts
                </Text>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#1a2540' }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#1a2540', '#0f1929']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={{
          paddingTop: insets.top,
          paddingHorizontal: 16,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.05)',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable
              onPress={handleBack}
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChevronLeft size={24} color="#fff" strokeWidth={2} />
            </Pressable>

            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{
                color: '#fff',
                fontSize: 22,
                fontWeight: '900',
                letterSpacing: 0.5,
              }}>
                Completed Levels
              </Text>
              <Text style={{
                color: 'rgba(160,200,255,0.6)',
                fontSize: 13,
                marginTop: 4,
                fontWeight: '600',
              }}>
                {completedLevels.length} level{completedLevels.length !== 1 ? 's' : ''}
              </Text>
            </View>

            <View style={{ width: 40 }} />
          </View>
        </View>

        {/* Levels Grid */}
        {completedLevels.length > 0 ? (
          <FlatList
            data={completedLevels}
            renderItem={renderLevelCard}
            keyExtractor={(item) => item.toString()}
            numColumns={COLS}
            scrollEnabled={true}
            contentContainerStyle={{
              paddingHorizontal: 6,
              paddingVertical: 12,
            }}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={true}
            maxToRenderPerBatch={16}
            windowSize={5}
            initialNumToRender={20}
          />
        ) : (
          <View style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 32,
          }}>
            <Text style={{
              color: 'rgba(160,200,255,0.5)',
              fontSize: 16,
              fontWeight: '600',
              textAlign: 'center',
            }}>
              No completed levels yet. Start playing to see your progress!
            </Text>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}
