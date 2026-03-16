import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Minus,
  Plus,
  Check,
  User,
  MapPin,
  Cat,
  Box,
  Film,
  Car,
  Apple,
  ShoppingBag,
  Play,
  HeartPulse,
  Gamepad2,
  Clock,
  Star,
  AlertTriangle,
  Globe,
  Clapperboard,
  Music,
  Briefcase,
  UtensilsCrossed,
  Landmark,
  Zap,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useGameStore, AVAILABLE_CATEGORIES, CategoryType } from '@/lib/state/game-store';
import type { LevelCategoryType } from '@/lib/level-types';
import { SKETCH_COLORS } from '@/lib/theme';
import { NotebookBackground } from '@/components/NotebookBackground';
import { CAT_COLORS } from '@/lib/category-colors';

// Icon colors differ by mode
const MODERN_ICON_COLOR = '#a5b4fc';
const SKETCH_ICON_COLOR = SKETCH_COLORS.inkLight;

const CATEGORY_ICONS_MODERN: Record<string, React.ReactNode> = {
  names: <User size={18} color={MODERN_ICON_COLOR} />,
  places: <MapPin size={18} color={MODERN_ICON_COLOR} />,
  animal: <Cat size={18} color={MODERN_ICON_COLOR} />,
  thing: <Box size={18} color={MODERN_ICON_COLOR} />,
  fruits_vegetables: <Apple size={18} color={MODERN_ICON_COLOR} />,
  sports_games: <Gamepad2 size={18} color={MODERN_ICON_COLOR} />,
  brands: <ShoppingBag size={18} color={MODERN_ICON_COLOR} />,
  health_issues: <HeartPulse size={18} color={MODERN_ICON_COLOR} />,
  countries: <Globe size={18} color={MODERN_ICON_COLOR} />,
  movies: <Clapperboard size={18} color={MODERN_ICON_COLOR} />,
  songs: <Music size={18} color={MODERN_ICON_COLOR} />,
  professions: <Briefcase size={18} color={MODERN_ICON_COLOR} />,
  food_dishes: <UtensilsCrossed size={18} color={MODERN_ICON_COLOR} />,
  historical_figures: <Landmark size={18} color={MODERN_ICON_COLOR} />,
  music_artists: <Music size={18} color={MODERN_ICON_COLOR} />,
  books_movies: <Film size={18} color={MODERN_ICON_COLOR} />,
  cars: <Car size={18} color={MODERN_ICON_COLOR} />,
};

const CATEGORY_ICONS_SKETCH: Record<string, React.ReactNode> = {
  names: <User size={18} color={SKETCH_ICON_COLOR} />,
  places: <MapPin size={18} color={SKETCH_ICON_COLOR} />,
  animal: <Cat size={18} color={SKETCH_ICON_COLOR} />,
  thing: <Box size={18} color={SKETCH_ICON_COLOR} />,
  fruits_vegetables: <Apple size={18} color={SKETCH_ICON_COLOR} />,
  sports_games: <Gamepad2 size={18} color={SKETCH_ICON_COLOR} />,
  brands: <ShoppingBag size={18} color={SKETCH_ICON_COLOR} />,
  health_issues: <HeartPulse size={18} color={SKETCH_ICON_COLOR} />,
  countries: <Globe size={18} color={SKETCH_ICON_COLOR} />,
  movies: <Clapperboard size={18} color={SKETCH_ICON_COLOR} />,
  songs: <Music size={18} color={SKETCH_ICON_COLOR} />,
  professions: <Briefcase size={18} color={SKETCH_ICON_COLOR} />,
  food_dishes: <UtensilsCrossed size={18} color={SKETCH_ICON_COLOR} />,
  historical_figures: <Landmark size={18} color={SKETCH_ICON_COLOR} />,
  music_artists: <Music size={18} color={SKETCH_ICON_COLOR} />,
  books_movies: <Film size={18} color={SKETCH_ICON_COLOR} />,
  cars: <Car size={18} color={SKETCH_ICON_COLOR} />,
};

const LEVEL_CATEGORY_NAMES: Record<LevelCategoryType, string> = {
  names: 'Names',
  places: 'Places',
  animal: 'Animal',
  thing: 'Thing',
  sports_games: 'Sports & Games',
  brands: 'Brands',
  health_issues: 'Health Issues',
  countries: 'Countries',
  movies: 'Movies',
  songs: 'Songs',
  professions: 'Professions',
  food_dishes: 'Food & Dishes',
  historical_figures: 'Historical Figures',
  music_artists: 'Music Artists/Bands',
  fruits_vegetables: 'Fruits & Vegetables',
};

// Pastel notebook colors per category — derived from shared CAT_COLORS
const CATEGORY_PASTEL: Record<string, { bg: string; border: string; selectedBg: string; ink: string }> = {
  ...Object.fromEntries(
    Object.entries(CAT_COLORS).map(([k, v]) => [k, { bg: v.tab, border: v.border, selectedBg: v.accent, ink: v.icon }])
  ),
  books_movies: { bg: '#D8E8F0', border: '#6090B8', selectedBg: '#6090B8', ink: '#304860' },
  cars:         { bg: '#E8E8E8', border: '#888888', selectedBg: '#888888', ink: '#404040' },
};

// Modern dark colors per category — derived from shared CAT_COLORS
const CATEGORY_MODERN: Record<string, { bg: string; border: string; ink: string }> = {
  ...Object.fromEntries(
    Object.entries(CAT_COLORS).map(([k, v]) => [k, { bg: v.darkBg, border: v.darkBorder, ink: v.darkAccent }])
  ),
  books_movies: { bg: '#1e1840', border: '#7c3aed', ink: '#c4b5fd' },
  cars:         { bg: '#1a1a1a', border: '#888888', ink: '#cccccc' },
};

export default function CreateGameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [rounds, setRounds] = useState(5);
  const [selectedCategories, setSelectedCategories] = useState<CategoryType[]>([
    'names', 'places', 'animal', 'thing',
  ]);

  const createGame = useGameStore((s) => s.createGame);
  const gameMode = useGameStore((s) => s.gameMode);
  const currentLevel = useGameStore((s) => s.currentLevel);

  const isLevelMode = gameMode === 'single' && currentLevel !== null;

  const handleRoundsChange = (delta: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRounds((prev) => Math.max(1, Math.min(20, prev + delta)));
  };

  const toggleCategory = (categoryId: CategoryType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategories((prev) => {
      if (prev.includes(categoryId)) {
        if (prev.length <= 1) return prev;
        return prev.filter((c) => c !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
  };

  const handleCreateGame = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      if (isLevelMode && currentLevel) {
        await createGame({
          totalRounds: 1,
          selectedCategories: currentLevel.categories as CategoryType[],
        });
      } else {
        await createGame({ totalRounds: rounds, selectedCategories });
      }
      router.replace('/lobby');
    } catch (error) {
      console.log('Error creating game:', error);
    }
  };

  // ── SINGLE PLAYER (level mode) — modern dark UI ──
  if (isLevelMode && currentLevel) {
    return (
      <LinearGradient
        colors={['#0d0d1a', '#1a1a2e', '#12122a']}
        style={{ flex: 1 }}
      >
        <View style={{ paddingTop: insets.top, flex: 1 }}>
          {/* Header */}
          <View
            
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}
          >
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
              style={({ pressed }) => ({
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <View style={{
                backgroundColor: '#1e1b4b',
                padding: 10,
                borderRadius: 10,
                borderWidth: 1.5,
                borderColor: '#4F46E5',
              }}>
                <ChevronLeft size={22} color="#a5b4fc" strokeWidth={2.5} />
              </View>
            </Pressable>
            <LinearGradient
              colors={['#1e1b4b', '#2d2a6e']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                marginLeft: 12,
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 10,
                borderWidth: 1.5,
                borderColor: '#4F46E5',
              }}
            >
              <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '900' }}>
                Level {currentLevel.level}
              </Text>
            </LinearGradient>
          </View>

          <ScrollView
            style={{ flex: 1, paddingHorizontal: 16 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {/* Level Hero Card */}
            <View  style={{ marginBottom: 14 }}>
              <LinearGradient
                colors={['#1e1b4b', '#2d2a6e']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 16,
                  padding: 20,
                  borderWidth: 1.5,
                  borderColor: '#4F46E5',
                  shadowColor: '#4F46E5',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.4,
                  shadowRadius: 16,
                  elevation: 10,
                  overflow: 'hidden',
                }}
              >
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: '#818CF8' }} />
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <View>
                    <Text style={{ color: '#818CF8', fontSize: 11, fontWeight: '700', letterSpacing: 2, marginBottom: 2 }}>LEVEL</Text>
                    <Text style={{ color: '#ffffff', fontSize: 48, fontWeight: '900', lineHeight: 52 }}>{currentLevel.level}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ color: '#a5b4fc', fontSize: 13, fontWeight: '700', marginBottom: 6 }}>{currentLevel.bandName}</Text>
                    <View style={{
                      backgroundColor: '#312e81',
                      paddingHorizontal: 16,
                      paddingVertical: 6,
                      borderRadius: 20,
                      borderWidth: 1.5,
                      borderColor: '#6366f1',
                    }}>
                      <Text style={{ color: '#ffffff', fontSize: 22, fontWeight: '900' }}>"{currentLevel.letter}"</Text>
                    </View>
                  </View>
                </View>
                <View style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingTop: 14,
                  borderTopWidth: 1,
                  borderTopColor: '#4F46E530',
                }}>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Clock size={18} color="#818CF8" strokeWidth={2.5} />
                    <Text style={{ color: '#ffffff', fontWeight: '800', marginTop: 4, fontSize: 15 }}>{currentLevel.timerSeconds}s</Text>
                    <Text style={{ color: '#6366f1', fontSize: 10 }}>per category</Text>
                  </View>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Star size={18} color="#FCD34D" fill="#FCD34D" strokeWidth={2} />
                    <Text style={{ color: '#ffffff', fontWeight: '800', marginTop: 4, fontSize: 15 }}>{currentLevel.minScoreToPass}/{currentLevel.maxPossibleScore}</Text>
                    <Text style={{ color: '#6366f1', fontSize: 10 }}>to pass</Text>
                  </View>
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    <Zap size={18} color="#FCD34D" strokeWidth={2.5} />
                    <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '900', marginTop: 4 }}>×{currentLevel.bonusMultiplier}</Text>
                    <Text style={{ color: '#6366f1', fontSize: 10 }}>multiplier</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>

            {/* Constraint Warning */}
            {(currentLevel.constraint.type !== 'none' || currentLevel.isSurvivalMode) && (
              <View  style={{ marginBottom: 14 }}>
                <View style={{
                  backgroundColor: currentLevel.isSurvivalMode ? '#3a0f0f' : '#2a1f0a',
                  padding: 14,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: currentLevel.isSurvivalMode ? '#ef4444' : '#F59E0B',
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <AlertTriangle size={20} color={currentLevel.isSurvivalMode ? '#f87171' : '#FCD34D'} strokeWidth={2.5} />
                    <View style={{ flex: 1 }}>
                      {currentLevel.isSurvivalMode && (
                        <Text style={{ color: '#f87171', fontWeight: '900', fontSize: 13, marginBottom: 2 }}>SURVIVAL MODE</Text>
                      )}
                      <Text style={{ color: currentLevel.isSurvivalMode ? '#fca5a5' : '#fde68a', fontSize: 12, fontWeight: '600' }}>
                        {currentLevel.constraint.description}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Categories */}
            <View >
              <View style={{
                backgroundColor: '#111827',
                borderRadius: 14,
                padding: 16,
                borderWidth: 1.5,
                borderColor: '#1f2937',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '900' }}>Categories</Text>
                  <View style={{
                    backgroundColor: '#1e1b4b',
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    borderRadius: 12,
                    borderWidth: 1.5,
                    borderColor: '#4F46E5',
                  }}>
                    <Text style={{ color: '#a5b4fc', fontSize: 11, fontWeight: '800' }}>{currentLevel.categoryCount} categories</Text>
                  </View>
                </View>
                <View style={{ gap: 8 }}>
                  {currentLevel.categories.map((cat, index) => {
                    const colors = CATEGORY_MODERN[cat] || { bg: '#1a1a2e', border: '#4F46E5', ink: '#a5b4fc' };
                    return (
                      <View key={cat} >
                        <View style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 12,
                          borderRadius: 10,
                          backgroundColor: colors.bg,
                          borderWidth: 1.5,
                          borderColor: colors.border,
                          gap: 12,
                        }}>
                          <View style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: colors.border + '25',
                          }}>
                            {CATEGORY_ICONS_MODERN[cat] || <Box size={18} color={MODERN_ICON_COLOR} />}
                          </View>
                          <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '800' }}>
                            {LEVEL_CATEGORY_NAMES[cat as LevelCategoryType] || cat}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
                <Text style={{ color: '#6366f1', fontSize: 11, textAlign: 'center', marginTop: 12, fontStyle: 'italic' }}>
                  Categories set by level — complete to progress!
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* Start Level Button */}
          <View
            
            style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 16 }}
          >
            <Pressable
              onPress={handleCreateGame}
              style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
            >
              <LinearGradient
                colors={['#4F46E5', '#6366f1']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  borderRadius: 16,
                  paddingVertical: 20,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 10,
                  shadowColor: '#4F46E5',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.5,
                  shadowRadius: 16,
                  elevation: 10,
                }}
              >
                <Play size={22} color="#fff" fill="#fff" strokeWidth={2} />
                <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1 }}>Start Level</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </LinearGradient>
    );
  }

  // ── MULTIPLAYER — OG notebook UI ──
  return (
    <NotebookBackground lineStartY={130} lineSpacing={36} lineCount={32} marginX={48}>
      <View style={{ paddingTop: insets.top, flex: 1 }}>

        {/* Header */}
        <View
          
          style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}
        >
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }}
            style={({ pressed }) => ({
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View style={{
              backgroundColor: SKETCH_COLORS.paperDark,
              padding: 10, borderRadius: 10, borderWidth: 1.5,
              borderColor: SKETCH_COLORS.paperLine,
              shadowColor: SKETCH_COLORS.ink, shadowOffset: { width: 1, height: 2 },
              shadowOpacity: 0.1, shadowRadius: 0,
            }}>
              <ChevronLeft size={22} color={SKETCH_COLORS.inkLight} strokeWidth={2.5} />
            </View>
          </Pressable>
          <View style={{
            marginLeft: 12,
            backgroundColor: '#F8E080',
            paddingHorizontal: 12, paddingVertical: 5,
            borderRadius: 6, borderWidth: 1.5, borderColor: '#C8A030',
            transform: [{ rotate: '-0.5deg' }],
          }}>
            <Text style={{ color: '#7A5000', fontSize: 18, fontWeight: '900' }}>Create Game</Text>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        >

          {/* ── ROUNDS SECTION ── */}
          <View  style={{ marginBottom: 22 }}>
            {/* Hand-written section label */}
            <Text style={{
              color: SKETCH_COLORS.inkLight, fontSize: 13, fontWeight: '700',
              fontStyle: 'italic', marginBottom: 8, marginLeft: 2,
            }}>
              Number of Rounds:
            </Text>

            {/* Tape */}
            <View style={{
              alignSelf: 'center', width: 50, height: 14,
              backgroundColor: 'rgba(205,190,120,0.65)', borderRadius: 3,
              marginBottom: -7, zIndex: 2,
              borderWidth: 1, borderColor: 'rgba(160,140,80,0.4)',
            }} />

            {/* Rounds control — sits on notebook page */}
            <View style={{
              backgroundColor: SKETCH_COLORS.paper,
              borderWidth: 2, borderColor: SKETCH_COLORS.paperLine,
              borderRadius: 4,
              paddingHorizontal: 16, paddingVertical: 14,
              shadowColor: SKETCH_COLORS.ink,
              shadowOffset: { width: 2, height: 3 },
              shadowOpacity: 0.1, shadowRadius: 0, elevation: 2,
              transform: [{ rotate: '-0.3deg' }],
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Pressable
                  onPress={() => handleRoundsChange(-1)}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <View style={{
                    width: 52, height: 52, borderRadius: 8,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: SKETCH_COLORS.paper,
                    borderWidth: 2, borderColor: SKETCH_COLORS.paperLine,
                  }}>
                    <Minus size={24} color={SKETCH_COLORS.inkLight} strokeWidth={2.5} />
                  </View>
                </Pressable>
                <View style={{ alignItems: 'center' }}>
                  <View style={{
                    backgroundColor: SKETCH_COLORS.amberLight,
                    paddingHorizontal: 28, paddingVertical: 4,
                    borderRadius: 4, borderWidth: 2, borderColor: SKETCH_COLORS.amber,
                    transform: [{ rotate: '-0.5deg' }],
                  }}>
                    <Text style={{ color: SKETCH_COLORS.ink, fontSize: 48, fontWeight: '900', lineHeight: 58 }}>{rounds}</Text>
                  </View>
                  <Text style={{ color: SKETCH_COLORS.inkFaint, fontSize: 11, marginTop: 3, fontStyle: 'italic' }}>rounds</Text>
                </View>
                <Pressable
                  onPress={() => handleRoundsChange(1)}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <View style={{
                    width: 52, height: 52, borderRadius: 8,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: SKETCH_COLORS.paper,
                    borderWidth: 2, borderColor: SKETCH_COLORS.paperLine,
                  }}>
                    <Plus size={24} color={SKETCH_COLORS.inkLight} strokeWidth={2.5} />
                  </View>
                </Pressable>
              </View>
              {/* Underline */}
              <View style={{ height: 1, backgroundColor: SKETCH_COLORS.paperLine, opacity: 0.5, marginTop: 12 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                <Text style={{ color: SKETCH_COLORS.inkFaint, fontSize: 10, fontStyle: 'italic' }}>min: 1</Text>
                <Text style={{ color: SKETCH_COLORS.inkFaint, fontSize: 10, fontStyle: 'italic' }}>max: 20</Text>
              </View>
            </View>
          </View>

          {/* ── CATEGORIES SECTION ── */}
          <View >
            {/* Hand-written section label + count */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, marginLeft: 2 }}>
              <Text style={{ color: SKETCH_COLORS.inkLight, fontSize: 13, fontWeight: '700', fontStyle: 'italic' }}>
                Categories:
              </Text>
              <View style={{
                backgroundColor: SKETCH_COLORS.amberLight,
                paddingHorizontal: 8, paddingVertical: 2,
                borderRadius: 4, borderWidth: 1.5, borderColor: SKETCH_COLORS.amber,
                transform: [{ rotate: '0.4deg' }],
              }}>
                <Text style={{ color: '#7A5000', fontSize: 11, fontWeight: '800' }}>{selectedCategories.length} selected</Text>
              </View>
            </View>

            {/* Category rows — directly on notebook, look like torn strips */}
            <View style={{ gap: 6 }}>
              {AVAILABLE_CATEGORIES.map((category, index) => {
                const isSelected = selectedCategories.includes(category.id);
                const colors = CATEGORY_PASTEL[category.id] || { bg: SKETCH_COLORS.paper, border: SKETCH_COLORS.paperLine, selectedBg: SKETCH_COLORS.paperLine, ink: SKETCH_COLORS.inkLight };
                const tilt = index % 3 === 0 ? '-0.4deg' : index % 3 === 1 ? '0.3deg' : '-0.2deg';
                return (
                  <View key={category.id} >
                    <Pressable onPress={() => toggleCategory(category.id)}
                      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }, { rotate: tilt }] })}>
                      <View style={{
                        flexDirection: 'row', alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 9, paddingHorizontal: 10,
                        borderRadius: 4,
                        backgroundColor: isSelected ? colors.bg : SKETCH_COLORS.paper,
                        borderWidth: isSelected ? 2 : 1,
                        borderColor: isSelected ? colors.border : SKETCH_COLORS.paperLine,
                        shadowColor: SKETCH_COLORS.ink,
                        shadowOffset: { width: 1, height: 2 },
                        shadowOpacity: isSelected ? 0.1 : 0.06,
                        shadowRadius: 0, elevation: isSelected ? 2 : 1,
                      }}>
                        {/* Left margin accent when selected */}
                        {isSelected && (
                          <View style={{
                            position: 'absolute', left: 0, top: 0, bottom: 0,
                            width: 4, borderRadius: 4,
                            backgroundColor: colors.border,
                          }} />
                        )}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingLeft: isSelected ? 6 : 2 }}>
                          <View style={{
                            width: 30, height: 30, borderRadius: 6,
                            alignItems: 'center', justifyContent: 'center',
                            backgroundColor: isSelected ? colors.border + '28' : SKETCH_COLORS.paperDark,
                          }}>
                            {CATEGORY_ICONS_SKETCH[category.id]}
                          </View>
                          <Text style={{
                            color: isSelected ? colors.ink : SKETCH_COLORS.inkLight,
                            fontSize: 13, fontWeight: isSelected ? '800' : '600',
                          }} numberOfLines={1}>
                            {category.name}
                          </Text>
                        </View>
                        {/* Checkbox */}
                        <View style={{
                          width: 22, height: 22, borderRadius: 3,
                          alignItems: 'center', justifyContent: 'center',
                          backgroundColor: isSelected ? colors.border : 'transparent',
                          borderWidth: 2,
                          borderColor: isSelected ? colors.border : SKETCH_COLORS.paperLine,
                        }}>
                          {isSelected && <Check size={13} color="#fff" strokeWidth={3} />}
                        </View>
                      </View>
                    </Pressable>
                  </View>
                );
              })}
            </View>
            <Text style={{ color: SKETCH_COLORS.inkFaint, fontSize: 11, marginTop: 8, fontStyle: 'italic', marginLeft: 2 }}>
              Tap to select / deselect (minimum 1)
            </Text>
          </View>
        </ScrollView>

        {/* Create Game Button */}
        <View
          
          style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: insets.bottom + 16 }}
        >
          <Pressable
            onPress={handleCreateGame}
            style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }, { rotate: '-0.3deg' }] })}
          >
            <View style={{
              backgroundColor: SKETCH_COLORS.red,
              borderRadius: 8, paddingVertical: 18,
              alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10,
              borderWidth: 2.5, borderColor: '#991111',
              shadowColor: SKETCH_COLORS.ink, shadowOffset: { width: 3, height: 5 },
              shadowOpacity: 0.2, shadowRadius: 0, elevation: 5,
            }}>
              <Play size={22} color="#fff" fill="#fff" strokeWidth={2} />
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>Create Game</Text>
            </View>
          </Pressable>
        </View>
      </View>
    </NotebookBackground>
  );
}
