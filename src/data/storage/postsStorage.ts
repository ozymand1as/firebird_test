import AsyncStorage from '@react-native-async-storage/async-storage';

import {PersistedPostsState} from '../../domain/post';
import {parsePersistedPostsState} from '../../domain/postValidation';

export const POSTS_STORAGE_KEY = '@firebird-posts/persisted-posts-state/v1';

export type KeyValueStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export type PostsStorage = {
  read: () => Promise<PersistedPostsState | null>;
  write: (snapshot: PersistedPostsState) => Promise<void>;
};

/** Error raised for local persistence failures that a caller may retry. */
export class PostsStorageError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'PostsStorageError';
  }
}

const defaultStorage: KeyValueStorage = AsyncStorage;

/**
 * Reads and writes the complete versioned snapshot. Invalid serialized values
 * are removed and treated as an empty cache; operational storage failures are
 * surfaced to the caller rather than being mistaken for durable success.
 */
export function createPostsStorage(storage: KeyValueStorage = defaultStorage): PostsStorage {
  return {
    async read(): Promise<PersistedPostsState | null> {
      let serialized: string | null;
      try {
        serialized = await storage.getItem(POSTS_STORAGE_KEY);
      } catch (error) {
        throw new PostsStorageError('Unable to read saved posts.', error);
      }

      if (serialized === null) {
        return null;
      }

      try {
        return parsePersistedPostsState(JSON.parse(serialized));
      } catch {
        try {
          await storage.removeItem(POSTS_STORAGE_KEY);
        } catch (removeError) {
          throw new PostsStorageError('Unable to discard invalid saved posts.', removeError);
        }
        return null;
      }
    },

    async write(snapshot: PersistedPostsState): Promise<void> {
      let serialized: string;
      try {
        // Re-validate caller input so this boundary cannot persist an invalid cache.
        serialized = JSON.stringify(parsePersistedPostsState(snapshot));
      } catch (error) {
        throw new PostsStorageError('Refusing to save an invalid posts snapshot.', error);
      }

      try {
        await storage.setItem(POSTS_STORAGE_KEY, serialized);
      } catch (error) {
        throw new PostsStorageError('Unable to save posts.', error);
      }
    },
  };
}
