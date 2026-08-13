import {create} from 'zustand';
import {act, fireEvent, render, screen} from '@testing-library/react-native';

import {PostsStoreProvider} from '../../src/app/App';
import {ListPost} from '../../src/domain/post';
import {PostsStore, PostsStoreState} from '../../src/state/postsStore';
import {PostsScreen} from '../../src/screens/PostsScreen';

const mockNavigate = jest.fn();

jest.mock('../../src/navigation/RootNavigator', () => ({RootNavigator: () => null}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
}));

const posts: ListPost[] = [
  {userId: 1, id: 1, title: 'First', body: 'First body', listImageUri: 'first', collectionIndex: 0},
  {userId: 1, id: 2, title: 'Second', body: 'Second body', listImageUri: 'second', collectionIndex: 1},
  {userId: 1, id: 3, title: 'Third', body: 'Third body', listImageUri: 'third', collectionIndex: 2},
];

const createTestStore = (overrides: Partial<PostsStoreState> = {}) => {
  const ensureList = jest.fn().mockResolvedValue(undefined);
  const retryList = jest.fn().mockResolvedValue(undefined);
  const store = create<PostsStoreState>(() => ({
    hydrationStatus: 'ready',
    hydrationError: null,
    listStatus: 'idle',
    listError: null,
    detailStatusById: {},
    detailErrorById: {},
    favoritePersistenceStatus: 'idle',
    favoritePersistenceError: null,
    list: null,
    detailsById: {},
    favoriteIds: [],
    hydrate: jest.fn().mockResolvedValue(undefined),
    ensureList,
    retryList,
    ensureDetail: jest.fn().mockResolvedValue(undefined),
    retryDetail: jest.fn().mockResolvedValue(undefined),
    toggleFavorite: jest.fn().mockResolvedValue(undefined),
    retryFavoritePersistence: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }));
  return {store, ensureList, retryList};
};

const renderScreen = (store: PostsStore) =>
  render(
    <PostsStoreProvider store={store}>
      <PostsScreen />
    </PostsStoreProvider>,
  );

describe('PostsScreen', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('keeps a pre-hydration screen loading and does not acquire the list', () => {
    const {store, ensureList} = createTestStore({hydrationStatus: 'hydrating'});
    renderScreen(store);

    expect(screen.getByTestId('screen-state-loading')).toBeTruthy();
    expect(ensureList).not.toHaveBeenCalled();
  });

  it('starts one cache-aware acquisition when hydration is ready with no list', () => {
    const {store, ensureList} = createTestStore();
    renderScreen(store);

    expect(screen.getByTestId('screen-state-loading')).toBeTruthy();
    expect(ensureList).toHaveBeenCalledTimes(1);
  });

  it('renders explicit loading, error/retry, and empty states', () => {
    const loading = createTestStore({listStatus: 'loading'});
    const rendered = renderScreen(loading.store);
    expect(screen.getByText('Loading posts…')).toBeTruthy();
    expect(loading.ensureList).not.toHaveBeenCalled();
    rendered.unmount();

    const errored = createTestStore({
      listStatus: 'error',
      listError: {message: 'Network unavailable'},
    });
    const errorRender = renderScreen(errored.store);
    expect(screen.getByText('Network unavailable')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', {name: 'Try loading posts again'}));
    expect(errored.retryList).toHaveBeenCalledTimes(1);
    errorRender.unmount();

    const empty = createTestStore({list: [], listStatus: 'success'});
    renderScreen(empty.store);
    expect(screen.getByTestId('screen-state-empty')).toBeTruthy();
    expect(screen.getByText('No posts are available.')).toBeTruthy();
    expect(empty.ensureList).not.toHaveBeenCalled();
  });

  it('renders a FlatList in stable favorite-first order and navigates with the exact numeric ID', () => {
    const {store, ensureList} = createTestStore({list: posts, listStatus: 'success', favoriteIds: [3, 2]});
    renderScreen(store);

    const listView = screen.getByTestId('posts-list');
    expect(listView.props.data.map((post: ListPost) => post.id)).toEqual([2, 3, 1]);
    expect(screen.getAllByRole('button').map(row => row.props.testID)).toEqual([
      'post-row-2',
      'post-row-3',
      'post-row-1',
    ]);
    fireEvent.press(screen.getByTestId('post-row-3'));
    expect(mockNavigate).toHaveBeenCalledWith('PostDetail', {postId: 3});
    expect(typeof mockNavigate.mock.calls[0][1].postId).toBe('number');
    expect(ensureList).not.toHaveBeenCalled();
  });

  it('reflects an immediate favorite change in ordering without reacquisition', () => {
    const {store, ensureList} = createTestStore({list: posts, listStatus: 'success'});
    renderScreen(store);
    expect(screen.getByTestId('posts-list').props.data.map((post: ListPost) => post.id)).toEqual([1, 2, 3]);

    act(() => {
      store.setState({favoriteIds: [3]});
    });
    expect(screen.getByTestId('posts-list').props.data.map((post: ListPost) => post.id)).toEqual([3, 1, 2]);
    expect(ensureList).not.toHaveBeenCalled();
  });

  it('does not request again when a valid cached list is remounted', () => {
    const {store, ensureList} = createTestStore({list: posts, listStatus: 'success'});
    const first = renderScreen(store);
    first.unmount();
    renderScreen(store);

    expect(ensureList).not.toHaveBeenCalled();
  });
});
