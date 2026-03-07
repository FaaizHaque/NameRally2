import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StatusBar, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Users, Zap, Trophy } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useGameStore } from '@/lib/state/game-store';
import type { LevelData } from '@/lib/level-types';

const BACKEND_URL = process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL || 'http://localhost:3000';

export default function GameModeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setGameMode = useGameStore((s) => s.setGameMode);
  const loadLevelProgress = useGameStore((s) => s.loadLevelProgress);
  const levelProgress = useGameStore((s) => s.levelProgress);
  const startLevelGame = useGameStore((s) => s.startLevelGame);
  const [isLoadingSingle, setIsLoadingSingle] = useState(false);

  useEffect(() => {
    loadLevelProgress();
  }, [loadLevelProgress]);

  const handleStartSinglePlayer = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGameMode('single');
    setIsLoadingSingle(true);
    try {
      const levelNumber = levelProgress.unlockedLevel;
      const response = await fetch(`${BACKEND_URL}/api/levels/${levelNumber}`);
      if (!response.ok) throw new Error('Failed to fetch level');
      const levelData: LevelData = await response.json();
      await startLevelGame(levelData);
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
    if (key === 'single') {
      handleStartSinglePlayer();
    } else if (key === 'multi') {
      setGameMode('multiplayer');
      router.push('/multiplayer-options');
    } else if (key === 'daily') {
      router.push('/daily-challenge');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0f1e' }}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={['#0a0f1e', '#0d1528', '#0a1020']}
        style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom + 16, paddingHorizontal: 16 }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, marginBottom: 12 }}>
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
            style={{
              width: 38, height: 38, borderRadius: 10,
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ChevronLeft size={22} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginLeft: 12, letterSpacing: 0.3 }}>
            Select Mode
          </Text>
        </View>

        {/* Cards — each is a TouchableOpacity with flex:1 */}
        <View style={{ flex: 1, gap: 14 }}>

          {/* ── SINGLE PLAYER ── */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => handlePress('single')}
            disabled={isLoadingSingle}
            style={{ flex: 1 }}
          >
            <LinearGradient
              colors={['#1a3a6e', '#1e4a8a', '#163468']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                flex: 1, borderRadius: 20, overflow: 'hidden',
                borderWidth: 1.5, borderColor: 'rgba(100,160,255,0.35)',
                flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: 18, gap: 16,
              }}
            >
              <View style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
                backgroundColor: 'rgba(255,255,255,0.04)',
                borderTopLeftRadius: 20, borderTopRightRadius: 20,
              }} />
              <View style={{
                position: 'absolute', top: -20, right: -20,
                width: 80, height: 80, borderRadius: 40,
                backgroundColor: 'rgba(80,140,255,0.18)',
              }} />
              <View style={{
                width: 54, height: 54, borderRadius: 16,
                backgroundColor: 'rgba(80,140,255,0.2)',
                borderWidth: 1.5, borderColor: 'rgba(100,160,255,0.45)',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {isLoadingSingle ? (
                  <ActivityIndicator color="#90c0ff" />
                ) : (
                  <Text style={{ fontSize: 28 }}>✍️</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 0.2, marginBottom: 7 }}>
                  Single Player
                </Text>
                <View style={{
                  backgroundColor: 'rgba(80,140,255,0.18)',
                  paddingHorizontal: 10, paddingVertical: 4,
                  borderRadius: 8, alignSelf: 'flex-start',
                  borderWidth: 1, borderColor: 'rgba(100,160,255,0.4)',
                }}>
                  <Text style={{ color: '#90c0ff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>
                    LEVEL {levelProgress.unlockedLevel}
                  </Text>
                </View>
              </View>
              <View style={{ opacity: 0.4 }}>
                <Text style={{ color: '#fff', fontSize: 22 }}>›</Text>
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
              overflow: 'hidden', flexDirection: 'row',
              alignItems: 'center', paddingHorizontal: 18, gap: 16,
            }}>
              {[0,1,2,3,4].map(i => (
                <View key={i} style={{
                  position: 'absolute', left: 44, right: 0,
                  top: 16 + i * 22, height: 1,
                  backgroundColor: 'rgba(138,112,64,0.15)',
                }} />
              ))}
              <View style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: 5, backgroundColor: 'rgba(190,60,50,0.7)',
              }} />
              <View style={{
                width: 50, height: 50, borderRadius: 10,
                backgroundColor: '#FEF0B0',
                borderWidth: 2, borderColor: '#D09010',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Users size={26} color="#7A5000" strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#1C120A', fontSize: 22, fontWeight: '900', letterSpacing: 0.3, marginBottom: 5 }}>
                  Multiplayer
                </Text>
                <View style={{
                  backgroundColor: '#FEF0B0', paddingHorizontal: 10, paddingVertical: 4,
                  borderRadius: 6, alignSelf: 'flex-start',
                  borderWidth: 1.5, borderColor: '#D09010',
                }}>
                  <Text style={{ color: '#7A5000', fontSize: 11, fontWeight: '800', letterSpacing: 0.4 }}>
                    2–10 PLAYERS
                  </Text>
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
              flex: 1, borderRadius: 12, overflow: 'hidden',
              backgroundColor: '#020f04',
              borderWidth: 2.5, borderColor: '#00C040',
              flexDirection: 'row', alignItems: 'center',
              paddingHorizontal: 18, gap: 16,
            }}>
              {/* Corner brackets */}
              <View style={{ position: 'absolute', top: 6, left: 6 }}>
                <View style={{ width: 14, height: 3, backgroundColor: '#00C040', marginBottom: 2 }} />
                <View style={{ width: 3, height: 14, backgroundColor: '#00C040' }} />
              </View>
              <View style={{ position: 'absolute', top: 6, right: 6, alignItems: 'flex-end' }}>
                <View style={{ width: 14, height: 3, backgroundColor: '#00C040', marginBottom: 2 }} />
                <View style={{ width: 3, height: 14, backgroundColor: '#00C040', alignSelf: 'flex-end' }} />
              </View>
              <View style={{ position: 'absolute', bottom: 6, left: 6 }}>
                <View style={{ width: 3, height: 14, backgroundColor: '#00C040', marginBottom: 2 }} />
                <View style={{ width: 14, height: 3, backgroundColor: '#00C040' }} />
              </View>
              <View style={{ position: 'absolute', bottom: 6, right: 6, alignItems: 'flex-end' }}>
                <View style={{ width: 3, height: 14, backgroundColor: '#00C040', alignSelf: 'flex-end', marginBottom: 2 }} />
                <View style={{ width: 14, height: 3, backgroundColor: '#00C040' }} />
              </View>
              <View style={{
                width: 54, height: 54, borderRadius: 6,
                backgroundColor: '#041408',
                borderWidth: 2.5, borderColor: '#00C040',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Trophy size={26} color="#00C040" strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{
                  color: '#00C040', fontSize: 19, fontWeight: '900',
                  letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6,
                }}>
                  Daily Challenge
                </Text>
                <View style={{
                  paddingHorizontal: 8, paddingVertical: 3,
                  borderRadius: 4, alignSelf: 'flex-start',
                  borderWidth: 1.5, borderColor: 'rgba(0,192,64,0.5)',
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                }}>
                  <Zap size={9} color="#00C040" strokeWidth={2.5} fill="#00C040" />
                  <Text style={{ color: '#00C040', fontSize: 10, fontWeight: '800', letterSpacing: 1 }}>
                    GLOBAL
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>

        </View>
      </LinearGradient>
    </View>
  );
}
