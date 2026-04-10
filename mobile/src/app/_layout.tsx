import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useEffect } from 'react';
import { registerForPushNotifications } from '@/lib/notifications';
import MobileAds from 'react-native-google-mobile-ads';

export const unstable_settings = {
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

// Override the canvas background so the navigation surface is never pure black
// during slide transitions. DarkTheme defaults to #000 which flashes through.
const AppTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: '#1a2030' },
};

function RootLayoutNav() {
  return (
    <ThemeProvider value={AppTheme}>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: '#1a2030' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="game-mode" />
        <Stack.Screen name="difficulty-select" />
        <Stack.Screen name="multiplayer-options" />
        <Stack.Screen name="create-game" />
        <Stack.Screen name="join-game" />
        <Stack.Screen name="lobby" />
        <Stack.Screen name="completed-levels" />
        <Stack.Screen name="game" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="round-results" options={{ gestureEnabled: false }} />
        <Stack.Screen name="final-results" options={{ gestureEnabled: false }} />
        <Stack.Screen name="daily-challenge" options={{ gestureEnabled: false }} />
        <Stack.Screen name="how-to-play" />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    registerForPushNotifications();
    MobileAds().initialize();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#1a2030' }}>
        <KeyboardProvider>
          <StatusBar style="light" />
          <RootLayoutNav />
        </KeyboardProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
