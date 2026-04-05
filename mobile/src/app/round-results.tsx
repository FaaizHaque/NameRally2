import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SKETCH_COLORS, SKETCH_CATEGORY_COLORS } from '@/lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NotebookBackground } from '@/components/NotebookBackground';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
} from 'react-native-reanimated';
import {
  Trophy,
  ChevronRight,
  Check,
  X,
  Users,
  User,
  MapPin,
  Cat,
  Box,
  Apple,
  ShoppingBag,
  HeartPulse,
  Gamepad2,
  Crown,
  Star,
  Zap,
  Globe,
  Film,
  Music,
  Briefcase,
  Utensils,
  Landmark,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useGameStore, CategoryType } from '@/lib/state/game-store';
import { getCategoryName } from '@/lib/word-validation';
import { supabase } from '@/lib/supabase';
import { CAT_COLORS } from '@/lib/category-colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const CATEGORY_ICONS: Record<CategoryType, React.ReactNode> = {
  names:              <User size={24} color={CAT_COLORS.names.accent} />,
  places:             <MapPin size={24} color={CAT_COLORS.places.accent} />,
  animal:             <Cat size={24} color={CAT_COLORS.animal.accent} />,
  thing:              <Box size={24} color={CAT_COLORS.thing.accent} />,
  sports_games:       <Gamepad2 size={24} color={CAT_COLORS.sports_games.accent} />,
  brands:             <ShoppingBag size={24} color={CAT_COLORS.brands.accent} />,
  health_issues:      <HeartPulse size={24} color={CAT_COLORS.health_issues.accent} />,
  countries:          <Globe size={24} color={CAT_COLORS.countries.accent} />,
  professions:        <Briefcase size={24} color={CAT_COLORS.professions.accent} />,
  food_dishes:        <Utensils size={24} color={CAT_COLORS.food_dishes.accent} />,
  celebrities: <Landmark size={24} color={CAT_COLORS.celebrities.accent} />,
  fruits_vegetables:  <Apple size={24} color={CAT_COLORS.fruits_vegetables.accent} />,
};

const CATEGORY_COLORS: Record<CategoryType, string> = Object.fromEntries(
  Object.entries(CAT_COLORS).map(([k, v]) => [k, v.accent])
) as Record<CategoryType, string>;

// Animated score counter component
const AnimatedScore = ({ targetScore, delay }: { targetScore: number; delay: number }) => {
  const [displayScore, setDisplayScore] = useState(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (targetScore > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        scale.value = withSequence(
          withSpring(1.3, { damping: 10 }),
          withSpring(1, { damping: 15 })
        );
      }
      // Animate the score counting up
      let current = 0;
      const increment = Math.ceil(targetScore / 10);
      const interval = setInterval(() => {
        current += increment;
        if (current >= targetScore) {
          setDisplayScore(targetScore);
          clearInterval(interval);
        } else {
          setDisplayScore(current);
        }
      }, 50);
    }, delay);

    return () => clearTimeout(timer);
  }, [targetScore, delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Text style={{ fontSize: 22, fontWeight: '900', color: targetScore > 0 ? SKETCH_COLORS.amber : SKETCH_COLORS.inkFaint }}>
        +{displayScore}
      </Text>
    </Animated.View>
  );
};

// Answer reveal card component
const AnswerRevealCard = ({
  player,
  answer,
  score,
  isValid,
  isCurrentUser,
  index,
  categoryColor,
  hasBonus,
}: {
  player: { username: string };
  answer: string;
  score: number;
  isValid: boolean;
  isCurrentUser: boolean;
  index: number;
  categoryColor: string;
  hasBonus?: boolean;
}) => {
  const [revealed, setRevealed] = useState(false);
  const slideAnim = useSharedValue(SCREEN_WIDTH);
  const opacityAnim = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      slideAnim.value = withSpring(0, { damping: 15, stiffness: 100 });
      opacityAnim.value = withTiming(1, { duration: 300 });
      setRevealed(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, index * 400);

    return () => clearTimeout(timer);
  }, [index]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideAnim.value }],
    opacity: opacityAnim.value,
  }));

  const isEmptyAnswer = !answer || answer.length <= 1;
  const displayAnswer = isEmptyAnswer ? 'No answer' : answer;

  return (
    <Animated.View style={animatedStyle}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 10,
          borderRadius: 10,
          marginBottom: 6,
          backgroundColor: isCurrentUser ? SKETCH_COLORS.pastelGreen : SKETCH_COLORS.paperDark,
          borderWidth: 1.5,
          borderColor: isCurrentUser ? '#50B870' : SKETCH_COLORS.paperLine,
        }}
      >
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10,
            backgroundColor: isValid ? SKETCH_COLORS.pastelGreen : SKETCH_COLORS.pastelPink,
            borderWidth: 1.5,
            borderColor: isValid ? '#50B870' : '#E07070',
          }}
        >
          {isValid ? (
            <Check size={14} color="#2A6640" strokeWidth={3} />
          ) : (
            <X size={14} color={SKETCH_COLORS.red} strokeWidth={3} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 12, color: isCurrentUser ? SKETCH_COLORS.teal : SKETCH_COLORS.inkFaint, fontWeight: '600' }}>
              {player.username}{isCurrentUser ? ' (You)' : ''}
            </Text>
            {hasBonus && revealed && (
              <View style={{ backgroundColor: SKETCH_COLORS.amberLight, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderColor: SKETCH_COLORS.amber }}>
                <Text style={{ color: SKETCH_COLORS.inkLight, fontSize: 9, fontWeight: '900' }}>ABC</Text>
                <Text style={{ color: SKETCH_COLORS.inkLight, fontSize: 10, fontWeight: '800' }}>+2</Text>
              </View>
            )}
          </View>
          <Text
            style={{ fontSize: 16, fontWeight: '700', color: isEmptyAnswer ? SKETCH_COLORS.inkFaint : SKETCH_COLORS.ink, fontStyle: isEmptyAnswer ? 'italic' : 'normal' }}
            numberOfLines={1}
          >
            {displayAnswer}
          </Text>
        </View>
        {revealed && (
          <AnimatedScore targetScore={score} delay={200} />
        )}
      </View>
    </Animated.View>
  );
};

// Category reveal section
const CategoryRevealSection = ({
  category,
  players,
  latestRound,
  currentUserId,
  categoryIndex,
  onComplete,
}: {
  category: CategoryType;
  players: any[];
  latestRound: any;
  currentUserId: string;
  categoryIndex: number;
  onComplete: () => void;
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const headerScale = useSharedValue(0.8);
  const headerOpacity = useSharedValue(0);

  useEffect(() => {
    const delay = categoryIndex * (players.length * 400 + 800);
    const timer = setTimeout(() => {
      setIsVisible(true);
      headerScale.value = withSpring(1, { damping: 12 });
      headerOpacity.value = withTiming(1, { duration: 400 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Call onComplete after all answers are revealed
      const completeDelay = players.length * 400 + 600;
      setTimeout(onComplete, completeDelay);
    }, delay);

    return () => clearTimeout(timer);
  }, [categoryIndex, players.length]);

  const headerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: headerScale.value }],
    opacity: headerOpacity.value,
  }));

  if (!isVisible) return null;

  const categoryColor = CATEGORY_COLORS[category];

  return (
    <View style={{ marginBottom: 20 }}>
      <Animated.View style={[headerStyle, { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }]}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: (SKETCH_CATEGORY_COLORS[category] || SKETCH_CATEGORY_COLORS.thing).strip,
            borderWidth: 1.5,
            borderColor: (SKETCH_CATEGORY_COLORS[category] || SKETCH_CATEGORY_COLORS.thing).stripBorder,
          }}
        >
          {CATEGORY_ICONS[category]}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: SKETCH_COLORS.ink, fontSize: 18, fontWeight: '900' }}>{getCategoryName(category)}</Text>
        </View>
      </Animated.View>

      <View style={{ backgroundColor: SKETCH_COLORS.paperDark, borderRadius: 10, padding: 10, borderWidth: 1.5, borderColor: SKETCH_COLORS.paperLine }}>
        {players.map((player, index) => {
          const answerData = latestRound?.answers[player.visibleId]?.[category];
          const answer = answerData?.answer || '';
          const score = answerData?.score || 0;
          const isValid = answerData?.isValid || false;
          const hasBonus = answerData?.hasBonus || false;
          const isCurrentUser = player.visibleId === currentUserId;

          return (
            <AnswerRevealCard
              key={player.id}
              player={player}
              answer={answer}
              score={score}
              isValid={isValid}
              isCurrentUser={isCurrentUser}
              index={index}
              categoryColor={(SKETCH_CATEGORY_COLORS[category] || SKETCH_CATEGORY_COLORS.thing).ink}
              hasBonus={hasBonus}
            />
          );
        })}
      </View>
    </View>
  );
};

// Standings card component
const StandingsCard = ({
  player,
  rank,
  roundScore,
  isCurrentUser,
  index,
}: {
  player: any;
  rank: number;
  roundScore: number;
  isCurrentUser: boolean;
  index: number;
}) => {
  const scale = useSharedValue(0);
  const [showScore, setShowScore] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      scale.value = withSpring(1, { damping: 12, stiffness: 100 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTimeout(() => setShowScore(true), 300);
    }, index * 200);

    return () => clearTimeout(timer);
  }, [index]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const medals = [SKETCH_COLORS.amber, '#B8B8B8', '#C89060'];
  const isTopThree = rank <= 3;

  return (
    <Animated.View style={animatedStyle}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 14,
          borderRadius: 12,
          marginBottom: 10,
          backgroundColor: isCurrentUser ? SKETCH_COLORS.pastelGreen : SKETCH_COLORS.paperDark,
          borderWidth: isCurrentUser ? 2 : 1.5,
          borderColor: isCurrentUser ? '#50B870' : SKETCH_COLORS.paperLine,
          shadowColor: SKETCH_COLORS.ink,
          shadowOffset: { width: 1, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 0,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
            backgroundColor: isTopThree ? medals[rank - 1] : SKETCH_COLORS.paperLine,
            borderWidth: 2,
            borderColor: isTopThree ? medals[rank - 1] : SKETCH_COLORS.inkFaint,
          }}
        >
          {rank === 1 ? (
            <Crown size={20} color={SKETCH_COLORS.ink} strokeWidth={2.5} />
          ) : (
            <Text style={{ fontWeight: '900', fontSize: 18, color: isTopThree ? SKETCH_COLORS.ink : SKETCH_COLORS.inkFaint }}>
              {rank}
            </Text>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: SKETCH_COLORS.ink, fontWeight: '800', fontSize: 15 }}>
              {player.username}
            </Text>
            {isCurrentUser && (
              <View style={{ backgroundColor: SKETCH_COLORS.pastelGreen, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: '#50B870' }}>
                <Text style={{ color: '#2A6640', fontSize: 9, fontWeight: '800' }}>YOU</Text>
              </View>
            )}
          </View>
          {showScore && (
            <Animated.View entering={FadeIn.duration(300)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Zap size={12} color={SKETCH_COLORS.amber} strokeWidth={2.5} />
                <Text style={{ color: SKETCH_COLORS.inkLight, fontSize: 12, fontWeight: '700' }}>
                  +{roundScore} this round
                </Text>
              </View>
            </Animated.View>
          )}
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: SKETCH_COLORS.ink, fontSize: 26, fontWeight: '900' }}>{player.totalScore}</Text>
          <Text style={{ color: SKETCH_COLORS.inkFaint, fontSize: 11 }}>points</Text>
        </View>
      </View>
    </Animated.View>
  );
};

type Phase = 'answers' | 'standings';

export default function RoundResultsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  const session = useGameStore((s) => s.session);
  const currentUser = useGameStore((s) => s.currentUser);
  const nextRound = useGameStore((s) => s.nextRound);
  const refreshSession = useGameStore((s) => s.refreshSession);
  const setTimeRemaining = useGameStore((s) => s.setTimeRemaining);

  const isHost = session?.hostId === currentUser?.id;
  const [phase, setPhase] = useState<Phase>('answers');
  const [completedCategories, setCompletedCategories] = useState(0);
  const [showNextButton, setShowNextButton] = useState(false);

  // Bounce arrow animation for bottom affordance
  const arrowBounce = useSharedValue(0);
  const arrowStyle = useAnimatedStyle(() => ({ transform: [{ translateY: arrowBounce.value }] }));
  useEffect(() => {
    arrowBounce.value = withRepeat(
      withSequence(withTiming(6, { duration: 500 }), withTiming(0, { duration: 500 })),
      -1, true
    );
  }, []);

  // Poll for session updates
  useEffect(() => {
    if (session) {
      pollingRef.current = setInterval(() => {
        refreshSession();
      }, 1500);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [session?.id]);

  // Navigate based on session status changes (for non-host players)
  useEffect(() => {
    if (session?.status === 'playing' || session?.status === 'picking_letter') {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      setTimeRemaining(session.settings.roundDuration);
      router.replace('/game');
    } else if (session?.status === 'final_results') {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      router.replace('/final-results');
    }
  }, [session?.status, session?.currentRound]);

  // Show "View Standings" button after all categories revealed (no auto-transition)
  useEffect(() => {
    if (session && completedCategories >= session.settings.selectedCategories.length && phase === 'answers') {
      const timer = setTimeout(() => {
        setShowNextButton(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Scroll to bottom so button is visible
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [completedCategories, session?.settings.selectedCategories.length, phase]);

  const handleViewStandings = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('standings');
    setShowNextButton(false);
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });

    // Show next button after standings animation completes
    const standingsDelay = (session?.players.length || 1) * 200 + 500;
    setTimeout(() => setShowNextButton(true), standingsDelay);
  }, [session?.players.length]);

  const handleCategoryComplete = useCallback(() => {
    setCompletedCategories(prev => prev + 1);
  }, []);

  if (!session || !currentUser) {
    return null;
  }

  const latestRound = session.roundResults[session.roundResults.length - 1];
  const isLastRound = session.currentRound >= session.settings.totalRounds;
  const sortedPlayers = [...session.players].sort((a, b) => b.totalScore - a.totalScore);

  const handleNextRound = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isLastRound) {
      if (isHost && session) {
        await supabase
          .from('game_sessions')
          .update({ status: 'final_results' })
          .eq('id', session.id);
        router.replace('/final-results');
      }
    } else {
      if (isHost) {
        await nextRound();
      }
    }
  };

  return (
    <NotebookBackground lineStartY={160} lineSpacing={36} lineCount={28} showMargin={false}>
      <View style={{ paddingTop: insets.top, flex: 1 }}>
          {/* Header */}
          <Animated.View
            entering={FadeInDown.duration(400)}
            style={{ alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16 }}
          >
            <View style={{
              backgroundColor: SKETCH_COLORS.amberLight,
              paddingHorizontal: 14,
              paddingVertical: 4,
              borderRadius: 16,
              marginBottom: 8,
              borderWidth: 1.5,
              borderColor: SKETCH_COLORS.amber,
            }}>
              <Text style={{ color: SKETCH_COLORS.inkLight, fontSize: 13, fontWeight: '700' }}>
                Round {latestRound?.roundNumber} Complete
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {phase === 'answers' && (
                <View style={{
                  width: 52,
                  height: 52,
                  borderRadius: 8,
                  backgroundColor: '#FFED7A',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 2,
                  borderColor: '#D4C020',
                  transform: [{ rotate: '2deg' }],
                  shadowColor: SKETCH_COLORS.ink,
                  shadowOffset: { width: 2, height: 3 },
                  shadowOpacity: 0.18,
                  shadowRadius: 0,
                }}>
                  <Text style={{ color: SKETCH_COLORS.ink, fontSize: 22, fontWeight: '900' }}>
                    {latestRound?.letter}
                  </Text>
                </View>
              )}
              <View>
                <Text style={{ color: SKETCH_COLORS.ink, fontSize: 22, fontWeight: '900' }}>
                  Results
                </Text>
                {phase === 'answers' && (
                  <Text style={{ color: SKETCH_COLORS.inkFaint, fontSize: 12 }}>
                    {completedCategories}/{session.settings.selectedCategories.length} categories
                  </Text>
                )}
              </View>
            </View>
          </Animated.View>

          {/* Phase indicator */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: phase === 'answers' ? SKETCH_COLORS.teal : SKETCH_COLORS.paperLine }} />
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: phase === 'standings' ? SKETCH_COLORS.teal : SKETCH_COLORS.paperLine }} />
          </View>

          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1, paddingHorizontal: 16 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 140 }}
          >
            {phase === 'answers' ? (
              <View>
                {session.settings.selectedCategories.map((category, index) => (
                  <CategoryRevealSection
                    key={category}
                    category={category}
                    players={session.players}
                    latestRound={latestRound}
                    currentUserId={currentUser.id}
                    categoryIndex={index}
                    onComplete={handleCategoryComplete}
                  />
                ))}
                {/* Bounce arrow — prompts user to scroll down if button is incoming */}
                {!showNextButton && completedCategories < (session?.settings.selectedCategories.length ?? 0) && (
                  <Animated.View style={[arrowStyle, { alignItems: 'center', paddingVertical: 12, opacity: 0.45 }]}>
                    <Text style={{ color: SKETCH_COLORS.inkFaint, fontSize: 22 }}>↓</Text>
                  </Animated.View>
                )}
              </View>
            ) : (
              <Animated.View entering={FadeIn.duration(500)}>
                {sortedPlayers.map((player, index) => {
                  const roundScore = latestRound?.playerScores[player.visibleId] || 0;
                  const isCurrentUser = player.visibleId === currentUser.id;

                  return (
                    <StandingsCard
                      key={player.id}
                      player={player}
                      rank={index + 1}
                      roundScore={roundScore}
                      isCurrentUser={isCurrentUser}
                      index={index}
                    />
                  );
                })}
              </Animated.View>
            )}
          </ScrollView>

          {/* Bottom Button */}
          {showNextButton && (
            phase === 'answers' ? (
              <Animated.View
                entering={FadeInUp.duration(500)}
                style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: insets.bottom + 16, paddingTop: 12, backgroundColor: SKETCH_COLORS.paper, borderTopWidth: 2, borderTopColor: SKETCH_COLORS.paperLine }}
              >
                <Pressable onPress={handleViewStandings} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
                  <View style={{
                    borderRadius: 14,
                    padding: 18,
                    backgroundColor: SKETCH_COLORS.pastelBlue,
                    borderWidth: 2,
                    borderColor: '#60A8E0',
                    shadowColor: SKETCH_COLORS.ink,
                    shadowOffset: { width: 2, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 0,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                  }}>
                    <Trophy size={22} color="#205880" strokeWidth={2.5} />
                    <Text style={{ color: '#205880', fontSize: 18, fontWeight: '900' }}>View Standings</Text>
                    <ChevronRight size={22} color="#205880" strokeWidth={2.5} />
                  </View>
                </Pressable>
              </Animated.View>
            ) : isHost ? (
              <Animated.View
                entering={FadeInUp.duration(500)}
                style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: insets.bottom + 16, paddingTop: 12, backgroundColor: SKETCH_COLORS.paper, borderTopWidth: 2, borderTopColor: SKETCH_COLORS.paperLine }}
              >
                <Pressable onPress={handleNextRound} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
                  <View style={{
                    borderRadius: 14,
                    padding: 18,
                    backgroundColor: isLastRound ? SKETCH_COLORS.amberLight : SKETCH_COLORS.pastelGreen,
                    borderWidth: 2,
                    borderColor: isLastRound ? SKETCH_COLORS.amber : '#50B870',
                    shadowColor: SKETCH_COLORS.ink,
                    shadowOffset: { width: 2, height: 4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 0,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                  }}>
                    {isLastRound ? (
                      <>
                        <Trophy size={22} color={SKETCH_COLORS.inkLight} strokeWidth={2.5} />
                        <Text style={{ color: SKETCH_COLORS.ink, fontSize: 18, fontWeight: '900' }}>See Final Results</Text>
                      </>
                    ) : (
                      <>
                        <Text style={{ color: SKETCH_COLORS.ink, fontSize: 18, fontWeight: '900' }}>Next Round</Text>
                        <ChevronRight size={22} color={SKETCH_COLORS.ink} strokeWidth={2.5} />
                      </>
                    )}
                  </View>
                </Pressable>
              </Animated.View>
            ) : (
              <Animated.View
                entering={FadeInUp.duration(500)}
                style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingBottom: insets.bottom + 16, paddingTop: 12, backgroundColor: SKETCH_COLORS.paper, borderTopWidth: 2, borderTopColor: SKETCH_COLORS.paperLine }}
              >
                <View style={{ backgroundColor: '#1a3a6e', borderRadius: 12, padding: 16, borderWidth: 1.5, borderColor: '#2a5aaa' }}>
                  <Text style={{ color: '#90c0ff', textAlign: 'center', fontWeight: '700', fontSize: 16 }}>
                    {isLastRound
                      ? 'Waiting for host to show final results...'
                      : 'Waiting for host to start next round...'}
                  </Text>
                </View>
              </Animated.View>
            )
          )}
        </View>
    </NotebookBackground>
  );
}
