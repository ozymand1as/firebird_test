import {JsonPlaceholderClient} from './api/jsonPlaceholderClient';
import {FakerImageFactory} from './images/fakerImageFactory';
import {PostsStorage} from './storage/postsStorage';
import {
  DetailPost,
  ListPost,
  PersistedPostsState,
  POSTS_SNAPSHOT_VERSION,
} from '../domain/post';

export type PostsRepository = {
  /** Restores the complete durable cache, or an empty cache when none exists. */
  hydrate: () => Promise<PersistedPostsState>;
  /** Returns the latest successfully committed cache held by this repository. */
  getSnapshot: () => PersistedPostsState;
  /** Acquires and commits the collection only when it is absent from cache. */
  ensureList: () => Promise<PersistedPostsState>;
  /** Acquires and commits one detail only when that ID is absent from cache. */
  ensureDetail: (postId: number) => Promise<PersistedPostsState>;
  /** Commits a complete snapshot for state changes such as favorite toggles. */
  persist: (snapshot: PersistedPostsState) => Promise<PersistedPostsState>;
};

export type PostsRepositoryDependencies = {
  api: JsonPlaceholderClient;
  images: FakerImageFactory;
  storage: PostsStorage;
};

/** A recoverable repository-level error, including invalid caller input. */
export class PostsRepositoryError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'PostsRepositoryError';
  }
}

const emptySnapshot = (): PersistedPostsState => ({
  version: POSTS_SNAPSHOT_VERSION,
  list: null,
  detailsById: {},
  favoriteIds: [],
});

/**
 * Snapshot data is copied at the repository boundary. This prevents a screen or
 * store from accidentally mutating what the repository considers durable cache
 * without first completing a storage write.
 */
const cloneSnapshot = (snapshot: PersistedPostsState): PersistedPostsState => ({
  version: POSTS_SNAPSHOT_VERSION,
  list: snapshot.list === null ? null : snapshot.list.map(post => ({...post})),
  detailsById: Object.fromEntries(
    Object.entries(snapshot.detailsById).map(([id, detail]) => [id, {...detail}]),
  ),
  favoriteIds: [...snapshot.favoriteIds],
});

const isPositiveFinitePostId = (postId: number): boolean =>
  Number.isFinite(postId) && postId > 0;

/**
 * Composes the remote API, one-time image enrichment, and complete snapshot
 * persistence. A result becomes cache only after its enclosing snapshot writes
 * successfully; failed work is deliberately left retryable.
 */
export function createPostsRepository({api, images, storage}: PostsRepositoryDependencies): PostsRepository {
  let snapshot = emptySnapshot();
  let listInFlight: Promise<PersistedPostsState> | null = null;
  const detailInFlight = new Map<number, Promise<PersistedPostsState>>();
  let pendingCommit: Promise<void> = Promise.resolve();

  const commit = (update: (current: PersistedPostsState) => PersistedPostsState) => {
    const operation = pendingCommit.then(async () => {
      const durableSnapshot = cloneSnapshot(update(snapshot));
      await storage.write(durableSnapshot);
      snapshot = durableSnapshot;
      return cloneSnapshot(snapshot);
    });

    // A failed persistence operation must not block a later user retry.
    pendingCommit = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  };

  const repository: PostsRepository = {
    async hydrate(): Promise<PersistedPostsState> {
      const restored = await storage.read();
      snapshot = restored === null ? emptySnapshot() : cloneSnapshot(restored);
      return cloneSnapshot(snapshot);
    },

    getSnapshot(): PersistedPostsState {
      return cloneSnapshot(snapshot);
    },

    ensureList(): Promise<PersistedPostsState> {
      if (snapshot.list !== null) {
        return Promise.resolve(cloneSnapshot(snapshot));
      }

      if (listInFlight) {
        return listInFlight;
      }

      const operation = (async (): Promise<PersistedPostsState> => {
        const posts = await api.getPosts();
        const list: ListPost[] = posts.map((post, collectionIndex) => ({
          ...post,
          collectionIndex,
          listImageUri: images.createImageUri({width: 32, height: 32}),
        }));

        return commit(current => ({...current, list}));
      })();

      listInFlight = operation;
      operation.then(
        () => {
          if (listInFlight === operation) {
            listInFlight = null;
          }
        },
        () => {
          if (listInFlight === operation) {
            listInFlight = null;
          }
        },
      );
      return operation;
    },

    ensureDetail(postId: number): Promise<PersistedPostsState> {
      if (!isPositiveFinitePostId(postId)) {
        return Promise.reject(new PostsRepositoryError('Post ID must be a positive finite number.'));
      }

      if (snapshot.detailsById[String(postId)]) {
        return Promise.resolve(cloneSnapshot(snapshot));
      }

      const inFlight = detailInFlight.get(postId);
      if (inFlight) {
        return inFlight;
      }

      const operation = (async (): Promise<PersistedPostsState> => {
        const post = await api.getPost(postId);
        const detail: DetailPost = {
          ...post,
          detailImageUri: images.createImageUri({width: 300, height: 300}),
        };

        return commit(current => ({
          ...current,
          detailsById: {...current.detailsById, [String(postId)]: detail},
        }));
      })();

      detailInFlight.set(postId, operation);
      operation.then(
        () => detailInFlight.delete(postId),
        () => detailInFlight.delete(postId),
      );
      return operation;
    },

    persist(nextSnapshot: PersistedPostsState): Promise<PersistedPostsState> {
      return commit(() => nextSnapshot);
    },
  };

  return repository;
}
