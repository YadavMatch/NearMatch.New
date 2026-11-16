# Deploying NearMatch

Two targets: **web** (Firebase Hosting) and **iOS** (Capacitor shell around the
same build). Both serve the identical `dist/` output.

---

## 0. Environment (do this first — nothing builds usefully without it)

`src/lib/firebase.ts` reads its config from `VITE_FIREBASE_*` variables and
**throws on startup if a required one is missing**. The values are *not* in the
repository: `firebase-applet-config.json` is untracked and `.env*` is ignored.

So on any fresh clone, or any CI runner:

```bash
cp .env.example .env.local
```

Then fill in the six required values from the Firebase console
(*Project settings → General → Your apps → SDK setup and configuration*):

| Variable | Required |
|---|---|
| `VITE_FIREBASE_API_KEY` | yes |
| `VITE_FIREBASE_AUTH_DOMAIN` | yes |
| `VITE_FIREBASE_PROJECT_ID` | yes |
| `VITE_FIREBASE_STORAGE_BUCKET` | yes |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | yes |
| `VITE_FIREBASE_APP_ID` | yes |
| `VITE_FIREBASE_DATABASE_ID` | only if not `(default)` |
| `VITE_FIREBASE_MEASUREMENT_ID` | optional |
| `VITE_FIREBASE_OAUTH_CLIENT_ID` | optional |
| `VITE_FIREBASE_RECAPTCHA_SITE_KEY` | optional |
| `GEMINI_API_KEY` | see note below |

`VITE_*` variables are **compiled into the public bundle**. That is correct and
expected for Firebase web config — it is not secret, and access is controlled by
Firestore rules, not by hiding these values. Never put a private key in a
`VITE_` variable.

**On `GEMINI_API_KEY`:** `metadata.json` declares
`MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API`, but no source file currently calls
Gemini — `@google/genai` is installed and unreferenced. Nothing breaks without
the key today. Either supply it when you add Gemini features, or drop the
capability declaration from `metadata.json`.

---

## 1. Verify before you ship

```bash
bun install
bun run typecheck
bun test
bun run build
```

All four must pass. `bun run build` writes `dist/`.

---

## 2. Web — Firebase Hosting

`firebase.json` is configured with `public: "dist"`, an SPA rewrite so deep
links resolve, long-lived caching for hashed assets, `no-store` on
`index.html`, and baseline security headers.

```bash
npm i -g firebase-tools     # once
firebase login
firebase use <your-project-id>
bun run build
firebase deploy --only hosting
```

Rules and indexes deploy separately:

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

Deploy rules **before or with** the app, never after — the app depends on them.

---

## 3. iOS — Capacitor

> Steps 3.2 onward **require macOS with Xcode**. They cannot be run on Linux or
> in a cloud container. Everything before that point is already done in this
> repository.

### 3.1 Already configured here

- `capacitor.config.json` — bundle id, app name, `webDir: dist`
- `ios/` platform scaffolded, `@capacitor-firebase/authentication` linked
- `ios/App/App/Info.plist` — all required usage descriptions (location,
  microphone, camera, photo library) plus `ITSAppUsesNonExemptEncryption`
- `src/lib/nativeAuth.ts` — native Google sign-in on device, popup on web

### 3.2 Confirm the bundle identifier — do this before anything else

`capacitor.config.json` currently sets:

```
in.nearmatch.app
```

**Change it now if you want something else.** Once an App Store Connect record
exists for a bundle id it is permanent and cannot be renamed or reused. Update
it in `capacitor.config.json`, then set the same value as
`PRODUCT_BUNDLE_IDENTIFIER` in Xcode (*App target → Signing & Capabilities*).

### 3.3 Add the iOS app in Firebase

Native Google sign-in will **not** work without this.

1. Firebase console → *Add app → iOS*, using the bundle id from 3.2.
2. Download `GoogleService-Info.plist` and add it to the Xcode project at
   `ios/App/App/GoogleService-Info.plist` (drag it into the **App** target so it
   is bundled, not merely present on disk).
3. Open that file, copy the `REVERSED_CLIENT_ID` value, and register it as a URL
   scheme — *App target → Info → URL Types → +*, with the reversed client id as
   the scheme.

Note that the OAuth client in the old web config is a **web** client. iOS needs
its own client, created by step 1. Do not reuse the web one.

### 3.4 Build

```bash
bun run ios:sync      # vite build + cap sync ios
cd ios/App && pod install && cd ../..
bun run ios:open      # opens Xcode
```

In Xcode: select your team, set `MARKETING_VERSION` and
`CURRENT_PROJECT_VERSION`, then *Product → Archive*.

### 3.5 Before you submit

- [ ] Privacy policy URL in App Store Connect → `https://<domain>/privacy.html`
- [ ] Age rating set to **17+** (unrestricted web access / dating), and confirm
      the dating questionnaire answers
- [ ] App Privacy ("nutrition label") completed — declare precise/coarse
      location, contact info, photos, audio, identifiers, user content
- [ ] Account deletion reachable in-app (it is, in Settings) — Apple requires
      this for any app with account creation
- [ ] Demo account credentials supplied for review, or review cannot sign in
      past Google auth
- [ ] Report and block flows demonstrable to the reviewer
- [ ] `ITSAppUsesNonExemptEncryption` self-classification confirmed with
      counsel — voice notes are encrypted client-side

---

## 4. Legal pages

`public/privacy.html` and `public/terms.html` are served as static files
(Firebase Hosting matches static files before the SPA rewrite) and are linked
from the sign-in footer and Settings.

**Both are drafts and both carry a visible DRAFT banner.** They describe what
this codebase actually does with data, as a starting point. Every highlighted
field must be completed and the text reviewed by a lawyer, then delete the
`id="draft-notice"` block from each file. Apple and Google both require a
reachable privacy policy; a dating app without one will be rejected.

---

## 5. Known non-blocking issues

- **Bundle size.** The main JS chunk is ~1.25 MB (365 KB gzipped). Works, but
  worth code-splitting the 3D radar and `three` into a lazy route.
- **Image weight.** `src/assets/images/` holds nine JPEGs of 790–980 KB each,
  ~8 MB total, shipped at full size. Resizing and converting to WebP/AVIF would
  cut most of it. Left untouched because it changes the artwork.
- **`firestore.rules` "Pillar 0".** The `match /{document=**} { allow read,
  write: if false; }` block denies nothing — in Firestore, access is granted if
  *any* rule allows, so a blanket `if false` cannot override the rules below it.
  Firestore already defaults to deny. Harmless, but it is not the safety net it
  reads as; the real protection is the per-collection rules.
