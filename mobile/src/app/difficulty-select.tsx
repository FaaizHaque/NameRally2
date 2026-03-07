import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { ChevronLeft, Zap, Flame, Skull, Clock, Brain, Trophy } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useGameStore, DifficultyLevel } from '@/lib/state/game-store';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface DifficultyOption {
  id: DifficultyLevel;
  name: string;
  description: string;
  icon: React.ReactNode;
  colors: [string, string];
  features: string[];
}

const DIFFICULTY_OPTIONS: DifficultyOption[] = [
  {
    id: 'easy',
    name: 'Easy',
    description: 'Perfect for beginners',
    icon: <Zap size={32} color="#fff" />,
    colors: ['#22C55E', '#4ADE80'],
    features: ['More time per round', 'Common letters only'],
  },
  {
    id: 'medium',
    name: 'Medium',
    description: 'Balanced challenge',
    icon: <Flame size={32} color="#fff" />,
    colors: ['#F59E0B', '#FBBF24'],
    features: ['Standard timing', 'All letters included'],
  },
  {
    id: 'hard',
    name: 'Hard',
    description: 'For word masters',
    icon: <Skull size={32} color="#fff" />,
    colors: ['#EF4444', '#F87171'],
    features: ['Less time', 'Challenging letters'],
  },
];

export default function DifficultySelectScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setDifficulty = useGameStore((s) => s.setDifficulty);
  const highScores = useGameStore((s) => s.highScores);

  const handleSelectDifficulty = (difficulty: DifficultyLevel) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDifficulty(difficulty);
    router.push('/create-game');
  };

  return (
    <View className="flex-1">
      <LinearGradient
        colors={['#1a1a2e', '#2d2a4a', '#1a1a2e']}
        style={{ flex: 1 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={{ paddingTop: insets.top }} className="flex-1">
          {/* Header */}
          <Animated.View
            entering={FadeInDown.duration(400)}
            className="flex-row items-center px-4 py-3"
          >
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
              className="bg-white/10 p-3 rounded-full active:opacity-70"
            >
              <ChevronLeft size={24} color="#fff" />
            </Pressable>
            <Text className="text-white text-2xl font-bold ml-4">Select Difficulty</Text>
          </Animated.View>

          {/* Difficulty Options */}
          <View className="flex-1 px-5 justify-center">
            <Animated.View
              entering={FadeInUp.duration(600).delay(100)}
              className="gap-4"
            >
              {DIFFICULTY_OPTIONS.map((option, index) => {
                const bestScore = highScores[option.id] || 0;

                return (
                  <AnimatedPressable
                    key={option.id}
                    onPress={() => handleSelectDifficulty(option.id)}
                    className="active:scale-98"
                    entering={FadeInUp.duration(500).delay(150 + index * 100)}
                  >
                    <LinearGradient
                      colors={option.colors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        borderRadius: 20,
                        padding: 20,
                        shadowColor: option.colors[0],
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.4,
                        shadowRadius: 12,
                        elevation: 6,
                      }}
                    >
                      <View className="flex-row items-start justify-between">
                        <View className="flex-1">
                          <View className="flex-row items-center gap-3 mb-2">
                            <View className="bg-white/20 p-2.5 rounded-xl">
                              {option.icon}
                            </View>
                            <View>
                              <Text className="text-white text-2xl font-black">
                                {option.name}
                              </Text>
                              <Text className="text-white/80 text-sm">
                                {option.description}
                              </Text>
                            </View>
                          </View>

                          {/* Features */}
                          <View className="flex-row flex-wrap gap-2 mt-2 ml-1">
                            {option.features.map((feature, i) => (
                              <View
                                key={i}
                                className="bg-white/20 px-2.5 py-1 rounded-full"
                              >
                                <Text className="text-white/90 text-xs font-medium">
                                  {feature}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>

                        {/* High Score Badge */}
                        {bestScore > 0 && (
                          <View className="bg-white/20 px-3 py-2 rounded-xl items-center">
                            <Trophy size={16} color="#FFD700" />
                            <Text className="text-white text-sm font-bold mt-1">
                              {bestScore}
                            </Text>
                          </View>
                        )}
                      </View>
                    </LinearGradient>
                  </AnimatedPressable>
                );
              })}
            </Animated.View>

            {/* Info Text */}
            <Animated.View
              entering={FadeInUp.duration(500).delay(500)}
              className="mt-6"
            >
              <Text className="text-white/50 text-center text-sm">
                Difficulty affects time limits and letter selection
              </Text>
            </Animated.View>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}
