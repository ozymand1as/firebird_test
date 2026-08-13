import {
  DetailPost,
  ListPost,
  PersistedPostsState,
  POSTS_SNAPSHOT_VERSION,
  RemotePost,
} from './post';

/** Error raised when an untrusted payload cannot become a domain value. */
export class PostValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PostValidationError';
  }
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPositiveFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isValidCollectionIndex = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0;

function remotePostFrom(value: unknown): RemotePost | null {
  if (!isRecord(value)) {
    return null;
  }

  const {userId, id, title, body} = value;
  if (
    !isPositiveFiniteNumber(userId) ||
    !isPositiveFiniteNumber(id) ||
    !isNonEmptyString(title) ||
    !isNonEmptyString(body)
  ) {
    return null;
  }

  return {userId, id, title, body};
}

/** Returns true only for a complete, valid remote post. */
export const isRemotePost = (value: unknown): value is RemotePost => remotePostFrom(value) !== null;

/** Parses a single remote post without coercing malformed input. */
export function parseRemotePost(value: unknown): RemotePost {
  const post = remotePostFrom(value);
  if (!post) {
    throw new PostValidationError('Invalid remote post payload.');
  }
  return post;
}

/** Parses a collection and rejects duplicate post IDs. */
export function parseRemotePostCollection(value: unknown): RemotePost[] {
  if (!Array.isArray(value)) {
    throw new PostValidationError('Posts collection must be an array.');
  }

  const ids = new Set<number>();
  return value.map((entry, index) => {
    const post = parseRemotePost(entry);
    if (ids.has(post.id)) {
      throw new PostValidationError(`Posts collection has a duplicate ID at index ${index}.`);
    }
    ids.add(post.id);
    return post;
  });
}

/** Parses a detail response and ensures it belongs to the requested post ID. */
export function parseDetailPost(value: unknown, requestedPostId: number): RemotePost {
  if (!isPositiveFiniteNumber(requestedPostId)) {
    throw new PostValidationError('Requested post ID must be a positive finite number.');
  }

  const post = parseRemotePost(value);
  if (post.id !== requestedPostId) {
    throw new PostValidationError('Detail response ID does not match the requested post ID.');
  }
  return post;
}

function listPostFrom(value: unknown): ListPost | null {
  const remotePost = remotePostFrom(value);
  if (!remotePost || !isRecord(value)) {
    return null;
  }

  if (!isNonEmptyString(value.listImageUri) || !isValidCollectionIndex(value.collectionIndex)) {
    return null;
  }

  return {...remotePost, listImageUri: value.listImageUri, collectionIndex: value.collectionIndex};
}

function detailPostFrom(value: unknown): DetailPost | null {
  const remotePost = remotePostFrom(value);
  if (!remotePost || !isRecord(value) || !isNonEmptyString(value.detailImageUri)) {
    return null;
  }

  return {...remotePost, detailImageUri: value.detailImageUri};
}

/** Returns true only for a valid, complete persisted snapshot. */
export const isPersistedPostsState = (value: unknown): value is PersistedPostsState => {
  try {
    parsePersistedPostsState(value);
    return true;
  } catch {
    return false;
  }
};

/**
 * Parses the whole persisted unit. Invalid snapshots are rejected as a whole so
 * downstream cache users never receive partially valid durable state.
 */
export function parsePersistedPostsState(value: unknown): PersistedPostsState {
  if (!isRecord(value) || value.version !== POSTS_SNAPSHOT_VERSION) {
    throw new PostValidationError('Persisted posts snapshot has an unsupported version or shape.');
  }

  let list: ListPost[] | null;
  if (value.list === null) {
    list = null;
  } else if (Array.isArray(value.list)) {
    const ids = new Set<number>();
    const indexes = new Set<number>();
    list = value.list.map((entry, index) => {
      const post = listPostFrom(entry);
      if (!post) {
        throw new PostValidationError(`Persisted list item at index ${index} is invalid.`);
      }
      if (ids.has(post.id) || indexes.has(post.collectionIndex)) {
        throw new PostValidationError('Persisted list has duplicate IDs or collection indexes.');
      }
      ids.add(post.id);
      indexes.add(post.collectionIndex);
      return post;
    });
  } else {
    throw new PostValidationError('Persisted list must be an array or null.');
  }

  if (!isRecord(value.detailsById)) {
    throw new PostValidationError('Persisted details must be a record.');
  }
  const detailsById: Record<string, DetailPost> = {};
  for (const [key, rawDetail] of Object.entries(value.detailsById)) {
    const detail = detailPostFrom(rawDetail);
    if (!detail || key !== String(detail.id)) {
      throw new PostValidationError('Persisted detail key and post ID must match.');
    }
    detailsById[key] = detail;
  }

  if (!Array.isArray(value.favoriteIds)) {
    throw new PostValidationError('Persisted favorite IDs must be an array.');
  }
  const favoriteIds = value.favoriteIds.map((id, index) => {
    if (!isPositiveFiniteNumber(id)) {
      throw new PostValidationError(`Persisted favorite ID at index ${index} is invalid.`);
    }
    return id;
  });
  if (new Set(favoriteIds).size !== favoriteIds.length) {
    throw new PostValidationError('Persisted favorite IDs must be unique.');
  }

  return {version: POSTS_SNAPSHOT_VERSION, list, detailsById, favoriteIds};
}
