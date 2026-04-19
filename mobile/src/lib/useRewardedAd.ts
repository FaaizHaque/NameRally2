import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
} from 'react-native-google-mobile-ads';

// ─── Ad Unit IDs ──────────────────────────────────────────────────────────────
const AD_UNIT_ID = Platform.select({
  ios:     'ca-app-pub-1431240801280221/3292546851',   // Production rewarded (iOS)
  android: 'ca-app-pub-3940256099942544/5224354917',   // Google test rewarded (Android — unused)
  default: 'ca-app-pub-3940256099942544/5224354917',
})!;

export function useRewardedAd() {
  const adRef   = useRef<RewardedAd | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadAd = () => {
    const ad = RewardedAd.createForAdRequest(AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: false,
    });
    adRef.current = ad;
    setLoaded(false);

    const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      // Defer state update — required with new arch (JSI) to avoid UI freeze
      setTimeout(() => setLoaded(true), 0);
    });
    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      // Defer state update and next-ad preload.
      // Use 800ms delay so the Google SDK fully tears down before we create a
      // new ad object — creating one immediately on CLOSED can leave the SDK in
      // a bad state on new-arch (Fabric/JSI) and contribute to UI freezes.
      setTimeout(() => {
        setLoaded(false);
        loadAd(); // preload next ad
      }, 800);
    });

    ad.load();

    return () => { unsubLoaded(); unsubClosed(); };
  };

  useEffect(() => {
    const cleanup = loadAd();
    return cleanup;
  }, []);

  /**
   * Show the rewarded ad.
   * - onRewarded: called only if the user watches to completion
   * - onDismissed: called always when the ad closes (use to resume the timer)
   *
   * If no ad is ready yet, grants the hint immediately as a fallback.
   */
  const showAd = (onRewarded: () => void, onDismissed: () => void) => {
    const ad = adRef.current;
    if (!ad || !loaded) {
      // No ad ready — grant hint for free as fallback
      setTimeout(() => { onRewarded(); onDismissed(); }, 0);
      return;
    }

    let rewarded = false;

    const unsubReward = ad.addAdEventListener(
      RewardedAdEventType.EARNED_REWARD,
      () => { rewarded = true; },
    );
    const unsubClose = ad.addAdEventListener(AdEventType.CLOSED, () => {
      unsubReward();
      unsubClose();
      // Defer callbacks by 200ms — gives the AdMob native ViewController enough
      // time to fully tear down on iOS/Android before we update React state.
      // 0ms was not sufficient on new arch (Fabric/JSI) and caused UI freezes.
      setTimeout(() => {
        onRewarded();
        onDismissed();
      }, 200);
    });

    try {
      ad.show();
    } catch {
      // Ad failed to show (e.g. not ready despite loaded=true) — grant hint free
      unsubReward();
      unsubClose();
      setTimeout(() => {
        onRewarded();
        onDismissed();
      }, 0);
    }
  };

  return { loaded, showAd };
}
