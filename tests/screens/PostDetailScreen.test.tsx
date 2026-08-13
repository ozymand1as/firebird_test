import {create} from 'zustand';
import {act, fireEvent, render, screen} from '@testing-library/react-native';

import {PostsStoreProvider} from '../../src/app/App';
import {DetailPost} from '../../src/domain/post';
import {PostDetailScreen} from '../../src/screens/PostDetailScreen';
import {PostsStore, PostsStoreState} from '../../src/state/postsStore';

const mockGoBack = jest.fn();
const route = {params: {postId: 7}};

jest.mock('../../src/navigation/RootNavigator', () => ({RootNavigator: () => null}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({goBack: mockGoBack}),
  useRoute: () => route,
}));

const detail: DetailPost = {
  userId: 1,
  id: 7,
  title: 'A detailed post',
  body: 'The complete post body.',
  detailImageUri: 'https://example.test/detail.png',
};

const createTestStore = (overrides: Partial<PostsStoreState> = {}) => {
  const ensureDetail = jest.fn().mockResolvedValue(undefined);
  const retryDetail = jest.fn().mockResolvedValue(undefined);
  const toggleFavorite = jest.fn().mockResolvedValue(undefined);
  const store = create<PostsStoreState>(() => ({
    hydrationStatus: 'ready',
    hydrationError: null,
    listStatus: 'success',
    listError: null,
    detailStatusById: {},
    detailErrorById: {},
    favoritePersistenceStatus: 'idle',
    favoritePersistenceError: null,
    list: [],
    detailsById: {},
    favoriteIds: [],
    hydrate: jest.fn().mockResolvedValue(undefined),
    ensureList: jest.fn().mockResolvedValue(undefined),
    retryList: jest.fn().mockResolvedValue(undefined),
    ensureDetail,
    retryDetail,
    toggleFavorite,
    retryFavoritePersistence: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }));
  return {ensureDetail, retryDetail, store, toggleFavorite};
};

const renderScreen = (store: PostsStore) =>
  render(
    <PostsStoreProvider store={store}>
      <PostDetailScreen />
    </PostsStoreProvider>,
  );

describe('PostDetailScreen', () => {
  beforeEach(() => {
    mockGoBack.mockClear();
    route.params.postId = 7;
  });

  it('acquires only the typed route ID when that detail is not cached', () => {
    const {ensureDetail, store} = createTestStore();
    renderScreen(store);

    expect(screen.getByText('Loading post…')).toBeTruthy();
    expect(ensureDetail).toHaveBeenCalledTimes(1);
    expect(ensureDetail).toHaveBeenCalledWith(7);
  });

  it('keeps the screen loading before hydration and does not acquire a detail', () => {
    const {ensureDetail, store} = createTestStore({hydrationStatus: 'hydrating'});
    renderScreen(store);

    expect(screen.getByText('Loading post…')).toBeTruthy();
    expect(ensureDetail).not.toHaveBeenCalled();
  });

  it('renders cached content at 300x300 without acquisition and exposes back/favorite actions', () => {
    const {ensureDetail, store, toggleFavorite} = createTestStore({
      detailsById: {'7': detail},
      detailStatusById: {'7': 'success'},
    });
    renderScreen(store);

    expect(screen.getByText(detail.title)).toBeTruthy();
    expect(screen.getByText(detail.body)).toBeTruthy();
    expect(screen.getByTestId('post-detail-image').props.style).toMatchObject({width: 300, height: 300});
    expect(ensureDetail).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', {name: 'Back to posts'}));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByRole('button', {name: 'Add to favorites'}));
    expect(toggleFavorite).toHaveBeenCalledWith(7);
  });

  it('keeps title, favorite actions, and back navigation usable after image fallback', () => {
    const {store, toggleFavorite} = createTestStore({
      detailsById: {'7': detail},
      detailStatusById: {'7': 'success'},
    });
    renderScreen(store);

    fireEvent(screen.getByTestId('post-detail-image'), 'error');
    expect(screen.getByTestId('post-detail-image-fallback')).toBeTruthy();
    expect(screen.getByText(detail.title)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', {name: 'Add to favorites'}));
    expect(toggleFavorite).toHaveBeenCalledWith(7);
    fireEvent.press(screen.getByRole('button', {name: 'Back to posts'}));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('renders error retry and usable not-found states', () => {
    const errored = createTestStore({
      detailStatusById: {'7': 'error'},
      detailErrorById: {'7': {message: 'Network unavailable'}},
    });
    const errorRender = renderScreen(errored.store);
    expect(screen.getByText('Network unavailable')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', {name: 'Try loading this post again'}));
    expect(errored.retryDetail).toHaveBeenCalledWith(7);
    errorRender.unmount();

    route.params.postId = -1;
    const missing = createTestStore();
    renderScreen(missing.store);
    expect(screen.getByTestId('post-detail-not-found')).toBeTruthy();
    expect(screen.getByText('Post not found.')).toBeTruthy();
    expect(missing.ensureDetail).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', {name: 'Back to posts'}));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('updates the shared dynamic favorite semantics without re-acquiring detail', () => {
    const {ensureDetail, store} = createTestStore({
      detailsById: {'7': detail},
      detailStatusById: {'7': 'success'},
    });
    renderScreen(store);
    expect(screen.getByRole('button', {name: 'Add to favorites'}).props.accessibilityState.selected).toBe(false);

    act(() => store.setState({favoriteIds: [7]}));
    expect(screen.getByRole('button', {name: 'Remove from favorites'}).props.accessibilityState.selected).toBe(true);
    expect(ensureDetail).not.toHaveBeenCalled();
  });

  it('renders an offline cached detail across remounts without new acquisition', () => {
    const {ensureDetail, store} = createTestStore({
      detailsById: {'7': detail},
      detailStatusById: {'7': 'success'},
      favoriteIds: [7],
    });
    const first = renderScreen(store);
    expect(screen.getByRole('button', {name: 'Remove from favorites'})).toBeTruthy();
    first.unmount();
    renderScreen(store);

    expect(screen.getByText(detail.body)).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Remove from favorites'})).toBeTruthy();
    expect(ensureDetail).not.toHaveBeenCalled();
  });
});
