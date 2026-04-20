# NAPT — Production Launch Checklist

**App:** NAPT  
**Bundle ID:** `com.haquegames.napt`  
**App Store ID:** `6759828697`  
**Current Build:** 110 · Version 1.0.0

---

## ✅ BEFORE GOING LIVE

### 🔨 EAS Build
- [ ] Run `bun run build:ios` locally OR trigger cloud build via `eas build --profile production --platform ios`
- [ ] Confirm build number auto-increments correctly (currently at 110)
- [ ] Confirm no TypeScript errors (`bun run typecheck`) before building
- [ ] Confirm build completes without fastlane timeout errors (use `bun run build:ios` script which sets timeout env vars)
- [ ] Submit to TestFlight: `eas submit --platform ios --latest`

### 📱 TestFlight Testing (before App Store submission)
- [ ] Install build from TestFlight on a real device (not simulator)
- [ ] Complete a full Single Player run: Level 1 → game → results → Level 2
- [ ] Verify lives system: lose a life, confirm count decreases, confirm results screen shows correct hearts
- [ ] Verify sound toggles correctly across level transitions (was recently fixed)
- [ ] Complete a Daily Challenge end-to-end
- [ ] Test Multiplayer: create room → join → play → results
- [ ] Tap "Share Results" in Daily Challenge — confirm share sheet appears with correct text and App Store link
- [ ] Test "Watch Ad" / restore lives flow
- [ ] Navigate "All Levels" from results → play a level → return (recently fixed nav bug — retest)
- [ ] Tap every button in How To Play and confirm all tabs load
- [ ] Confirm avatar emoji picker opens and saves correctly
- [ ] Confirm "Your Stats" sheet opens with correct SP/MP/DC stats

### 🎯 AdMob
- [ ] **iOS App ID in `app.json`:** `ca-app-pub-1431240801280221~1971859778` — confirm this matches your AdMob iOS app ✓
- [ ] **Android App ID in `app.json`:** currently set to Google TEST ID (`ca-app-pub-3940256099942544~3347511713`) — update to real Android ID if/when releasing on Android
- [ ] **iOS Rewarded Ad Unit:** `ca-app-pub-1431240801280221/3292546851` — confirm this is live/active in AdMob dashboard
- [ ] In AdMob dashboard → Apps → NAPT iOS → confirm app status is "Ready"
- [ ] Register your real test device in AdMob (Settings → Test Devices) to test ads during development without policy violations
- [ ] Confirm rewarded ad loads and plays on a real device from TestFlight build
- [ ] Confirm lives are restored after watching ad successfully
- [ ] Confirm ad does NOT show in simulator (AdMob silently skips on simulators — expected behaviour)

### 🗄️ Supabase
- [ ] Log in to [supabase.com](https://supabase.com) → Project `zgmygoichpzdxgdjewts`
- [ ] Check **project is not paused** (free tier pauses after 1 week of inactivity)
- [ ] Check **Database → Table Editor** — confirm multiplayer session tables exist and are not empty/corrupted
- [ ] Check **Authentication** settings — confirm anon key is enabled
- [ ] Check **API** → confirm RLS (Row Level Security) policies are correctly set
- [ ] Check **Usage** tab — confirm you're within free tier limits or upgrade if expecting traffic
- [ ] Confirm Realtime is enabled for the multiplayer session tables
- [ ] Consider upgrading to Pro ($25/mo) before launch to avoid auto-pause

### 🚂 Railway (Backend)
- [ ] Log in to [railway.app](https://railway.app) → Project → Service
- [ ] Confirm backend is running: visit `https://wonderful-radiance-production-008f.up.railway.app/api/levels/1` — should return JSON
- [ ] Confirm `/api/daily-challenge` endpoint returns today's challenge
- [ ] Check Railway **Usage / Billing** — free tier has $5 credit/month, confirm you're not over
- [ ] Set up a **custom domain** (optional but looks more professional in error logs)
- [ ] Check **Environment Variables** in Railway match what's in `.env.production`
- [ ] Enable **Health Check** in Railway settings so it auto-restarts on crash
- [ ] Consider upgrading to Hobby ($5/mo) for always-on uptime guarantee

### 🔑 Environment Variables
- [ ] Confirm `EXPO_PUBLIC_VIBECODE_BACKEND_URL` in `.env.production` points to Railway URL (not localhost)
- [ ] Confirm `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are production values
- [ ] Confirm no test/placeholder API keys are shipping in the production build
- [ ] `.env` files are in `.gitignore` and NOT committed to the repo ✓

### 🍎 App Store Connect
- [ ] App name, subtitle, and description are finalised
- [ ] Screenshots uploaded for all required device sizes (6.9", 6.5", 5.5" iPhone at minimum)
- [ ] App icon uploaded (1024×1024, no alpha channel)
- [ ] Privacy policy URL set (required if app collects any data)
- [ ] Age rating completed
- [ ] In-app purchases / ads disclosure filled in (you have AdMob — must disclose)
- [ ] `NSUserTrackingUsageDescription` set in app.json (for ATT prompt — AdMob requires this on iOS 14+)
- [ ] Keywords filled in (max 100 chars — affects discoverability)
- [ ] Category set correctly (Games → Word)
- [ ] Support URL and marketing URL set
- [ ] Version release set to "Manually release" (so you control when it goes live after approval)

---

## ✅ AFTER GOING LIVE

### 🔗 App Store Link
- [ ] Visit `https://apps.apple.com/app/id6759828697` — confirm it resolves to your app page
- [ ] Tap "Share Results" in Daily Challenge on a production build — confirm the link opens the App Store correctly
- [ ] Test the link on a device that does NOT have the app — confirm it prompts to download

### 📊 AdMob (Post-Launch)
- [ ] Check AdMob dashboard 24–48 hours after launch for first impressions/clicks
- [ ] Confirm eCPM and fill rate look reasonable (rewarded ads typically 80%+ fill)
- [ ] If ads not showing: confirm app is approved in AdMob, not just submitted
- [ ] Watch for AdMob policy violation emails in the first week

### 🚂 Railway + Supabase (Post-Launch)
- [ ] Monitor Railway logs for any 5xx errors after real users hit the backend
- [ ] Check Supabase Dashboard → Logs for any auth or database errors
- [ ] Set up uptime monitoring (e.g. UptimeRobot free tier — ping your Railway URL every 5 min)

### 📈 General
- [ ] Test the full user journey from a fresh install (no cached data)
- [ ] Confirm splash screen shows correctly on first launch
- [ ] Confirm username entry works on first launch
- [ ] Check that daily challenge resets at midnight correctly across timezones
- [ ] Monitor App Store reviews in the first week and respond to any crash reports

---

## 📝 Known Placeholder / TODO Items
| Item | Status | Notes |
|------|--------|-------|
| App Store link in share message | ✅ Fixed | `apps.apple.com/app/id6759828697` |
| AdMob iOS App ID | ✅ Production | `ca-app-pub-1431240801280221~1971859778` |
| AdMob Android App ID | ⚠️ Test ID | Replace if Android release planned |
| Railway backend URL | ✅ Live | `wonderful-radiance-production-008f.up.railway.app` |
| Supabase project | ✅ Live | Check for pausing on free tier |
| Build number | ✅ 110 | Auto-increments on EAS build |
