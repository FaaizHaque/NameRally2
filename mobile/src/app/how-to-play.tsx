import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sounds } from '@/lib/sounds';
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
  Heart,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

type TabType = 'basics' | 'categories' | 'single' | 'daily' | 'multiplayer';

export default function HowToPlayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('basics');

  useFocusEffect(useCallback(() => {
    Sounds.duckBackground(0.16);
    return () => { Sounds.unduckBackground(); };
  }, []));

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
      description: 'A letter is revealed each round. Every answer must start with it.',
      color: '#3BA99C',
    },
    {
      icon: <Clock size={24} color="#D4A84B" />,
      title: 'Race the Clock',
      description: 'Fill all categories before time runs out.',
      color: '#D4A84B',
    },
    {
      icon: <Trophy size={24} color="#6EC4B8" />,
      title: 'Score Points',
      description: 'Valid answer = 10 pts. Word with 10+ letters = +2 bonus.',
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
        <Text className="text-white text-xl font-bold mb-2">What is NPAT?</Text>
        <Text className="text-white/80 text-base leading-6">
          A timeless and classic word game, revived with a fresh look.{'\n'}Think across new and exciting categories, challenge your creativity, and play solo, take on daily challenges, or compete with family and friends in real time.
        </Text>
      </Animated.View>

      {/* Steps */}
      <Animated.View entering={FadeInUp.duration(500).delay(200)} className="mb-5">
        <Text className="text-white text-xl font-bold mb-4">How It Works</Text>
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
                <Text className="text-white/70 text-sm leading-5">{step.description}</Text>
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
            <Text className="text-white/80 text-sm flex-1">Valid answer</Text>
          </View>
          <View className="flex-row items-center gap-3">
            <View className="bg-[#9B6ED8] px-3 py-1.5 rounded-lg min-w-[70px] items-center">
              <Text className="text-white font-bold text-base">+2 pts</Text>
            </View>
            <Text className="text-white/80 text-sm flex-1">Bonus for 10+ letter words</Text>
          </View>
          <View className="flex-row items-center gap-3">
            <View className="bg-[#FF6B6B]/70 px-3 py-1.5 rounded-lg min-w-[70px] items-center">
              <Text className="text-white font-bold text-base">0 pts</Text>
            </View>
            <Text className="text-white/80 text-sm flex-1">Invalid or empty answer</Text>
          </View>
        </View>
      </Animated.View>

      {/* Categories */}
      <Animated.View
        entering={FadeInUp.duration(500).delay(400)}
        className="bg-white/8 rounded-3xl p-6 border border-white/10"
      >
        <View className="flex-row items-center gap-2 mb-3">
          <Sparkles size={22} color="#6EC4B8" />
          <Text className="text-white text-xl font-bold">Categories</Text>
        </View>
        <Text className="text-white/70 text-sm leading-5 mb-3">
          Start with Names, Places, and Animals. Unlock more as you level up:
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {['Things', 'Fruits & Veg', 'Sports & Games', 'Brands', 'Food & Dishes', 'Countries', 'Health Issues', 'Professions', 'Famous People'].map((cat) => (
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
    { name: 'Name', emoji: '👤', color: '#3BA99C', description: 'Valid human names.' },
    { name: 'Place', emoji: '📍', color: '#D4A84B', description: 'Any city, country, landmark, or geographic location.' },
    { name: 'Animal', emoji: '🐾', color: '#6EC4B8', description: 'Any living creature — mammals, birds, fish, insects, reptiles.' },
    { name: 'Thing', emoji: '📦', color: '#9B6ED8', description: 'Any physical object you can touch.' },
    { name: 'Food & Dishes', emoji: '🍽️', color: '#FF6B6B', description: 'Any meal, dish, or cuisine from around the world. Fruits, vegetables, and ingredients also accepted.' },
    { name: 'Sports & Games', emoji: '⚽', color: '#3BA99C', description: 'Any sport, board game, card game, video game, mobile/online game, or athletic discipline. Popular traditional games also accepted.' },
    { name: 'Fruits & Vegetables', emoji: '🍎', color: '#D4A84B', description: 'Any fruit or vegetable, common or exotic.' },
    { name: 'Brands', emoji: '™️', color: '#6EC4B8', description: 'A company or brand you\'d recognise on a billboard.' },
    { name: 'Countries', emoji: '🌍', color: '#3BA99C', description: 'Any sovereign country in the world.' },
    { name: 'Health Issues', emoji: '🏥', color: '#9B6ED8', description: 'Medical conditions, illnesses, or symptoms.' },
    { name: 'Professions', emoji: '💼', color: '#6EC4B8', description: 'Any job or occupation.' },
    { name: 'Famous People', emoji: '⭐', color: '#D4A84B', description: 'A real historical person — world leader, scientist, social activist, sportsman, music artist, or explorer.' },
  ];

  return (
    <>
      <Animated.View
        entering={FadeInUp.duration(500).delay(100)}
        className="bg-white/10 rounded-3xl p-6 mb-5 border border-white/10"
      >
        <Text className="text-white text-xl font-bold mb-2">All Categories</Text>
        <Text className="text-white/70 text-sm leading-5">
          Starts with the classics. New ones unlock as you level up.
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
              <Text className="text-white text-base font-bold mb-0.5">{cat.name}</Text>
              <Text className="text-white/65 text-sm leading-5">{cat.description}</Text>
            </View>
          </Animated.View>
        ))}
      </Animated.View>

      <Animated.View
        entering={FadeInUp.duration(500).delay(600)}
        className="bg-white/6 rounded-2xl p-5 mb-6 border border-white/10 flex-row gap-3"
      >
        <Text style={{ fontSize: 18, marginTop: 1 }}>ℹ️</Text>
        <View className="flex-1">
          <Text className="text-white/60 text-sm leading-5">
            Our database is built around commonly and popular recognized entries from worldwide.{'\n'}While not exhaustive, it continues to grow over time.
          </Text>
        </View>
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
        <View className="flex-row items-center gap-2 mb-2">
          <Gamepad2 size={24} color="#9B6ED8" />
          <Text className="text-white text-xl font-bold">Level Journey</Text>
        </View>
        <Text className="text-white/80 text-sm leading-6">
          Each level is one round. Score above the pass threshold to unlock the next. Earn points and stars as you climb — letters get harder and constraints get wilder.
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
                Early levels use common letters. As you advance: rare letters (Q, X, Z), two-letter combos (CH, TH, ST), tighter timers, and more categories per round.
              </Text>
            </View>
          </View>

          <View className="bg-white/8 rounded-2xl p-4 flex-row items-center gap-4 border border-white/8">
            <View className="w-12 h-12 rounded-xl bg-[#D4A84B]/25 items-center justify-center">
              <Star size={24} color="#D4A84B" />
            </View>
            <View className="flex-1">
              <Text className="text-white text-base font-bold mb-1">Points & Stars</Text>
              <Text className="text-white/70 text-sm leading-5">
                Pass = 1★ · ~75% = 2★ · ~90% = 3★ (thresholds rise with more categories){'\n'}Points accumulate from your best score on each level. Every 100 points earns 2 bonus stars.
              </Text>
            </View>
          </View>

          <View className="bg-white/8 rounded-2xl p-4 flex-row items-center gap-4 border border-white/8">
            <View className="w-12 h-12 rounded-xl bg-[#f87171]/20 items-center justify-center">
              <Heart size={24} color="#f87171" fill="#f87171" />
            </View>
            <View className="flex-1">
              <Text className="text-white text-base font-bold mb-1">Lives</Text>
              <Text className="text-white/70 text-sm leading-5">
                You get 3 lives. Failing a level costs one. Restore them by watching an ad or waiting 24 hours.
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
                Levels add rules to raise the difficulty: minimum word length · no repeated letters · must end with a set letter · double letters · odd-length words · survival mode (one wrong answer ends the round)
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
                New categories unlock as you level up:{'\n'}Things (L2) · Food (L5) · Sports (L11) · Fruits & Veg (L16) · Countries (L21) · Brands (L31) · Famous People (L41) · Professions (L51) · Health (L61)
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
            'Hints reveal a valid answer when you\'re stuck',
            'Long words (10+ letters) earn a +2 bonus',
            'Replay levels to earn more stars',
            'Earlier levels are great for practicing hard letters',
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
        <View className="flex-row items-center gap-2 mb-2">
          <Calendar size={24} color="#D4A84B" />
          <Text className="text-white text-xl font-bold">Daily Challenge</Text>
        </View>
        <Text className="text-white/80 text-sm leading-6">
          A new challenge every day. Same letter and 6 categories. Finish faster to climb the global leaderboard.
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
              <Text className="text-white text-base font-bold mb-1">Resets at Midnight UTC</Text>
              <Text className="text-white/70 text-sm leading-5">
                Fresh letter and categories every day, shared with every player worldwide.
              </Text>
            </View>
          </View>

          <View className="bg-white/8 rounded-2xl p-4 flex-row items-center gap-4 border border-white/8">
            <View className="w-12 h-12 rounded-xl bg-[#6EC4B8]/25 items-center justify-center">
              <Clock size={24} color="#6EC4B8" />
            </View>
            <View className="flex-1">
              <Text className="text-white text-base font-bold mb-1">One Attempt Only</Text>
              <Text className="text-white/70 text-sm leading-5">
                No retries. Submit and your score is locked until tomorrow's challenge.
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
                Your score is ranked against every other player who played today.
              </Text>
            </View>
          </View>

          <View className="bg-white/8 rounded-2xl p-4 flex-row items-center gap-4 border border-white/8">
            <View className="w-12 h-12 rounded-xl bg-[#FF6B6B]/25 items-center justify-center">
              <Zap size={24} color="#FF6B6B" />
            </View>
            <View className="flex-1">
              <Text className="text-white text-base font-bold mb-1">Build Your Streak</Text>
              <Text className="text-white/70 text-sm leading-5">
                Play every day to keep your streak alive. Miss a day and it resets.
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
        <View className="flex-row items-center gap-2 mb-3">
          <Sparkles size={22} color="#6EC4B8" />
          <Text className="text-white text-xl font-bold">Share Your Score</Text>
        </View>
        <Text className="text-white/70 text-sm leading-5">
          After finishing, share your result spoiler-free. Your answers stay hidden until your friends play.
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
        <View className="flex-row items-center gap-2 mb-2">
          <Users size={24} color="#3BA99C" />
          <Text className="text-white text-xl font-bold">Play with Friends</Text>
        </View>
        <Text className="text-white/80 text-sm leading-6">
          2–10 players, real-time. Same letter, same categories. Unique answers score more.
        </Text>
      </Animated.View>

      {/* How To */}
      <Animated.View entering={FadeInUp.duration(500).delay(200)} className="mb-5">
        <Text className="text-white text-xl font-bold mb-4">Getting Started</Text>
        <View className="gap-3">
          {[
            { num: '1', color: '#3BA99C', title: 'Create or Join', body: 'Host taps "Create Game" and shares the 6-character code. Others tap "Join Game" and enter it.' },
            { num: '2', color: '#D4A84B', title: 'Host Picks Settings', body: 'Categories, rounds, and timer length. Everyone sees the same settings.' },
            { num: '3', color: '#9B6ED8', title: 'A Player Picks the Letter', body: 'Each round, one player is picked to choose the starting letter. Role rotates.' },
            { num: '4', color: '#FF6B6B', title: 'Race to Stop', body: 'Fill all categories and hit STOP. Others get 5 seconds to finish. Then scores are revealed.' },
          ].map((step) => (
            <View key={step.num} className="bg-white/8 rounded-2xl p-4 flex-row items-center gap-4 border border-white/8">
              <View className="w-12 h-12 rounded-xl items-center justify-center" style={{ backgroundColor: `${step.color}25` }}>
                <Text style={{ color: step.color, fontWeight: '900', fontSize: 18 }}>{step.num}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-white text-base font-bold mb-1">{step.title}</Text>
                <Text className="text-white/70 text-sm leading-5">{step.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </Animated.View>

      {/* Rejoin note */}
      <Animated.View
        entering={FadeInUp.duration(500).delay(250)}
        className="bg-white/6 rounded-2xl p-4 mb-5 border border-white/10 flex-row gap-3"
      >
        <Text style={{ fontSize: 16, marginTop: 1 }}>🔄</Text>
        <View className="flex-1">
          <Text className="text-white text-sm font-bold mb-0.5">Dropped out?</Text>
          <Text className="text-white/60 text-sm leading-5">
            Enter the same game code to rejoin an in-progress game and pick up where you left off.
          </Text>
        </View>
      </Animated.View>

      {/* Scoring */}
      <Animated.View
        entering={FadeInUp.duration(500).delay(300)}
        className="bg-white/8 rounded-3xl p-6 border border-white/10"
      >
        <View className="flex-row items-center gap-2 mb-4">
          <Shield size={22} color="#6EC4B8" />
          <Text className="text-white text-xl font-bold">Scoring</Text>
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
            <Text className="text-white/80 text-sm flex-1">Shared by 2 players</Text>
          </View>
          <View className="flex-row items-center gap-3">
            <View className="bg-[#6EC4B8] px-3 py-1.5 rounded-lg min-w-[70px] items-center">
              <Text className="text-[#1a1a2e] font-bold text-sm">3 pts</Text>
            </View>
            <Text className="text-white/80 text-sm flex-1">Shared by 3+ players</Text>
          </View>
        </View>
        <Text className="text-white/60 text-sm mt-4 leading-5">
          Think outside the box — common answers split points with everyone else.
        </Text>
      </Animated.View>
    </>
  );
}
