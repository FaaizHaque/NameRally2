import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
} from 'react-native-google-mobile-ads';

// ─── Ad Unit IDs ──────────────────────────────────────────────────────────────
// TODO: Replace these test IDs with your real AdMob rewarded ad unit IDs
// after creating them at https://admob.google.com
const AD_UNIT_ID = Platform.select({
  ios:     'ca-app-pub-3940256099942544/1712485313',   // TODO: swap with real iOS rewarded unit ID
  android: 'ca-app-pub-3940256099942544/5224354917',   // TODO: swap with real Android rewarded unit ID
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
      setLoaded(true);
    });
    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      setLoaded(false);
      loadAd(); // immediately preload the next one
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
      onRewarded();
      onDismissed();
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
      if (rewarded) onRewarded();
      onDismissed();
    });

    ad.show();
  };

  return { loaded, showAd };
}
