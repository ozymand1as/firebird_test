/** A post as returned by the JSONPlaceholder API. */
export type RemotePost = {
  userId: number;
  id: number;
  title: string;
  body: string;
};

/** The collection representation enriched exactly once with its list image. */
export type ListPost = RemotePost & {
  listImageUri: string;
  collectionIndex: number;
};

/** The per-post representation enriched exactly once with its detail image. */
export type DetailPost = RemotePost & {
  detailImageUri: string;
};

export const POSTS_SNAPSHOT_VERSION = 1 as const;

/** The complete unit persisted by the storage gateway. */
export type PersistedPostsState = {
  version: typeof POSTS_SNAPSHOT_VERSION;
  list: ListPost[] | null;
  detailsById: Record<string, DetailPost>;
  favoriteIds: number[];
};

export type RequestStatus = 'idle' | 'loading' | 'success' | 'error';

/** A display-safe, recoverable error owned by a request or persistence operation. */
export type RequestError = {
  message: string;
  cause?: unknown;
};
