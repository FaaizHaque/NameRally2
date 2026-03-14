import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const NOTIF_SCHEDULED_KEY = 'daily_challenge_notif_scheduled';
const DAILY_NOTIF_HOUR = 9; // 9am local time

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<void> {
  if (!Device.isDevice) return; // Simulators can't receive push notifs

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('daily-challenge', {
      name: 'Daily Challenge',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  await scheduleDailyChallengeNotification();
}

export async function scheduleDailyChallengeNotification(): Promise<void> {
  try {
    // Don't reschedule if already scheduled
    const alreadyScheduled = await AsyncStorage.getItem(NOTIF_SCHEDULED_KEY);
    if (alreadyScheduled === 'true') return;

    // Cancel any existing daily challenge notifications first
    await cancelDailyChallengeNotification();

    // Schedule repeating daily notification at 9am
    await Notifications.scheduleNotificationAsync({
      identifier: 'daily-challenge-reminder',
      content: {
        title: '🔥 Daily Challenge is live!',
        body: "Today's letter is waiting. Think you can top the leaderboard?",
        sound: false,
        badge: 1,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: DAILY_NOTIF_HOUR,
        minute: 0,
      },
    });

    await AsyncStorage.setItem(NOTIF_SCHEDULED_KEY, 'true');
  } catch {
    // Silent fail — notifications are non-critical
  }
}

export async function cancelDailyChallengeNotification(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync('daily-challenge-reminder');
  } catch {
    // Silent fail
  }
}

export async function dismissDailyBadge(): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch {
    // Silent fail
  }
}
