import {PostsRepository} from '../../src/data/postsRepository';
import {DetailPost, ListPost, PersistedPostsState, POSTS_SNAPSHOT_VERSION} from '../../src/domain/post';
import {selectFavoriteFirstPosts, selectIsFavorite} from '../../src/state/postSelectors';
import {createPostsStore} from '../../src/state/postsStore';

const list: ListPost[] = [
  {userId: 1, id: 1, title: 'First', body: 'First body', listImageUri: 'list-1', collectionIndex: 0},
  {userId: 1, id: 2, title: 'Second', body: 'Second body', listImageUri: 'list-2', collectionIndex: 1},
  {userId: 1, id: 3, title: 'Third', body: 'Third body', listImageUri: 'list-3', collectionIndex: 2},
];
const detail: DetailPost = {
  userId: 1, id: 2, title: 'Second', body: 'Second body', detailImageUri: 'detail-2',
};

const emptySnapshot = (): PersistedPostsState => ({
  version: POSTS_SNAPSHOT_VERSION, list: null, detailsById: {}, favoriteIds: [],
});
const populatedSnapshot = (): PersistedPostsState => ({
  ...emptySnapshot(), list, detailsById: {'2': detail}, favoriteIds: [2],
});

const createRepository = (initial = emptySnapshot()) => {
  let durable = initial;
  const repository: jest.Mocked<PostsRepository> = {
    hydrate: jest.fn().mockImplementation(async () => durable),
    getSnapshot: jest.fn().mockImplementation(() => durable),
    ensureList: jest.fn().mockImplementation(async () => durable),
    ensureDetail: jest.fn().mockImplementation(async () => durable),
    persist: jest.fn().mockImplementation(async next => {
      durable = next;
      return durable;
    }),
  };
  return {repository, getDurable: () => durable};
};

describe('posts store', () => {
  it('hydrates restored list, details, favorites, and request statuses', async () => {
    const {repository} = createRepository(populatedSnapshot());
    const store = createPostsStore(repository);
    await store.getState().hydrate();

    expect(store.getState()).toMatchObject({
      hydrationStatus: 'ready', listStatus: 'success', list, detailsById: {'2': detail},
      favoriteIds: [2], detailStatusById: {'2': 'success'},
    });
    expect(selectIsFavorite(store.getState(), 2)).toBe(true);
  });

  it('does not acquire list or detail before hydration is ready', async () => {
    const {repository} = createRepository();
    const store = createPostsStore(repository);
    await store.getState().ensureList();
    await store.getState().ensureDetail(1);
    expect(repository.ensureList).not.toHaveBeenCalled();
    expect(repository.ensureDetail).not.toHaveBeenCalled();
  });

  it('de-duplicates hydration and recovers from a hydration failure', async () => {
    const {repository} = createRepository();
    let resolveHydration: ((snapshot: PersistedPostsState) => void) | undefined;
    repository.hydrate.mockImplementationOnce(
      () => new Promise(resolve => { resolveHydration = resolve; }),
    );
    const store = createPostsStore(repository);
    const first = store.getState().hydrate();
    const duplicate = store.getState().hydrate();
    expect(store.getState().hydrationStatus).toBe('hydrating');
    expect(repository.hydrate).toHaveBeenCalledTimes(1);
    resolveHydration?.(emptySnapshot());
    await Promise.all([first, duplicate]);

    const recovering = createPostsStore(repository);
    repository.hydrate.mockRejectedValueOnce(new Error('storage unavailable'));
    await recovering.getState().hydrate();
    expect(recovering.getState().hydrationStatus).toBe('error');
    expect(recovering.getState().hydrationError?.message).toBe('storage unavailable');
    await recovering.getState().hydrate();
    expect(recovering.getState().hydrationStatus).toBe('ready');
  });

  it('transitions list state, prevents duplicate acquisition while loading, and retries errors', async () => {
    const {repository} = createRepository();
    let resolveList: ((snapshot: PersistedPostsState) => void) | undefined;
    repository.ensureList.mockImplementationOnce(
      () => new Promise(resolve => { resolveList = resolve; }),
    );
    const store = createPostsStore(repository);
    await store.getState().hydrate();
    const first = store.getState().ensureList();
    const duplicate = store.getState().ensureList();
    expect(store.getState().listStatus).toBe('loading');
    expect(repository.ensureList).toHaveBeenCalledTimes(1);
    resolveList?.({...emptySnapshot(), list});
    await Promise.all([first, duplicate]);
    expect(store.getState().listStatus).toBe('success');

    store.setState({list: null, listStatus: 'idle'});
    repository.ensureList.mockRejectedValueOnce(new Error('offline'));
    await store.getState().ensureList();
    expect(store.getState().listStatus).toBe('error');
    expect(store.getState().listError?.message).toBe('offline');
    repository.ensureList.mockResolvedValueOnce({...emptySnapshot(), list});
    await store.getState().retryList();
    expect(store.getState().listStatus).toBe('success');
    expect(repository.ensureList).toHaveBeenCalledTimes(3);
  });

  it('does not reacquire a hydrated list and tracks per-ID detail retries', async () => {
    const {repository} = createRepository(populatedSnapshot());
    const store = createPostsStore(repository);
    await store.getState().hydrate();
    await store.getState().ensureList();
    await store.getState().ensureDetail(2);
    expect(repository.ensureList).not.toHaveBeenCalled();
    expect(repository.ensureDetail).not.toHaveBeenCalled();

    store.setState({detailsById: {}, detailStatusById: {}, detailErrorById: {}});
    repository.ensureDetail.mockRejectedValueOnce(new Error('missing post'));
    await store.getState().ensureDetail(3);
    expect(store.getState().detailStatusById['3']).toBe('error');
    expect(store.getState().detailErrorById['3']?.message).toBe('missing post');
    repository.ensureDetail.mockResolvedValueOnce({...emptySnapshot(), detailsById: {'3': detail}});
    await store.getState().retryDetail(3);
    expect(store.getState().detailStatusById['3']).toBe('success');
    expect(repository.ensureDetail).toHaveBeenCalledTimes(2);
  });

  it('de-duplicates concurrent detail loads for the same ID', async () => {
    const {repository} = createRepository();
    let resolveDetail: ((snapshot: PersistedPostsState) => void) | undefined;
    repository.ensureDetail.mockImplementationOnce(
      () => new Promise(resolve => { resolveDetail = resolve; }),
    );
    const store = createPostsStore(repository);
    await store.getState().hydrate();
    const first = store.getState().ensureDetail(2);
    const duplicate = store.getState().ensureDetail(2);
    expect(repository.ensureDetail).toHaveBeenCalledTimes(1);
    expect(store.getState().detailStatusById['2']).toBe('loading');
    resolveDetail?.({...emptySnapshot(), detailsById: {'2': detail}});
    await Promise.all([first, duplicate]);
    expect(store.getState().detailStatusById['2']).toBe('success');
  });

  it('shares immediate favorite state and restores original order after unmarking', async () => {
    const {repository} = createRepository({...emptySnapshot(), list});
    let resolvePersist: (() => void) | undefined;
    repository.persist.mockImplementationOnce(
      next => new Promise(resolve => { resolvePersist = () => resolve(next); }),
    );
    const store = createPostsStore(repository);
    await store.getState().hydrate();
    const add = store.getState().toggleFavorite(2);
    expect(store.getState().favoriteIds).toEqual([2]);
    expect(selectFavoriteFirstPosts(store.getState()).map(post => post.id)).toEqual([2, 1, 3]);
    expect(selectIsFavorite(store.getState(), 2)).toBe(true);
    await Promise.resolve();
    resolvePersist?.();
    await add;
    await store.getState().toggleFavorite(2);
    expect(store.getState().favoriteIds).toEqual([]);
    expect(selectFavoriteFirstPosts(store.getState()).map(post => post.id)).toEqual([1, 2, 3]);
  });

  it('serializes rapid toggles and persists the newest completed favorite choice', async () => {
    const {repository, getDurable} = createRepository({...emptySnapshot(), list});
    const store = createPostsStore(repository);
    await store.getState().hydrate();
    const add = store.getState().toggleFavorite(1);
    const remove = store.getState().toggleFavorite(1);
    await Promise.all([add, remove]);
    expect(repository.persist).toHaveBeenNthCalledWith(1, expect.objectContaining({favoriteIds: [1]}));
    expect(repository.persist).toHaveBeenNthCalledWith(2, expect.objectContaining({favoriteIds: []}));
    expect(store.getState().favoriteIds).toEqual([]);
    expect(getDurable().favoriteIds).toEqual([]);
    expect(store.getState().favoritePersistenceStatus).toBe('success');
  });

  it('keeps the immediate selection and exposes recoverable favorite-persistence failures', async () => {
    const {repository} = createRepository({...emptySnapshot(), list});
    repository.persist.mockRejectedValueOnce(new Error('disk full'));
    const store = createPostsStore(repository);
    await store.getState().hydrate();
    await store.getState().toggleFavorite(1);
    expect(store.getState().favoriteIds).toEqual([1]);
    expect(store.getState().favoritePersistenceStatus).toBe('error');
    expect(store.getState().favoritePersistenceError?.message).toBe('disk full');
    await store.getState().retryFavoritePersistence();
    expect(repository.persist).toHaveBeenLastCalledWith(expect.objectContaining({favoriteIds: [1]}));
    expect(store.getState().favoritePersistenceStatus).toBe('success');
  });
});
