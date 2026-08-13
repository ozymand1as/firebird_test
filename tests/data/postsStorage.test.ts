import {
  createPostsStorage,
  KeyValueStorage,
  POSTS_STORAGE_KEY,
  PostsStorageError,
} from '../../src/data/storage/postsStorage';

const snapshot = {
  version: 1 as const,
  list: [
    {
      userId: 1,
      id: 2,
      title: 'Title',
      body: 'Body',
      listImageUri: 'https://example.test/list',
      collectionIndex: 0,
    },
  ],
  detailsById: {},
  favoriteIds: [2],
};

const createMemoryStorage = (getItem: KeyValueStorage['getItem']): KeyValueStorage => ({
  getItem,
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
});

describe('posts storage', () => {
  it('reads a valid versioned snapshot', async () => {
    const storage = createMemoryStorage(jest.fn().mockResolvedValue(JSON.stringify(snapshot)));

    await expect(createPostsStorage(storage).read()).resolves.toEqual(snapshot);
    expect(storage.getItem).toHaveBeenCalledWith(POSTS_STORAGE_KEY);
  });

  it('returns empty cache and discards corrupt or incompatible storage values', async () => {
    const storage = createMemoryStorage(jest.fn().mockResolvedValue('{bad json'));

    await expect(createPostsStorage(storage).read()).resolves.toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith(POSTS_STORAGE_KEY);
  });

  it.each([
    '{bad json',
    JSON.stringify({...snapshot, version: 2}),
    JSON.stringify({...snapshot, favoriteIds: [2, 2]}),
  ])('removes every corrupt or incompatible serialized snapshot', async serialized => {
    const storage = createMemoryStorage(jest.fn().mockResolvedValue(serialized));

    await expect(createPostsStorage(storage).read()).resolves.toBeNull();
    expect(storage.removeItem).toHaveBeenCalledTimes(1);
    expect(storage.removeItem).toHaveBeenCalledWith(POSTS_STORAGE_KEY);
  });

  it('does not remove storage for an absent snapshot', async () => {
    const storage = createMemoryStorage(jest.fn().mockResolvedValue(null));

    await expect(createPostsStorage(storage).read()).resolves.toBeNull();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('writes only a validated complete snapshot under one namespaced key', async () => {
    const storage = createMemoryStorage(jest.fn().mockResolvedValue(null));

    await createPostsStorage(storage).write(snapshot);
    expect(storage.setItem).toHaveBeenCalledWith(POSTS_STORAGE_KEY, JSON.stringify(snapshot));
  });

  it('surfaces storage read and write failures', async () => {
    const readStorage = createMemoryStorage(jest.fn().mockRejectedValue(new Error('read failed')));
    const writeStorage = createMemoryStorage(jest.fn().mockResolvedValue(null));
    writeStorage.setItem = jest.fn().mockRejectedValue(new Error('write failed'));

    await expect(createPostsStorage(readStorage).read()).rejects.toBeInstanceOf(PostsStorageError);
    await expect(createPostsStorage(writeStorage).write(snapshot)).rejects.toBeInstanceOf(
      PostsStorageError,
    );
  });

  it('surfaces an inability to discard corrupt cache data', async () => {
    const storage = createMemoryStorage(jest.fn().mockResolvedValue('{bad json'));
    storage.removeItem = jest.fn().mockRejectedValue(new Error('remove failed'));

    await expect(createPostsStorage(storage).read()).rejects.toBeInstanceOf(PostsStorageError);
  });

  it('refuses invalid snapshots before writing them', async () => {
    const storage = createMemoryStorage(jest.fn().mockResolvedValue(null));
    const invalidSnapshot = {...snapshot, favoriteIds: [2, 2]};

    await expect(createPostsStorage(storage).write(invalidSnapshot)).rejects.toBeInstanceOf(
      PostsStorageError,
    );
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
