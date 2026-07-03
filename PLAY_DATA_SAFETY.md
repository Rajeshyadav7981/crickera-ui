# Google Play — Data Safety form answers (CRIXONE)

Source of truth for the Play Console **Data safety** section. Generated from the
actual app code, not assumptions. Re-verify whenever data collection changes.

App package: `com.crixone.app`

---

## Summary answers

| Question | Answer |
|---|---|
| Does your app collect or share user data? | **Yes** |
| Is all data encrypted in transit? | **Yes** (all API + WebSocket traffic is HTTPS/WSS to `crixone.in`) |
| Do you provide a way to request data deletion? | **Yes** — in-app: Settings → Delete Account (`DELETE /api/auth/me`). Also a deletion URL can be listed. |
| Is data collection optional for some types? | **Yes** — location is permission-gated and optional. |

---

## Data types COLLECTED

### Personal info
- **Name** — collected. Account function. Required. (first/last/full name)
- **Phone number** — collected. Account management / sign-in (OTP). Required.
- **Email address** — collected (optional field). Account management. Optional.
- **User IDs** — collected (username, internal user id). App functionality.
- **Address / other info** — city, state, country (optional profile fields), date of birth (optional). App functionality. Optional.

### Location
- **Approximate location** — collected. `expo-location`, foreground only, `Accuracy.Balanced`.
  Purpose: **App functionality** (show nearby tournaments / matches / venues).
  Optional (permission-gated). **No background location.**
- Precise location: not collected. `ACCESS_FINE_LOCATION` is blocked in `app.json`
  (`android.blockedPermissions`), so declare **Approximate** only.

### Photos and videos
- **Not collected.** The app has no image picker or upload flow — avatars use a
  fixed preset set. No `CAMERA` or media permissions are declared.

### Messages / User-generated content
- **Other user-generated content** — collected. Community posts, comments, match
  commentary, team/player/tournament data. Purpose: App functionality.

### App activity
- **App interactions / other actions** — cricket stats, scoring activity, favorites,
  follows. Purpose: App functionality.

### App info and performance
- **Crash logs / diagnostics** — collected. Custom error telemetry batched to
  `POST /api/errors/batch`. Purpose: Analytics / app stability.

### Device or other IDs
- **Not collected.** Push notifications are disabled in this release (no push
  token collected, `POST_NOTIFICATIONS` blocked in `app.json`).

---

## Data SHARING
- No user data is **shared** with third parties for advertising or analytics.
- OTP delivery uses **Message Central (VerifyNow)** as a service provider — the
  phone number is processed by them solely to deliver the verification SMS
  (processing on our behalf, not "sharing" for their own use).

---

## Security practices
- Encrypted in transit: **Yes** (HTTPS/WSS).
- Auth tokens stored in the OS secure keystore (`expo-secure-store`).
- Users can request deletion of their data: **Yes** (in-app Delete Account).
- Committed to Play **Families / data-handling** best practices: review before submit.

---

## Permissions declared (Android, auto-added by Expo plugins)
- `ACCESS_COARSE_LOCATION` — `expo-location` (nearby venues). Foreground only. `ACCESS_FINE_LOCATION` is blocked in `app.json`.
- `INTERNET` / network state — API + live scoring.
- Push notifications are disabled this release: `POST_NOTIFICATIONS` is blocked in `app.json`.

> If any permission above is NOT actually needed on a given build, remove the
> plugin or add a `blockedPermissions` entry so the Data Safety form stays honest.

---

## Pre-submission checklist tied to this form
- [ ] Host the real **Privacy Policy** and **Terms** pages; update the URLs in
      `src/screens/profile/SettingsScreen.js` (`PRIVACY_POLICY_URL`, `TERMS_URL`)
      and add the privacy-policy URL in the Play Console listing.
- [ ] Confirm in-app **Delete Account** works end-to-end on a release build.
- [ ] If you later add background location or precise GPS, update this file and the form.
