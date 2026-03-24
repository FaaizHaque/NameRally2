import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, AlertCircle, LogIn } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useGameStore } from '@/lib/state/game-store';
import { SKETCH_COLORS } from '@/lib/theme';
import { NotebookBackground } from '@/components/NotebookBackground';

export default function JoinGameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const joinGame = useGameStore((s) => s.joinGame);
  const error = useGameStore((s) => s.error);
  const setError = useGameStore((s) => s.setError);

  const handleCodeChange = (text: string) => {
    const cleaned = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setCode(cleaned);
    setError(null);
  };

  const handleJoinGame = async () => {
    if (code.length !== 6) {
      setError('Please enter a valid 6-character code');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setIsJoining(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const success = await joinGame(code);
    setIsJoining(false);
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const latestSession = useGameStore.getState().session;
      if (latestSession && latestSession.status !== 'lobby') {
        router.replace('/game');
      } else {
        router.replace('/lobby');
      }
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const isReady = code.length === 6 && !isJoining;

  return (
    <NotebookBackground lineStartY={120} lineSpacing={36} lineCount={30} marginX={48}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={{ paddingTop: insets.top, flex: 1 }}>

          {/* Header row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
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
            {/* Title tag — amber, matching multiplayer theme */}
            <View style={{
              marginLeft: 12,
              backgroundColor: '#F8E080',
              paddingHorizontal: 12, paddingVertical: 5,
              borderRadius: 6, borderWidth: 1.5, borderColor: '#C8A030',
              transform: [{ rotate: '-0.5deg' }],
            }}>
              <Text style={{ color: '#7A5000', fontSize: 18, fontWeight: '900' }}>Join Game</Text>
            </View>
          </View>

          <View style={{ flex: 1, paddingHorizontal: 20, justifyContent: 'center', gap: 0 }}>

            {/* "Enter room code" label — looks like a teacher wrote it */}
            <View style={{ marginBottom: 6 }}>
              <Text style={{
                color: SKETCH_COLORS.inkLight,
                fontSize: 13,
                fontWeight: '700',
                fontStyle: 'italic',
                marginLeft: 2,
              }}>
                Enter the 6-character room code:
              </Text>
            </View>

            {/* Code input — sits directly on the notebook line, no card wrapper */}
            <View>
              {/* Tape strip at top */}
              <View style={{
                alignSelf: 'center',
                width: 60, height: 14,
                backgroundColor: 'rgba(205,190,120,0.65)',
                borderRadius: 3,
                marginBottom: -7,
                zIndex: 2,
                borderWidth: 1,
                borderColor: 'rgba(160,140,80,0.4)',
              }} />
              <View style={{
                backgroundColor: SKETCH_COLORS.paper,
                borderWidth: 2,
                borderColor: code.length > 0 ? SKETCH_COLORS.amber : SKETCH_COLORS.paperLine,
                borderRadius: 4,
                paddingHorizontal: 12,
                paddingVertical: 10,
                shadowColor: SKETCH_COLORS.ink,
                shadowOffset: { width: 2, height: 3 },
                shadowOpacity: 0.12,
                shadowRadius: 0,
                elevation: 3,
                transform: [{ rotate: '-0.3deg' }],
              }}>
                <TextInput
                  style={{
                    fontSize: 38,
                    fontWeight: '900',
                    color: SKETCH_COLORS.ink,
                    textAlign: 'center',
                    letterSpacing: 14,
                    paddingVertical: 8,
                  }}
                  placeholder="· · · · · ·"
                  placeholderTextColor={SKETCH_COLORS.inkFaint}
                  value={code}
                  onChangeText={handleCodeChange}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={6}
                  keyboardType="default"
                  editable={!isJoining}
                  autoFocus
                />
                {/* Underline rule */}
                <View style={{ height: 1.5, backgroundColor: code.length > 0 ? SKETCH_COLORS.amber : SKETCH_COLORS.paperLine, opacity: 0.6, marginTop: 4 }} />
              </View>
            </View>

            {/* Helper note */}
            <View style={{ marginTop: 8, marginLeft: 4 }}>
              <Text style={{ color: SKETCH_COLORS.inkFaint, fontSize: 11, fontStyle: 'italic' }}>
                Ask your host for the room code
              </Text>
            </View>

            {/* Error */}
            {error ? (
              <View
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  marginTop: 10,
                  backgroundColor: '#FFD4D4',
                  padding: 10, borderRadius: 6,
                  borderWidth: 1.5, borderColor: '#E07070',
                  transform: [{ rotate: '0.2deg' }],
                }}
              >
                <AlertCircle size={15} color="#882020" />
                <Text style={{ color: '#882020', fontSize: 13, flex: 1, fontWeight: '700' }}>{error}</Text>
              </View>
            ) : null}

            {/* Join button — big stamp-style, directly on page */}
            <View style={{ marginTop: 28 }}>
              <Pressable
                onPress={handleJoinGame}
                disabled={!isReady}
                style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.96 : 1 }, { rotate: '-0.4deg' }] })}
              >
                <View style={{
                  backgroundColor: isReady ? SKETCH_COLORS.green : SKETCH_COLORS.paperLine,
                  borderRadius: 8,
                  paddingVertical: 18,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  borderWidth: 2.5,
                  borderColor: isReady ? '#1A5A1A' : SKETCH_COLORS.inkFaint,
                  shadowColor: SKETCH_COLORS.ink,
                  shadowOffset: { width: 3, height: 5 },
                  shadowOpacity: isReady ? 0.18 : 0,
                  shadowRadius: 0,
                  elevation: isReady ? 4 : 0,
                }}>
                  {isJoining
                    ? <ActivityIndicator color="#fff" />
                    : <>
                        <LogIn size={20} color={isReady ? '#fff' : SKETCH_COLORS.inkFaint} strokeWidth={2.5} />
                        <Text style={{ fontSize: 18, fontWeight: '900', color: isReady ? '#fff' : SKETCH_COLORS.inkFaint, letterSpacing: 0.5 }}>
                          Join Game
                        </Text>
                      </>
                  }
                </View>
              </Pressable>
            </View>

            <View style={{ marginTop: 14, alignItems: 'center' }}>
              <Text style={{ color: SKETCH_COLORS.inkFaint, fontSize: 11, fontStyle: 'italic' }}>
                Players will see you join instantly!
              </Text>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </NotebookBackground>
  );
}
