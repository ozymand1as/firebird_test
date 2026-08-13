import {create, type UseBoundStore} from 'zustand';
import type {StoreApi} from 'zustand/vanilla';

import {PostsRepository} from '../data/postsRepository';
import {
  DetailPost,
  ListPost,
  PersistedPostsState,
  POSTS_SNAPSHOT_VERSION,
  RequestError,
  RequestStatus,
} from '../domain/post';

export type HydrationStatus = 'idle' | 'hydrating' | 'ready' | 'error';

export type PostsStoreState = {
  hydrationStatus: HydrationStatus;
  hydrationError: RequestError | null;
  listStatus: RequestStatus;
  listError: RequestError | null;
  detailStatusById: Record<string, RequestStatus>;
  detailErrorById: Record<string, RequestError | undefined>;
  favoritePersistenceStatus: RequestStatus;
  favoritePersistenceError: RequestError | null;
  list: ListPost[] | null;
  detailsById: Record<string, DetailPost>;
  favoriteIds: number[];
  hydrate: () => Promise<void>;
  ensureList: () => Promise<void>;
  retryList: () => Promise<void>;
  ensureDetail: (postId: number) => Promise<void>;
  retryDetail: (postId: number) => Promise<void>;
  toggleFavorite: (postId: number) => Promise<void>;
  retryFavoritePersistence: () => Promise<void>;
};

export type PostsStore = UseBoundStore<StoreApi<PostsStoreState>>;

const emptySnapshot = (): PersistedPostsState => ({
  version: POSTS_SNAPSHOT_VERSION,
  list: null,
  detailsById: {},
  favoriteIds: [],
});

const toRequestError = (error: unknown, fallbackMessage: string): RequestError => ({
  message: error instanceof Error && error.message.trim() !== '' ? error.message : fallbackMessage,
  cause: error,
});

const isPositiveFinitePostId = (postId: number): boolean =>
  Number.isFinite(postId) && postId > 0;

/**
 * Creates the single application store. It intentionally owns request feedback
 * while the repository owns validation, acquisition, enrichment, and durable
 * snapshot writes.
 */
export function createPostsStore(repository: PostsRepository): PostsStore {
  let hydrationInFlight: Promise<void> | null = null;
  let listInFlight: Promise<void> | null = null;
  const detailInFlight = new Map<number, Promise<void>>();
  let favoriteWriteQueue: Promise<void> = Promise.resolve();
  let favoriteWriteRevision = 0;

  return create<PostsStoreState>((set, get) => {
    const publishSnapshot = (snapshot: PersistedPostsState, preserveFavorites: boolean) => {
      set(current => ({
        list: snapshot.list,
        detailsById: snapshot.detailsById,
        favoriteIds: preserveFavorites ? current.favoriteIds : snapshot.favoriteIds,
      }));
    };

    const persistFavoriteIds = (favoriteIds: number[]): Promise<void> => {
      const revision = ++favoriteWriteRevision;
      set({favoritePersistenceStatus: 'loading', favoritePersistenceError: null});

      const operation = favoriteWriteQueue.then(async () => {
        // Build from the latest repository snapshot when this write reaches the
        // queue. This prevents a favorite write from discarding a concurrently
        // acquired list/detail that was persisted just before it.
        const durable = repository.getSnapshot();
        const snapshot = await repository.persist({...durable, favoriteIds});

        if (revision === favoriteWriteRevision) {
          publishSnapshot(snapshot, true);
          set({favoritePersistenceStatus: 'success', favoritePersistenceError: null});
        }
      });

      favoriteWriteQueue = operation.then(
        () => undefined,
        () => undefined,
      );

      return operation.catch(error => {
        if (revision === favoriteWriteRevision) {
          set({
            favoritePersistenceStatus: 'error',
            favoritePersistenceError: toRequestError(error, 'Unable to save favorite changes.'),
          });
        }
      });
    };

    const ensureDetail = (postId: number): Promise<void> => {
      if (get().hydrationStatus !== 'ready') {
        return Promise.resolve();
      }

      if (!isPositiveFinitePostId(postId)) {
        set(current => ({
          detailStatusById: {...current.detailStatusById, [String(postId)]: 'error'},
          detailErrorById: {
            ...current.detailErrorById,
            [String(postId)]: {message: 'Post ID must be a positive finite number.'},
          },
        }));
        return Promise.resolve();
      }

      const key = String(postId);
      if (get().detailsById[key]) {
        set(current => ({
          detailStatusById: {...current.detailStatusById, [key]: 'success'},
          detailErrorById: {...current.detailErrorById, [key]: undefined},
        }));
        return Promise.resolve();
      }

      const existing = detailInFlight.get(postId);
      if (existing) {
        return existing;
      }

      set(current => ({
        detailStatusById: {...current.detailStatusById, [key]: 'loading'},
        detailErrorById: {...current.detailErrorById, [key]: undefined},
      }));

      const operation = repository.ensureDetail(postId).then(
        snapshot => {
          publishSnapshot(snapshot, true);
          set(current => ({
            detailStatusById: {...current.detailStatusById, [key]: 'success'},
            detailErrorById: {...current.detailErrorById, [key]: undefined},
          }));
        },
        error => {
          set(current => ({
            detailStatusById: {...current.detailStatusById, [key]: 'error'},
            detailErrorById: {
              ...current.detailErrorById,
              [key]: toRequestError(error, 'Unable to load this post.'),
            },
          }));
        },
      );

      detailInFlight.set(postId, operation);
      operation.then(
        () => detailInFlight.delete(postId),
        () => detailInFlight.delete(postId),
      );
      return operation;
    };

    return {
      hydrationStatus: 'idle',
      hydrationError: null,
      listStatus: 'idle',
      listError: null,
      detailStatusById: {},
      detailErrorById: {},
      favoritePersistenceStatus: 'idle',
      favoritePersistenceError: null,
      ...emptySnapshot(),

      hydrate: (): Promise<void> => {
        const currentStatus = get().hydrationStatus;
        if (currentStatus === 'ready') {
          return Promise.resolve();
        }
        if (hydrationInFlight) {
          return hydrationInFlight;
        }

        set({hydrationStatus: 'hydrating', hydrationError: null});
        const operation = repository.hydrate().then(
          snapshot => {
            publishSnapshot(snapshot, false);
            set({
              hydrationStatus: 'ready',
              hydrationError: null,
              listStatus: snapshot.list === null ? 'idle' : 'success',
              listError: null,
              detailStatusById: Object.fromEntries(
                Object.keys(snapshot.detailsById).map(id => [id, 'success' as const]),
              ),
              detailErrorById: {},
            });
          },
          error => {
            set({
              hydrationStatus: 'error',
              hydrationError: toRequestError(error, 'Unable to restore saved posts.'),
            });
          },
        );
        hydrationInFlight = operation;
        operation.then(
          () => {
            if (hydrationInFlight === operation) {
              hydrationInFlight = null;
            }
          },
          () => undefined,
        );
        return operation;
      },

      ensureList: (): Promise<void> => {
        if (get().hydrationStatus !== 'ready') {
          return Promise.resolve();
        }
        if (get().list !== null) {
          set({listStatus: 'success', listError: null});
          return Promise.resolve();
        }
        if (listInFlight) {
          return listInFlight;
        }

        set({listStatus: 'loading', listError: null});
        const operation = repository.ensureList().then(
          snapshot => {
            publishSnapshot(snapshot, true);
            set({listStatus: 'success', listError: null});
          },
          error => {
            set({
              listStatus: 'error',
              listError: toRequestError(error, 'Unable to load posts.'),
            });
          },
        );
        listInFlight = operation;
        operation.then(
          () => {
            if (listInFlight === operation) {
              listInFlight = null;
            }
          },
          () => undefined,
        );
        return operation;
      },

      retryList: (): Promise<void> => {
        if (get().hydrationStatus !== 'ready') {
          return Promise.resolve();
        }
        if (listInFlight) {
          return listInFlight;
        }
        set({listStatus: 'idle', listError: null});
        return get().ensureList();
      },

      ensureDetail,

      retryDetail: (postId: number): Promise<void> => {
        const key = String(postId);
        if (detailInFlight.has(postId)) {
          return ensureDetail(postId);
        }
        set(current => ({
          detailStatusById: {...current.detailStatusById, [key]: 'idle'},
          detailErrorById: {...current.detailErrorById, [key]: undefined},
        }));
        return ensureDetail(postId);
      },

      toggleFavorite: (postId: number): Promise<void> => {
        if (!isPositiveFinitePostId(postId)) {
          set({
            favoritePersistenceStatus: 'error',
            favoritePersistenceError: {message: 'Post ID must be a positive finite number.'},
          });
          return Promise.resolve();
        }

        const currentFavoriteIds = get().favoriteIds;
        const nextFavoriteIds = currentFavoriteIds.includes(postId)
          ? currentFavoriteIds.filter(id => id !== postId)
          : [...currentFavoriteIds, postId];
        set({favoriteIds: nextFavoriteIds});
        return persistFavoriteIds(nextFavoriteIds);
      },

      retryFavoritePersistence: (): Promise<void> => persistFavoriteIds([...get().favoriteIds]),
    };
  });
}
