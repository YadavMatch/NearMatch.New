# NearMatch

Location-aware dating with safety built into the database, not bolted on after.
Profiles are discoverable only through coordinates snapped to a ~300 m grid, PII
lives in an owner-only record, and blocking, reporting and verification are
enforced by Firestore rules rather than UI alone.

```
React 19 + Vite  ──►  Firebase Auth  ──►  Cloud Firestore
       │                                        ▲
       └──────── Capacitor shell (iOS) ─────────┘
```

| | |
|---|---|
| **Web** | React 19, TypeScript, Vite 8, Tailwind 4, Motion, three.js |
| **Backend** | Firebase Auth + Cloud Firestore (703 lines of rules) |
| **iOS** | Capacitor 7, native Google sign-in |
| **Bundle id** | `in.nearmatch.app` — confirm before creating the App Store record |
| **Tests** | 42 unit tests across 12 files, plus 16 Firestore rules tests |

## Quick start

```bash
bun install
cp .env.example .env.local      # then fill in your Firebase values
bun run dev                     # http://localhost:3000
```

`src/lib/firebase.ts` throws at startup if a required `VITE_FIREBASE_*` value is
missing — the config is not committed. See
[DEPLOYMENT.md](DEPLOYMENT.md#0-environment-do-this-first--nothing-builds-usefully-without-it).

## Scripts

| Command | What it does |
|---|---|
| `bun run dev` | Dev server on port 3000 |
| `bun run build` | Production build to `dist/` |
| `bun run preview` | Serve the built output |
| `bun test` | Unit tests |
| `bun run test:rules` | Firestore rules tests against the local emulator |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run ios:sync` | Build, then sync into the iOS project |
| `bun run ios:open` | Open the iOS project in Xcode (macOS only) |

## Deploying

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for web (Firebase Hosting) and iOS
(Capacitor + App Store) in full, including the pre-submission checklist.

## Legal pages

`public/privacy.html` and `public/terms.html` are **drafts carrying a visible
DRAFT banner**. They must be completed and reviewed by a lawyer before launch —
a dating app without a reachable privacy policy will be rejected by both app
stores.

## Layout

```
src/
  components/      UI, including onboarding, discovery, chat, safety modals
  context/         AuthContext — auth state and profile subscriptions
  hooks/           useNearMatchData
  lib/             firebase, firestoreService, nativeAuth, matching, voiceCrypto
  lib/__tests__/   unit tests
  scene3d/         three.js neighbourhood radar
firestore.rules    authorisation and validation, per collection
firebase-blueprint.json   entity schemas the rules validate against
ios/               Capacitor iOS project
```
