import React, { useEffect, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, Modal,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Trophy, Users, CalendarDays, Star, Pencil } from 'lucide-react-native';
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

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatCard({
  icon, title, accentColor, rows,
}: {
  icon: React.ReactNode;
  title: string;
  accentColor: string;
  rows: Array<{ label: string; value: string; big?: boolean }>;
}) {
  return (
    <View style={{
      width: 110,
      backgroundColor: SKETCH_COLORS.paper,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: accentColor + '55',
      borderTopWidth: 3,
      borderTopColor: accentColor,
      paddingHorizontal: 10,
      paddingVertical: 10,
      marginRight: 8,
      shadowColor: SKETCH_COLORS.ink,
      shadowOffset: { width: 1, height: 2 },
      shadowOpacity: 0.08, shadowRadius: 0,
    }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 }}>
        {icon}
        <Text style={{
          fontSize: 10, fontWeight: '700',
          color: accentColor,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          flexShrink: 1,
        }} numberOfLines={1}>{title}</Text>
      </View>
      {/* Rows */}
      {rows.map((row, i) => (
        <View key={i} style={{ marginBottom: i < rows.length - 1 ? 5 : 0 }}>
          {row.big ? (
            <Text style={{
              fontSize: 26, fontWeight: '900',
              color: SKETCH_COLORS.ink,
              lineHeight: 28,
            }}>{row.value}</Text>
          ) : (
            <Text style={{
              fontSize: 13, fontWeight: '700',
              color: SKETCH_COLORS.inkLight,
            }}>{row.value}</Text>
          )}
          <Text style={{
            fontSize: 10, color: SKETCH_COLORS.inkFaint,
            fontWeight: '600', letterSpacing: 0.3,
          }}>{row.label}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Emoji picker modal ────────────────────────────────────────────────────────

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
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
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
              paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32,
              borderTopWidth: 2, borderLeftWidth: 1, borderRightWidth: 1,
              borderColor: SKETCH_COLORS.paperLine + '50',
            }}
          >
            {/* Handle */}
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

            {/* Emoji grid */}
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

// ─── ProfileCard ──────────────────────────────────────────────────────────────

interface ProfileCardProps {
  levelProgress: LevelProgress;
  splashDone: boolean;
}

export function ProfileCard({ levelProgress, splashDone }: ProfileCardProps) {
  const [emoji, setEmoji] = useState<string>(DEFAULT_EMOJI);
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

  const spLevel = levelProgress.unlockedLevel;
  const spStars = levelProgress.totalStars ?? 0;
  const spPoints = levelProgress.totalPoints ?? 0;

  return (
    <>
      <Animated.View
        entering={splashDone ? FadeIn.duration(600).delay(100) : undefined}
        style={{
          backgroundColor: SKETCH_COLORS.paperDark,
          borderRadius: 18,
          borderWidth: 1.5,
          borderColor: SKETCH_COLORS.paperLine + '40',
          padding: 16,
          shadowColor: SKETCH_COLORS.ink,
          shadowOffset: { width: 2, height: 4 },
          shadowOpacity: 0.10, shadowRadius: 0,
          transform: [{ rotate: '-0.3deg' }],
        }}
      >
        {/* Emoji avatar */}
        <View style={{ alignItems: 'center', marginBottom: 14 }}>
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowPicker(true); }}
            style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.93 : 1 }] })}
          >
            <View style={{ position: 'relative' }}>
              <View style={{
                width: 72, height: 72, borderRadius: 36,
                backgroundColor: SKETCH_COLORS.paper,
                borderWidth: 2.5, borderColor: SKETCH_COLORS.amber + '80',
                alignItems: 'center', justifyContent: 'center',
                shadowColor: SKETCH_COLORS.ink,
                shadowOffset: { width: 1, height: 2 },
                shadowOpacity: 0.12, shadowRadius: 0,
              }}>
                <Text style={{ fontSize: 38 }}>{emoji}</Text>
              </View>
              {/* Edit badge */}
              <View style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 22, height: 22, borderRadius: 11,
                backgroundColor: SKETCH_COLORS.amber,
                borderWidth: 2, borderColor: SKETCH_COLORS.paperDark,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Pencil size={11} color={SKETCH_COLORS.ink} strokeWidth={2.5} />
              </View>
            </View>
          </Pressable>
        </View>

        {/* Stat cards — horizontal scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ paddingRight: 4 }}
        >
          {/* Single Player */}
          <StatCard
            icon={<Trophy size={11} color="#D09010" strokeWidth={2.5} />}
            title="Single"
            accentColor="#D09010"
            rows={[
              { label: 'level', value: `${spLevel}`, big: true },
              { label: `star${spStars !== 1 ? 's' : ''}`, value: `⭐ ${spStars}` },
              { label: 'points', value: `${spPoints} pts` },
            ]}
          />

          {/* Multiplayer */}
          <StatCard
            icon={<Users size={11} color="#205880" strokeWidth={2.5} />}
            title="Multi"
            accentColor="#205880"
            rows={[
              { label: 'played', value: `${mpStats.gamesPlayed}`, big: true },
              { label: 'won', value: `${mpStats.gamesWon} 🏆` },
            ]}
          />

          {/* Daily Challenge */}
          <StatCard
            icon={<CalendarDays size={11} color="#2A6640" strokeWidth={2.5} />}
            title="Daily"
            accentColor="#2A6640"
            rows={[
              { label: 'played', value: `${dcStats.played}`, big: true },
              {
                label: 'best time',
                value: dcStats.bestTimeMs !== null ? formatTimeMs(dcStats.bestTimeMs) : '—',
              },
            ]}
          />
        </ScrollView>
      </Animated.View>

      <EmojiPickerModal
        visible={showPicker}
        current={emoji}
        onPick={handlePickEmoji}
        onClose={() => setShowPicker(false)}
      />
    </>
  );
}
