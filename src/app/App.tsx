import {useEffect, useRef, type ReactNode} from 'react';
import {Button, StatusBar, StyleSheet, Text, View} from 'react-native';
import {createContext, useContext} from 'react';

import {createJsonPlaceholderClient} from '../data/api/jsonPlaceholderClient';
import {createFakerImageFactory} from '../data/images/fakerImageFactory';
import {createPostsRepository} from '../data/postsRepository';
import {createPostsStorage} from '../data/storage/postsStorage';
import {RootNavigator} from '../navigation/RootNavigator';
import {
  createPostsStore,
  type PostsStore,
  type PostsStoreState,
} from '../state/postsStore';

const PostsStoreContext = createContext<PostsStore | null>(null);

/** Creates the production dependency graph once for an application instance. */
export function createApplicationStore(): PostsStore {
  return createPostsStore(
    createPostsRepository({
      api: createJsonPlaceholderClient(),
      images: createFakerImageFactory(),
      storage: createPostsStorage(),
    }),
  );
}

export function PostsStoreProvider({
  children,
  store,
}: {
  children: ReactNode;
  store: PostsStore;
}) {
  return <PostsStoreContext.Provider value={store}>{children}</PostsStoreContext.Provider>;
}

/** Shared screen-facing state hook; screens must use store commands, not gateways. */
export function usePostsStore<T>(selector: (state: PostsStoreState) => T): T {
  const store = useContext(PostsStoreContext);
  if (store === null) {
    throw new Error('usePostsStore must be used inside PostsStoreProvider.');
  }
  return store(selector);
}

export type AppProps = {
  /** Dependency seam for root rendering tests. Production callers omit this. */
  store?: PostsStore;
};

function HydrationGate() {
  const hydrationStatus = usePostsStore(state => state.hydrationStatus);
  const hydrationError = usePostsStore(state => state.hydrationError);
  const hydrate = usePostsStore(state => state.hydrate);

  useEffect(() => {
    if (hydrationStatus === 'idle') {
      hydrate().catch(() => undefined);
    }
  }, [hydrate, hydrationStatus]);

  if (hydrationStatus === 'ready') {
    return <RootNavigator />;
  }

  if (hydrationStatus === 'error') {
    return (
      <View style={styles.state} testID="hydration-error">
        <Text accessibilityRole="alert">{hydrationError?.message ?? 'Unable to restore saved posts.'}</Text>
        <Button title="Try again" onPress={() => hydrate().catch(() => undefined)} />
      </View>
    );
  }

  return (
    <View style={styles.state} testID="hydration-loading">
      <Text accessibilityRole="progressbar">Restoring saved posts…</Text>
    </View>
  );
}

export function App({store}: AppProps) {
  const createdStore = useRef<PostsStore | null>(null);
  if (store === undefined && createdStore.current === null) {
    createdStore.current = createApplicationStore();
  }
  const applicationStore = store ?? createdStore.current;

  if (applicationStore === null) {
    throw new Error('Unable to create the posts store.');
  }

  return (
    <PostsStoreProvider store={applicationStore}>
      <StatusBar barStyle="dark-content" />
      <HydrationGate />
    </PostsStoreProvider>
  );
}

const styles = StyleSheet.create({
  state: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
});
