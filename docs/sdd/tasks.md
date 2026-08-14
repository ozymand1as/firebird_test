# Implementation Tasks: Persistent Posts and Favorites

## Execution rules

- Complete tasks in order unless their listed dependencies are satisfied.
- The implementation owner changes only the files named by its task (plus generated native scaffold files where explicitly noted). Preserve all unrelated work already in the workspace.
- Each implementation task is immediately followed by its tester verification task. A task is complete only after its acceptance checks pass.
- Tests must use mocked/spied API, storage, Faker, and navigation seams where required; visual checks alone do not prove the one-time acquisition rules.

## Ordered checklist

- [x] **T01 — Create the non-Expo React Native foundation and test tooling**
  - **Owner:** Implementer
  - **Files owned:** generated React Native CLI scaffold (`android/`, `ios/`, `package.json`, `package-lock.json`, `metro.config.*`, `babel.config.*`, `tsconfig.json`, Jest configuration/setup) and initial `src/` directories.
  - **Dependencies:** none.
  - **Work:** Generate a TypeScript React Native CLI app at React Native 0.77+; add React Navigation v7+, Zustand, AsyncStorage, FakerJS, and React Native Testing Library. Configure Jest, TypeScript, lint/typecheck scripts, and required native navigation peers without Expo or web targets.
  - **Acceptance checks:** `package.json` declares the required production libraries and RN version; native iOS/Android directories exist; the project has runnable test, lint, and typecheck commands.

- [x] **T01-V — Verify scaffold and toolchain**
  - **Owner:** Tester
  - **Files owned:** test/tooling-only configuration corrections if necessary; do not alter product source.
  - **Dependencies:** T01.
  - **Verify:** run dependency installation, Jest smoke test, typecheck, and lint; inspect dependencies and ensure no Expo dependency/configuration is introduced.
  - **Evidence:** record commands and pass/fail output for the final validation task.

- [x] **T02 — Define domain contracts and strict validators**
  - **Owner:** Implementer
  - **Files owned:** `src/domain/post.ts`, `src/domain/postValidation.ts`, `tests/domain/postValidation.test.ts`.
  - **Dependencies:** T01-V.
  - **Work:** Implement `RemotePost`, enriched list/detail records, versioned persisted snapshot, request-status/error types, and validators for remote collection/record and persisted state. Require positive finite IDs, non-empty required strings, unique list IDs, and valid unique `collectionIndex`; reject detail-ID mismatches and incompatible snapshots.
  - **Acceptance checks:** invalid remote or persisted payloads cannot be represented as valid cache data; valid payloads retain all required fields without coercing malformed records into success.

- [x] **T02-V — Verify validation boundaries**
  - **Owner:** Tester
  - **Files owned:** `tests/domain/postValidation.test.ts`.
  - **Dependencies:** T02.
  - **Verify:** test valid collection/detail/snapshot cases plus malformed fields, duplicate IDs, invalid indexes, corrupt JSON-compatible shapes, and requested/detail ID mismatch.
  - **Evidence:** Jest results show malformed data is rejected and valid data accepted.

- [x] **T03 — Implement API, Faker image, and AsyncStorage gateways**
  - **Owner:** Implementer
  - **Files owned:** `src/data/api/jsonPlaceholderClient.ts`, `src/data/images/fakerImageFactory.ts`, `src/data/storage/postsStorage.ts`, `tests/data/jsonPlaceholderClient.test.ts`, `tests/data/fakerImageFactory.test.ts`, `tests/data/postsStorage.test.ts`.
  - **Dependencies:** T02-V.
  - **Work:** Add small injectable gateways. The API gateway builds only `GET /posts` and `GET /posts/:id`, checks HTTP success, parses/validates payloads, and reports failures. The image factory creates a FakerJS URI/value from supplied dimensions. Storage reads/writes one namespaced, versioned snapshot and safely discards corrupt/incompatible stored data.
  - **Acceptance checks:** storage never exposes an invalid snapshot as cache; API failures and malformed payloads are errors; image generation is independently spyable and dimension-aware.

- [x] **T03-V — Verify gateway behavior**
  - **Owner:** Tester
  - **Files owned:** gateway test files from T03.
  - **Dependencies:** T03.
  - **Verify:** mock fetch for success, non-OK, malformed collection/detail, and mismatched ID; mock AsyncStorage for valid, corrupt, and read/write failure cases; spy on Faker calls and assert requested 32x32/300x300 arguments.
  - **Evidence:** test output proves validation and error propagation at each boundary.

- [x] **T04 — Build cache-first posts repository**
  - **Owner:** Implementer
  - **Files owned:** `src/data/postsRepository.ts`, `tests/data/postsRepository.test.ts`.
  - **Dependencies:** T03-V.
  - **Work:** Compose gateways into repository operations that hydrate/read snapshots, acquire and enrich a missing list, acquire and enrich a missing detail by ID, merge details without loss, and commit a complete snapshot before reporting durable success. Add per-ID in-flight de-duplication. Do not refresh valid cache or regenerate persisted images.
  - **Acceptance checks:** a successful list request creates exactly one 32x32 image per item; a successful detail request creates one independent 300x300 value; valid persisted entries bypass API/Faker; failed/incomplete results are not cached; commits retain details and favorites.

- [x] **T04-V — Verify acquisition, caching, and repository recovery**
  - **Owner:** Tester
  - **Files owned:** `tests/data/postsRepository.test.ts`.
  - **Dependencies:** T04.
  - **Verify:** test first acquisition, valid-list cache bypass, retry after a failed request, per-ID detail caching, concurrent same-ID de-duplication, details merge preservation, write failure, malformed responses, and corrupt-snapshot recovery. Assert API/Faker call counts.
  - **Evidence:** tests demonstrate successful-only one-time acquisition and generation semantics.

- [x] **T05 — Implement shared Zustand state and ordering selectors**
  - **Owner:** Implementer
  - **Files owned:** `src/state/postsStore.ts`, `src/state/postSelectors.ts`, `tests/state/postsStore.test.ts`, `tests/state/postSelectors.test.ts`.
  - **Dependencies:** T04-V.
  - **Work:** Implement hydration status, list/detail request states and recoverable errors, idempotent `ensureList`, `retryList`, `ensureDetail`, `retryDetail`, and shared `toggleFavorite`. Serialize favorite snapshot writes so rapid toggles persist the newest completed choice. Implement favorite-first ordering by `collectionIndex`, retaining original order within both groups.
  - **Acceptance checks:** list and detail share one favorite-ID state; a toggle updates selected state/order immediately; unfavoriting restores original non-favorite placement; persistence errors are recoverable and never claimed as durable success.

- [x] **T05-V — Verify store and selector semantics**
  - **Owner:** Tester
  - **Files owned:** state test files from T05.
  - **Dependencies:** T05.
  - **Verify:** test hydration/restoration, no duplicate ensures while loading, shared state, deterministic rapid toggles and final persisted result, persistence failure handling, favorite-first stable ordering, and unfavorite placement.
  - **Evidence:** selector and store tests prove the business behavior independently of rendering.

- [x] **T06 — Add typed navigation and hydrated application shell**
  - **Owner:** Implementer
  - **Files owned:** `App.tsx`, `src/app/App.tsx`, `src/navigation/types.ts`, `src/navigation/RootNavigator.tsx`, `tests/app/App.test.tsx`.
  - **Dependencies:** T05-V.
  - **Work:** Configure a v7 native stack with `Posts` and `PostDetail { postId: number }`; instantiate/provide the store and repository composition; gate navigation behind explicit hydration loading/error UI so list acquisition cannot race restoration.
  - **Acceptance checks:** `Posts` is initial route, only numeric post IDs type-check for detail navigation, and app hydration produces a clear loading or recoverable-error state instead of a blank screen.

- [x] **T06-V — Verify root navigation and hydration gate**
  - **Owner:** Tester
  - **Files owned:** `tests/app/App.test.tsx`.
  - **Dependencies:** T06.
  - **Verify:** render with mocked store/repository states; assert hydration loading, hydration error/recovery, and successful transition to the Posts route; typecheck navigation contracts.
  - **Evidence:** tests confirm startup state cannot trigger a pre-hydration list request.

- [x] **T07 — Create reusable accessible presentation components**
  - **Owner:** Implementer
  - **Files owned:** `src/components/PostImage.tsx`, `src/components/PostRow.tsx`, `src/components/ScreenState.tsx`, `src/components/FavoriteButton.tsx`, `src/theme/*`, `tests/components/*.test.tsx`.
  - **Dependencies:** T06-V.
  - **Work:** Add an image component with stable in-app fallback on load failure, 32x32 post row with title and non-color-only favorite marker, loading/error-with-retry/empty presentations, and dynamic accessible favorite button. Keep 300x300 sizing support available to detail rendering.
  - **Acceptance checks:** rows and favorite button expose meaningful roles/labels; favorite button exposes selected/pressed state and changing text/icon; image failure preserves all surrounding UI; no Faker call occurs in fallback behavior.

- [x] **T07-V — Verify presentation component accessibility and fallback**
  - **Owner:** Tester
  - **Files owned:** `tests/components/*.test.tsx`.
  - **Dependencies:** T07.
  - **Verify:** assert 32x32 prop/style output, favorite label/indicator, button role and selected state in both modes, retry callback, empty/loading content, and `Image.onError` fallback without hiding text/actions.
  - **Evidence:** component tests document all required non-content UI states.

- [x] **T08 — Implement Posts screen**
  - **Owner:** Implementer
  - **Files owned:** `src/screens/PostsScreen.tsx`, `tests/screens/PostsScreen.test.tsx`.
  - **Dependencies:** T07-V.
  - **Work:** Bind the screen exclusively to store commands/selectors; invoke idempotent list acquisition after ready hydration; render loading, retryable error, intentional empty state, and `FlatList` content. Navigate with the exact selected numeric ID and render favorite-first order using `PostRow`.
  - **Acceptance checks:** every content row includes its 32x32 stored image/title, favorite mark, and accessible press target; list remains a `FlatList`; no network refresh is triggered when valid list cache exists.

- [x] **T08-V — Verify Posts screen flows**
  - **Owner:** Tester
  - **Files owned:** `tests/screens/PostsScreen.test.tsx`.
  - **Dependencies:** T08.
  - **Verify:** render loading, error/retry, empty, and content states; assert selected row navigation receives the correct ID, favorite ordering/mark updates from shared state, and valid cached list causes no acquisition call.
  - **Evidence:** screen tests cover all Posts acceptance states.

- [x] **T09 — Implement Post Detail screen**
  - **Owner:** Implementer
  - **Files owned:** `src/screens/PostDetailScreen.tsx`, `tests/screens/PostDetailScreen.test.tsx`.
  - **Dependencies:** T08-V.
  - **Work:** Read typed route ID, call idempotent detail acquisition, provide native back navigation, and render explicit loading/error/not-found/retry/content states. Content includes title, body, stored detail image constrained to 300x300 when space allows, and shared dynamic favorite control.
  - **Acceptance checks:** first uncached opening requests only the selected ID once; cached detail renders without fetch/Faker; error/not-found maintains a usable back path; long content scrolls and does not obstruct the favorite action.

- [x] **T09-V — Verify detail screen flows**
  - **Owner:** Tester
  - **Files owned:** `tests/screens/PostDetailScreen.test.tsx`.
  - **Dependencies:** T09.
  - **Verify:** test correct-ID ensure call, loading/error/not-found/retry/content, 300x300 image rendering, back navigation, dynamic accessible favorite behavior, cache bypass, and image fallback.
  - **Evidence:** tests prove ID-specific detail behavior and shared favorite semantics.

- [x] **T10 — Add restart-oriented integration coverage**
  - **Owner:** Implementer
  - **Files owned:** `tests/integration/restartPersistence.test.tsx` (and narrowly scoped test helpers under `tests/helpers/` only).
  - **Dependencies:** T09-V.
  - **Work:** Create a realistic persisted enriched list, one or more cached details, and favorites; recreate repository/store/app state; assert restored content/order/favorites and cached detail behavior without new remote calls or image generation.
  - **Acceptance checks:** integration coverage uses actual production composition seams with mocked external gateways and asserts zero API/Faker calls after restart for valid cached records.

- [x] **T10-V — Verify restart contract**
  - **Owner:** Tester
  - **Files owned:** `tests/integration/restartPersistence.test.tsx`.
  - **Dependencies:** T10.
  - **Verify:** run the test independently and confirm it includes list, detail, image-value stability, favorite restoration, ordering, and no-call assertions; add edge coverage only where a listed assertion is absent.
  - **Evidence:** passing integration result is retained for final delivery verification.

- [ ] **T11 — Complete repository documentation and AI-work evidence**
  - **Owner:** Implementer
  - **Files owned:** `README.md`, `docs/ai-evidence/*`, `docs/sdd/specification.md`, `docs/sdd/plan.md`, `docs/sdd/tasks.md` (links/traceability only).
  - **Dependencies:** T10-V.
  - **Work:** Document product scope, architecture, prerequisites, exact normal `npm install` and `npm run start` commands, separate iOS/Android bootstrap/run steps, test/typecheck/lint commands, persistence/cache behavior, and known limitations. Add assignment prompt, agent rules, and AI-chat screenshots/exports (or clear repository links to them) under `docs/ai-evidence/`; link all evidence from README.
  - **Acceptance checks:** a reviewer can identify required prerequisites and perform the two-command normal path; required evidence is present or clearly linked; documentation does not claim unverified acceptance criteria.

- [ ] **T11-V — Verify documentation deliverables**
  - **Owner:** Tester
  - **Files owned:** documentation verification notes only, if the project has a designated evidence location.
  - **Dependencies:** T11.
  - **Verify:** follow README from a clean checkout through install and Metro start; check required evidence links resolve and SDD documents are included; compare commands and stated limitations with actual package scripts/results.
  - **Evidence:** capture the executed command transcript and any gaps.

- [ ] **T12 — Run integrated automated validation and native manual acceptance**
  - **Owner:** Implementer
  - **Files owned:** only necessary test fixes within the owning test/source files above; `README.md` known-limitations section if results reveal a real limitation.
  - **Dependencies:** T11-V.
  - **Work:** Run Jest, lint, and TypeScript checks. On both iOS and Android, manually verify clean-install list acquisition, scrolling, 32x32/300x300 display, list/detail/back flow, long content, rapid favorite toggles, restart/offline cached behavior, image fallback, and accessibility labels/state. Resolve only failures that contradict the SDD contract.
  - **Acceptance checks:** automated suite is green; both platform checks cover every item in plan section 9; all unresolved constraints are explicitly documented rather than hidden.

- [ ] **T12-V — Independently sign off final validation**
  - **Owner:** Tester
  - **Files owned:** final verification record under `docs/ai-evidence/` if required by the repository evidence convention; otherwise no source edits.
  - **Dependencies:** T12.
  - **Verify:** rerun Jest, lint, and typecheck from the documented commands; review call-count tests and platform/manual evidence against specification acceptance criteria 1–11; report pass status and any remaining limitation precisely.
  - **Evidence:** final command output and platform checklist form the delivery sign-off.

## iOS Simulator execution checklist

This sequence operationalizes plan section 12 for the already-booted iOS Simulator. It is intentionally separate from T12's cross-platform product validation: do not mark an environment or CoreSimulator access failure as a source regression. All tasks are non-destructive unless the reviewer explicitly authorizes a clean app-data run.

- [x] **IOS-01 — Record read-only native preflight** *(setup)*
  - **Owner:** iOS verification owner.
  - **Prerequisites:** repository checkout available; no source or simulator changes required.
  - **Commands/evidence:** record output of `node --version`, `npm --version`, `bundle --version`, `xcodebuild -version`, and `git status --short` when applicable; record whether `ios/Pods` and `ios/FirebirdPosts.xcworkspace` exist.
  - **Pass condition:** prerequisite/tool versions and native-artifact presence are recorded; a non-Git workspace is recorded as such.
  - **Stop condition:** missing required local tooling is an environment/setup blocker; do not alter application code to compensate.

- [x] **IOS-02 — Identify exactly one already-booted simulator** *(setup)*
  - **Owner:** iOS verification owner.
  - **Prerequisites:** IOS-01; host-capable access to CoreSimulator.
  - **Commands/evidence:** run `xcrun simctl list devices booted`; record device name, runtime, and UDID.
  - **Pass condition:** one target is explicitly reported as `Booted`.
  - **Stop condition:** if zero devices are booted, multiple are booted, or `CoreSimulatorService` cannot be reached, stop and report the precise environment condition. Do not boot, create, erase, or guess a device.

- [x] **IOS-03 — Install JavaScript dependencies when needed** *(setup)*
  - **Owner:** iOS verification owner.
  - **Prerequisites:** IOS-01; network access if dependencies are not already usable.
  - **Commands/evidence:** run the documented `npm install` when installation/reproducibility is required; retain terminal output and report any registry/sandbox failure.
  - **Pass condition:** dependencies resolve according to the lockfile without deleting an existing `node_modules` tree.
  - **Stop condition:** installation/network/sandbox failure is recorded as bootstrap failure; do not substitute packages or modify the lockfile merely to proceed.

- [x] **IOS-04 — Install the Gemfile-managed CocoaPods bundle** *(setup)*
  - **Owner:** iOS verification owner.
  - **Prerequisites:** IOS-03; Bundler available.
  - **Commands/evidence:** run `bundle install`; retain output and any normal Bundler lockfile change as dependency-bootstrap evidence.
  - **Pass condition:** the Gemfile-managed bundle is available for `bundle exec`.
  - **Stop condition:** RubyGems/network/Bundler failure is reported precisely; do not replace it with a global CocoaPods installation.

- [x] **IOS-05 — Generate iOS Pods and workspace** *(setup)*
  - **Owner:** iOS verification owner.
  - **Prerequisites:** IOS-04.
  - **Commands/evidence:** run `bundle exec pod install --project-directory=ios`, then read-only-check `ios/Pods` and `ios/FirebirdPosts.xcworkspace`.
  - **Pass condition:** pod install completes and both native artifacts exist.
  - **Stop condition:** classify pod resolution, network, Xcode/CocoaPods, or sandbox write failures; never delete Pods, workspace, lockfiles, or derived data as a recovery shortcut.

- [x] **IOS-06 — Start and retain one Metro instance** *(run)*
  - **Owner:** iOS verification owner.
  - **Prerequisites:** IOS-03.
  - **Commands/evidence:** start `npm run start` in a dedicated terminal and retain its output; establish that it owns port 8081 or that an existing owner serves this same checkout.
  - **Pass condition:** one usable Metro server is available on the launch port.
  - **Stop condition:** if port 8081 belongs to an unrelated process, report the conflict; do not kill it.

- [x] **IOS-07 — Reconfirm target and launch the shared scheme** *(run)*
  - **Owner:** iOS verification owner.
  - **Prerequisites:** IOS-02, IOS-05, IOS-06.
  - **Commands/evidence:** rerun `xcrun simctl list devices booted`; then run `npm run ios -- --udid <BOOTED_SIMULATOR_UDID> --scheme FirebirdPosts --no-packager`. Record UDID, native build/install output, Metro connection, and visible launch.
  - **Pass condition:** the `FirebirdPosts` scheme installs and launches on the same recorded booted UDID.
  - **Stop condition:** classify and report Xcode compile/install, simulator access, Metro bundle/connection, or first-load-network failures separately. If device choice is ambiguous, use only `npm run ios -- --list-devices --scheme FirebirdPosts --no-packager` as the non-mutating fallback.

- [ ] **IOS-08 — Verify clean-data list behavior when authorized** *(manual QA)*
  - **Owner:** iOS verification owner.
  - **Prerequisites:** IOS-07; reviewer authorization before clearing app data/reinstalling; working first-load network access.
  - **Actions/evidence:** observe explicit loading, posts content, scrollability, titles, and 32 × 32 list images; record a visible post ID/title. Use this run only for first-load acceptance.
  - **Pass condition:** the list remains usable and no blank screen occurs.
  - **Stop condition:** without authorization for a clean app-data run, skip this destructive-reset scenario and record it as unexecuted rather than resetting simulator content.

- [ ] **IOS-09 — Verify detail, favorite, and return journey** *(manual QA)*
  - **Owner:** iOS verification owner.
  - **Prerequisites:** IOS-07 and a loaded list (IOS-08 when clean-load evidence is required).
  - **Actions/evidence:** open the recorded post; observe detail loading then matching title/body and a 300 × 300 bounded image; toggle favorite once; verify immediate selected/add-remove semantics; navigate back and verify the marked post precedes all non-favorites; reopen it and verify the selected state.
  - **Pass condition:** ID-specific detail, dynamic favorite state, visible marker, favorite-first order, and native back navigation all work without a crash.
  - **Stop condition:** record whether a failure is first-detail network, image rendering, navigation, state/persistence, or layout/accessibility behavior before changing anything.

- [ ] **IOS-10 — Verify process-restart persistence on the same device** *(manual QA)*
  - **Owner:** iOS verification owner.
  - **Prerequisites:** IOS-09; installed app data must remain intact.
  - **Commands/evidence:** run `xcrun simctl terminate <BOOTED_SIMULATOR_UDID> org.reactjs.native.example.FirebirdPosts` and `xcrun simctl launch <BOOTED_SIMULATOR_UDID> org.reactjs.native.example.FirebirdPosts`; record the relaunch observations.
  - **Pass condition:** cached list/detail content, stable image references, favorite state, and favorite-first ordering reappear without uninstalling, erasing, or clearing storage.
  - **Stop condition:** if persistence is absent, preserve simulator state and report the observed regression; do not reset data before recording evidence.

- [ ] **IOS-11 — Run automated contract checks** *(automated test)*
  - **Owner:** iOS verification owner.
  - **Prerequisites:** IOS-03; source/test tree unchanged except for intentional in-scope fixes.
  - **Commands/evidence:** independently run `npm test -- --runInBand`, `npm run lint`, and `npm run typecheck`; retain output. Confirm the existing call-count/cache tests cover no re-fetch/no-regeneration for valid persisted records.
  - **Pass condition:** all commands pass and their results provide the non-visual cache/acquisition evidence.
  - **Stop condition:** report each failing command/test separately; only implement a fix when it contradicts the SDD contract and falls within the assigned implementation scope.

- [ ] **IOS-12 — Produce the iOS verification handoff** *(evidence)*
  - **Owner:** iOS verification owner.
  - **Prerequisites:** IOS-01 through IOS-11, or documented stop conditions for any blocked task.
  - **Evidence:** compile one concise record of tool/bootstrap outputs, simulator name/runtime/UDID, Metro/build/launch results, automated-check results, list/detail/favorite/back/restart observations, and each unexecuted or blocked step with its exact stage.
  - **Pass condition:** evidence clearly distinguishes environment/sandbox/network limitations from application regressions and preserves the next investigator's simulator/workspace state.
  - **Stop condition:** none; incomplete verification is handed off with its precise blocker rather than an inferred product result.

## iOS clean-build compatibility remediation

This ordered sequence remediates the React Native 0.87 / Gesture Handler native compatibility defect recorded in specification section 10.2 and plan section 12.6. It must not change product behavior or patch generated/native dependency source files.

- [x] **IOS-13 — Gate the dependency correction on published support evidence** *(compatibility decision)*
  - **Owner:** iOS verification owner.
  - **Prerequisites:** IOS-01; access to the publisher's release/compatibility material and the published package contents.
  - **Actions/evidence:** retain upstream evidence that `react-native-gesture-handler` 3.1.0 explicitly supports React Native 0.87; inspect that published package's iOS new-architecture module and record that it no longer uses `RCTCxxBridge` or `RCTBridge.runtime`.
  - **Pass condition:** the evidence explicitly covers RN 0.87 and verifies the obsolete bridge API is absent; select exactly 3.1.0 for IOS-14.
  - **Stop condition:** if either proof is absent, do not alter manifests or locks. Record the newest published version with explicit RN 0.87 support, or—only if no such version exists—record the evidence required to use the plan's RN 0.86.0 family-alignment fallback.
  - **Completion evidence (2026-08-13):** Publisher [v3.0.1 release notes](https://github.com/software-mansion/react-native-gesture-handler/releases/tag/3.0.1) explicitly list the iOS fix to build with React Native `0.87-nightly`; the subsequent published [v3.1.0 release](https://github.com/software-mansion/react-native-gesture-handler/releases/tag/v3.1.0) contains that 3.x fix. `npm view react-native-gesture-handler@3.1.0` identified the published archive, and inspection of its `package/apple/RNGestureHandlerModule.mm` (the `RCTTurboModule` implementation) plus all `package/apple` and `package/shared` iOS/new-architecture sources found no `RCTCxxBridge` or `RCTBridge.runtime` occurrence. Select exact `3.1.0` for IOS-14; no fallback is required.

- [x] **IOS-14 — Pin the supported dependency pair in manifests** *(dependency change)*
  - **Owner:** iOS verification owner.
  - **Prerequisites:** IOS-13 selected a supported published version.
  - **Actions/evidence:** pin the selected `react-native-gesture-handler` version exactly (primary: `3.1.0`, without a range) in `package.json`. If IOS-13 selected the no-compatible-release fallback, pin the complete React Native 0.86.0 family named in plan section 12.6 and retain gesture-handler 2.32.0; make no unrelated dependency or product changes.
  - **Pass condition:** the manifest describes one documented, supported RN/Gesture Handler pair and contains no hand edits to `node_modules`, Pods, generated React Codegen/autolinking files, or Xcode-derived source.
  - **Stop condition:** an ambiguous support decision or any required unrelated dependency upgrade stops this task for diagnosis.

- [x] **IOS-15 — Regenerate and verify the npm dependency lock** *(dependency install)*
  - **Owner:** iOS verification owner.
  - **Prerequisites:** IOS-14.
  - **Commands/evidence:** run `npm install` from the selected manifest state; retain its output and the resulting `package-lock.json` change. Run `npm ls react-native react-native-gesture-handler` and record the single resolved pair.
  - **Pass condition:** a fresh npm install resolves exactly the selected manifest versions and the lockfile records the same pair without manual lockfile editing.
  - **Stop condition:** registry, network, sandbox, or lock-resolution failure is recorded separately; do not edit the lockfile or installed package source to continue.

- [x] **IOS-16 — Regenerate Pods and verify generated native references** *(native dependency install)*
  - **Owner:** iOS verification owner.
  - **Prerequisites:** IOS-15; Bundler available.
  - **Commands/evidence:** run `bundle install`, then `bundle exec pod install --project-directory=ios`; retain output and resulting normal dependency artifacts, including `ios/Podfile.lock` and any Bundler lock update. Read-only-check `ios/Pods`, `ios/FirebirdPosts.xcworkspace`, and generated Pod references for the selected Gesture Handler release.
  - **Pass condition:** Pods/workspace are regenerated from the chosen npm resolution and reference the same Gesture Handler version.
  - **Stop condition:** classify Ruby/Bundler, CocoaPods, Xcode, registry, pod-source, or sandbox failure; do not delete Pods, workspace, lockfiles, derived data, or generated files as recovery.

- [x] **IOS-17 — Clean-build, install, and launch the exact required UDID** *(native verification)*
  - **Owner:** iOS verification owner.
  - **Prerequisites:** IOS-06, IOS-16; healthy Metro on port 8081; simulator `3B474FEB-4A78-456A-85EF-AC6B841A0796` confirmed `Booted` immediately before launch.
  - **Commands/evidence:** run `xcrun simctl list devices booted`, then `npm run ios -- --udid 3B474FEB-4A78-456A-85EF-AC6B841A0796 --scheme FirebirdPosts --no-packager`; retain selected-UDID, build/install, Metro-connection, and visible-launch output.
  - **Pass condition:** the scheme builds, installs, and launches on that exact UDID with neither an `RCTCxxBridge` nor missing `RCTBridge.runtime` compiler error.
  - **Stop condition:** CoreSimulator access, device mismatch, Xcode compile/install, Metro, or network failure is recorded by stage; do not create, boot, erase, or substitute a simulator.

- [x] **IOS-18 — Perform clean-state product smoke QA** *(manual QA)*
  - **Owner:** iOS verification owner.
  - **Prerequisites:** IOS-17; reviewer authorization before reinstalling or otherwise clearing the app's data; usable first-load network access.
  - **Actions/evidence:** on the newly installed clean-state app, wait for posts, open one detail, toggle favorite, return to the list, and record that the visibly marked row moves ahead of all non-favorites.
  - **Pass condition:** list, detail, favorite semantics, and favorite-first ordering work without a crash and without a product behavior change attributable to the dependency correction.
  - **Stop condition:** missing clean-state authorization is recorded as unexecuted; a smoke failure after a successful build is a separate product regression and stops remediation for diagnosis.
  - **Completion evidence (2026-08-13):** On the exact booted iPhone 17 Pro (`3B474FEB-4A78-456A-85EF-AC6B841A0796`), the authorized scoped uninstall/reinstall of only `org.reactjs.native.example.FirebirdPosts` reached a populated clean posts list with 32 × 32 images and titles (`/private/tmp/firebirdposts-ios18-after-standard-launch.png`). Screenshot-guided taps opened the first post (`789,250`), showed its title/body and 300 × 300 image (`/private/tmp/firebirdposts-ios18-detail-loaded.png`), and exposed the dynamic Add control. Tapping `(693,720)` immediately changed it to `Remove from favorites` (`/private/tmp/firebirdposts-ios18-after-add-favorite.png`); Back `(665,180)` returned to a visibly star-labeled, highlighted first row ahead of all non-favorites (`/private/tmp/firebirdposts-ios18-after-back-favorite-on.png`). Scoped terminate/relaunch preserved that state (`/private/tmp/firebirdposts-ios18-after-relaunch-favorite-on-loaded.png`). Reopening then removing at `(720,720)` restored `Add to favorites` (`/private/tmp/firebirdposts-ios18-after-remove-favorite.png`), removed the list marker and restored original ordering (`/private/tmp/firebirdposts-ios18-after-back-removal-settled.png`), and that removal persisted through another scoped terminate/relaunch (`/private/tmp/firebirdposts-ios18-after-relaunch-removal-settled.png`). No crash occurred. There is no separate Favorites tab; the implemented/spec-required favorite-first main list was verified directly.

- [x] **IOS-18A — Capture runtime acquisition/cache evidence** *(manual QA evidence)*
  - **Owner:** iOS verification owner.
  - **Prerequisites:** IOS-17 and explicit authorization before resetting app data for a clean run. Development bundle/Metro must be running; this does not run in a release bundle.
  - **Instrumentation boundary:** `src/data/api/jsonPlaceholderClient.ts` logs every actual fetch attempt/success; `src/data/images/fakerImageFactory.ts` logs each real Faker URI generation; `src/data/postsRepository.ts` logs cache hydrate/hit/miss/in-flight joins and only logs `persistence.commit.success` after AsyncStorage resolves. `src/components/RuntimeEvidenceOverlay.tsx` renders the same cumulative counters in a compact, pointer-transparent, DEBUG-only screenshot surface. All console lines use the exact prefix `[FIREBIRD_EVIDENCE]`.
  - **Actions/evidence:** clear only this app's data by uninstalling/reinstalling only after authorization, clear Metro output, launch, and retain the prefixed JSON lines. On clean launch expect one list cache miss, one `GET /posts` attempt/success, 100 `faker.image.generated` events at 32×32, and one durable commit. Open post N once and then again: expect one detail miss, one `GET /posts/N` attempt/success, one 300×300 Faker event, one durable commit, then a detail cache hit. Terminate/relaunch without uninstalling: expect `cache.hydrated` with the stored counts, then list/detail cache hits and no API/Faker event.
  - **Screenshot readout:** `API attempts/successes`; `F 32`/`300` are Faker list/detail calls; `C H`/`M`/`J`/`Y` are cache hits/misses/in-flight joins/hydrations; `P` is successful durable commits. The overlay is never rendered in a release bundle and has `pointerEvents="none"`. In a development JS debugger, `globalThis.__FIREBIRD_RUNTIME_EVIDENCE__.read()` returns the current process ledger; `.reset()` clears only this in-memory evidence ledger and does not clear AsyncStorage or affect application behavior. Process relaunch starts a new process ledger, so retain a screenshot for each phase.
  - **Expected acquisition snapshots:** after the clean list settles: `API 1/1`, `F 32:100 300:0`, `C M:1 J:0 Y:1`, `P 1`. After the first successful detail for N: `API 2/2`, `F 32:100 300:1`, `C M:2 J:0 Y:1`, `P 2`. On same-process revisit and after process restart, API/Faker/miss/commit values must not increase for valid cached records; a repository `C H` increment is informative but is not required when the hydrated Zustand state legitimately bypasses a repository ensure call.
  - **Completion evidence (2026-08-13):** Rebuilt DEBUG overlay and performed an authorized scoped clean reinstall of only the target bundle. Clean-list overlay screenshot `/private/tmp/firebirdposts-ios18-counter-clean-list-settled.png`: `API 1/1`, `F 32:100 300:0`, `C H:0 M:1 J:0 Y:1`, `P 1`. First-detail screenshot `/private/tmp/firebirdposts-ios18-counter-first-detail-settled.png`: `API 2/2`, `F 32:100 300:1`, `C H:0 M:2 J:0 Y:1`, `P 2`. Same-process revisit `/private/tmp/firebirdposts-ios18-counter-detail-revisit.png` retained `API 2/2`, `F 32:100 300:1`, `M:2`, `P:2` with no acquisition/generation/commit increase. After scoped terminate/relaunch, `/private/tmp/firebirdposts-ios18-counter-relaunch-list-settled.png` showed a new ledger `API 0/0`, `F 32:0 300:0`, `M:0 J:0 Y:1`, `P 0`; reopening the cached detail (`/private/tmp/firebirdposts-ios18-counter-relaunch-detail-hit.png`) retained all zero acquisition/generation/commit values. `C H` stayed zero in those latter phases because the restored store already held list/detail records and did not invoke repository `ensure*`; this is a valid cache bypass and directly proves the required absence of redundant remote/Faker work. Existing passing repository/restart automated tests separately cover per-ID in-flight de-duplication and cache call behavior.
  - **Pass condition:** captured overlay evidence proves the stated successful acquisition counts and zero redundant API/Faker/cache-miss/commit activity for valid restored data.

- [x] **IOS-19 — Run automated regression and contract checks** *(automated test)*
  - **Owner:** iOS verification owner.
  - **Prerequisites:** IOS-15; source/test tree unchanged except for the intentional compatibility correction.
  - **Commands/evidence:** run `npm test -- --runInBand`, `npm run lint`, and `npm run typecheck`; retain complete results and confirm the existing call-count/cache tests still prove no re-fetch or FakerJS regeneration for valid persisted records.
  - **Pass condition:** all three commands pass with no test, lint, or type regression caused by the chosen dependency pair.
  - **Stop condition:** record each failed command independently; do not patch native library source or make unrelated product changes to suppress a failure.
  - **Completion evidence (2026-08-13):** `npm test -- --runInBand` exited 0: 16 suites/131 tests passed. `npm run lint` exited 0 with no ESLint findings. `npm run typecheck` exited 0 with no TypeScript findings. Cache/acquisition coverage remains present and passing: `tests/data/postsRepository.test.ts` asserts valid persisted list/detail records issue no API or Faker calls, and `tests/integration/restartPersistence.test.tsx` asserts no API/Faker calls after restoration. No failures to classify; no source, test, configuration, Metro, or app-run-state changes were made for this check.

- [x] **IOS-20 — Assemble compatibility-remediation evidence and handoff** *(evidence)*
  - **Owner:** iOS verification owner.
  - **Prerequisites:** IOS-13 through IOS-19 completed or each incomplete task has its precise stop condition recorded.
  - **Evidence:** compile the upstream support decision, exact manifest/lock resolved pair, npm/Bundler/Pod regeneration output, exact-UDID build/install/launch result, clean-state smoke observations, automated-check output, and each blocker classified as environment, dependency resolution, native build, Metro/network, or product regression.
  - **Pass condition:** the record proves a reproducible compatible dependency install or makes the remaining blocker unambiguous, while distinguishing the native compatibility defect from unrelated application behavior and preserving simulator/workspace state.
  - **Stop condition:** none; hand off incomplete remediation with its exact stage and without an inferred product result.
  - **Completion evidence / handoff (2026-08-13):** The compatibility-only manifest change is exact `react-native-gesture-handler` **2.32.0 → 3.1.0** alongside React Native 0.87.0. `npm install` regenerated `package-lock.json`, resolving `react-native-gesture-handler@3.1.0`; `bundle install` and `bundle exec pod install --project-directory=ios` regenerated the Bundler/Pod artifacts, with `ios/Podfile.lock` recording `RNGestureHandler (3.1.0)`. No dependency source, generated native source, or product behavior was patched.
  - **Native result:** a clean Xcode build installed and launched `org.reactjs.native.example.FirebirdPosts` (scheme `FirebirdPosts`) on the required, immediately reconfirmed booted simulator UDID `3B474FEB-4A78-456A-85EF-AC6B841A0796`, using the existing Metro server on port 8081 with `--no-packager`. The build did not reproduce either `RCTCxxBridge` or missing `RCTBridge.runtime` compiler failure. The instrumented native shell used for IOS-18A had already built successfully; a later extra native-rebuild agent was aborted before starting any build. This satisfies the native-compatibility build/install/launch gate.
  - **Automated result:** `npm test -- --runInBand` passed **16 suites / 131 tests**; `npm run lint` and `npm run typecheck` exited 0. Passing repository and restart-integration tests retain the no-valid-cache API/Faker-call assertions.
  - **IOS-18 status — complete:** subsequent authorized screenshot-guided Simulator QA directly completed list/detail/back navigation, favorite add/remove, favorite-first visual ordering, and persistence after scoped process restarts. The full screenshot matrix and clean acquisition/cache overlay evidence are recorded under IOS-18 and IOS-18A.
  - **Call-count/cache adjudication:** the temporary DEBUG overlay directly captured the clean first list/detail acquisition and zero redundant API/Faker/miss/commit values after revisit/restart. Hydrated Zustand state can validly bypass repository `ensure*`, so a repository-hit counter is not required when visible cached data is restored with zero redundant work; the passing automated suite additionally covers mocked per-ID in-flight deduplication and cache behavior.
  - **Temporary instrumentation cleanup:** the IOS-18A instrumentation was JavaScript-only, used solely for the documented development evidence, and has been removed from shipped source (no `FIREBIRD_EVIDENCE`, runtime-overlay component, or runtime ledger remains). The cleaned source passed the final automated checks above; no temporary instrumentation remains to ship.
  - **Changed/generated inventory:** `package.json`, `package-lock.json`, `Gemfile.lock`, `ios/Podfile.lock`, generated `ios/Pods/`, generated `ios/FirebirdPosts.xcworkspace/`, and this handoff record in `docs/sdd/tasks.md`. The workspace has no Git metadata (`git status --short` reports “not a git repository”), so a Git diff/status inventory is unavailable. IOS-20 is complete under its evidence-handoff pass condition; IOS-18 and IOS-18A are complete with the direct QA and cache evidence recorded above.

## Installer delivery checklist (addendum)

- [x] **INS-01 — Inspect repository contracts and preserve current work**
  - **Owner:** Implementer
  - **Files owned:** no source changes; use `git status --short`, `package.json`, `package-lock.json`, `Gemfile`, `Gemfile.lock`, `ios/Podfile`, and the existing iOS workspace/scheme only for read-only confirmation.
  - **Dependencies:** none.
  - **Work:** Confirm the lockfiles and native project names expected by the specification before writing the installer. Record pre-existing dirty files and do not alter application, Android, lockfile, generated native, Simulator, or Metro state as part of this feature.
  - **Acceptance checks:** the implementation target is limited to new root `install.sh`, its executable mode, and the installer README section; all pre-existing unrelated edits remain intact.

- [x] **INS-02 — Implement the root POSIX installer interface and safe preflight**
  - **Owner:** Implementer
  - **Files owned:** `install.sh` (new; executable mode must be committed).
  - **Dependencies:** INS-01.
  - **Work:** Implement `/bin/sh` with `set -eu`, a concise `install.sh [destination]` usage function, and `-h`/`--help` success handling. Refuse more than one destination with nonzero status. Capture the invocation directory before any `cd`; resolve no-argument destination as `./firebird_test` from that directory and resolve a relative explicit destination against it. Use quoted paths throughout and support ordinary spaces. Before changing the destination, verify Darwin, `git`, `node`, `npm`, `ruby`, `bundle`, `xcode-select`, and `xcodebuild`; compare Node >= 22.11.0 and Ruby >= 2.6.10; require successful `xcode-select -p` and `xcodebuild -version`; give each failure a concise remediation hint. Reject existing files, directories, and symlinks (including dangling symlinks) before clone, validate a writable nearest existing parent, and create only safely validated missing parents.
  - **Acceptance checks:** every preflight/safety error is nonzero, names the missing/invalid condition, makes no clone or destination content change, and uses neither `sudo`, host-tool installation, shell-profile editing, destructive cleanup, nor simulator/Metro commands.

- [x] **INS-03 — Implement locked setup, non-launching build, and failure reporting**
  - **Owner:** Implementer
  - **Files owned:** `install.sh`.
  - **Dependencies:** INS-02.
  - **Work:** Add sequential named stages: clone `https://github.com/ozymand1as/firebird_test.git`; confirm committed `package-lock.json`, `Gemfile`, `Gemfile.lock`, and `ios/Podfile`; run `npm ci`; run `bundle install`; run `bundle exec pod install --project-directory=ios`; then build `FirebirdPosts` from `ios/FirebirdPosts.xcworkspace` with `xcodebuild`, Debug, `iphonesimulator`, and `generic/platform=iOS Simulator`. Preserve each failing command's diagnostics, stop later stages, return nonzero, and report the retained partial destination without deleting it. On success only, print an unmistakable success line, absolute project path, safely quoted `cd` command, exact `npm run start` and `npm run ios` commands, and two-terminal guidance.
  - **Acceptance checks:** dependency commands are lockfile-governed and use Bundler for Pods; build has no `simctl`, `npm run ios`, Metro, app-launch, boot, erase, or selected-device action; interruption/failure never prints the success footer or removes a partial checkout.

- [x] **INS-04 — Add installer-first README guidance**
  - **Owner:** Implementer
  - **Files owned:** `README.md`.
  - **Dependencies:** INS-03.
  - **Work:** Insert a prominent `One-command macOS/iOS installation` section near the beginning, before existing manual setup. State the macOS/iOS focus; required preinstalled Git, Node 22.11.0+, npm, Ruby 2.6.10+, Bundler, Xcode command-line tools/Xcode, and network; and that the installer does not install/upgrade host tools. Include the fixed public HTTPS clone source, exact syntax, default `./firebird_test`, a quoted explicit-destination example, existing-destination refusal, locked installs/pod setup/non-launching build behavior, two-terminal post-install Metro/iOS commands, and partial-destination retry guidance. Retain links or access to all existing manual Android/iOS, quality, limitations, and evidence information.
  - **Acceptance checks:** docs do not claim an unverified build succeeded or that the installer provisions host prerequisites, starts Metro, or launches a Simulator.

- [x] **INS-05 — Run static and interface checks**
  - **Owner:** Tester
  - **Files owned:** no production edits; a validation record only if the repository has an established evidence location.
  - **Dependencies:** INS-03, INS-04.
  - **Verify:** Run `sh -n ./install.sh` and verify `test -x ./install.sh`. Inspect the script for the canonical HTTPS URL, `npm ci`, `bundle install`, `bundle exec pod install --project-directory=ios`, and the required workspace/scheme simulator-compatible `xcodebuild` invocation. Confirm absence of `sudo`, global `pod`, simulator commands, `npm run start`, `npm run ios`, Metro process start, and delete/cleanup behavior. From outside the checkout, verify `--help` exits zero and invalid argument count is nonzero with usage.
  - **Evidence:** retain commands/output and any discrepancy; do not use a running Simulator or modify app state.

- [x] **INS-06 — Run destination and preflight negative validation**
  - **Owner:** Tester
  - **Files owned:** no production edits; temporary directories only.
  - **Dependencies:** INS-05.
  - **Verify:** In a newly created `mktemp -d` directory outside the development checkout, invoke the installer by absolute path against a pre-created nonempty destination holding a sentinel file; assert nonzero exit and byte-for-byte unchanged sentinel. Also cover an existing file or symlink target where practical. Invoke under a deliberately constrained `PATH` (or controlled command shim) to simulate one missing prerequisite; assert a specific nonzero preflight error occurs before target/parent creation. Clean only the temporary validation directory when safe; never clean any checkout or use Simulator controls.
  - **Evidence:** capture exit codes, output, sentinel comparison, and confirmation that the preflight-failure target is absent.

- [x] **INS-07 — Validate a fresh isolated installation and build**
  - **Owner:** Tester
  - **Files owned:** no repository production edits; temporary clone, normal tool caches, and captured logs only.
  - **Dependencies:** INS-06 and host prerequisites/network/disk capacity available.
  - **Verify:** From a newly created `mktemp -d` directory outside this checkout, run the source installer via its absolute path using a unique explicit fresh destination (use a space-containing name when environment capacity permits). Capture full terminal output and exit status. Verify cloned `origin` uses the canonical public HTTPS URL; `node_modules`, Bundler-managed dependencies, `ios/Pods`, and `ios/FirebirdPosts.xcworkspace` exist; retained output proves all locked stages and the non-launching `xcodebuild` completed. In the installed clone run `git status --short` and confirm tracked source and lockfiles are unchanged. Confirm success output contains absolute destination, `npm run start`, `npm run ios`, and two-terminal instructions. Confirm the installer neither starts Metro nor issues any Simulator command.
  - **Evidence:** report either the complete successful transcript/status/postconditions or the exact environmental blocker (network, registry, RubyGems, pod source, Xcode, disk) and failing stage. Do not weaken the requirement or claim success if this end-to-end run cannot complete.

- [x] **INS-08 — Final installer review and handoff**
  - **Owner:** Tester
  - **Files owned:** documentation/evidence record only when appropriate; no application changes.
  - **Dependencies:** INS-07 (or its explicitly documented environment limitation).
  - **Verify:** Review acceptance criteria 1–14 against implementation and validation evidence. Reconfirm repository working tree changes are limited to intended installer/docs/SDD work and that no developer checkout, app installation, Metro process, or Simulator state was changed by the validation flow.
  - **Evidence:** give a concise pass/fail matrix that distinguishes implementation defects from environment limitations and lists the retained partial directory, if any.
