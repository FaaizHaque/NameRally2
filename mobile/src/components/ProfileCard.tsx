import React, { useEffect, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, Modal,
} from 'react-native';
import Animated, {
  FadeIn, FadeInDown, useSharedValue, useAnimatedStyle,
  withSpring, withTiming,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Trophy, Users, CalendarDays, Pencil, ChevronDown } from 'lucide-react-native';
import { SKETCH_COLORS } from '@/lib/theme';
import type { LevelProgress } from '@/lib/level-types';

// ─── Constants ────────────────────────────────────────────────────────────────

const PROFILE_EMOJIS = [
  '🦊', '🐻', '🐼', '🦁', '🐯', '🐨', '🦋', '🐸', '🦄', '🐙',
  '🐺', '🦅', '🦉', '🐬', '🐘', '🦝', '🦜', '🐮', '🐷', '🐧',
  '🦖', '🐲', '🌟', '⚡', '🎯', '🔥', '🎭', '🏆', '🎮', '🌈',
];

const DEFAULT_EMOJI = '🦊';
const MP_STATS_KEY = 'npat_mp_stats';
const PROFILE_EMOJI_KEY = 'npat_profile_emoji';

interface MpStats { gamesPlayed: number; gamesWon: number }
interface DcStats { played: number; bestTimeMs: number | null }

function formatTimeMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

async function loadDcStats(): Promise<DcStats> {
  const dateStrings: string[] = [];
  for (let i = 0; i < 90; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dateStrings.push(d.toISOString().split('T')[0]!);
  }
  const results = await Promise.all(
    dateStrings.map(s => AsyncStorage.getItem(`daily_challenge_result_${s}`))
  );
  let played = 0;
  let bestTimeMs: number | null = null;
  for (const raw of results) {
    if (!raw) continue;
    try {
      const r = JSON.parse(raw);
      played++;
      if (r.totalTimeMs && (bestTimeMs === null || r.totalTimeMs < bestTimeMs)) {
        bestTimeMs = r.totalTimeMs;
      }
    } catch { /* ignore */ }
  }
  return { played, bestTimeMs };
}

// ─── Emoji picker ─────────────────────────────────────────────────────────────

function EmojiPickerModal({
  visible, current, onPick, onClose,
}: {
  visible: boolean;
  current: string;
  onPick: (e: string) => void;
  onClose: () => void;
}) {
  const COLS = 5;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(28,18,10,0.5)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable onPress={e => e.stopPropagation()}>
          <Animated.View
            entering={FadeInDown.duration(250).springify()}
            style={{
              backgroundColor: SKETCH_COLORS.paper,
              borderTopLeftRadius: 28, borderTopRightRadius: 28,
              paddingHorizontal: 20, paddingTop: 16, paddingBottom: 36,
              borderTopWidth: 2, borderLeftWidth: 1, borderRightWidth: 1,
              borderColor: SKETCH_COLORS.paperLine + '50',
            }}
          >
            <View style={{
              width: 40, height: 4, borderRadius: 2,
              backgroundColor: SKETCH_COLORS.inkFaint + '60',
              alignSelf: 'center', marginBottom: 16,
            }} />
            <Text style={{
              fontSize: 18, fontWeight: '900', color: SKETCH_COLORS.ink,
              textAlign: 'center', marginBottom: 4,
            }}>Pick your avatar</Text>
            <Text style={{
              fontSize: 12, color: SKETCH_COLORS.inkFaint, textAlign: 'center', marginBottom: 20,
            }}>tap to select</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {PROFILE_EMOJIS.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPick(emoji); }}
                  style={({ pressed }) => ({
                    width: `${100 / COLS - 2}%`,
                    aspectRatio: 1,
                    alignItems: 'center', justifyContent: 'center',
                    borderRadius: 14,
                    backgroundColor: emoji === current
                      ? SKETCH_COLORS.amber + '30'
                      : pressed ? SKETCH_COLORS.paperDark : 'transparent',
                    borderWidth: emoji === current ? 2 : 1,
                    borderColor: emoji === current
                      ? SKETCH_COLORS.amber
                      : SKETCH_COLORS.paperLine + '30',
                    transform: [{ scale: pressed ? 0.9 : 1 }],
                  })}
                >
                  <Text style={{ fontSize: 32 }}>{emoji}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => ({
                marginTop: 20,
                paddingVertical: 16, borderRadius: 14,
                backgroundColor: pressed ? SKETCH_COLORS.paperDark : SKETCH_COLORS.ink,
                alignItems: 'center',
              })}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Done</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Themed stat card ─────────────────────────────────────────────────────────

function StatCard({
  icon, label, primary, secondary, theme,
}: {
  icon: React.ReactNode;
  label: string;
  primary: string;
  secondary: string;
  theme: 'sp' | 'mp' | 'dc';
}) {
  const themes = {
    sp: {
      bg: '#163468',
      border: 'rgba(80,160,255,0.5)',
      iconBg: 'rgba(80,160,255,0.15)',
      labelColor: '#FFFFFF',
      primaryColor: '#FFFFFF',
      secondaryColor: 'rgba(144,192,255,0.8)',
    },
    mp: {
      bg: '#F2EAD0',
      border: '#D09010',
      iconBg: 'rgba(208,144,16,0.18)',
      labelColor: '#1C1410',
      primaryColor: '#1C1410',
      secondaryColor: '#5A3E1B',
    },
    dc: {
      bg: '#0D1F0D',
      border: 'rgba(74,222,128,0.45)',
      iconBg: 'rgba(74,222,128,0.12)',
      labelColor: '#4ADE80',
      primaryColor: '#4ADE80',
      secondaryColor: 'rgba(74,222,128,0.6)',
    },
  };
  const t = themes[theme];
  return (
    <View style={{
      backgroundColor: t.bg,
      borderRadius: 16, borderWidth: 2, borderColor: t.border,
      paddingVertical: 16, paddingHorizontal: 16,
      flexDirection: 'row', alignItems: 'center',
      overflow: 'hidden',
      shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8,
      elevation: 6,
    }}>
      {theme === 'mp' && [16, 34, 52, 70].map((top) => (
        <View key={top} style={{ position: 'absolute', left: 0, right: 0, top, height: 1, backgroundColor: 'rgba(208,144,16,0.15)' }} />
      ))}
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: t.iconBg, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
        {icon}
      </View>
      <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: t.labelColor }}>{label}</Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 18, fontWeight: '900', color: t.primaryColor, lineHeight: 23 }}>{primary}</Text>
        <Text style={{ fontSize: 11, fontWeight: '600', color: t.secondaryColor, marginTop: 2 }}>{secondary}</Text>
      </View>
    </View>
  );
}

// ─── Stats sheet modal ────────────────────────────────────────────────────────

function StatsSheet({
  visible, emoji, mpStats, dcStats, levelProgress, onClose, onChangeAvatar,
}: {
  visible: boolean;
  emoji: string;
  mpStats: MpStats;
  dcStats: DcStats;
  levelProgress: LevelProgress;
  onClose: () => void;
  onChangeAvatar: () => void;
}) {
  const spLevel = levelProgress.unlockedLevel;
  const spStars = levelProgress.totalStars ?? 0;
  const spPoints = levelProgress.totalPoints ?? 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(28,18,10,0.45)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable onPress={e => e.stopPropagation()}>
          <Animated.View
            entering={FadeInDown.duration(300).springify()}
            style={{
              backgroundColor: '#111111',
              borderTopLeftRadius: 28, borderTopRightRadius: 28,
              paddingTop: 14, paddingBottom: 40,
              borderTopWidth: 1.5, borderLeftWidth: 1, borderRightWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
            }}
          >
            {/* Handle */}
            <View style={{
              width: 40, height: 4, borderRadius: 2,
              backgroundColor: 'rgba(255,255,255,0.2)',
              alignSelf: 'center', marginBottom: 18,
            }} />

            {/* Avatar centered with pencil overlay */}
            <View style={{ alignItems: 'center', marginBottom: 22 }}>
              <View style={{ position: 'relative' }}>
                <View style={{
                  width: 76, height: 76, borderRadius: 38,
                  backgroundColor: '#1E1E1E',
                  borderWidth: 2.5, borderColor: SKETCH_COLORS.amber + '90',
                  alignItems: 'center', justifyContent: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.4, shadowRadius: 8,
                }}>
                  <Text style={{ fontSize: 40 }}>{emoji}</Text>
                </View>
                {/* Pencil badge — bottom right of avatar */}
                <Pressable
                  onPress={onChangeAvatar}
                  style={({ pressed }) => ({
                    position: 'absolute', bottom: 0, right: 0,
                    width: 28, height: 28, borderRadius: 14,
                    backgroundColor: pressed ? SKETCH_COLORS.amber : '#2A2A2A',
                    borderWidth: 1.5, borderColor: SKETCH_COLORS.amber,
                    alignItems: 'center', justifyContent: 'center',
                  })}
                >
                  <Pencil size={12} color={SKETCH_COLORS.amber} strokeWidth={2.5} />
                </Pressable>
              </View>
            </View>

            {/* Themed stat cards */}
            <View style={{ marginHorizontal: 20, gap: 10 }}>
              <StatCard
                theme="sp"
                icon={<Trophy size={16} color="#90c0ff" strokeWidth={2.5} />}
                label="Single Player"
                primary={`Level ${spLevel}`}
                secondary={`⭐ ${spStars}  ·  ${spPoints} pts`}
              />
              <StatCard
                theme="mp"
                icon={<Users size={16} color="#D09010" strokeWidth={2.5} />}
                label="Multiplayer"
                primary={`${mpStats.gamesPlayed} played`}
                secondary={`${mpStats.gamesWon} won 🏆`}
              />
              <StatCard
                theme="dc"
                icon={<CalendarDays size={16} color="#4ADE80" strokeWidth={2.5} />}
                label="Daily Challenge"
                primary={`${dcStats.played} played`}
                secondary={dcStats.bestTimeMs !== null ? `Best: ${formatTimeMs(dcStats.bestTimeMs)}` : 'No best yet'}
              />
            </View>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── ProfileCard ──────────────────────────────────────────────────────────────

interface ProfileCardProps {
  levelProgress: LevelProgress;
  splashDone: boolean;
}

export function ProfileCard({ levelProgress, splashDone }: ProfileCardProps) {
  const [emoji, setEmoji] = useState<string>(DEFAULT_EMOJI);
  const [showStats, setShowStats] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [mpStats, setMpStats] = useState<MpStats>({ gamesPlayed: 0, gamesWon: 0 });
  const [dcStats, setDcStats] = useState<DcStats>({ played: 0, bestTimeMs: null });

  useEffect(() => {
    AsyncStorage.getItem(PROFILE_EMOJI_KEY).then(e => { if (e) setEmoji(e); });
    AsyncStorage.getItem(MP_STATS_KEY).then(raw => {
      if (raw) { try { setMpStats(JSON.parse(raw)); } catch { /* ignore */ } }
    });
    loadDcStats().then(setDcStats);
  }, []);

  const handlePickEmoji = (e: string) => {
    setEmoji(e);
    AsyncStorage.setItem(PROFILE_EMOJI_KEY, e).catch(() => {});
    setShowPicker(false);
  };

  const handleAvatarPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowStats(true);
  };

  const handleChangeAvatar = () => {
    setShowStats(false);
    // Small delay so stats sheet closes before picker opens
    setTimeout(() => setShowPicker(true), 320);
  };

  return (
    <>
      {/* Avatar — prominent, obviously tappable */}
      <Animated.View
        entering={splashDone ? FadeIn.duration(600).delay(100) : undefined}
        style={{ alignItems: 'center' }}
      >
        <Pressable
          onPress={handleAvatarPress}
          style={({ pressed }) => ({ alignItems: 'center', transform: [{ scale: pressed ? 0.94 : 1 }] })}
        >
          <View style={{ position: 'relative' }}>
            <View style={{
              width: 88, height: 88, borderRadius: 44,
              backgroundColor: SKETCH_COLORS.paperDark,
              borderWidth: 3, borderColor: SKETCH_COLORS.amber,
              alignItems: 'center', justifyContent: 'center',
              shadowColor: SKETCH_COLORS.amber,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3, shadowRadius: 12,
            }}>
              <Text style={{ fontSize: 46 }}>{emoji}</Text>
            </View>
            {/* Stats hint badge */}
            <View style={{
              position: 'absolute', bottom: 2, right: 2,
              width: 24, height: 24, borderRadius: 12,
              backgroundColor: SKETCH_COLORS.amber,
              borderWidth: 2, borderColor: SKETCH_COLORS.paper,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <ChevronDown size={12} color={SKETCH_COLORS.ink} strokeWidth={3} />
            </View>
          </View>
          {/* Tap hint label */}
          <View style={{ alignItems: 'center', marginTop: 9 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{
                color: SKETCH_COLORS.ink,
                fontSize: 13, fontWeight: '800', letterSpacing: 0.3,
              }}>Your Stats</Text>
              <ChevronDown size={13} color={SKETCH_COLORS.inkLight} strokeWidth={2.5} />
            </View>
          </View>
        </Pressable>
      </Animated.View>

      {/* Stats bottom sheet */}
      <StatsSheet
        visible={showStats}
        emoji={emoji}
        mpStats={mpStats}
        dcStats={dcStats}
        levelProgress={levelProgress}
        onClose={() => setShowStats(false)}
        onChangeAvatar={handleChangeAvatar}
      />

      {/* Emoji picker */}
      <EmojiPickerModal
        visible={showPicker}
        current={emoji}
        onPick={handlePickEmoji}
        onClose={() => setShowPicker(false)}
      />
    </>
  );
}
