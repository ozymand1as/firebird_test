# Technical Plan: Persistent Posts and Favorites

## 1. Implementation shape

Create a non-Expo React Native CLI application using TypeScript and React Native 0.77.x (or a later compatible non-Expo release). The initial route is `Posts`; a native-stack route named `PostDetail` accepts `{ postId: number }`. The application is deliberately cache-first: app startup hydrates local state before deciding whether the list endpoint is needed, and the detail route reads an ID-specific cache before deciding whether its endpoint is needed.

Use a layered structure so screens do not call `fetch`, Faker, or AsyncStorage directly:

```
App / NavigationContainer
  PostsScreen, PostDetailScreen, reusable presentation components
       -> Zustand post-store (view state + commands)
            -> posts repository (validation, acquisition, enrichment, persistence)
                 -> JSONPlaceholder client / Faker image factory / AsyncStorage gateway
```

The store is the single source of truth for list data, cached details, favorite IDs, request status, and recoverable errors. Screens select state and invoke store commands only. Repository functions are dependency-injected or otherwise constructed from small interfaces so their fetch, image-generation, and persistence behavior can be tested without React Native UI.

## 2. Project scaffold and dependencies

1. Generate the native iOS/Android project with the React Native Community CLI TypeScript template; do not add Expo or web targets. Retain the generated `android/`, `ios/`, Metro, Babel, TypeScript, and native configuration files needed for a standard RN CLI app.
2. Add production dependencies:
   - `@react-navigation/native` and `@react-navigation/native-stack` at v7 or newer, with their documented React Native peer dependencies (`react-native-screens`, `react-native-safe-area-context`, and required gesture support if applicable to the selected v7 setup).
   - `zustand` for mandatory shared application state.
   - `@react-native-async-storage/async-storage` for durable local state.
   - `@faker-js/faker` for generated, persisted image-reference values.
3. Retain/configure the RN Jest preset and add `@testing-library/react-native` plus the necessary navigation/AsyncStorage mocks for component tests. Use TypeScript type checking and the generated lint/test scripts.
4. Define a single documented Node, JDK, Xcode/CocoaPods, and Android SDK prerequisite set in the README. The normal review path must be exactly one install command (`npm install`) and one launch command (`npm run start`); document iOS/Android native bootstrap and run commands separately where platform tooling requires them.

## 3. Files and responsibilities

```
src/
  app/App.tsx                         # providers and hydrated-app gate
  navigation/types.ts                  # typed stack parameter list
  navigation/RootNavigator.tsx         # Posts/PostDetail routes
  domain/post.ts                       # remote, enriched, persisted, and status types
  domain/postValidation.ts             # strict payload and persisted-snapshot validation
  data/api/jsonPlaceholderClient.ts    # GET /posts and GET /posts/:id only
  data/images/fakerImageFactory.ts     # image URL/value creation at supplied dimensions
  data/storage/postsStorage.ts         # AsyncStorage key, parse, validation, read/write
  data/postsRepository.ts              # cache-first acquire/enrich/commit behavior
  state/postsStore.ts                  # Zustand state, hydration and user commands
  state/postSelectors.ts               # stable favorite-first list derivation
  screens/PostsScreen.tsx              # list states and navigation
  screens/PostDetailScreen.tsx         # detail states and favorite action
  components/PostRow.tsx               # 32x32 row and favorite indicator
  components/PostImage.tsx             # image load fallback abstraction
  components/ScreenState.tsx           # loading, error/retry, and empty views
  components/FavoriteButton.tsx        # accessible dynamic favorite control
  theme/                               # small shared colors/spacing/typography
tests/
  data/, state/, screens/, integration/ # behavior-oriented Jest tests
```

Exact folder names may be adjusted to match the generated template, but these responsibility boundaries must remain intact. Keep business types and repository modules independent of screen rendering.

## 4. Data model and durable snapshot

Use explicit types rather than merging unvalidated API responses into state:

```ts
type RemotePost = { userId: number; id: number; title: string; body: string };
type ListPost = RemotePost & { listImageUri: string; collectionIndex: number };
type DetailPost = RemotePost & { detailImageUri: string };
type PersistedPostsState = {
  version: 1;
  list: ListPost[] | null;
  detailsById: Record<string, DetailPost>;
  favoriteIds: number[];
};
```

Store this as one versioned AsyncStorage JSON snapshot under a namespaced key. A single snapshot avoids overwriting detail records when later details are added and keeps a completed favorite change together with the rest of its state. Validate parsed data (shape, finite positive numeric IDs, non-empty text/image strings, unique IDs, valid `collectionIndex`) before treating it as cache. If the complete snapshot is corrupt or incompatible, discard it safely and begin with an empty cache; do not crash. A repository commit writes the updated complete snapshot first, then exposes it as durable cache/state. Storage errors are surfaced as recoverable errors instead of silently claiming persistence succeeded.

`collectionIndex` captures the original successful collection response order and is never recomputed from favorite ordering. The display selector partitions the persisted list into favorite and non-favorite arrays and concatenates them, sorting each partition by `collectionIndex`. This produces favorite-first stable order and restores an unfavorited item to its original relative place.

## 5. Remote acquisition and Faker enrichment

`jsonPlaceholderClient` owns the two URL constructions and checks `response.ok`. It parses JSON and uses domain validation; malformed collections, malformed records, a detail record whose ID differs from the requested ID, and unknown IDs are errors and are never persisted as valid cache.

On list acquisition:

1. After hydration, if a valid persisted list exists, use it and do not call `GET /posts` or Faker.
2. If it is absent, mark list loading, issue one in-flight `GET /posts`, validate the collection, assign original indexes, and call the Faker image factory exactly once per returned post to create its 32x32 list URI/value.
3. Persist the fully enriched list atomically with existing details/favorites, then publish it as loaded. A failure before commit leaves no valid list cache and shows retry; retry is allowed to request and generate again.

On detail acquisition for `postId`:

1. If a valid `detailsById[postId]` exists, display it without fetch or Faker.
2. Otherwise deduplicate concurrent opens/retries by tracking an in-flight promise/request status keyed by ID. Make one `GET /posts/{id}`, validate it, create one independent 300x300 Faker image URI/value, merge only that detail into `detailsById`, and persist the full snapshot before publishing success.
3. Failed or incomplete requests do not write a detail entry; expose a retryable error. A missing/unknown ID has a recoverable error and an available back route.

The image factory returns a deterministic, test-spyable generated URI/reference. Production generation uses FakerJS and receives the required `width` and `height`; list and detail generation are separate calls and persisted separately. The generated reference, not an image binary, is the durable value. No refresh, cache expiry, background request, or regeneration path will be implemented.

## 6. Store, navigation, and persistence semantics

At launch, `hydrate()` reads the snapshot once and sets a hydration state (`hydrating`, `ready`, or recoverable storage error). `App` renders a clear app-loading state until hydration completes so list acquisition cannot race restore. Once ready, `ensureList()` is called by the Posts route and is idempotent while list loading is already in progress.

Store commands include `hydrate`, `ensureList`, `retryList`, `ensureDetail(postId)`, `retryDetail(postId)`, and `toggleFavorite(postId)`. Favorite state is one set/array of post IDs shared by both screens; it is never copied into a detail model. `toggleFavorite` immediately calculates and publishes the next value so visual feedback and list ordering update without a network wait, then serializes snapshot writes. Queue/serialize persistence writes so rapid accepted taps cannot let an older write overwrite a newer favorite choice. If saving a completed toggle fails, show a recoverable persistence error and retain enough state to retry rather than representing an unsaved value as durable.

`PostsScreen` navigates using the exact selected numeric ID. `PostDetailScreen` calls `ensureDetail` for its route ID, and returning uses native-stack back navigation. Because both routes select the same Zustand store, a toggle updates the visible list immediately even if the list screen remains mounted beneath the detail screen.

## 7. UI and accessibility plan

- **Posts screen:** a header and `FlatList` for responsive scrolling. Every row is a pressable with a 32x32 `PostImage`, wrapping title, and a non-color-only favorite mark (for example, a star plus “Favorite” label). Use an intentional full-screen loading view on first acquisition, a retryable error view, and a distinct empty-success view.
- **Detail screen:** native-stack back affordance plus a scrollable body showing a 300x300 bounded/responsive image, title, body, and a `FavoriteButton`. Constrain image width to available screen width while keeping the requested 300x300 size when it fits. Use explicit loading and retryable error/not-found views; preserve a usable back action in errors.
- **Image fallback:** `PostImage` handles `onError` locally to replace a failed remote URI with a stable in-app placeholder (not a newly generated Faker value). Images use accessible labels; a failed image never hides text or controls.
- **Accessible interactions:** post rows have button role and meaningful labels that include title/favorite state. The favorite control has button role, dynamic add/remove label, and `accessibilityState={{ selected: isFavorite }}` (and/or pressed state); its visual icon/label changes with state. Touch targets, text wrapping, and scroll containers prevent long content from obscuring actions.

## 8. Error boundaries and recovery rules

Network, malformed payload, storage read/write, and image-load errors are handled at their owning layer and mapped to stable UI messages. Only a successfully validated, enriched, persisted response counts as acquired; failed attempts remain retryable. Valid cache is always shown without a refresh attempt, including offline relaunch. The implementation must never emit a blank screen for pending, empty, error, or missing-ID states. An optional small root error boundary may prevent an unexpected render failure from terminating the app, but it must not replace specified state handling.

## 9. Automated and manual verification

Use Jest mocks/spies for the API client, AsyncStorage gateway, Faker image factory, and navigation. Tests must prove values and calls rather than relying on screenshots alone.

1. **Repository/domain tests:** valid first list acquisition; one Faker list image per item; absent-cache fetch versus valid-cache no-fetch/no-generation; retry after failure; detail per-ID cache/deduplication; malformed list/detail and mismatched detail ID; corrupt snapshot recovery; merge without loss of prior details; persistence-write error.
2. **Store/selectors tests:** immediate favorite toggle, rapid deterministic toggles, persistence of final result, shared favorite state, favorite-first stable ordering, unfavorite placement, and hydration/restoration of list/details/favorites.
3. **Screen tests:** list loading, error/retry, empty, content, row 32x32 rendering and ID-specific navigation; detail loading, error/not-found/retry, correct 300x300 content, dynamic accessible favorite semantics, and image fallback.
4. **Restart integration test:** create/persist enriched list, a detail, and favorites; recreate repository/store/app state; assert restored content/order and zero API/Faker calls for cached records.
5. **Manual iOS and Android acceptance:** clean install call counts, scrolling, dimensions, long text, detail/back flow, rapid toggles, relaunch persistence, offline cached usage, image fallback, and accessibility labels/state.

## 10. Documentation and delivery evidence

`README.md` will describe the product, architecture, prerequisites, exact two-command normal setup/launch path, iOS/Android platform steps, test/typecheck commands, cache behavior, and known limitations (if any). Add a `docs/ai-evidence/` area containing the user prompt/assignment, agent rules used for the work, and screenshots or exported transcripts of the AI-agent collaboration, then link it from the README. Keep `docs/sdd/specification.md`, this plan, and the implementation task checklist in version control as traceability evidence. Do not claim any acceptance criterion is complete unless implementation and its appropriate tests/manual checks support it.

The repository implementation of this delivery area is linked from [README.md](../../README.md) and indexed in [the AI-work evidence manifest](../ai-evidence/README.md). Missing screenshots/transcripts and unexecuted validation must remain explicitly marked as limitations until the real evidence is added.

## 11. Delivery sequence

1. Generate and verify the RN 0.77+ TypeScript CLI scaffold and dependency/native setup.
2. Add domain types, validation, image factory, API client, storage snapshot gateway, and repository tests.
3. Build Zustand hydration, acquisition, per-ID request de-duplication, favorite persistence queue, and selector tests.
4. Add typed navigation, shared UI primitives, and Posts/Detail screens with all specified states and accessibility.
5. Add component/integration tests, then run lint, type checking, and Jest.
6. Manually verify both native platforms and prepare README plus required AI-work evidence/limitations.

## 12. iOS Simulator bootstrap and acceptance execution

This checkout has JavaScript dependencies present but no `ios/Pods` directory or generated `ios/FirebirdPosts.xcworkspace`. Treat native dependency bootstrap as a prerequisite to the first iOS build. Preserve all existing workspace changes; do not erase simulator content, uninstall the app during restart validation, change the selected device, clean derived data, or modify product/native source merely to bypass a host-tooling restriction.

### 12.1 Preflight and safe environment handling

1. From the repository root, record only read-only baseline evidence: `node --version`, `npm --version`, `bundle --version`, `xcodebuild -version`, `git status --short` when this is a Git worktree, and whether `ios/Pods` plus `ios/FirebirdPosts.xcworkspace` exist. If the workspace is not a Git worktree, record that fact rather than treating it as an application failure.
2. Query the existing simulator without booting, creating, selecting, or deleting any device: `xcrun simctl list devices booted`. Copy the sole `Booted` device's name, runtime, and UDID. If multiple booted devices are reported, stop and ask the reviewer which one is the intended target; do not guess. If none is booted, report the environment mismatch and do not boot a substitute because the contract requires the already-launched simulator.
3. A `simctl` connection error such as inability to contact `CoreSimulatorService` is an execution-environment permission/service limitation, not evidence of an app defect. First retry only from an approved host-capable context. If the restricted sandbox cannot access CoreSimulator, request escalation specifically for the required `xcrun simctl` inspection/build/launch commands; do not work around it by changing simulator state or files.
4. `npm install`/`bundle install` may need registry network access, while CocoaPods may need both RubyGems and pod-spec/source access. Attempt the documented commands normally; if an important command fails because of sandboxed network/filesystem access, rerun it with narrowly scoped escalation and retain the command output as evidence. Do not substitute globally installed CocoaPods for the Gemfile's Bundler-managed version.

### 12.2 Native dependency bootstrap

1. If `node_modules` is absent or the dependency tree is invalid, run `npm install`. If it is already usable, do not delete it; still use the lockfile/documented install command when a reproducible install check is required.
2. Run `bundle install` to install the exact Gemfile-managed CocoaPods bundle. This may create/update the normal Bundler lockfile; preserve it as an intentional dependency-bootstrap artifact and do not overwrite unrelated changes.
3. Run `bundle exec pod install --project-directory=ios`. This generates the Pods directory and Xcode workspace needed by React Native. Capture its result. If it fails, classify the failure as dependency resolution, network access, Xcode/CocoaPods configuration, or sandbox write/access before concluding that the app build failed.
4. Confirm, read-only, that `ios/Pods` and `ios/FirebirdPosts.xcworkspace` now exist. Never delete Pods, the workspace, lockfiles, or derived data as a recovery shortcut.

### 12.3 Build, install, and launch the exact booted device

1. Start one Metro server in a dedicated terminal using `npm run start`, retaining its output and ensuring it owns port 8081. If the port is already occupied, identify the existing Metro owner and use it only if it serves this checkout; do not kill unrelated processes.
2. In another terminal, re-run `xcrun simctl list devices booted` immediately before launch and verify that the recorded UDID is still `Booted`.
3. Build, install, and launch only the declared shared scheme and explicit UDID:

   ```sh
   npm run ios -- --udid <BOOTED_SIMULATOR_UDID> --scheme FirebirdPosts --no-packager
   ```

   `--no-packager` keeps native launch attached to the Metro instance from the prior step. Capture native build output, the selected UDID, and the observed application launch. If device enumeration works but matching the device is ambiguous, the non-mutating fallback is `npm run ios -- --list-devices --scheme FirebirdPosts --no-packager`; it must not cause selection of an unrelated device.
4. Distinguish an Xcode compile/install failure, Metro bundle/connection failure, first-load network failure, and a product behavior failure in the evidence. A launch red screen, build error, or absent CoreSimulator access must not be collapsed into one generic failure.

### 12.4 Focused manual product acceptance

1. For true first-load acceptance, use a reviewer-authorized clean app-data run only when necessary; then observe the loading state, successful posts list, scrollability, titles, and 32 x 32 list images. Network access to JSONPlaceholder is required for this first load.
2. Open a specific visible post and record its ID/title. Observe the detail loading state followed by matching title/body and its 300 x 300 image. The first uncached detail requires network access.
3. Toggle the post favorite once, confirm the control's selected/add-remove semantics update immediately, navigate back, and confirm its row is visibly marked and precedes all non-favorites. Reopen the same detail and confirm favorite state remains selected.
4. Verify restart persistence without clearing data: terminate and relaunch the installed bundle on the exact same UDID:

   ```sh
   xcrun simctl terminate <BOOTED_SIMULATOR_UDID> org.reactjs.native.example.FirebirdPosts
   xcrun simctl launch <BOOTED_SIMULATOR_UDID> org.reactjs.native.example.FirebirdPosts
   ```

   Confirm cached list/detail content, image references, favorite state, and favorite-first ordering reappear. Do not uninstall the application, erase the simulator, or clear application storage between these two commands.

### 12.5 Automated checks and evidence handoff

1. Independently run `npm test -- --runInBand`, `npm run lint`, and `npm run typecheck`. Their output supplies the call-count/cache correctness evidence that manual observation cannot prove.
2. Retain a concise verification record containing: dependency/bootstrap command outputs; simulator name, runtime, and UDID; Metro/native build/install/launch outputs; automated-check results; and observations for list load/scroll, exact detail content, favorite movement, back navigation, and process-restart persistence.
3. If any stage fails, report its precise stage and relevant command output. Record environment/sandbox/CoreSimulator/network blockers separately from source regressions, and leave existing files and simulator state intact for the next investigator.

### 12.6 React Native 0.87 / Gesture Handler clean-build correction

The current resolved `react-native-gesture-handler` 2.32.0 was developed against React Native 0.86 and fails the RN 0.87 new-architecture iOS build on its obsolete `RCTCxxBridge.runtime` use. Treat this as a dependency compatibility defect only: do not alter application behavior, Metro configuration, simulator selection, generated code, `node_modules`, `ios/Pods`, or an Xcode build-product source file to suppress it.

1. **Select and pin the supported release.** The primary correction is the published `react-native-gesture-handler` **3.1.0** release, pinned exactly (no caret/range) in `package.json` and resolved identically in `package-lock.json`. Before committing the manifest change, retain the publisher's release/compatibility evidence that this release supports RN 0.87, and inspect its package contents to confirm the iOS new-architecture module no longer depends on `RCTCxxBridge` or `RCTBridge.runtime`. The application has no direct Gesture Handler API usage, so this is a native dependency replacement, not a planned product/API migration.
2. **First decision point — published-support verification.** If 3.1.0's published compatibility statement or inspected package does not explicitly cover RN 0.87, stop before changing source or locks and select the newest published Gesture Handler release that does. Record its exact version and the supporting upstream evidence. Do not accept a broad peer dependency (`react-native: "*"`) or a general minimum-version table as proof for this known native-API break.
3. **Fallback decision point — no compatible Gesture Handler release.** If no published Gesture Handler version can be evidenced as supporting RN 0.87, do not patch the failing library. Instead align the React Native family as one supported set to **0.86.0** (the version used by Gesture Handler 2.32.0): pin `react-native`, `@react-native/new-app-screen`, and each `@react-native/*` development package currently pinned to 0.87.0 to 0.86.0, retain/pin `react-native-gesture-handler` 2.32.0, regenerate the npm lock, and re-run all checks. This remains within the RN 0.77-or-newer contract. Make this fallback only after documenting why the primary release cannot support 0.87; do not mix arbitrary unrelated dependency upgrades into either option.
4. **Regenerate reproducibly.** From the chosen manifest state, run `npm install` (not a manual lockfile edit), verify with `npm ls react-native react-native-gesture-handler` that one resolved pair matches the committed exact versions, then run `bundle install` and `bundle exec pod install --project-directory=ios`. Commit the resulting normal dependency artifacts (`package-lock.json`, any Bundler lock update, and `ios/Podfile.lock`) only when they resolve the chosen pair. Confirm the generated workspace/Pods reference that same node-module release. If install or pod resolution fails, classify it as registry, Ruby/CocoaPods, or lock-resolution failure; do not edit generated source as recovery.
5. **Clean native verification on the required device.** Keep the existing healthy Metro server on port 8081. Reconfirm that simulator `3B474FEB-4A78-456A-85EF-AC6B841A0796` is the required booted target, then build/install/launch exactly it with `npm run ios -- --udid 3B474FEB-4A78-456A-85EF-AC6B841A0796 --scheme FirebirdPosts --no-packager`. A successful clean build must contain neither the `RCTCxxBridge` nor missing `RCTBridge.runtime` compiler failure. Do not create, boot, erase, or substitute a simulator; a CoreSimulator-service access error remains an environment blocker, not evidence against the dependency correction.
6. **Smoke and regression checks.** On the newly installed app, wait for posts, open one detail, toggle it favorite, return, and confirm its visibly marked row moves ahead of non-favorites. Then run `npm test -- --runInBand`, `npm run lint`, and `npm run typecheck`. Retain output for the selected dependency pair, npm/Pod regeneration, exact UDID build/launch, smoke journey, and automated checks. If build passes but the smoke flow fails, treat it as a separate product regression and stop for diagnosis rather than changing native library sources.

Rollback means restoring only the dependency manifests and generated lock artifacts to their prior committed/resolved pair, reinstalling npm dependencies and Pods, and recording that the attempted published version did not meet the compile or check gate. It never means retaining a hand edit in `node_modules`, Pods, generated React Codegen/autolinking files, or Xcode-derived source.
