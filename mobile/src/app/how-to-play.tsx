import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import {
  ChevronLeft,
  Users,
  Clock,
  Target,
  Trophy,
  Lightbulb,
  Star,
  Gamepad2,
  Calendar,
  TrendingUp,
  Zap,
  Lock,
  Shield,
  Sparkles,
  Grid3X3,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

type TabType = 'basics' | 'categories' | 'single' | 'daily' | 'multiplayer';

export default function HowToPlayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('basics');

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleTabChange = (tab: TabType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'basics', label: 'Basics', icon: <Target size={16} color="#fff" /> },
    { id: 'categories', label: 'Categories', icon: <Grid3X3 size={16} color="#fff" /> },
    { id: 'single', label: 'Solo', icon: <Gamepad2 size={16} color="#fff" /> },
    { id: 'daily', label: 'Daily', icon: <Calendar size={16} color="#fff" /> },
    { id: 'multiplayer', label: 'Multiplayer', icon: <Users size={16} color="#fff" /> },
  ];

  return (
    <View className="flex-1">
      <LinearGradient
        colors={['#2d3a4f', '#3d4a5f', '#4a5a6f']}
        style={{ flex: 1 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={{ paddingTop: insets.top }} className="flex-1">
          {/* Header */}
          <Animated.View
            entering={FadeInDown.duration(400)}
            className="flex-row items-center px-4 py-4"
          >
            <Pressable
              onPress={handleBack}
              className="w-10 h-10 bg-white/10 rounded-full items-center justify-center mr-3"
            >
              <ChevronLeft size={24} color="#fff" />
            </Pressable>
            <Text className="text-white text-2xl font-bold flex-1">How to Play</Text>
          </Animated.View>

          {/* Tab Bar */}
          <Animated.View
            entering={FadeInDown.duration(400).delay(100)}
            style={{ paddingHorizontal: 16, marginBottom: 16 }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingRight: 4 }}
            >
              {tabs.map((tab) => (
                <Pressable
                  key={tab.id}
                  onPress={() => handleTabChange(tab.id)}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingVertical: 9,
                      paddingHorizontal: 16,
                      borderRadius: 20,
                      backgroundColor: activeTab === tab.id ? '#3BA99C' : 'rgba(255,255,255,0.1)',
                    }}
                  >
                    {tab.icon}
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '700',
                        color: activeTab === tab.id ? '#1a1a2e' : 'rgba(255,255,255,0.7)',
                      }}
                    >
                      {tab.label}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>

          <ScrollView
            className="flex-1 px-4"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          >
            {activeTab === 'basics' && <BasicsContent />}
            {activeTab === 'categories' && <CategoriesContent />}
            {activeTab === 'single' && <SinglePlayerContent />}
            {activeTab === 'daily' && <DailyChallengeContent />}
            {activeTab === 'multiplayer' && <MultiplayerContent />}
          </ScrollView>

          {/* Back Button */}
          <Animated.View
            entering={FadeInUp.duration(500).delay(900)}
            className="px-4"
            style={{ paddingBottom: insets.bottom + 16 }}
          >
            <Pressable
              onPress={handleBack}
              className="active:scale-95"
            >
              <LinearGradient
                colors={['#3BA99C', '#5BC4B6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 20,
                  padding: 18,
                  alignItems: 'center',
                  shadowColor: '#3BA99C',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.4,
                  shadowRadius: 16,
                  elevation: 8,
                }}
              >
                <Text className="text-[#1a1a2e] text-xl font-bold">Got It!</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </View>
      </LinearGradient>
    </View>
  );
}

// Basics Tab Content
function BasicsContent() {
  const basicSteps = [
    {
      icon: <Target size={24} color="#3BA99C" />,
      title: 'Get a Letter',
      description: 'Each round starts with a letter (like "S" or combo like "CH"). All your answers must start with it.',
      color: '#3BA99C',
    },
    {
      icon: <Clock size={24} color="#D4A84B" />,
      title: 'Race the Clock',
      description: 'Fill in words for each category before time runs out. Think fast!',
      color: '#D4A84B',
    },
    {
      icon: <Trophy size={24} color="#6EC4B8" />,
      title: 'Score Points',
      description: 'Valid answers earn 10 points. Long words (10+ letters) get a +2 bonus!',
      color: '#6EC4B8',
    },
  ];

  return (
    <>
      {/* Overview */}
      <Animated.View
        entering={FadeInUp.duration(500).delay(100)}
        className="bg-white/10 rounded-3xl p-6 mb-5 border border-white/10"
      >
        <Text className="text-white text-xl font-bold mb-3">What is NPAT?</Text>
        <Text className="text-white/80 text-base leading-7">
          NPAT (Name, Place, Animal, Thing) is the classic word game where you think of words
          starting with a given letter across different categories. Play solo through endless levels,
          tackle the daily challenge, or compete with friends!
        </Text>
      </Animated.View>

      {/* Steps */}
      <Animated.View entering={FadeInUp.duration(500).delay(200)} className="mb-5">
        <Text className="text-white text-xl font-bold mb-4">The Basics</Text>
        <View className="gap-3">
          {basicSteps.map((step, index) => (
            <View
              key={step.title}
              className="bg-white/8 rounded-2xl p-5 flex-row items-start gap-4 border border-white/8"
            >
              <View
                className="w-12 h-12 rounded-xl items-center justify-center"
                style={{ backgroundColor: `${step.color}25` }}
              >
                {step.icon}
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-1">
                  <View
                    className="w-5 h-5 rounded-full items-center justify-center"
                    style={{ backgroundColor: step.color }}
                  >
                    <Text className="text-[#1a1a2e] text-xs font-bold">{index + 1}</Text>
                  </View>
                  <Text className="text-white text-lg font-bold">{step.title}</Text>
                </View>
                <Text className="text-white/70 text-base leading-6">{step.description}</Text>
              </View>
            </View>
          ))}
        </View>
      </Animated.View>

      {/* Scoring */}
      <Animated.View
        entering={FadeInUp.duration(500).delay(300)}
        className="bg-gradient-to-r from-[#D4A84B]/20 to-[#FF6B6B]/20 rounded-3xl p-6 mb-5 border border-[#D4A84B]/30"
      >
        <View className="flex-row items-center gap-2 mb-4">
          <Star size={22} color="#D4A84B" fill="#D4A84B" />
          <Text className="text-white text-xl font-bold">Scoring</Text>
        </View>
        <View className="gap-3">
          <View className="flex-row items-center gap-3">
            <View className="bg-[#D4A84B] px-3 py-1.5 rounded-lg min-w-[70px] items-center">
              <Text className="text-[#1a1a2e] font-bold text-base">10 pts</Text>
            </View>
            <Text className="text-white/80 text-base flex-1">Valid answer</Text>
          </View>
          <View className="flex-row items-center gap-3">
            <View className="bg-[#9B6ED8] px-3 py-1.5 rounded-lg min-w-[70px] items-center">
              <Text className="text-white font-bold text-base">+2 pts</Text>
            </View>
            <Text className="text-white/80 text-base flex-1">Bonus for 10+ letters</Text>
          </View>
          <View className="flex-row items-center gap-3">
            <View className="bg-[#FF6B6B]/70 px-3 py-1.5 rounded-lg min-w-[70px] items-center">
              <Text className="text-white font-bold text-base">0 pts</Text>
            </View>
            <Text className="text-white/80 text-base flex-1">Invalid or empty</Text>
          </View>
        </View>
      </Animated.View>

      {/* Categories */}
      <Animated.View
        entering={FadeInUp.duration(500).delay(400)}
        className="bg-white/8 rounded-3xl p-6 border border-white/10"
      >
        <View className="flex-row items-center gap-2 mb-4">
          <Sparkles size={22} color="#6EC4B8" />
          <Text className="text-white text-xl font-bold">Categories</Text>
        </View>
        <Text className="text-white/70 text-base leading-6 mb-3">
          Start with basics like Names, Places, Animals, Things. As you progress, unlock:
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {['Sports & Games', 'Fruits & Vegetables', 'Brands', 'Movies', 'Songs', 'Food & Dishes', 'Countries', 'Health Issues', 'Professions', 'Historical Figures'].map((cat) => (
            <View key={cat} className="bg-white/10 px-3 py-1.5 rounded-full">
              <Text className="text-white/80 text-sm">{cat}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </>
  );
}

// Categories Content
function CategoriesContent() {
  const categories = [
    {
      name: 'Name',
      emoji: '👤',
      color: '#3BA99C',
      description: 'A person\'s first or full name. Real or fictional — anyone counts!',
    },
    {
      name: 'Place',
      emoji: '📍',
      color: '#D4A84B',
      description: 'Any city, country, landmark, or geographic location in the world.',
    },
    {
      name: 'Animal',
      emoji: '🐾',
      color: '#6EC4B8',
      description: 'Any living creature — mammals, birds, fish, insects, reptiles, all fair game.',
    },
    {
      name: 'Thing',
      emoji: '📦',
      color: '#9B6ED8',
      description: 'Any physical object or item. If you can touch it, it counts.',
    },
    {
      name: 'Food & Dishes',
      emoji: '🍽️',
      color: '#FF6B6B',
      description: 'Any meal, dish, or cuisine from around the world. Think restaurants, not raw ingredients.',
    },
    {
      name: 'Sports & Games',
      emoji: '⚽',
      color: '#3BA99C',
      description: 'A sport, game, or athletic discipline — from football to chess.',
    },
    {
      name: 'Fruits & Vegetables',
      emoji: '🍎',
      color: '#D4A84B',
      description: 'Any fruit or vegetable — common or exotic. Berries, citrus, tropical, root veg, all included.',
    },
    {
      name: 'Brands',
      emoji: '™️',
      color: '#6EC4B8',
      description: 'A company, brand, or trademark. Think logos you\'d recognize on a billboard.',
    },
    {
      name: 'Movies',
      emoji: '🎬',
      color: '#9B6ED8',
      description: 'A film title — blockbuster, indie, animated, or classic. Any era counts.',
    },
    {
      name: 'Songs',
      emoji: '🎵',
      color: '#FF6B6B',
      description: 'A song title from any genre or era. The name of the track, not the artist.',
    },
    {
      name: 'Countries',
      emoji: '🌍',
      color: '#3BA99C',
      description: 'Any sovereign country in the world — from Afghanistan to Zimbabwe.',
    },
    {
      name: 'Health Issues',
      emoji: '🏥',
      color: '#9B6ED8',
      description: 'Medical conditions, illnesses, symptoms, and health ailments.',
    },
    {
      name: 'Professions',
      emoji: '💼',
      color: '#6EC4B8',
      description: 'A job, career, or occupation. Doctor, pilot, chef — any line of work.',
    },
    {
      name: 'Historical Figures',
      emoji: '📜',
      color: '#D4A84B',
      description: 'A real historical person — explorer, ruler, scientist, or world leader.',
    },
  ];

  return (
    <>
      <Animated.View
        entering={FadeInUp.duration(500).delay(100)}
        className="bg-white/10 rounded-3xl p-6 mb-5 border border-white/10"
      >
        <Text className="text-white text-xl font-bold mb-2">All Categories</Text>
        <Text className="text-white/70 text-base leading-6">
          NPAT starts with the classics and unlocks new categories as you level up. Here's what each one means.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(500).delay(200)} className="gap-3 mb-6">
        {categories.map((cat, index) => (
          <Animated.View
            key={cat.name}
            entering={FadeInUp.duration(400).delay(100 + index * 40)}
            className="bg-white/8 rounded-2xl p-4 flex-row items-center gap-4 border border-white/8"
          >
            <View
              className="w-12 h-12 rounded-xl items-center justify-center"
              style={{ backgroundColor: `${cat.color}25` }}
            >
              <Text style={{ fontSize: 22 }}>{cat.emoji}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-white text-base font-bold mb-1">{cat.name}</Text>
              <Text className="text-white/65 text-sm leading-5">{cat.description}</Text>
            </View>
          </Animated.View>
        ))}
      </Animated.View>
    </>
  );
}

// Single Player Content
function SinglePlayerContent() {
  return (
    <>
      {/* Overview */}
      <Animated.View
        entering={FadeInUp.duration(500).delay(100)}
        className="bg-gradient-to-r from-[#9B6ED8]/20 to-[#6EC4B8]/20 rounded-3xl p-6 mb-5 border border-[#9B6ED8]/30"
      >
        <View className="flex-row items-center gap-2 mb-3">
          <Gamepad2 size={24} color="#9B6ED8" />
          <Text className="text-white text-xl font-bold">Level Journey</Text>
        </View>
        <Text className="text-white/80 text-base leading-7">
          Progress through increasingly challenging levels. Each level is one round —
          score enough points to unlock the next. How far can you go?
        </Text>
      </Animated.View>

      {/* How Levels Work */}
      <Animated.View entering={FadeInUp.duration(500).delay(200)} className="mb-5">
        <Text className="text-white text-xl font-bold mb-4">How Levels Work</Text>
        <View className="gap-3">
          <View className="bg-white/8 rounded-2xl p-4 flex-row items-center gap-4 border border-white/8">
            <View className="w-12 h-12 rounded-xl bg-[#3BA99C]/25 items-center justify-center">
              <TrendingUp size={24} color="#3BA99C" />
            </View>
            <View className="flex-1">
              <Text className="text-white text-base font-bold mb-1">Progressive Difficulty</Text>
              <Text className="text-white/70 text-sm leading-5">
                Starts easy with common letters, gets harder with Q, X, Z and two-letter combos like "CH", "TH"
              </Text>
            </View>
          </View>

          <View className="bg-white/8 rounded-2xl p-4 flex-row items-center gap-4 border border-white/8">
            <View className="w-12 h-12 rounded-xl bg-[#D4A84B]/25 items-center justify-center">
              <Star size={24} color="#D4A84B" />
            </View>
            <View className="flex-1">
              <Text className="text-white text-base font-bold mb-1">Earn Stars</Text>
              <Text className="text-white/70 text-sm leading-5">
                Pass = 1 star, 75%+ = 2 stars, 90%+ = 3 stars. Collect stars to show mastery!
              </Text>
            </View>
          </View>

          <View className="bg-white/8 rounded-2xl p-4 flex-row items-center gap-4 border border-white/8">
            <View className="w-12 h-12 rounded-xl bg-[#FF6B6B]/25 items-center justify-center">
              <Zap size={24} color="#FF6B6B" />
            </View>
            <View className="flex-1">
              <Text className="text-white text-base font-bold mb-1">Special Constraints</Text>
              <Text className="text-white/70 text-sm leading-5">
                Constraints unlock as you progress: minimum word length, no repeat letters, survival mode (one wrong = fail), time pressure, double letters, and more
              </Text>
            </View>
          </View>

          <View className="bg-white/8 rounded-2xl p-4 flex-row items-center gap-4 border border-white/8">
            <View className="w-12 h-12 rounded-xl bg-[#9B6ED8]/25 items-center justify-center">
              <Lock size={24} color="#9B6ED8" />
            </View>
            <View className="flex-1">
              <Text className="text-white text-base font-bold mb-1">Unlock Categories</Text>
              <Text className="text-white/70 text-sm leading-5">
                New categories unlock as you progress: Countries, Movies, Songs, Health Issues, Professions, Historical Figures, Fruits & Vegetables, and more
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Tips */}
      <Animated.View
        entering={FadeInUp.duration(500).delay(400)}
        className="bg-white/8 rounded-3xl p-6 border border-white/10"
      >
        <View className="flex-row items-center gap-2 mb-4">
          <Lightbulb size={22} color="#6EC4B8" />
          <Text className="text-white text-xl font-bold">Tips</Text>
        </View>
        <View className="gap-3">
          {[
            'Use hints when stuck - they show a valid answer',
            'Replay levels to earn more stars',
            'Long words (10+ letters) earn bonus points',
            'Practice hard letters in earlier levels',
          ].map((tip, index) => (
            <View key={index} className="flex-row items-start gap-3">
              <View className="w-2 h-2 rounded-full bg-[#6EC4B8] mt-2" />
              <Text className="text-white/80 text-sm flex-1 leading-5">{tip}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </>
  );
}

// Daily Challenge Content
function DailyChallengeContent() {
  return (
    <>
      {/* Overview */}
      <Animated.View
        entering={FadeInUp.duration(500).delay(100)}
        className="bg-gradient-to-r from-[#D4A84B]/20 to-[#FF6B6B]/20 rounded-3xl p-6 mb-5 border border-[#D4A84B]/30"
      >
        <View className="flex-row items-center gap-2 mb-3">
          <Calendar size={24} color="#D4A84B" />
          <Text className="text-white text-xl font-bold">Daily Challenge</Text>
        </View>
        <Text className="text-white/80 text-base leading-7">
          A new challenge every day! Everyone gets the same letter and categories.
          Compare your score with players worldwide on the leaderboard.
        </Text>
      </Animated.View>

      {/* How It Works */}
      <Animated.View entering={FadeInUp.duration(500).delay(200)} className="mb-5">
        <Text className="text-white text-xl font-bold mb-4">How It Works</Text>
        <View className="gap-3">
          <View className="bg-white/8 rounded-2xl p-4 flex-row items-center gap-4 border border-white/8">
            <View className="w-12 h-12 rounded-xl bg-[#D4A84B]/25 items-center justify-center">
              <Calendar size={24} color="#D4A84B" />
            </View>
            <View className="flex-1">
              <Text className="text-white text-base font-bold mb-1">New Daily at Midnight</Text>
              <Text className="text-white/70 text-sm leading-5">
                A fresh challenge resets at midnight UTC. Same letter and categories for everyone!
              </Text>
            </View>
          </View>

          <View className="bg-white/8 rounded-2xl p-4 flex-row items-center gap-4 border border-white/8">
            <View className="w-12 h-12 rounded-xl bg-[#6EC4B8]/25 items-center justify-center">
              <Clock size={24} color="#6EC4B8" />
            </View>
            <View className="flex-1">
              <Text className="text-white text-base font-bold mb-1">One Attempt</Text>
              <Text className="text-white/70 text-sm leading-5">
                You only get one shot per day. Make it count! No retries until tomorrow.
              </Text>
            </View>
          </View>

          <View className="bg-white/8 rounded-2xl p-4 flex-row items-center gap-4 border border-white/8">
            <View className="w-12 h-12 rounded-xl bg-[#9B6ED8]/25 items-center justify-center">
              <Trophy size={24} color="#9B6ED8" />
            </View>
            <View className="flex-1">
              <Text className="text-white text-base font-bold mb-1">Global Leaderboard</Text>
              <Text className="text-white/70 text-sm leading-5">
                See how you rank against other players. Top scores get bragging rights!
              </Text>
            </View>
          </View>

          <View className="bg-white/8 rounded-2xl p-4 flex-row items-center gap-4 border border-white/8">
            <View className="w-12 h-12 rounded-xl bg-[#FF6B6B]/25 items-center justify-center">
              <Zap size={24} color="#FF6B6B" />
            </View>
            <View className="flex-1">
              <Text className="text-white text-base font-bold mb-1">Build Streaks</Text>
              <Text className="text-white/70 text-sm leading-5">
                Play daily to build your streak. How many days in a row can you complete?
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Share */}
      <Animated.View
        entering={FadeInUp.duration(500).delay(300)}
        className="bg-white/8 rounded-3xl p-6 border border-white/10"
      >
        <View className="flex-row items-center gap-2 mb-4">
          <Sparkles size={22} color="#6EC4B8" />
          <Text className="text-white text-xl font-bold">Share Your Score</Text>
        </View>
        <Text className="text-white/70 text-base leading-6">
          After completing the daily challenge, share your results with friends!
          Challenge them to beat your score. Your answers stay hidden until they play.
        </Text>
      </Animated.View>
    </>
  );
}

// Multiplayer Content
function MultiplayerContent() {
  return (
    <>
      {/* Overview */}
      <Animated.View
        entering={FadeInUp.duration(500).delay(100)}
        className="bg-gradient-to-r from-[#3BA99C]/20 to-[#6EC4B8]/20 rounded-3xl p-6 mb-5 border border-[#3BA99C]/30"
      >
        <View className="flex-row items-center gap-2 mb-3">
          <Users size={24} color="#3BA99C" />
          <Text className="text-white text-xl font-bold">Play with Friends</Text>
        </View>
        <Text className="text-white/80 text-base leading-7">
          Compete with 2-10 players in real-time! Create a game and share the code,
          or join a friend's game. Same letters, same categories - who's fastest?
        </Text>
      </Animated.View>

      {/* How To */}
      <Animated.View entering={FadeInUp.duration(500).delay(200)} className="mb-5">
        <Text className="text-white text-xl font-bold mb-4">Getting Started</Text>
        <View className="gap-3">
          <View className="bg-white/8 rounded-2xl p-4 flex-row items-center gap-4 border border-white/8">
            <View className="w-12 h-12 rounded-xl bg-[#3BA99C]/25 items-center justify-center">
              <Text className="text-[#3BA99C] font-bold text-lg">1</Text>
            </View>
            <View className="flex-1">
              <Text className="text-white text-base font-bold mb-1">Create or Join</Text>
              <Text className="text-white/70 text-sm leading-5">
                Tap "Create Game" to host, or "Join Game" and enter a friend's code
              </Text>
            </View>
          </View>

          <View className="bg-white/8 rounded-2xl p-4 flex-row items-center gap-4 border border-white/8">
            <View className="w-12 h-12 rounded-xl bg-[#D4A84B]/25 items-center justify-center">
              <Text className="text-[#D4A84B] font-bold text-lg">2</Text>
            </View>
            <View className="flex-1">
              <Text className="text-white text-base font-bold mb-1">Share the Code</Text>
              <Text className="text-white/70 text-sm leading-5">
                Send the 6-character room code to friends. They join from their device.
              </Text>
            </View>
          </View>

          <View className="bg-white/8 rounded-2xl p-4 flex-row items-center gap-4 border border-white/8">
            <View className="w-12 h-12 rounded-xl bg-[#9B6ED8]/25 items-center justify-center">
              <Text className="text-[#9B6ED8] font-bold text-lg">3</Text>
            </View>
            <View className="flex-1">
              <Text className="text-white text-base font-bold mb-1">Customize Settings</Text>
              <Text className="text-white/70 text-sm leading-5">
                Host picks categories, rounds, and timer. Everyone sees the same settings.
              </Text>
            </View>
          </View>

          <View className="bg-white/8 rounded-2xl p-4 flex-row items-center gap-4 border border-white/8">
            <View className="w-12 h-12 rounded-xl bg-[#FF6B6B]/25 items-center justify-center">
              <Text className="text-[#FF6B6B] font-bold text-lg">4</Text>
            </View>
            <View className="flex-1">
              <Text className="text-white text-base font-bold mb-1">Race to Stop</Text>
              <Text className="text-white/70 text-sm leading-5">
                First to fill all categories hits STOP. Others get 5 seconds to finish!
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Scoring */}
      <Animated.View
        entering={FadeInUp.duration(500).delay(300)}
        className="bg-white/8 rounded-3xl p-6 border border-white/10"
      >
        <View className="flex-row items-center gap-2 mb-4">
          <Shield size={22} color="#6EC4B8" />
          <Text className="text-white text-xl font-bold">Multiplayer Scoring</Text>
        </View>
        <View className="gap-3">
          <View className="flex-row items-center gap-3">
            <View className="bg-[#D4A84B] px-3 py-1.5 rounded-lg min-w-[70px] items-center">
              <Text className="text-[#1a1a2e] font-bold text-sm">10 pts</Text>
            </View>
            <Text className="text-white/80 text-sm flex-1">Unique answer (only you said it)</Text>
          </View>
          <View className="flex-row items-center gap-3">
            <View className="bg-[#3BA99C] px-3 py-1.5 rounded-lg min-w-[70px] items-center">
              <Text className="text-[#1a1a2e] font-bold text-sm">5 pts</Text>
            </View>
            <Text className="text-white/80 text-sm flex-1">Shared by 2 players (split)</Text>
          </View>
          <View className="flex-row items-center gap-3">
            <View className="bg-[#6EC4B8] px-3 py-1.5 rounded-lg min-w-[70px] items-center">
              <Text className="text-[#1a1a2e] font-bold text-sm">3 pts</Text>
            </View>
            <Text className="text-white/80 text-sm flex-1">Shared by 3 players</Text>
          </View>
        </View>
        <Text className="text-white/60 text-sm mt-4 leading-5">
          The more unique your answers, the more you score! Avoid common words others might pick.
        </Text>
      </Animated.View>
    </>
  );
}
