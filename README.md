# Firebird Posts

Native React Native app for iOS and Android that displays JSONPlaceholder posts, opens a post detail view, and lets a user maintain a local favorites list. It uses TypeScript, React Navigation, Zustand, AsyncStorage, and FakerJS; it does not use Expo.

## Normal setup and Metro launch

Prerequisites:

- Node.js 22.11.0 or later (the version required by `package.json`)
- npm
- For Android: Android Studio with an Android SDK/emulator configured for React Native development
- For iOS: macOS, Xcode, CocoaPods, and Ruby 2.6.10 or later

From the repository root, the normal JavaScript setup and Metro launch path is exactly:

```sh
npm install
```

```sh
npm run start
```

The second command starts Metro; keep it running while launching the native app from a separate terminal.

## Native platform bootstrap and launch

These platform-specific steps are separate from the two-command Metro path above.

### Android

Start an emulator in Android Studio, or connect an Android device with USB debugging enabled, then run:

```sh
npm run android
```

### iOS

On macOS, install the Ruby dependencies and CocoaPods for a fresh checkout, then launch a simulator build:

```sh
bundle install
bundle exec pod install --project-directory=ios
npm run ios
```

`bundle install` uses the repository's `Gemfile`; the app is named `FirebirdPosts` in the native iOS project. If CocoaPods or Xcode reports a local environment issue, complete the standard React Native iOS toolchain setup before retrying.

## Quality commands

```sh
npm test
npm run lint
npm run typecheck
```

These commands are declared in `package.json`. They are not represented here as a final validation result; final automated and device validation is tracked by T12/T12-V in the [SDD task checklist](docs/sdd/tasks.md).

## Behavior and architecture

On first successful list use, the app fetches `GET /posts` from JSONPlaceholder, generates and persists one FakerJS image URI per list record (32 × 32), and displays a selectable, scrollable list. On first opening of an uncached detail, it fetches `GET /posts/:id`, generates and persists an independent FakerJS image URI (300 × 300), and displays the title, body, and favorite control.

Favorites update immediately, are visually marked, and sort before non-favorites while preserving original API order within each group. The cache stores the enriched list, per-ID details, and favorite IDs in AsyncStorage. A valid restored entry bypasses another successful API request and image generation; failed or invalid data remains retryable. The UI includes loading, empty, request-error/retry, missing-detail, and image-fallback states.

The layers are intentionally separated:

```text
Screens and presentation components
  -> Zustand store and ordering selectors
    -> posts repository
      -> JSONPlaceholder client / Faker image factory / AsyncStorage gateway
```

For complete scope, cache semantics, accessibility requirements, and verification expectations, see the [product specification](docs/sdd/specification.md) and [technical plan](docs/sdd/plan.md).

## AI-work evidence and traceability

The assignment source, the recorded implementation rules, and the chat-evidence status are in [docs/ai-evidence](docs/ai-evidence/README.md):

- [Assignment prompt source](docs/ai-evidence/assignment-prompt.md)
- [Recorded agent rules](docs/ai-evidence/agent-rules.md)
- [AI interaction evidence status](docs/ai-evidence/interaction-evidence.md)

The specification, plan, and execution checklist are also retained under [docs/sdd](docs/sdd/). No screenshot/export of the interactive AI chat was available in this workspace when this documentation was prepared; the evidence status file identifies this delivery gap rather than claiming that it is satisfied.

## Known limitations and validation status

- This repository contains no captured iOS or Android manual-acceptance record yet. On 2026-08-13, this workspace could not run those checks: `xcrun simctl list devices available` failed because `CoreSimulatorService` was unavailable, and `adb devices` could not start its local listener (`Operation not permitted`). Run the plan’s full native checklist on an available simulator/device before delivery.
- This repository contains no AI-chat screenshot or exported transcript yet; add the actual artifact under `docs/ai-evidence/` and update its manifest before final delivery.
- Automated validation completed on 2026-08-13: `npm test -- --runInBand` passed 16 suites / 131 tests; `npm run lint` and `npm run typecheck` also passed. This does not replace the outstanding iOS/Android manual acceptance or independent documentation/final-validation sign-off (T11-V and T12-V).
