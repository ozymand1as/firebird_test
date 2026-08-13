import {JsonPlaceholderClient} from '../../src/data/api/jsonPlaceholderClient';
import {FakerImageFactory} from '../../src/data/images/fakerImageFactory';
import {
  createPostsRepository,
  PostsRepositoryError,
} from '../../src/data/postsRepository';
import {PostsStorage} from '../../src/data/storage/postsStorage';
import {PersistedPostsState, POSTS_SNAPSHOT_VERSION, RemotePost} from '../../src/domain/post';

const firstPost: RemotePost = {userId: 1, id: 1, title: 'First', body: 'First body'};
const secondPost: RemotePost = {userId: 2, id: 2, title: 'Second', body: 'Second body'};

const emptySnapshot = (): PersistedPostsState => ({
  version: POSTS_SNAPSHOT_VERSION,
  list: null,
  detailsById: {},
  favoriteIds: [],
});

const createDependencies = (initialSnapshot: PersistedPostsState | null = null) => {
  const api: jest.Mocked<JsonPlaceholderClient> = {
    getPosts: jest.fn().mockResolvedValue([firstPost, secondPost]),
    getPost: jest.fn().mockImplementation(async postId =>
      postId === 1 ? firstPost : secondPost,
    ),
  };
  const images: jest.Mocked<FakerImageFactory> = {
    createImageUri: jest
      .fn()
      .mockImplementation(({width, height}) => `https://images.test/${width}x${height}`),
  };
  const storage: jest.Mocked<PostsStorage> = {
    read: jest.fn().mockResolvedValue(initialSnapshot),
    write: jest.fn().mockResolvedValue(undefined),
  };

  return {api, images, storage};
};

describe('posts repository', () => {
  it('hydrates an empty snapshot when storage has no cache', async () => {
    const dependencies = createDependencies();
    const repository = createPostsRepository(dependencies);

    await expect(repository.hydrate()).resolves.toEqual(emptySnapshot());
    expect(dependencies.storage.read).toHaveBeenCalledTimes(1);
  });

  it('acquires a missing list, enriches each item once, and commits the complete snapshot', async () => {
    const dependencies = createDependencies();
    const repository = createPostsRepository(dependencies);
    await repository.hydrate();

    const result = await repository.ensureList();

    expect(dependencies.api.getPosts).toHaveBeenCalledTimes(1);
    expect(dependencies.images.createImageUri).toHaveBeenCalledTimes(2);
    expect(dependencies.images.createImageUri).toHaveBeenNthCalledWith(1, {width: 32, height: 32});
    expect(dependencies.images.createImageUri).toHaveBeenNthCalledWith(2, {width: 32, height: 32});
    expect(result.list).toEqual([
      {...firstPost, collectionIndex: 0, listImageUri: 'https://images.test/32x32'},
      {...secondPost, collectionIndex: 1, listImageUri: 'https://images.test/32x32'},
    ]);
    expect(dependencies.storage.write).toHaveBeenCalledWith(result);
  });

  it('uses valid persisted list data without API or Faker calls', async () => {
    const cached = {
      ...emptySnapshot(),
      list: [{...firstPost, collectionIndex: 0, listImageUri: 'cached-list'}],
      favoriteIds: [1],
    };
    const dependencies = createDependencies(cached);
    const repository = createPostsRepository(dependencies);
    await repository.hydrate();

    await expect(repository.ensureList()).resolves.toEqual(cached);
    expect(dependencies.api.getPosts).not.toHaveBeenCalled();
    expect(dependencies.images.createImageUri).not.toHaveBeenCalled();
    expect(dependencies.storage.write).not.toHaveBeenCalled();
  });

  it('restores all valid cached records unchanged and never reacquires them', async () => {
    const cached = {
      ...emptySnapshot(),
      list: [{...firstPost, collectionIndex: 0, listImageUri: 'cached-list-image'}],
      detailsById: {'1': {...firstPost, detailImageUri: 'cached-detail-image'}},
      favoriteIds: [1],
    };
    const dependencies = createDependencies(cached);
    const repository = createPostsRepository(dependencies);

    await expect(repository.hydrate()).resolves.toEqual(cached);
    await expect(repository.ensureList()).resolves.toEqual(cached);
    await expect(repository.ensureDetail(1)).resolves.toEqual(cached);

    expect(dependencies.api.getPosts).not.toHaveBeenCalled();
    expect(dependencies.api.getPost).not.toHaveBeenCalled();
    expect(dependencies.images.createImageUri).not.toHaveBeenCalled();
    expect(dependencies.storage.write).not.toHaveBeenCalled();
  });

  it('de-duplicates concurrent list acquisition', async () => {
    const dependencies = createDependencies();
    let resolvePosts: ((posts: RemotePost[]) => void) | undefined;
    dependencies.api.getPosts.mockImplementation(
      () =>
        new Promise(resolve => {
          resolvePosts = resolve;
        }),
    );
    const repository = createPostsRepository(dependencies);
    await repository.hydrate();

    const first = repository.ensureList();
    const second = repository.ensureList();
    expect(dependencies.api.getPosts).toHaveBeenCalledTimes(1);

    resolvePosts?.([firstPost, secondPost]);
    await expect(Promise.all([first, second])).resolves.toEqual([
      expect.objectContaining({list: expect.any(Array)}),
      expect.objectContaining({list: expect.any(Array)}),
    ]);
    expect(dependencies.images.createImageUri).toHaveBeenCalledTimes(2);
    expect(dependencies.storage.write).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed list request, allowing a later retry', async () => {
    const dependencies = createDependencies();
    dependencies.api.getPosts.mockRejectedValueOnce(new Error('offline'));
    const repository = createPostsRepository(dependencies);
    await repository.hydrate();

    await expect(repository.ensureList()).rejects.toThrow('offline');
    expect(repository.getSnapshot().list).toBeNull();
    expect(dependencies.storage.write).not.toHaveBeenCalled();

    await repository.ensureList();
    expect(dependencies.api.getPosts).toHaveBeenCalledTimes(2);
    expect(dependencies.images.createImageUri).toHaveBeenCalledTimes(2);
  });

  it('does not generate or persist a malformed-list error from the API boundary and allows retry', async () => {
    const dependencies = createDependencies();
    dependencies.api.getPosts.mockRejectedValueOnce(new Error('invalid remote collection'));
    const repository = createPostsRepository(dependencies);
    await repository.hydrate();

    await expect(repository.ensureList()).rejects.toThrow('invalid remote collection');
    expect(repository.getSnapshot()).toEqual(emptySnapshot());
    expect(dependencies.images.createImageUri).not.toHaveBeenCalled();
    expect(dependencies.storage.write).not.toHaveBeenCalled();

    await repository.ensureList();
    expect(dependencies.api.getPosts).toHaveBeenCalledTimes(2);
    expect(dependencies.images.createImageUri).toHaveBeenCalledTimes(2);
  });

  it('does not publish a list or treat it as cached when its persistence write fails', async () => {
    const dependencies = createDependencies();
    dependencies.storage.write.mockRejectedValueOnce(new Error('disk full'));
    const repository = createPostsRepository(dependencies);
    await repository.hydrate();

    await expect(repository.ensureList()).rejects.toThrow('disk full');
    expect(repository.getSnapshot().list).toBeNull();

    await repository.ensureList();
    expect(dependencies.api.getPosts).toHaveBeenCalledTimes(2);
    expect(dependencies.images.createImageUri).toHaveBeenCalledTimes(4);
    expect(dependencies.storage.write).toHaveBeenCalledTimes(2);
  });

  it('acquires one detail image independently and bypasses valid per-ID cache', async () => {
    const dependencies = createDependencies();
    const repository = createPostsRepository(dependencies);
    await repository.hydrate();

    const first = await repository.ensureDetail(1);
    const second = await repository.ensureDetail(1);

    expect(first.detailsById['1']).toEqual({...firstPost, detailImageUri: 'https://images.test/300x300'});
    expect(second).toEqual(first);
    expect(dependencies.api.getPost).toHaveBeenCalledTimes(1);
    expect(dependencies.images.createImageUri).toHaveBeenCalledTimes(1);
    expect(dependencies.images.createImageUri).toHaveBeenCalledWith({width: 300, height: 300});
  });

  it('de-duplicates concurrent detail acquisition for the same ID', async () => {
    const dependencies = createDependencies();
    let resolvePost: ((post: RemotePost) => void) | undefined;
    dependencies.api.getPost.mockImplementation(
      () =>
        new Promise(resolve => {
          resolvePost = resolve;
        }),
    );
    const repository = createPostsRepository(dependencies);
    await repository.hydrate();

    const first = repository.ensureDetail(1);
    const second = repository.ensureDetail(1);
    expect(dependencies.api.getPost).toHaveBeenCalledTimes(1);

    resolvePost?.(firstPost);
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(dependencies.images.createImageUri).toHaveBeenCalledTimes(1);
  });

  it('serializes concurrent acquisitions for different IDs without losing either detail', async () => {
    const dependencies = createDependencies();
    const resolvers = new Map<number, (post: RemotePost) => void>();
    dependencies.api.getPost.mockImplementation(
      postId =>
        new Promise(resolve => {
          resolvers.set(postId, resolve);
        }),
    );
    const repository = createPostsRepository(dependencies);
    await repository.hydrate();

    const first = repository.ensureDetail(1);
    const second = repository.ensureDetail(2);
    resolvers.get(1)?.(firstPost);
    resolvers.get(2)?.(secondPost);
    const [, result] = await Promise.all([first, second]);

    expect(dependencies.api.getPost).toHaveBeenCalledTimes(2);
    expect(dependencies.images.createImageUri).toHaveBeenCalledTimes(2);
    expect(result.detailsById).toEqual({
      '1': {...firstPost, detailImageUri: 'https://images.test/300x300'},
      '2': {...secondPost, detailImageUri: 'https://images.test/300x300'},
    });
    expect(repository.getSnapshot().detailsById).toEqual(result.detailsById);
  });

  it('merges later details with existing details, list data, and favorites', async () => {
    const cached = {
      ...emptySnapshot(),
      list: [{...firstPost, collectionIndex: 0, listImageUri: 'cached-list'}],
      detailsById: {'1': {...firstPost, detailImageUri: 'cached-detail'}},
      favoriteIds: [1],
    };
    const dependencies = createDependencies(cached);
    const repository = createPostsRepository(dependencies);
    await repository.hydrate();

    const result = await repository.ensureDetail(2);

    expect(result.list).toEqual(cached.list);
    expect(result.favoriteIds).toEqual([1]);
    expect(result.detailsById).toEqual({
      '1': cached.detailsById['1'],
      '2': {...secondPost, detailImageUri: 'https://images.test/300x300'},
    });
  });

  it('does not publish partial acquisition when persistence fails', async () => {
    const dependencies = createDependencies();
    dependencies.storage.write.mockRejectedValueOnce(new Error('disk full'));
    const repository = createPostsRepository(dependencies);
    await repository.hydrate();

    await expect(repository.ensureDetail(1)).rejects.toThrow('disk full');
    expect(repository.getSnapshot().detailsById).toEqual({});

    await repository.ensureDetail(1);
    expect(dependencies.api.getPost).toHaveBeenCalledTimes(2);
    expect(dependencies.images.createImageUri).toHaveBeenCalledTimes(2);
  });

  it('does not generate or persist a rejected malformed detail and permits retry', async () => {
    const dependencies = createDependencies();
    dependencies.api.getPost.mockRejectedValueOnce(new Error('detail ID mismatch'));
    const repository = createPostsRepository(dependencies);
    await repository.hydrate();

    await expect(repository.ensureDetail(1)).rejects.toThrow('detail ID mismatch');
    expect(repository.getSnapshot().detailsById).toEqual({});
    expect(dependencies.images.createImageUri).not.toHaveBeenCalled();
    expect(dependencies.storage.write).not.toHaveBeenCalled();

    await repository.ensureDetail(1);
    expect(dependencies.api.getPost).toHaveBeenCalledTimes(2);
    expect(dependencies.images.createImageUri).toHaveBeenCalledTimes(1);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid requested ID %p before acquisition',
    async postId => {
    const dependencies = createDependencies();
    const repository = createPostsRepository(dependencies);

    await expect(repository.ensureDetail(postId)).rejects.toBeInstanceOf(PostsRepositoryError);
    expect(dependencies.api.getPost).not.toHaveBeenCalled();
    },
  );

  it('persists an explicit complete snapshot and publishes it only after successful write', async () => {
    const dependencies = createDependencies();
    const repository = createPostsRepository(dependencies);
    await repository.hydrate();
    const next = {...emptySnapshot(), favoriteIds: [2]};

    await expect(repository.persist(next)).resolves.toEqual(next);
    expect(repository.getSnapshot()).toEqual(next);
    expect(dependencies.storage.write).toHaveBeenCalledWith(next);
  });

  it('returns defensive snapshots so unpersisted caller mutations cannot alter cache', async () => {
    const dependencies = createDependencies();
    const repository = createPostsRepository(dependencies);
    await repository.hydrate();
    const committed = await repository.ensureList();

    committed.list?.[0] && (committed.list[0].title = 'Mutated outside repository');
    committed.favoriteIds.push(999);

    expect(repository.getSnapshot().list?.[0].title).toBe('First');
    expect(repository.getSnapshot().favoriteIds).toEqual([]);
  });
});
