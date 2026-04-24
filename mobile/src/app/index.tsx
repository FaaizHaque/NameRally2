import React, { useEffect, useRef, useState } from 'react';
import { navGuard } from '@/lib/nav-guard';
import { View, Text, Pressable, TextInput, KeyboardAvoidingView, Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  interpolate,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gamepad2, Volume2, VolumeX, HelpCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { useFonts, PlayfairDisplay_400Regular_Italic } from '@expo-google-fonts/playfair-display';
import { useGameStore } from '@/lib/state/game-store';
import { SKETCH_COLORS } from '@/lib/theme';
import { NotebookBackground } from '@/components/NotebookBackground';
import { Sounds, initSounds } from '@/lib/sounds';
import { ProfileCard } from '@/components/ProfileCard';

const mainLogoSource = require('@/assets/logo-main-dark.png');

const LOGO_WIDTH = 280;
const LOGO_HEIGHT = 280;

const TILES = [
  { letter: 'N', bg: '#FFD4D4', border: '#E07070', ink: '#882020' },
  { letter: 'P', bg: '#FEF3A3', border: '#E8D840', ink: '#8B7A10' },
  { letter: 'A', bg: '#C8F5D0', border: '#50B870', ink: '#2A6640' },
  { letter: 'T', bg: '#D0EAFF', border: '#60A8E0', ink: '#205880' },
];

// Show splash on cold start and after 30s+ in background (covers iOS suspension-resume).
// Skip for quick app switches (< 30s background).
let splashAlreadyShown = false;
let backgroundedAt: number | null = null;
AppState.addEventListener('change', (state) => {
  if (state === 'background') {
    backgroundedAt = Date.now();
  } else if (state === 'active' && backgroundedAt !== null) {
    if (Date.now() - backgroundedAt > 30_000) splashAlreadyShown = false;
    backgroundedAt = null;
  }
});

// ─── SPLASH SCREEN ────────────────────────────────────────────────────────────
// Sequence: logo fades in slowly → holds → tagline gently appears below-right → holds → all fades out
function SplashScreen({ onDone, fontsLoaded }: { onDone: () => void; fontsLoaded: boolean }) {
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.92);
  const overlayOpacity = useSharedValue(1);
  const taglineOpacity = useSharedValue(0);
  const taglineTranslateY = useSharedValue(6);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);
  const sequenceStarted = useRef(false);

  const taglineFont = fontsLoaded ? 'PlayfairDisplay_400Regular_Italic' : 'Georgia';

  const startSequence = () => {
    if (sequenceStarted.current) return;
    sequenceStarted.current = true;

    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];

    // Step 1: Logo fades in slowly and scales up gently — smooth, cinematic
    logoOpacity.value = withTiming(1, { duration: 2000, easing: Easing.out(Easing.quad) });
    logoScale.value = withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) });

    // Step 2: Tagline fades in with a delay after logo is fully visible
    taglineOpacity.value = withDelay(
      1800,
      withTiming(1, { duration: 1000, easing: Easing.out(Easing.quad) })
    );
    taglineTranslateY.value = withDelay(
      1800,
      withTiming(0, { duration: 1000, easing: Easing.out(Easing.quad) })
    );

    // Step 3: Everything fades out gracefully
    const t1 = setTimeout(() => {
      logoOpacity.value = withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.cubic) });
      taglineOpacity.value = withTiming(0, { duration: 800, easing: Easing.inOut(Easing.cubic) });
    }, 3800);

    // Step 4: Background dissolves
    const t2 = setTimeout(() => {
      overlayOpacity.value = withTiming(0, { duration: 600, easing: Easing.inOut(Easing.cubic) }, () => {
        runOnJS(onDone)();
      });
    }, 4800);

    timerRefs.current = [t1, t2];
  };

  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      startSequence();
    }, 500);

    return () => {
      clearTimeout(fallbackTimer);
      timerRefs.current.forEach(clearTimeout);
    };
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: taglineTranslateY.value }],
  }));

  return (
    <Animated.View
      style={[overlayStyle, {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#F5EDD8',
        alignItems: 'center', justifyContent: 'center',
        zIndex: 100,
      }]}
      pointerEvents="none"
    >
      <View style={{ alignItems: 'center' }}>
        {/* Logo — slow, elegant fade-in with subtle scale */}
        <Animated.Image
          source={mainLogoSource}
          style={[logoStyle, { width: LOGO_WIDTH, height: LOGO_HEIGHT }]}
          resizeMode="contain"
          onLoad={startSequence}
        />
      </View>
    </Animated.View>
  );
}

// ─── HOME SCREEN ──────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const [fontsLoaded] = useFonts({ PlayfairDisplay_400Regular_Italic });
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [showInput, setShowInput] = useState(false);
  const [splashDone, setSplashDone] = useState(splashAlreadyShown);
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [showHowToPlayModal, setShowHowToPlayModal] = useState(false);
  const [soundOn, setSoundOn] = useState(Sounds.isSoundEnabled());
  const editInputRef = useRef<TextInput>(null);

  const currentUser = useGameStore((s) => s.currentUser);
  const levelProgress = useGameStore((s) => s.levelProgress);
  const setCurrentUser = useGameStore((s) => s.setCurrentUser);
  const loadUser = useGameStore((s) => s.loadUser);
  const loadLevelProgress = useGameStore((s) => s.loadLevelProgress);

  const floatAnim = useSharedValue(0);
  const editFadeAnim = useSharedValue(1);

  useEffect(() => {
    // Hide the native Expo splash screen immediately so our custom splash takes over seamlessly
    ExpoSplashScreen.hideAsync();
    initSounds().then(() => {
      Sounds.startBackground('home');
    });
    loadUser();
    loadLevelProgress();
    floatAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200 }),
        withTiming(0, { duration: 2200 })
      ),
      -1, true
    );
    return () => { Sounds.stopBackground(); };
  }, []);

  // Restart home music when navigating back to this screen (screens stay mounted in the stack)
  useFocusEffect(
    React.useCallback(() => {
      Sounds.startBackground('home');
      // Don't stop on blur — how-to-play/select screens duck in place, game screens switch tracks themselves
      return () => { setShowHowToPlayModal(false); };
    }, [])
  );

  useEffect(() => {
    if (!currentUser) setShowInput(true);
    if (currentUser && editNameValue === '') setEditNameValue(currentUser.username);
  }, [currentUser?.id]);

  const letterStyle0 = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(floatAnim.value, [0, 1], [-8, -14]) }, { rotate: '-3deg' }],
  }));
  const letterStyle1 = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(floatAnim.value, [0, 1], [8, 14]) }, { rotate: '2deg' }],
  }));
  const letterStyle2 = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(floatAnim.value, [0, 1], [-12, -6]) }, { rotate: '-2deg' }],
  }));
  const letterStyle3 = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(floatAnim.value, [0, 1], [4, 10]) }, { rotate: '3deg' }],
  }));
  const letterStyles = [letterStyle0, letterStyle1, letterStyle2, letterStyle3];
  const keyboardFadeStyle = useAnimatedStyle(() => ({
    opacity: editFadeAnim.value,
    transform: [
      { translateY: interpolate(editFadeAnim.value, [0, 1], [-8, 0]) },
      { scale: interpolate(editFadeAnim.value, [0, 1], [0.97, 1]) },
    ],
  }));

  // Show tutorial modal if user exists but hasn't explicitly dismissed it yet
  useEffect(() => {
    if (!currentUser) return;
    AsyncStorage.getItem('npat_tutorial_dismissed').then((val) => {
      if (!val) setTimeout(() => setShowHowToPlayModal(true), 400);
    });
  }, [currentUser?.id]);

  const handleCreateAccount = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Sounds.tap();
    const chosenName = username.trim() || 'Guest';
    setCurrentUser({ id: `user_${Date.now()}`, username: chosenName });
    setShowInput(false);
    // Tutorial will show via the useEffect above once currentUser is set
  };

  const handleStartEditName = () => {
    if (!currentUser) return;
    setEditNameValue(currentUser.username);
    setEditingName(true);
    setTimeout(() => editInputRef.current?.focus(), 50);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSaveName = () => {
    if (editNameValue.trim().length < 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCurrentUser({ id: currentUser!.id, username: editNameValue.trim() });
    setEditingName(false);
  };

  const handlePlay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Sounds.stopBackground();
    Sounds.navigate();
    navGuard(() => router.push('/game-mode'));
  };

  const handleHowToPlay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Sounds.tap();
    navGuard(() => router.push('/how-to-play'));
  };

  const toggleSound = () => {
    const next = !soundOn;
    Sounds.setSoundEnabled(next);
    setSoundOn(next);
    if (next) {
      Sounds.tap();
      Sounds.resumeBackground();
    } else {
      Sounds.pauseBackground();
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={{ flex: 1 }}>
      <NotebookBackground lineStartY={200} lineSpacing={36} lineCount={32} marginX={48}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{
            flex: 1,
            paddingHorizontal: 24,
            paddingTop: insets.top + 28,
            paddingBottom: insets.bottom + 20,
          }}>

            {/* TOP: NPAT tiles + title */}
            <View style={{ alignItems: 'center' }}>
              <Animated.View
                entering={splashDone ? FadeInDown.duration(500) : undefined}
                style={{ marginBottom: 14, opacity: splashDone ? 1 : 0 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                  {TILES.map((t, index) => (
                    <Animated.View
                      key={t.letter}
                      style={[letterStyles[index], {
                        width: 70, height: 70, borderRadius: 12,
                        backgroundColor: t.bg,
                        justifyContent: 'center', alignItems: 'center',
                        borderWidth: 2.5, borderColor: t.border,
                        shadowColor: SKETCH_COLORS.ink,
                        shadowOffset: { width: 2, height: 4 },
                        shadowOpacity: 0.18, shadowRadius: 0, elevation: 5,
                      }]}
                    >
                      <Text style={{ fontSize: 34, fontWeight: '900', color: t.ink }}>{t.letter}</Text>
                    </Animated.View>
                  ))}
                </View>
              </Animated.View>

              <Animated.View
                entering={splashDone ? FadeInDown.duration(600).delay(150) : undefined}
                style={{ alignItems: 'center', opacity: splashDone ? 1 : 0 }}
              >
                {/* Title */}
                <Text style={{
                  fontSize: 44,
                  fontWeight: '900',
                  color: SKETCH_COLORS.ink,
                  letterSpacing: -1,
                  lineHeight: 50,
                  textAlign: 'center',
                }}>
                  Name Place{'\n'}Animal Thing
                </Text>

                {/* Amber underline */}
                <View style={{
                  width: 120, height: 3,
                  backgroundColor: SKETCH_COLORS.amber,
                  borderRadius: 2, marginTop: 8, marginBottom: 12,
                  transform: [{ rotate: '-0.5deg' }],
                }} />
              </Animated.View>
            </View>

            {/* PROFILE CARD — sits between title and name/play, only for returning users */}
            {currentUser && (
              <Animated.View
                style={[keyboardFadeStyle, { alignItems: 'center', marginTop: 56 }]}
                pointerEvents={editingName ? 'none' : 'auto'}
              >
                <Animated.View
                  entering={splashDone ? FadeIn.duration(600).delay(100) : undefined}
                  style={{ opacity: splashDone ? 1 : 0 }}
                >
                  <ProfileCard levelProgress={levelProgress} />
                </Animated.View>
              </Animated.View>
            )}

            {/* MIDDLE: Username entry or Play — centered in remaining space */}
            <View style={{ flex: 1, justifyContent: 'center' }}>

              {showInput && !currentUser ? (
                /* ── First-time: enter name ── */
                <Animated.View
                  entering={splashDone ? FadeInUp.duration(600).delay(400) : undefined}
                  style={{ opacity: splashDone ? 1 : 0, alignItems: 'center' }}
                >
                  {/* Name input */}
                  <View style={{
                    borderBottomWidth: 2.5,
                    borderBottomColor: username.trim().length > 0 ? SKETCH_COLORS.ink : SKETCH_COLORS.inkFaint,
                    marginBottom: 10,
                    width: '80%',
                  }}>
                    <TextInput
                      style={{
                        paddingVertical: 8, paddingHorizontal: 2,
                        color: SKETCH_COLORS.ink,
                        fontSize: 26, fontWeight: '800',
                        backgroundColor: 'transparent',
                        textAlign: 'center',
                      }}
                      placeholder="enter your name..."
                      placeholderTextColor={SKETCH_COLORS.inkFaint + '80'}
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={20}
                      returnKeyType="done"
                      onSubmitEditing={handleCreateAccount}
                    />
                  </View>
                  <Text style={{
                    color: SKETCH_COLORS.inkFaint,
                    fontSize: 11, fontWeight: '600',
                    letterSpacing: 1, marginBottom: 32,
                    textAlign: 'center',
                  }}>
                    this is how others will see you
                  </Text>
                  {/* Play button — always black, Guest name used if no name typed */}
                  <Pressable onPress={handleCreateAccount}>
                    <View style={{
                      backgroundColor: SKETCH_COLORS.ink,
                      borderRadius: 18, paddingVertical: 20,
                      alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'row', gap: 12,
                      paddingHorizontal: 40,
                      alignSelf: 'center',
                      minWidth: '70%',
                      shadowColor: SKETCH_COLORS.ink,
                      shadowOffset: { width: 0, height: 8 },
                      shadowOpacity: 0.35,
                      shadowRadius: 16, elevation: 10,
                    }}>
                      <Gamepad2 size={26} color={SKETCH_COLORS.amberLight} strokeWidth={2} />
                      <Text style={{
                        color: '#fff',
                        fontWeight: '900', fontSize: 22, letterSpacing: 2,
                      }}>
                        LET&apos;S PLAY!
                      </Text>
                    </View>
                  </Pressable>
                </Animated.View>

              ) : currentUser ? (
                /* ── Returning user ── */
                <View style={{ gap: 20, alignItems: 'center' }}>
                  <Animated.View
                    entering={splashDone ? FadeInUp.duration(500) : undefined}
                    style={{ marginBottom: 0, opacity: splashDone ? 1 : 0, alignItems: 'center' }}
                  >
                    {/* Inline editable name — tap to rename, no label needed */}
                    <View style={{
                      borderBottomWidth: 2.5,
                      borderBottomColor: SKETCH_COLORS.amber,
                      paddingBottom: 4,
                      paddingHorizontal: 16,
                      minWidth: '55%',
                    }}>
                      <TextInput
                        ref={editInputRef}
                        style={{
                          color: SKETCH_COLORS.ink,
                          fontSize: 28, fontWeight: '900',
                          backgroundColor: 'transparent',
                          textAlign: 'center',
                          paddingVertical: 0,
                        }}
                        value={editNameValue}
                        onFocus={() => {
                          setEditingName(true);
                          editFadeAnim.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.quad) });
                        }}
                        onChangeText={(v) => {
                          setEditNameValue(v);
                        }}
                        onBlur={() => {
                          // Delay fade-in so elements reappear as the keyboard begins
                          // descending rather than popping in while it's still up.
                          editFadeAnim.value = withDelay(120, withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }));
                          if (editingName && editNameValue.trim().length > 0) {
                            handleSaveName();
                          } else {
                            setEditingName(false);
                            setEditNameValue(currentUser?.username || '');
                          }
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                        maxLength={20}
                        returnKeyType="done"
                        onSubmitEditing={handleSaveName}
                        selectTextOnFocus
                      />
                    </View>
                    <Text style={{
                      color: SKETCH_COLORS.inkFaint,
                      fontSize: 11, fontWeight: '600',
                      letterSpacing: 1, marginTop: 5,
                      textAlign: 'center',
                    }}>
                      tap to rename
                    </Text>
                  </Animated.View>

                  <Animated.View
                    style={[keyboardFadeStyle, { alignItems: 'center' }]}
                    pointerEvents={editingName ? 'none' : 'auto'}
                  >
                    <Animated.View
                      entering={splashDone ? FadeInUp.duration(600).delay(150) : undefined}
                      style={{ opacity: splashDone ? 1 : 0, alignItems: 'center' }}
                    >
                      <Pressable onPress={handlePlay}>
                        <View style={{
                          alignSelf: 'center',
                          minWidth: '70%',
                          backgroundColor: SKETCH_COLORS.ink,
                          borderRadius: 18, paddingVertical: 20,
                          paddingHorizontal: 40,
                          alignItems: 'center', justifyContent: 'center',
                          flexDirection: 'row', gap: 12,
                          shadowColor: SKETCH_COLORS.ink,
                          shadowOffset: { width: 0, height: 8 },
                          shadowOpacity: 0.35, shadowRadius: 16, elevation: 10,
                        }}>
                          <Gamepad2 size={26} color={SKETCH_COLORS.amberLight} strokeWidth={2} />
                          <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: 2.5 }}>
                            PLAY
                          </Text>
                        </View>
                      </Pressable>
                    </Animated.View>
                  </Animated.View>
                </View>

              ) : null}
            </View>

            {/* FOOTER — How to Play + Sound toggle, inline */}
            <Animated.View
              entering={splashDone ? FadeIn.duration(600).delay(700) : undefined}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                opacity: splashDone ? 1 : 0,
                marginTop: 28,
              }}
            >
              {/* Sound toggle — same style as How to Play */}
              <Pressable
                onPress={toggleSound}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <View style={{
                  backgroundColor: SKETCH_COLORS.paperDark,
                  paddingVertical: 11,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1.5,
                  borderColor: SKETCH_COLORS.inkFaint + '60',
                }}>
                  {soundOn
                    ? <Volume2 size={22} color={SKETCH_COLORS.inkLight} strokeWidth={2} />
                    : <VolumeX size={22} color={SKETCH_COLORS.inkFaint} strokeWidth={2} />
                  }
                </View>
              </Pressable>

              {/* How to Play Button */}
              <Pressable
                onPress={handleHowToPlay}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <View style={{
                  backgroundColor: SKETCH_COLORS.paperDark,
                  paddingVertical: 11,
                  paddingHorizontal: 18,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 7,
                  borderWidth: 1.5,
                  borderColor: SKETCH_COLORS.inkFaint + '60',
                }}>
                  <HelpCircle size={18} color={SKETCH_COLORS.inkFaint} strokeWidth={2} />
                  <Text style={{
                    color: SKETCH_COLORS.inkLight,
                    fontSize: 15,
                    fontWeight: '700',
                    letterSpacing: 0.3,
                  }}>
                    How to Play
                  </Text>
                </View>
              </Pressable>
            </Animated.View>

          </View>
        </KeyboardAvoidingView>
      </NotebookBackground>

      {!splashDone && (
        <SplashScreen fontsLoaded={fontsLoaded} onDone={() => {
          splashAlreadyShown = true;
          setSplashDone(true);
        }} />
      )}

      {/* ── How to Play prompt for new users ── */}
      {showHowToPlayModal && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(28,18,10,0.65)',
          alignItems: 'center', justifyContent: 'center',
          paddingHorizontal: 28, zIndex: 50,
        }}>
          <View style={{
            backgroundColor: SKETCH_COLORS.paper,
            borderRadius: 20, padding: 28,
            borderWidth: 2.5, borderColor: SKETCH_COLORS.amber,
            shadowColor: SKETCH_COLORS.ink,
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.3, shadowRadius: 24,
            elevation: 20, width: '100%',
          }}>
            {/* Tape strip decoration */}
            <View style={{
              position: 'absolute', top: -10, alignSelf: 'center',
              width: 60, height: 18,
              backgroundColor: 'rgba(205,190,120,0.7)',
              borderRadius: 3, transform: [{ rotate: '-1deg' }],
            }} />
            <Text style={{
              fontSize: 26, fontWeight: '900', color: SKETCH_COLORS.ink,
              textAlign: 'center', marginBottom: 8, marginTop: 4,
            }}>
              Welcome! 🎉
            </Text>
            <Text style={{
              fontSize: 15, color: SKETCH_COLORS.inkLight,
              textAlign: 'center', lineHeight: 22, marginBottom: 24,
            }}>
              Want a quick tour on how to play before you dive in?
            </Text>
            {/* How to Play button */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                Sounds.tap();
                AsyncStorage.setItem('npat_tutorial_dismissed', 'true');
                setShowHowToPlayModal(false);
                navGuard(() => router.push('/how-to-play'));
              }}
            >
              <View style={{
                backgroundColor: SKETCH_COLORS.ink,
                borderRadius: 14, paddingVertical: 16,
                alignItems: 'center', marginBottom: 12,
                shadowColor: SKETCH_COLORS.ink,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3, shadowRadius: 12, elevation: 8,
              }}>
                <Text style={{ color: '#fff', fontSize: 17, fontWeight: '900', letterSpacing: 1 }}>
                  Show me how to play
                </Text>
              </View>
            </Pressable>
            {/* Skip button */}
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                AsyncStorage.setItem('npat_tutorial_dismissed', 'true');
                setShowHowToPlayModal(false);
                Sounds.stopBackground();
                Sounds.navigate();
                navGuard(() => router.push('/game-mode'));
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, paddingVertical: 14, alignItems: 'center', marginTop: 6 })}
            >
              <Text style={{
                color: SKETCH_COLORS.inkFaint,
                fontSize: 15, fontWeight: '600',
                textDecorationLine: 'underline',
              }}>
                Skip for now
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
