# Product Specification: Persistent Posts and Favorites

## 1. Product Goal

Deliver a small native React Native application for iOS and Android that lets a user browse JSONPlaceholder posts, inspect an individual post, and mark or unmark it as a favorite. Favorite status must be immediately visible and must move favorite posts to the top of the list. Once acquired or generated, post data, image values, and favorite state must survive application restarts without redundant requests or regeneration.

The result is complete when a reviewer can install the project with one documented command, start it with a second documented command, and verify the same core behavior on both supported platforms.

## 2. Current Project Baseline

- The workspace contains an implemented, non-Expo React Native 0.87.0 application named `FirebirdPosts`, with native iOS and Android projects, TypeScript source, Jest tests, and npm scripts for Metro, platform launch, tests, lint, and type checking.
- The current implementation uses React Navigation 7, Zustand, AsyncStorage, and FakerJS. It includes posts and detail screens, explicit loading/error/empty or not-found states, image fallback, favorite-first ordering, and persisted list/detail/favorite data.
- The iOS project exposes the shared `FirebirdPosts` scheme and targets iOS 15.1 or newer. The checked-out workspace does not currently contain `ios/Pods` or `ios/FirebirdPosts.xcworkspace`, so CocoaPods bootstrap is a prerequisite before the first native build in this checkout.
- JavaScript dependencies are present in the inspected workspace. Node 22.23.2, npm 10.9.8, Xcode 26.4.1, and Bundler 2.4.19 satisfy the declared baseline, but the CocoaPods bundle is not yet locally installed.
- No repository-level `AGENTS.md` or supplied design-reference images are present. Existing source, tests, documentation, and user changes must be preserved while simulator verification is performed.
- The immediate validation target is the already-launched iOS Simulator. From the restricted execution context used to inspect this repository, `simctl` could not connect to `CoreSimulatorService`; this is an environment-access limitation, not evidence that the host simulator is absent or that the application fails.

## 3. Users and Primary Journeys

### 3.1 Browse posts

1. On the first successful use, the user opens the posts screen.
2. The application requests the posts collection from `https://jsonplaceholder.typicode.com/posts` exactly once.
3. Every list item receives one FakerJS-generated image value and displays it at 32 × 32.
4. The user sees each post represented clearly enough to identify and open it; at minimum, the post title and image are visible.
5. Selecting a list item opens the corresponding detail screen.

### 3.2 View a post and change favorite status

1. On the first opening of a post that has no cached detail record, the application requests `https://jsonplaceholder.typicode.com/posts/{id}` once for that post.
2. The detail record receives one FakerJS-generated image value and displays it at 300 × 300 together with the post title and body.
3. A dynamic toggle communicates the current favorite state and lets the user add or remove the post from favorites.
4. The toggle updates immediately after the user acts.
5. Returning to the posts screen shows the same status: a favorite is visually distinguished and placed in the favorite section at the top; an unfavorited post returns to the non-favorite section.

### 3.3 Return later

1. The user closes and reopens the application.
2. Previously stored list data appears without another collection request or another FakerJS generation pass.
3. Previously opened detail records appear without another request or image generation when revisited.
4. Posts previously marked as favorites are already marked, highlighted, and grouped at the top.
5. A detail record that has never been opened may still be fetched once when it is opened for the first time.

### 3.4 Review in the already-launched iOS Simulator

1. The reviewer bootstraps missing iOS native dependencies once, starts Metro, and identifies the simulator that is already booted.
2. The reviewer builds and launches the `FirebirdPosts` scheme on that exact simulator rather than creating or selecting an unrelated device.
3. On a clean application-data run, the reviewer waits for the posts list, scrolls it, opens a specific post, and confirms the expected list and detail content and image presentation.
4. The reviewer toggles that post as a favorite, returns to the list, and confirms that it is visibly marked and moved above all non-favorites.
5. The reviewer opens the same detail again and confirms the favorite state remains selected.
6. The reviewer terminates and relaunches the application without uninstalling it or erasing simulator content, then confirms the cached list, detail, and favorite ordering survive the process restart.
7. Any failure is recorded with the failing stage (bootstrap, native build, Metro connection, first-load network access, or product behavior) so an environment failure is not mistaken for a product regression.

## 4. Functional Requirements

### 4.1 Posts screen

- The initial screen must present the posts collection returned by JSONPlaceholder.
- Each post row must be selectable and navigate to the detail view for that exact post ID.
- Each row must display its stored list image at 32 × 32 and meaningful post text, including the title.
- Favorite rows must have an unambiguous visual treatment beyond position alone, such as an icon, label, or distinct styling.
- All favorite posts must precede all non-favorite posts.
- Within both groups, posts must retain their original collection order. Toggling a favorite changes only the post's group, not the relative order of the other posts.
- The screen must reflect favorite changes made on the detail screen without requiring a network refresh or application restart.

### 4.2 Details screen

- The screen must show the post matching the selected ID, including its title, body, and stored detail image at 300 × 300.
- The screen must provide a clear way to navigate back to the posts list.
- The favorite control must represent both states (“add to favorites” and “remove from favorites”) through dynamic text, iconography, accessibility state, or a combination of these.
- One user action must toggle the state exactly once; repeated actions must alternate predictably between favorite and non-favorite.
- Favorite state is shared with the corresponding list item and is not a separate detail-only value.

### 4.3 One-time acquisition and generation

- The posts collection must be requested only when no valid persisted collection exists.
- A specific post detail must be requested only when no valid persisted detail for that ID exists.
- FakerJS must generate a list-image value once for each post during initial list enrichment.
- FakerJS must generate a detail-image value once for a post during that post's first detail enrichment.
- Navigating, rerendering, toggling favorites, backgrounding, or restarting must not regenerate already stored image values.
- The list image and detail image are independently generated values and may differ.
- Successfully acquired/enriched records must be persisted before they are treated as durable cached data.

### 4.4 Persistence

- Persist the enriched list, any enriched details, and favorite IDs locally.
- Restored favorite IDs must immediately affect list ordering and visual state.
- A favorite toggle must be persisted so that a later process restart restores the latest completed choice.
- Persistence must avoid duplicating posts or losing previously cached detail records as more posts are opened.

### 4.5 Loading, empty, and error behavior

- While first-time list data is being obtained, show an explicit loading state rather than an empty or frozen screen.
- While an uncached detail is being obtained, show an explicit detail loading state and prevent accidental duplicate requests for the same ID.
- A failed request must produce a user-readable error state with a retry action.
- Retry may repeat a failed, incomplete request; the “only once” rule applies to successfully acquired and persisted data.
- An empty successful collection response must show an intentional empty state.
- If a remote image cannot load, the post text, navigation, and favorite control must remain usable and a stable placeholder or fallback must be shown.

## 5. Scope Boundaries

### In scope

- A React Native iOS and Android application built with TypeScript.
- Posts list and post detail navigation.
- JSONPlaceholder integration for the collection and per-post detail.
- FakerJS enrichment at the two required display sizes.
- Favorite toggling, visual distinction, favorite-first ordering, and durable local persistence.
- Loading, empty, image-fallback, and recoverable network-error experiences.
- A state-management library, separation of UI from product logic/state, and automated verification appropriate to the behaviors in this specification.
- A GitHub-ready repository with a README, installation/run instructions, and the AI-work evidence required by the assignment.
- Building and launching the existing `FirebirdPosts` iOS scheme in the simulator that is already booted, followed by focused manual validation of the primary and restart journeys.

### Out of scope

- Creating, editing, deleting, sharing, searching, filtering, or paginating posts.
- User accounts, authentication, cloud synchronization, or favorites shared between devices.
- Backend development or modification of JSONPlaceholder data.
- Background refresh, pull-to-refresh, polling, or automatic cache expiry.
- Expo-based development or a web version.
- Pixel matching to unavailable reference figures or a prescribed design system.
- Storing generated image binaries for guaranteed offline viewing, unless the implementation team chooses to add this without changing required behavior; the required durable value is the generated image reference.
- Changing simulator device models, erasing all simulator content, or modifying product source merely to work around a host toolchain or simulator-service permission problem.

## 6. Constraints and Assumptions

- React Native version must be 0.77 or newer and must not use Expo.
- React Navigation version must be 7 or newer.
- TypeScript and FakerJS are mandatory.
- A state manager is mandatory; component-local state alone does not satisfy the assignment.
- UI, product logic, persistence/state, and remote-data responsibilities must remain cleanly separated. Exact technical architecture belongs in the technical plan, not this product specification.
- JSONPlaceholder post fields are assumed to include numeric `id` and `userId` plus string `title` and `body`.
- The source API is read-only for this product; favorite status is local application state.
- “Requested only once” means once after a successful response has been enriched and durably saved. Failed attempts may be retried, and data that is absent or invalid in local storage may be reacquired so the application can recover.
- A reviewer may clear application storage or reinstall to reproduce true first-launch behavior.
- The app must not depend on a seeded favorite set; on a clean install, no post is favorite until the user marks it.
- Supported device sizes may differ. The 300 × 300 detail image should preserve the requested dimensions when space allows and remain fully viewable on narrow screens without making other content inaccessible.
- Native iOS dependency setup is distinct from the assignment's normal two-command JavaScript setup/Metro path. A fresh checkout may require `bundle install` and CocoaPods installation before `npm run ios` can build the application.
- The simulator verification must target the UDID reported as `Booted`. Application termination/relaunch preserves AsyncStorage; uninstalling the application, erasing the simulator, or clearing application data intentionally resets the persistence scenario.
- Metro uses port 8081 by default. The native launch and Metro commands must use the same port, and only one Metro instance should own that port during the test.
- Network access is required for a true clean first load and first opening of an uncached detail. Relaunch verification of already cached text and favorite data must not depend on a new API request; remote image rendering itself may still depend on the stored URI being reachable.

## 7. Non-Functional Requirements

- **Cross-platform parity:** Core flows and persistence behavior must work on both iOS and Android.
- **Responsiveness:** Favorite feedback and reordered list state must appear immediately from local state, without waiting for a remote operation.
- **Reliability:** Repeated screen mounts and process restarts must not create duplicate data, reset favorites, or change stored image values.
- **Usability:** Loading, empty, error, favorite, and navigation states must be visually understandable without developer knowledge.
- **Accessibility:** Interactive rows and the favorite control must have meaningful accessible labels/roles; the favorite control must expose its selected/pressed state, and visual highlighting must not rely on color alone.
- **List performance:** The full JSONPlaceholder collection must remain scrollable and responsive; rendering should be suitable for a mobile list rather than mounting all rows as one static block.
- **Maintainability:** TypeScript types must cover remote post data and enriched/persisted product data, and business behavior must be testable without relying solely on manual device interaction.
- **Documentation:** README instructions must be sufficient for a reviewer with the documented prerequisites to install in one command and launch in a second command, with any platform-specific prerequisite steps stated separately.

## 8. Edge Cases and Expected Outcomes

- **Rapid repeated favorite taps:** Each accepted tap produces one deterministic toggle; the stored final state matches the displayed final state.
- **Favorite toggle followed by immediate back navigation or process exit:** The latest completed toggle is restored on relaunch.
- **Opening the same detail repeatedly or concurrently:** At most one successful acquisition/enrichment is stored, and all later views reuse it.
- **Favorite ordering with multiple favorites:** Every favorite appears above every non-favorite, while original API order is retained inside each group.
- **Unfavoriting a post:** It moves into its original relative place among non-favorites; other posts do not reorder unexpectedly.
- **API record mismatch or malformed payload:** Invalid data must not be committed as a valid cache; show a recoverable error instead of crashing.
- **Unknown/missing post ID:** Show a recoverable not-found/error experience and allow returning to the list.
- **Corrupt or incompatible local data:** Recover safely by discarding only unusable cached state and reacquiring required remote data; do not crash on launch.
- **Network unavailable with valid cache:** Previously persisted text data, detail data, and favorite state remain usable without a refresh request.
- **Network unavailable without required cache:** Show the applicable error and retry path.
- **Image failure:** Show a placeholder while preserving text, favorite actions, and navigation.
- **Long titles or bodies:** Content wraps or scrolls and does not overlap the favorite control or navigation.

## 9. Acceptance Criteria

1. On a clean install, opening the app produces one successful `GET /posts`, enriches every returned list post once with a FakerJS image value, and shows the posts screen.
2. Every visible row shows a 32 × 32 image and title and opens the correct post detail.
3. First opening post `N` produces one successful `GET /posts/N`, generates one detail image value, and shows that image at 300 × 300 with the correct title and body.
4. Returning to post `N` in the same session or after a restart performs no further successful detail acquisition or FakerJS generation for `N`, and its stored image value is unchanged.
5. Marking post `N` favorite changes the detail control immediately; after returning, its list row is visibly marked and appears above all non-favorites.
6. Unmarking post `N` removes the mark and returns it to its original relative position among non-favorites.
7. With several favorites, favorite and non-favorite groups each retain original collection order.
8. After a full application process restart, the list loads from persistence, existing details reuse persistence, image values remain stable, and all latest favorite states and ordering are restored without redundant successful API requests.
9. First-load, first-detail, empty-response, request-failure, and image-failure states behave as defined and never produce an unusable blank screen or crash.
10. Core behavior is demonstrable on both iOS and Android using a non-Expo React Native project at the required dependency versions.
11. The repository includes a README that identifies prerequisites and provides one installation command and one launch command, plus the requested AI prompts/rules and chat screenshots or exports.
12. On the already-booted iOS Simulator, the `FirebirdPosts` scheme builds and launches; the reviewer can complete list, detail, favorite, back-navigation, process-termination, and relaunch checks without a crash or loss of persisted product state.

## 10. Verification Expectations

- Automated tests must cover favorite toggling, favorite-first stable ordering, shared list/detail favorite state, cache restoration, and the decision not to fetch or regenerate when valid persisted data exists.
- Data-layer tests must cover first successful acquisition, retry after failure, per-ID detail caching, persistence updates, malformed remote data, and corrupt persisted data.
- UI tests must cover list loading/error/empty/content states, detail loading/error/content states, navigation with the correct ID, dynamic favorite semantics, and image fallback behavior.
- A restart-oriented integration test must seed or create cached data and favorites, recreate application state, and verify restoration without a network call or FakerJS regeneration.
- Manual acceptance on both platforms must confirm scrolling, 32 × 32 and 300 × 300 image presentation, long-content layout, back navigation, rapid toggles, restart persistence, accessibility labels/state, and the two-command README path.
- Request spying/mocking and deterministic FakerJS spying/mocking should be used to prove call counts and stable generated values; visual inspection alone is insufficient for the one-time rules.

### 10.1 Likely command workflow for the booted iOS Simulator

Run commands from the repository root. The native bootstrap commands are required for this inspected checkout because `ios/Pods` and the generated workspace are absent:

```sh
npm install
bundle install
bundle exec pod install --project-directory=ios
```

Start Metro and leave it running:

```sh
npm run start
```

In another terminal, identify the already-booted simulator, copy its UDID, and target it explicitly:

```sh
xcrun simctl list devices booted
npm run ios -- --udid <BOOTED_SIMULATOR_UDID> --scheme FirebirdPosts --no-packager
```

If device discovery succeeds but the UDID is unclear, the repository's installed React Native CLI also supports an interactive list:

```sh
npm run ios -- --list-devices --scheme FirebirdPosts --no-packager
```

After completing the first list/detail/favorite journey, verify persistence by terminating and relaunching the application without uninstalling it. Replace the placeholder with the same booted simulator UDID:

```sh
xcrun simctl terminate <BOOTED_SIMULATOR_UDID> org.reactjs.native.example.FirebirdPosts
xcrun simctl launch <BOOTED_SIMULATOR_UDID> org.reactjs.native.example.FirebirdPosts
```

Run automated checks independently of manual simulator acceptance:

```sh
npm test -- --runInBand
npm run lint
npm run typecheck
```

Expected evidence consists of successful command output, the exact simulator name/UDID and iOS runtime, application launch without a red error screen, and observations for list load/scroll, correct detail, favorite movement, back navigation, and persistence after process relaunch. A clean-install call-count guarantee is established by automated spies; simulator observation supplements but does not replace those assertions.

### 10.2 Clean rebuild compatibility defect

A clean iOS rebuild currently stops while compiling `RNGestureHandlerModule.mm`: `react-native-gesture-handler` 2.32.0 uses the legacy `RCTCxxBridge` type and its `runtime` property in the new-architecture path, but the installed React Native 0.87.0 prebuilt core does not expose that API. The local package metadata also shows that gesture-handler 2.32.0 is developed against React Native 0.86.0. This is a native dependency compatibility defect, not a Metro, simulator-discovery, or application-state failure; Metro PID 88803 is healthy, and only the app on simulator `3B474FEB-4A78-456A-85EF-AC6B841A0796` was uninstalled.

The minimal acceptable correction is to select and lock a published `react-native-gesture-handler` release that explicitly supports the repository's React Native 0.87 line, then regenerate the iOS dependency lock/install from those manifests. If no such release is available, the acceptable fallback is to align React Native to a gesture-handler-supported version that still satisfies the assignment's React Native 0.77-or-newer constraint. Editing generated Pods or `node_modules` source is not an acceptable durable fix, and product behavior must remain unchanged.

The defect is resolved when all of the following are true:

- A fresh JavaScript dependency install and CocoaPods install reproduce the committed compatible versions without manual source edits.
- A clean build of the `FirebirdPosts` scheme for simulator `3B474FEB-4A78-456A-85EF-AC6B841A0796` compiles gesture-handler without `RCTCxxBridge` or missing `RCTBridge.runtime` errors and launches against the existing Metro server.
- The launched clean-install app reaches the posts experience, can open a detail, toggle a favorite, and return to the correctly reordered list.
- The existing automated test, lint, and type-check suites remain successful; unrelated dependency upgrades or product changes are not required for this correction.

## 11. Delivery Evidence

The final GitHub repository must include or clearly link to:

- Source code and automated tests.
- README setup, installation, and launch instructions.
- The prompts and agent rules used to generate the solution.
- Screenshots or exported transcripts of the AI-agent/AI-chat work.
- Any known limitations that prevent an acceptance criterion from being met.

Repository traceability for these deliverables is maintained in [the root README](../../README.md) and [the AI-work evidence manifest](../ai-evidence/README.md). The manifest distinguishes present artifacts from delivery gaps; it must not be read as proof that pending validation or missing chat evidence is complete.
