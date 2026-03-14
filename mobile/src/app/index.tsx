import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useRouter } from 'expo-router';
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
import { Gamepad2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { useFonts, PlayfairDisplay_400Regular_Italic } from '@expo-google-fonts/playfair-display';
import { useGameStore } from '@/lib/state/game-store';
import { SKETCH_COLORS } from '@/lib/theme';
import { NotebookBackground } from '@/components/NotebookBackground';
import { Sounds } from '@/lib/sounds';

const mainLogoSource = require('@/assets/logo-main-dark.png');

const LOGO_WIDTH = 280;
const LOGO_HEIGHT = 280;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const TILES = [
  { letter: 'N', bg: '#FFD4D4', border: '#E07070', ink: '#882020' },
  { letter: 'P', bg: '#FEF3A3', border: '#E8D840', ink: '#8B7A10' },
  { letter: 'A', bg: '#C8F5D0', border: '#50B870', ink: '#2A6640' },
  { letter: 'T', bg: '#D0EAFF', border: '#60A8E0', ink: '#205880' },
];

// Track if splash was already shown this app session
let splashAlreadyShown = false;

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
  const editInputRef = useRef<TextInput>(null);

  const currentUser = useGameStore((s) => s.currentUser);
  const setCurrentUser = useGameStore((s) => s.setCurrentUser);
  const loadUser = useGameStore((s) => s.loadUser);
  const loadLevelProgress = useGameStore((s) => s.loadLevelProgress);

  const floatAnim = useSharedValue(0);

  useEffect(() => {
    // Hide the native Expo splash screen immediately so our custom splash takes over
    ExpoSplashScreen.hideAsync();
    loadUser();
    loadLevelProgress();
    floatAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200 }),
        withTiming(0, { duration: 2200 })
      ),
      -1, true
    );
  }, []);

  useEffect(() => {
    if (!currentUser) setShowInput(true);
    if (currentUser && editNameValue === '') setEditNameValue(currentUser.username);
  }, [currentUser?.id]);

  const letterStyle0 = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(floatAnim.value, [0, 1], [0, -6]) }, { rotate: '-3deg' }],
  }));
  const letterStyle1 = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(floatAnim.value, [0, 1], [0, 6]) }, { rotate: '2deg' }],
  }));
  const letterStyle2 = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(floatAnim.value, [0, 1], [0, -6]) }, { rotate: '-2deg' }],
  }));
  const letterStyle3 = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(floatAnim.value, [0, 1], [0, 6]) }, { rotate: '3deg' }],
  }));
  const letterStyles = [letterStyle0, letterStyle1, letterStyle2, letterStyle3];

  const handleCreateAccount = () => {
    if (username.trim().length < 1) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Sounds.tap();
    setCurrentUser({ id: `user_${Date.now()}`, username: username.trim() });
    setShowInput(false);
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
    Sounds.navigate();
    router.push('/game-mode');
  };

  const handleHowToPlay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Sounds.tap();
    router.push('/how-to-play');
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
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                  {TILES.map((t, index) => (
                    <Animated.View
                      key={t.letter}
                      style={[letterStyles[index], {
                        width: 58, height: 58, borderRadius: 10,
                        backgroundColor: t.bg,
                        justifyContent: 'center', alignItems: 'center',
                        borderWidth: 2, borderColor: t.border,
                        shadowColor: SKETCH_COLORS.ink,
                        shadowOffset: { width: 2, height: 4 },
                        shadowOpacity: 0.18, shadowRadius: 0, elevation: 5,
                      }]}
                    >
                      <Text style={{ fontSize: 26, fontWeight: '900', color: t.ink }}>{t.letter}</Text>
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
                  fontSize: 40,
                  fontWeight: '900',
                  color: SKETCH_COLORS.ink,
                  letterSpacing: -1,
                  lineHeight: 46,
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

            {/* MIDDLE: Username entry or Play — centered in remaining space */}
            <View style={{ flex: 1, justifyContent: 'center' }}>

              {showInput && !currentUser ? (
                /* ── First-time: enter name ── */
                <Animated.View
                  entering={splashDone ? FadeInUp.duration(600).delay(400) : undefined}
                  style={{ opacity: splashDone ? 1 : 0, alignItems: 'center' }}
                >
                  <Text style={{
                    color: SKETCH_COLORS.inkFaint,
                    fontSize: 12, fontWeight: '700',
                    letterSpacing: 3, textTransform: 'uppercase',
                    marginBottom: 8,
                    textAlign: 'center',
                  }}>
                    Enter Your Name
                  </Text>
                  <View style={{
                    borderBottomWidth: 2.5,
                    borderBottomColor: username.trim().length > 0 ? SKETCH_COLORS.ink : SKETCH_COLORS.inkFaint,
                    marginBottom: 32,
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
                      placeholder="your name..."
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
                  {/* Play button — clearly shows inactive until name entered */}
                  <Pressable
                    onPress={handleCreateAccount}
                    disabled={username.trim().length < 1}
                    style={({ pressed }) => ({
                      backgroundColor: username.trim().length > 0
                        ? (pressed ? '#2a2a2a' : SKETCH_COLORS.ink)
                        : 'rgba(0,0,0,0.12)',
                      borderRadius: 18, paddingVertical: 20,
                      alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'row', gap: 12,
                      paddingHorizontal: 40,
                      alignSelf: 'center',
                      minWidth: '70%',
                      borderWidth: username.trim().length > 0 ? 0 : 2,
                      borderColor: 'rgba(0,0,0,0.15)',
                      shadowColor: SKETCH_COLORS.ink,
                      shadowOffset: { width: 0, height: username.trim().length > 0 ? 8 : 0 },
                      shadowOpacity: username.trim().length > 0 ? 0.35 : 0,
                      shadowRadius: 16, elevation: username.trim().length > 0 ? 10 : 0,
                    })}
                  >
                    <Gamepad2 size={26} color={username.trim().length > 0 ? SKETCH_COLORS.amberLight : SKETCH_COLORS.inkFaint} strokeWidth={2} />
                    <Text style={{
                      color: username.trim().length > 0 ? '#fff' : SKETCH_COLORS.inkFaint,
                      fontWeight: '900', fontSize: 22, letterSpacing: 2,
                    }}>
                      {username.trim().length > 0 ? 'LET\'S PLAY!' : 'Enter a name first'}
                    </Text>
                  </Pressable>
                </Animated.View>

              ) : currentUser ? (
                /* ── Returning user ── */
                <View>
                  <Animated.View
                    entering={splashDone ? FadeInUp.duration(500) : undefined}
                    style={{ marginBottom: 20, opacity: splashDone ? 1 : 0, alignItems: 'center' }}
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
                        onChangeText={(v) => {
                          setEditNameValue(v);
                          setEditingName(true);
                        }}
                        onBlur={() => {
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
                    entering={splashDone ? FadeInUp.duration(600).delay(150) : undefined}
                    style={{ opacity: splashDone ? 1 : 0, marginTop: 6 }}
                  >
                    <AnimatedPressable
                      onPress={handlePlay}
                      style={({ pressed }: { pressed: boolean }) => ({
                        transform: [{ scale: pressed ? 0.96 : 1 }],
                      })}
                    >
                      <View style={{
                        backgroundColor: SKETCH_COLORS.ink,
                        borderRadius: 18, paddingVertical: 20,
                        paddingHorizontal: 40,
                        alignItems: 'center', justifyContent: 'center',
                        flexDirection: 'row', gap: 12,
                        alignSelf: 'center',
                        minWidth: '70%',
                        shadowColor: SKETCH_COLORS.ink,
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.35, shadowRadius: 16, elevation: 10,
                      }}>
                        <Gamepad2 size={26} color={SKETCH_COLORS.amberLight} strokeWidth={2} />
                        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: 2.5 }}>
                          PLAY
                        </Text>
                      </View>
                    </AnimatedPressable>
                  </Animated.View>
                </View>

              ) : null}
            </View>

            {/* FOOTER — "How to Play" */}
            <Animated.View
              entering={splashDone ? FadeIn.duration(600).delay(700) : undefined}
              style={{ alignItems: 'center', opacity: splashDone ? 1 : 0, marginTop: 20 }}
            >
              <Pressable
                onPress={handleHowToPlay}
                style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, paddingVertical: 8, paddingHorizontal: 4 })}
              >
                <Text style={{
                  color: '#9A5200',
                  fontSize: 18,
                  fontWeight: '700',
                  letterSpacing: 0.8,
                  textDecorationLine: 'underline',
                  textDecorationColor: '#C8840060',
                }}>
                  How to Play?
                </Text>
              </Pressable>
            </Animated.View>

          </View>
        </KeyboardAvoidingView>
      </NotebookBackground>

      {!splashDone && (
        <SplashScreen fontsLoaded={fontsLoaded} onDone={() => { splashAlreadyShown = true; setSplashDone(true); }} />
      )}
    </View>
  );
}
