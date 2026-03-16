import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Plus, LogIn } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { SKETCH_COLORS } from '@/lib/theme';
import { NotebookBackground } from '@/components/NotebookBackground';
import { Sounds } from '@/lib/sounds';

// Rough hand-drawn border effect using nested views
function SketchBox({
  children,
  rotate = '0deg',
  accentColor,
  pressed,
}: {
  children: React.ReactNode;
  rotate?: string;
  accentColor: string;
  pressed: boolean;
}) {
  return (
    <View style={{
      transform: [{ rotate }, { scale: pressed ? 0.97 : 1 }],
      opacity: pressed ? 0.92 : 1,
    }}>
      {/* Tape strip */}
      <View style={{
        alignSelf: 'center',
        width: 56, height: 15,
        backgroundColor: 'rgba(210,190,110,0.7)',
        borderRadius: 3,
        marginBottom: -8,
        zIndex: 2,
        borderWidth: 1,
        borderColor: 'rgba(160,130,60,0.45)',
        shadowColor: '#8A7040',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 0,
      }} />

      {/* Outer rough shadow (sketchy depth) */}
      <View style={{
        position: 'absolute',
        top: 4, left: 4, right: -4, bottom: -4,
        backgroundColor: 'rgba(90,60,20,0.12)',
        borderRadius: 6,
      }} />

      {/* Main card */}
      <View style={{
        backgroundColor: SKETCH_COLORS.paper,
        borderRadius: 6,
        borderWidth: 2.5,
        borderColor: SKETCH_COLORS.paperLine,
        paddingVertical: 22,
        paddingHorizontal: 20,
        paddingLeft: 26,
        // Subtle inner notebook lines
        overflow: 'hidden',
      }}>
        {/* Notebook horizontal lines inside card */}
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={{
            position: 'absolute',
            left: 26, right: 0,
            top: 18 + i * 20,
            height: 1,
            backgroundColor: 'rgba(140,100,50,0.1)',
          }} />
        ))}

        {/* Red margin line */}
        <View style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 4.5,
          backgroundColor: accentColor,
          borderRadius: 6,
        }} />

        {/* Extra sketchy corner ticks */}
        <View style={{
          position: 'absolute', top: 6, right: 8,
          width: 10, height: 10,
          borderTopWidth: 2, borderRightWidth: 2,
          borderColor: 'rgba(140,100,50,0.2)',
        }} />
        <View style={{
          position: 'absolute', bottom: 6, left: 16,
          width: 10, height: 10,
          borderBottomWidth: 2, borderLeftWidth: 2,
          borderColor: 'rgba(140,100,50,0.2)',
        }} />

        {children}
      </View>
    </View>
  );
}

export default function MultiplayerOptionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleCreateGame = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/create-game');
  };

  const handleJoinGame = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Sounds.join();
    router.push('/join-game');
  };

  return (
    <NotebookBackground lineStartY={160} lineSpacing={36} lineCount={25} marginX={48}>
      <View style={{ paddingTop: insets.top, flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
            style={({ pressed }) => ({
              backgroundColor: pressed ? SKETCH_COLORS.paperLine : SKETCH_COLORS.paperDark,
              padding: 10,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: SKETCH_COLORS.paperLine,
              shadowColor: SKETCH_COLORS.ink,
              shadowOffset: { width: 1, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 0,
            })}
          >
            <ChevronLeft size={22} color={SKETCH_COLORS.inkLight} strokeWidth={2.5} />
          </Pressable>
          <View style={{
            marginLeft: 12,
            backgroundColor: '#F8E080',
            paddingHorizontal: 12,
            paddingVertical: 5,
            borderRadius: 6,
            borderWidth: 1.5,
            borderColor: '#C8A030',
            transform: [{ rotate: '-0.5deg' }],
          }}>
            <Text style={{ color: '#7A5000', fontSize: 18, fontWeight: '900' }}>Multiplayer</Text>
          </View>
        </View>

        {/* Options */}
        <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: 'center', gap: 24 }}>

          {/* Create Game */}
          <Pressable onPress={handleCreateGame}>
            {({ pressed }) => (
              <SketchBox rotate="-0.6deg" accentColor={SKETCH_COLORS.red} pressed={pressed}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{
                    width: 46, height: 46, borderRadius: 10,
                    backgroundColor: '#FFE0DA',
                    borderWidth: 2, borderColor: '#E07070',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Plus size={22} color="#882020" strokeWidth={2.5} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: SKETCH_COLORS.ink, fontSize: 19, fontWeight: '900' }}>Create Game</Text>
                    <Text style={{ color: SKETCH_COLORS.inkFaint, fontSize: 12, marginTop: 3, fontStyle: 'italic' }}>
                      Host a new game & invite friends
                    </Text>
                  </View>
                </View>
              </SketchBox>
            )}
          </Pressable>

          {/* Join Game */}
          <Pressable onPress={handleJoinGame}>
            {({ pressed }) => (
              <SketchBox rotate="0.5deg" accentColor="#5090E0" pressed={pressed}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{
                    width: 46, height: 46, borderRadius: 10,
                    backgroundColor: '#D8EAFF',
                    borderWidth: 2, borderColor: '#60A8E0',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <LogIn size={22} color="#205880" strokeWidth={2.5} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: SKETCH_COLORS.ink, fontSize: 19, fontWeight: '900' }}>Join Game</Text>
                    <Text style={{ color: SKETCH_COLORS.inkFaint, fontSize: 12, marginTop: 3, fontStyle: 'italic' }}>
                      Enter a code to join a friend's game
                    </Text>
                  </View>
                </View>
              </SketchBox>
            )}
          </Pressable>

          {/* Info */}
          <View style={{ alignItems: 'center', marginTop: 4 }}>
            <Text style={{ color: SKETCH_COLORS.inkFaint, fontSize: 11, fontStyle: 'italic' }}>
              Play the classic word game with friends
            </Text>
          </View>
        </View>
      </View>
    </NotebookBackground>
  );
}
