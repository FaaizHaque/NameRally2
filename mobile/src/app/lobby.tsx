import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, ScrollView, Share, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp, FadeIn } from 'react-native-reanimated';
import {
  ChevronLeft,
  Copy,
  Share2,
  Crown,
  Play,
  Users,
  User,
  MapPin,
  Cat,
  Box,
  Gamepad2,
  Apple,
  ShoppingBag,
  HeartPulse,
  Globe,
  Film,
  Music,
  Briefcase,
  Utensils,
  Landmark,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useGameStore, CategoryType } from '@/lib/state/game-store';
import { getCategoryName } from '@/lib/word-validation';
import { NotebookBackground } from '@/components/NotebookBackground';
import { CAT_COLORS } from '@/lib/category-colors';
import { Sounds } from '@/lib/sounds';

// Player avatar emojis + colors — one per slot, consistent per session
const PLAYER_EMOJIS = ['🦊', '🐻', '🐼', '🦁', '🐯', '🐨', '🦋', '🐸', '🦄', '🐙'];
const PLAYER_COLORS = ['#E8704A', '#8B6A3A', '#5A5A5A', '#E8A030', '#D05030', '#5A9080', '#8060C8', '#50A050', '#C850A0', '#6060A0'];

// Stable avatar index derived from username
function getAvatarIndex(username: string): number {
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = (hash * 31 + username.charCodeAt(i)) & 0xffff;
  return hash % PLAYER_EMOJIS.length;
}

// OG notebook palette
const P = {
  paper:      '#F2EAD0',
  paperDark:  '#E8DDB8',
  paperLine:  '#8A7040',
  paperDeep:  '#C4A870',
  marginRed:  'rgba(190,80,65,0.28)',
  ink:        '#1C120A',
  inkMed:     '#40301A',
  inkFaint:   '#8A7050',
  amber:      '#D09010',
  amberBg:    '#FEF0B0',
  wire:       '#8A7055',
};

// Category colors derived from shared palette
const CATEGORY_COLORS: Record<CategoryType, { tab: string; border: string; icon: string }> = Object.fromEntries(
  Object.entries(CAT_COLORS).map(([k, v]) => [k, { tab: v.tab, border: v.border, icon: v.icon }])
) as Record<CategoryType, { tab: string; border: string; icon: string }>;

const CATEGORY_ICONS: Record<CategoryType, React.ReactNode> = {
  names:              <User size={13} color={CAT_COLORS.names.icon} strokeWidth={2.5} />,
  places:             <MapPin size={13} color={CAT_COLORS.places.icon} strokeWidth={2.5} />,
  animal:             <Cat size={13} color={CAT_COLORS.animal.icon} strokeWidth={2.5} />,
  thing:              <Box size={13} color={CAT_COLORS.thing.icon} strokeWidth={2.5} />,
  sports_games:       <Gamepad2 size={13} color={CAT_COLORS.sports_games.icon} strokeWidth={2.5} />,
  brands:             <ShoppingBag size={13} color={CAT_COLORS.brands.icon} strokeWidth={2.5} />,
  health_issues:      <HeartPulse size={13} color={CAT_COLORS.health_issues.icon} strokeWidth={2.5} />,
  countries:          <Globe size={13} color={CAT_COLORS.countries.icon} strokeWidth={2.5} />,
  movies:             <Film size={13} color={CAT_COLORS.movies.icon} strokeWidth={2.5} />,
  songs:              <Music size={13} color={CAT_COLORS.songs.icon} strokeWidth={2.5} />,
  professions:        <Briefcase size={13} color={CAT_COLORS.professions.icon} strokeWidth={2.5} />,
  food_dishes:        <Utensils size={13} color={CAT_COLORS.food_dishes.icon} strokeWidth={2.5} />,
  historical_figures: <Landmark size={13} color={CAT_COLORS.historical_figures.icon} strokeWidth={2.5} />,
  music_artists:      <Music size={13} color={CAT_COLORS.music_artists.icon} strokeWidth={2.5} />,
  fruits_vegetables:  <Apple size={13} color={CAT_COLORS.fruits_vegetables.icon} strokeWidth={2.5} />,
};

export default function LobbyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const session = useGameStore((s) => s.session);
  const currentUser = useGameStore((s) => s.currentUser);
  const startGame = useGameStore((s) => s.startGame);
  const leaveGame = useGameStore((s) => s.leaveGame);
  const setTimeRemaining = useGameStore((s) => s.setTimeRemaining);
  const refreshSession = useGameStore((s) => s.refreshSession);

  // Poll for updates as fallback
  useEffect(() => {
    if (session) {
      pollingRef.current = setInterval(() => { refreshSession(); }, 2000);
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [session?.id]);

  // Start lobby background music (calm home track) when lobby loads
  useEffect(() => {
    if (session) {
      Sounds.startBackground('home');
    }
  }, [session]);

  // Navigate to game when status changes to 'playing' or 'picking_letter'
  useEffect(() => {
    if (session?.status === 'playing' || session?.status === 'picking_letter') {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      setTimeRemaining(session.settings.roundDuration);
      router.replace('/game');
    }
  }, [session?.status]);

  if (!session || !currentUser) return null;

  const isHost = session.hostId === currentUser.id;
  const canStart = session.players.length >= 1;

  const handleCopyCode = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(session.code);
    Alert.alert('Copied!', 'Game code copied to clipboard');
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({ message: `Join my NAPT game! Use code: ${session.code}` });
    } catch { /* ignore */ }
  };

  const handleStartGame = async () => {
    if (!canStart) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await startGame();
  };

  const handleLeaveGame = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await leaveGame();
    router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: P.paper }}>
      <NotebookBackground lineStartY={0} lineSpacing={28} lineCount={50} marginX={58} showMargin={true}>
        <View style={{ paddingTop: insets.top, flex: 1 }}>

          {/* ── Header ── */}
          <Animated.View entering={FadeInDown.duration(400)} style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 16, paddingVertical: 10,
            borderBottomWidth: 2, borderBottomColor: P.paperDeep,
          }}>
            <Pressable
              onPress={handleLeaveGame}
              style={({ pressed }) => ({
                backgroundColor: pressed ? P.paperDark : P.paperDark,
                padding: 8, borderRadius: 8,
                borderWidth: 1.5, borderColor: P.paperLine + '80',
              })}
            >
              <ChevronLeft size={20} color={P.inkMed} strokeWidth={2.5} />
            </Pressable>

            <Text style={{
              fontSize: 20, fontWeight: '900', color: P.inkMed,
              letterSpacing: 0.5,
            }}>
              Game Lobby
            </Text>

            <View style={{ width: 36 }} />
          </Animated.View>

          <ScrollView
            style={{ flex: 1, paddingHorizontal: 16 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20, paddingTop: 16, gap: 14 }}
          >

            {/* ── Room Code Card ── */}
            <Animated.View entering={FadeInUp.duration(500).delay(100)}>
              <View style={{
                backgroundColor: P.amberBg,
                borderRadius: 12, padding: 18,
                borderWidth: 2, borderColor: P.amber,
                shadowColor: P.ink, shadowOffset: { width: 2, height: 4 },
                shadowOpacity: 0.12, shadowRadius: 0,
                transform: [{ rotate: '-0.3deg' }],
              }}>
                {/* Tape piece */}
                <View style={{
                  position: 'absolute', top: -8, alignSelf: 'center',
                  width: 52, height: 16,
                  backgroundColor: 'rgba(205,190,120,0.65)',
                  borderRadius: 2,
                  transform: [{ rotate: '0.5deg' }],
                }} />

                <Text style={{ fontWeight: '500',fontSize: 13, color: P.inkFaint, marginBottom: 4 }}>
                  Room Code
                </Text>
                <Text style={{
                  fontWeight: '900', fontSize: 42,
                  color: P.inkMed, letterSpacing: 6, marginBottom: 8,
                }} numberOfLines={1} adjustsFontSizeToFit>
                  {session.code}
                </Text>

                <Text style={{
                  fontSize: 12, color: P.inkFaint, fontStyle: 'italic',
                  textAlign: 'center', marginBottom: 12,
                }}>
                  Share this code to invite friends
                </Text>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable
                    onPress={handleCopyCode}
                    style={({ pressed }) => ({
                      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                      backgroundColor: pressed ? P.paperDark : P.paper,
                      paddingVertical: 10, borderRadius: 8,
                      borderWidth: 1.5, borderColor: P.paperLine + '60',
                    })}
                  >
                    <Copy size={16} color={P.inkMed} strokeWidth={2.5} />
                    <Text style={{ fontWeight: '700', fontSize: 15, color: P.inkMed }}>Copy</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleShare}
                    style={({ pressed }) => ({
                      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
                      backgroundColor: pressed ? P.paperDark : P.paper,
                      paddingVertical: 10, borderRadius: 8,
                      borderWidth: 1.5, borderColor: P.paperLine + '60',
                    })}
                  >
                    <Share2 size={16} color={P.inkMed} strokeWidth={2.5} />
                    <Text style={{ fontWeight: '700', fontSize: 15, color: P.inkMed }}>Share</Text>
                  </Pressable>
                </View>
              </View>
            </Animated.View>

            {/* ── Game Settings ── */}
            <Animated.View entering={FadeInUp.duration(500).delay(200)}>
              <View style={{
                backgroundColor: P.paper,
                borderRadius: 10, padding: 16,
                borderWidth: 1.5, borderColor: P.paperLine + '50',
                shadowColor: P.ink, shadowOffset: { width: 1, height: 2 },
                shadowOpacity: 0.08, shadowRadius: 0,
              }}>
                <Text style={{ fontWeight: '700', fontSize: 16, color: P.inkMed, marginBottom: 10 }}>
                  Game Settings
                </Text>

                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                  <View style={{
                    flex: 1, alignItems: 'center', paddingVertical: 10,
                    backgroundColor: P.paperDark, borderRadius: 8,
                    borderWidth: 1, borderColor: P.paperLine + '40',
                  }}>
                    <Text style={{ fontWeight: '900', fontSize: 26, color: P.inkMed }}>{session.settings.totalRounds}</Text>
                    <Text style={{ fontWeight: '500',fontSize: 12, color: P.inkFaint }}>Rounds</Text>
                  </View>
                  <View style={{
                    flex: 1, alignItems: 'center', paddingVertical: 10,
                    backgroundColor: P.paperDark, borderRadius: 8,
                    borderWidth: 1, borderColor: P.paperLine + '40',
                  }}>
                    <Text style={{ fontWeight: '900', fontSize: 26, color: P.inkMed }}>{session.settings.selectedCategories.length}</Text>
                    <Text style={{ fontWeight: '500',fontSize: 12, color: P.inkFaint }}>Categories</Text>
                  </View>
                </View>

                {/* Category chips */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {session.settings.selectedCategories.map((cat) => {
                    const colors = CATEGORY_COLORS[cat];
                    return (
                      <View
                        key={cat}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 4,
                          paddingHorizontal: 9, paddingVertical: 4,
                          backgroundColor: colors?.tab || P.paperDark,
                          borderRadius: 6, borderWidth: 1, borderColor: colors?.border || P.paperLine,
                        }}
                      >
                        {CATEGORY_ICONS[cat]}
                        <Text style={{ fontWeight: '500',fontSize: 12, color: colors?.icon || P.ink }}>
                          {getCategoryName(cat)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </Animated.View>

            {/* ── Players ── */}
            <Animated.View entering={FadeInUp.duration(500).delay(300)}>
              <View style={{
                backgroundColor: P.paper,
                borderRadius: 10, padding: 16,
                borderWidth: 1.5, borderColor: P.paperLine + '50',
                shadowColor: P.ink, shadowOffset: { width: 1, height: 2 },
                shadowOpacity: 0.08, shadowRadius: 0,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Users size={16} color={P.amber} strokeWidth={2.5} />
                    <Text style={{ fontWeight: '700', fontSize: 16, color: P.inkMed }}>Players</Text>
                  </View>
                  <View style={{
                    backgroundColor: P.amberBg, paddingHorizontal: 10, paddingVertical: 3,
                    borderRadius: 20, borderWidth: 1, borderColor: P.amber,
                  }}>
                    <Text style={{ fontWeight: '700', fontSize: 13, color: P.amber }}>
                      {session.players.length}/10
                    </Text>
                  </View>
                </View>

                <View style={{ gap: 8 }}>
                  {session.players.map((player, index) => {
                    const isCurrentPlayer = player.visibleId === currentUser.id;
                    return (
                      <Animated.View
                        key={player.id}
                        entering={FadeIn.duration(400).delay(400 + index * 80)}
                      >
                        <View style={{
                          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                          padding: 12, borderRadius: 8,
                          backgroundColor: isCurrentPlayer ? '#FEF9EC' : P.paperDark,
                          borderWidth: 1.5,
                          borderColor: isCurrentPlayer ? P.amber : P.paperLine + '40',
                        }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            {/* Emoji avatar — consistent color per username */}
                            <View style={{ position: 'relative' }}>
                              <View style={{
                                width: 38, height: 38, borderRadius: 19,
                                backgroundColor: PLAYER_COLORS[getAvatarIndex(player.username)] + '22',
                                borderWidth: 2, borderColor: PLAYER_COLORS[getAvatarIndex(player.username)] + '80',
                                alignItems: 'center', justifyContent: 'center',
                              }}>
                                <Text style={{ fontSize: 20 }}>{PLAYER_EMOJIS[getAvatarIndex(player.username)]}</Text>
                              </View>
                              {player.isHost && (
                                <View style={{
                                  position: 'absolute', top: -4, right: -4,
                                  width: 16, height: 16, borderRadius: 8,
                                  backgroundColor: P.amberBg, borderWidth: 1.5, borderColor: P.amber,
                                  alignItems: 'center', justifyContent: 'center',
                                }}>
                                  <Crown size={9} color={P.amber} strokeWidth={2.5} />
                                </View>
                              )}
                            </View>
                            <View>
                              <Text style={{ fontWeight: '700', fontSize: 15, color: P.inkMed }}>
                                {player.username}{isCurrentPlayer ? ' (You)' : ''}
                              </Text>
                              <Text style={{ fontWeight: '500', fontSize: 11, color: player.isHost ? P.amber : P.inkFaint }}>
                                {player.isHost ? 'Host' : 'Player'}
                              </Text>
                            </View>
                          </View>
                          {/* Ready dot */}
                          <View style={{
                            width: 10, height: 10, borderRadius: 5,
                            backgroundColor: player.isReady ? '#22C55E' : '#EF4444',
                          }} />
                        </View>
                      </Animated.View>
                    );
                  })}
                </View>

              </View>
            </Animated.View>

          </ScrollView>

          {/* ── Start / Waiting button ── */}
          {isHost ? (
            <Animated.View
              entering={FadeInUp.duration(500).delay(500)}
              style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 16 }}
            >
              <Pressable
                onPress={handleStartGame}
                disabled={!canStart}
                style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}
              >
                <View style={{
                  borderRadius: 14, paddingVertical: 18,
                  backgroundColor: canStart ? P.amberBg : P.paperDark,
                  borderWidth: 2.5, borderColor: canStart ? P.amber : P.paperLine,
                  shadowColor: P.ink, shadowOffset: { width: 2, height: 4 },
                  shadowOpacity: canStart ? 0.18 : 0.08, shadowRadius: 0,
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                }}>
                  <Play size={22} color={canStart ? P.inkMed : P.inkFaint} fill={canStart ? P.inkMed : 'transparent'} strokeWidth={2} />
                  <Text style={{
                    fontWeight: '700', fontSize: 20,
                    color: canStart ? P.inkMed : P.inkFaint,
                  }}>
                    Start Game
                  </Text>
                </View>
              </Pressable>
            </Animated.View>
          ) : (
            <Animated.View
              entering={FadeInUp.duration(500).delay(500)}
              style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 16 }}
            >
              <View style={{
                borderRadius: 12, paddingVertical: 14,
                backgroundColor: P.paperDark, borderWidth: 1.5, borderColor: P.paperLine + '60',
              }}>
                <Text style={{ fontWeight: '500',fontSize: 14, color: P.inkFaint, textAlign: 'center', fontStyle: 'italic' }}>
                  Waiting for host to start the game...
                </Text>
              </View>
            </Animated.View>
          )}

        </View>
      </NotebookBackground>
    </View>
  );
}
