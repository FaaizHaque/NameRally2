import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Lock, Star, Play, ChevronRight, Unlock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useGameStore } from '@/lib/state/game-store';
import type { LevelData, DifficultyBand } from '@/lib/level-types';

const BACKEND_URL = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL || 'http://localhost:3000';

const BAND_COLORS: Record<number, [string, string]> = {
  1:  ['#22C55E', '#4ADE80'],
  2:  ['#34D399', '#6EE7B7'],
  3:  ['#2DD4BF', '#5EEAD4'],
  4:  ['#22D3EE', '#67E8F9'],
  5:  ['#38BDF8', '#7DD3FC'],
  6:  ['#60A5FA', '#93C5FD'],
  7:  ['#818CF8', '#A5B4FC'],
  8:  ['#A78BFA', '#C4B5FD'],
  9:  ['#C084FC', '#D8B4FE'],
  10: ['#E879F9', '#F0ABFC'],
  11: ['#F472B6', '#F9A8D4'],
  12: ['#FB7185', '#FDA4AF'],
  13: ['#F97316', '#FB923C'],
  14: ['#EF4444', '#F87171'],
  15: ['#DC2626', '#EF4444'],
  16: ['#B91C1C', '#DC2626'],
  17: ['#991B1B', '#B91C1C'],
  18: ['#7F1D1D', '#991B1B'],
  19: ['#450A0A', '#7F1D1D'],
  20: ['#1C1917', '#44403C'],
};

interface BandInfo {
  bandNumber: number;
  name: string;
  levelRange: [number, number];
  description: string;
}

const BANDS: BandInfo[] = [
  { bandNumber: 1,  name: 'Warmup',        levelRange: [1,   25],  description: 'Get familiar with the game' },
  { bandNumber: 2,  name: 'Getting Started',levelRange: [26,  50],  description: 'Building vocabulary' },
  { bandNumber: 3,  name: 'Novice',         levelRange: [51,  75],  description: 'Expand your horizons' },
  { bandNumber: 4,  name: 'Apprentice',     levelRange: [76,  100], description: 'The challenge begins' },
  { bandNumber: 5,  name: 'Skilled',        levelRange: [101, 125], description: 'Normal letters join' },
  { bandNumber: 6,  name: 'Adept',          levelRange: [126, 150], description: 'Quick thinking tested' },
  { bandNumber: 7,  name: 'Proficient',     levelRange: [151, 175], description: 'The pressure mounts' },
  { bandNumber: 8,  name: 'Experienced',    levelRange: [176, 200], description: 'Hard letters appear' },
  { bandNumber: 9,  name: 'Advanced',       levelRange: [201, 225], description: 'New categories unlock' },
  { bandNumber: 10, name: 'Veteran',        levelRange: [226, 250], description: 'Halfway point' },
  { bandNumber: 11, name: 'Expert',         levelRange: [251, 275], description: 'For the dedicated' },
  { bandNumber: 12, name: 'Master',         levelRange: [276, 300], description: 'Two-letter combos' },
  { bandNumber: 13, name: 'Grandmaster',    levelRange: [301, 325], description: 'Mental agility' },
  { bandNumber: 14, name: 'Elite',          levelRange: [326, 350], description: 'All categories' },
  { bandNumber: 15, name: 'Champion',       levelRange: [351, 375], description: 'Every answer counts' },
  { bandNumber: 16, name: 'Legend',         levelRange: [376, 400], description: 'Hard + Two-letter' },
  { bandNumber: 17, name: 'Mythic',         levelRange: [401, 425], description: 'Truly exceptional' },
  { bandNumber: 18, name: 'Immortal',       levelRange: [426, 450], description: 'No margin for error' },
  { bandNumber: 19, name: 'Transcendent',   levelRange: [451, 475], description: 'Beyond human limits' },
  { bandNumber: 20, name: 'Absolute',       levelRange: [476, 500], description: 'Ultimate challenge' },
];

export default function LevelSelectScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const levelProgress = useGameStore((s) => s.levelProgress);
  const loadLevelProgress = useGameStore((s) => s.loadLevelProgress);
  const startLevelGame = useGameStore((s) => s.startLevelGame);
  const devUnlockAllLevels = useGameStore((s) => s.devUnlockAllLevels);
  const [isLoading, setIsLoading] = useState(false);
  const [isProgressLoaded, setIsProgressLoaded] = useState(false);
  const [selectedBand, setSelectedBand] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      await loadLevelProgress();
      setIsProgressLoaded(true);
    };
    load();
  }, [loadLevelProgress]);

  const currentBandNumber = BANDS.find(
    b => levelProgress.unlockedLevel >= b.levelRange[0] && levelProgress.unlockedLevel <= b.levelRange[1]
  )?.bandNumber || 1;

  useEffect(() => {
    if (isProgressLoaded && selectedBand === null) {
      setSelectedBand(currentBandNumber);
    }
  }, [isProgressLoaded, currentBandNumber]);

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

  const renderBandCard = (band: BandInfo) => {
    const colors = BAND_COLORS[band.bandNumber] || ['#6366F1', '#8B5CF6'];
    const isUnlocked = levelProgress.unlockedLevel >= band.levelRange[0];
    const isCurrentBand = band.bandNumber === currentBandNumber;
    const completedInBand = Object.keys(levelProgress.levelScores).filter(
      l => parseInt(l) >= band.levelRange[0] && parseInt(l) <= band.levelRange[1]
    ).length;
    const totalInBand = band.levelRange[1] - band.levelRange[0] + 1;
    const starsInBand = Object.entries(levelProgress.levelStars)
      .filter(([l]) => parseInt(l) >= band.levelRange[0] && parseInt(l) <= band.levelRange[1])
      .reduce((sum, [, stars]) => sum + stars, 0);
    const maxStarsInBand = totalInBand * 3;
    const isExpanded = selectedBand === band.bandNumber;

    return (
      <View key={band.bandNumber} style={{ marginBottom: 8 }}>
        <Pressable
          onPress={() => {
            if (isUnlocked) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedBand(isExpanded ? null : band.bandNumber);
            } else {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
          }}
        >
          <View style={{
            borderRadius: 14,
            padding: 14,
            opacity: isUnlocked ? 1 : 0.4,
            borderWidth: isCurrentBand ? 2 : 1,
            borderColor: isCurrentBand ? colors[0] : 'rgba(255,255,255,0.08)',
            backgroundColor: isUnlocked ? colors[0] + '18' : 'rgba(255,255,255,0.04)',
            shadowColor: colors[0],
            shadowOffset: { width: 0, height: isUnlocked ? 4 : 0 },
            shadowOpacity: isUnlocked ? 0.18 : 0,
            shadowRadius: 8,
            elevation: isUnlocked ? 3 : 0,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {!isUnlocked && <Lock size={13} color="rgba(255,255,255,0.3)" strokeWidth={2.5} />}
                  {isUnlocked && (
                    <View style={{
                      width: 10, height: 10, borderRadius: 5,
                      backgroundColor: colors[0],
                      shadowColor: colors[0],
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.8,
                      shadowRadius: 4,
                    }} />
                  )}
                  <Text style={{
                    color: isUnlocked ? '#fff' : 'rgba(255,255,255,0.3)',
                    fontSize: 15, fontWeight: '700',
                  }}>
                    {band.name}
                  </Text>
                  {isCurrentBand && (
                    <View style={{
                      backgroundColor: colors[0] + '30',
                      paddingHorizontal: 7, paddingVertical: 2,
                      borderRadius: 8, borderWidth: 1, borderColor: colors[0],
                    }}>
                      <Text style={{ color: colors[0], fontSize: 9, fontWeight: '800' }}>NOW</Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 }}>
                  Levels {band.levelRange[0]}–{band.levelRange[1]} · {band.description}
                </Text>
                {isUnlocked && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 5 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
                      {completedInBand}/{totalInBand}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                      <Star size={10} color="#FBBF24" fill="#FBBF24" strokeWidth={2} />
                      <Text style={{ color: '#FBBF24', fontSize: 11, fontWeight: '700' }}>{starsInBand}/{maxStarsInBand}</Text>
                    </View>
                    {completedInBand > 0 && (
                      <View style={{
                        flex: 1, height: 3, borderRadius: 2,
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        maxWidth: 80,
                      }}>
                        <View style={{
                          width: `${(completedInBand / totalInBand) * 100}%`,
                          height: 3, borderRadius: 2,
                          backgroundColor: colors[0],
                        }} />
                      </View>
                    )}
                  </View>
                )}
              </View>
              <ChevronRight
                size={16}
                color={isUnlocked ? colors[0] : 'rgba(255,255,255,0.15)'}
                strokeWidth={2.5}
                style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}
              />
            </View>
          </View>
        </Pressable>

        {isExpanded && isUnlocked && (
          <View style={{
            backgroundColor: 'rgba(255,255,255,0.04)',
            borderRadius: 12,
            padding: 12,
            marginBottom: 8,
            marginHorizontal: 4,
            marginTop: 8,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
          }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {Array.from({ length: totalInBand }, (_, i) => {
                const lvl = band.levelRange[0] + i;
                const isLevelUnlocked = lvl <= levelProgress.unlockedLevel;
                const stars = levelProgress.levelStars[lvl] || 0;
                const score = levelProgress.levelScores[lvl];

                return (
                  <Pressable
                    key={lvl}
                    onPress={() => handleSelectLevel(lvl)}
                    style={{ alignItems: 'center', width: 46 }}
                  >
                    <View style={{
                      width: 40, height: 40,
                      borderRadius: 10,
                      alignItems: 'center', justifyContent: 'center',
                      backgroundColor: isLevelUnlocked
                        ? score !== undefined
                          ? colors[0] + '30'
                          : 'rgba(255,255,255,0.1)'
                        : 'rgba(255,255,255,0.04)',
                      borderWidth: 1,
                      borderColor: isLevelUnlocked
                        ? score !== undefined ? colors[0] : 'rgba(255,255,255,0.2)'
                        : 'rgba(255,255,255,0.06)',
                    }}>
                      {isLevelUnlocked ? (
                        <Text style={{ color: score !== undefined ? colors[0] : '#fff', fontWeight: '700', fontSize: 12 }}>{lvl}</Text>
                      ) : (
                        <Lock size={11} color="rgba(255,255,255,0.2)" strokeWidth={2.5} />
                      )}
                    </View>
                    {stars > 0 && (
                      <View style={{ flexDirection: 'row', marginTop: 2 }}>
                        {[1, 2, 3].map(s => (
                          <Star key={s} size={6} color={s <= stars ? '#FBBF24' : 'rgba(255,255,255,0.15)'} fill={s <= stars ? '#FBBF24' : 'transparent'} strokeWidth={2} />
                        ))}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient
        colors={['#1a3a6e', '#1e4a8a', '#163468']}
        style={{ flex: 1 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={{ paddingTop: insets.top, flex: 1 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.back();
                }}
                style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 10 }}
              >
                <ChevronLeft size={22} color="#fff" strokeWidth={2.5} />
              </Pressable>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', marginLeft: 12 }}>
                Single Player
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable
                onPress={handleDevUnlockAll}
                style={{ backgroundColor: 'rgba(251,191,36,0.1)', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)' }}
              >
                <Unlock size={15} color="#FBBF24" strokeWidth={2.5} />
              </Pressable>
              <View style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: 'rgba(251,191,36,0.12)',
                paddingHorizontal: 10, paddingVertical: 6,
                borderRadius: 20, borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)', gap: 4,
              }}>
                <Star size={14} color="#FBBF24" fill="#FBBF24" strokeWidth={2} />
                <Text style={{ color: '#FBBF24', fontWeight: '800', fontSize: 13 }}>{levelProgress.totalStars}</Text>
              </View>
            </View>
          </View>

          {/* Play Next Button */}
          <View style={{ paddingHorizontal: 16, marginBottom: 14 }}>
            <Pressable
              onPress={handlePlayNext}
              disabled={isLoading || !isProgressLoaded}
              style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}
            >
              <LinearGradient
                colors={['#6366F1', '#8B5CF6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 16, padding: 16,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  shadowColor: '#6366F1', shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.4, shadowRadius: 14, elevation: 8, gap: 10,
                }}
              >
                {isLoading || !isProgressLoaded ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Play size={22} color="#fff" fill="#fff" strokeWidth={2} />
                    <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>
                      Play Level {levelProgress.unlockedLevel}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>

          {/* Band List */}
          <ScrollView
            style={{ flex: 1, paddingHorizontal: 16 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          >
            {BANDS.map((band) => renderBandCard(band))}
          </ScrollView>
        </View>
      </LinearGradient>
    </View>
  );
}
