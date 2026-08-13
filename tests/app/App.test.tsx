import {create} from 'zustand';
import {act, fireEvent, render, screen} from '@testing-library/react-native';

import {App, createApplicationStore} from '../../src/app/App';
import {RootStackParamList} from '../../src/navigation/types';
import {PostsStore, PostsStoreState} from '../../src/state/postsStore';

jest.mock('../../src/navigation/RootNavigator', () => ({
  RootNavigator: () => {
    const {Text: MockText} = require('react-native');
    return <MockText testID="posts-route">Posts route</MockText>;
  },
}));

const createTestStore = (
  overrides: Partial<PostsStoreState> = {},
): {store: PostsStore; hydrate: jest.Mock} => {
  const hydrate = jest.fn().mockResolvedValue(undefined);
  const store = create<PostsStoreState>(() => ({
    hydrationStatus: 'idle',
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
    hydrate,
    ensureList: jest.fn().mockResolvedValue(undefined),
    retryList: jest.fn().mockResolvedValue(undefined),
    ensureDetail: jest.fn().mockResolvedValue(undefined),
    retryDetail: jest.fn().mockResolvedValue(undefined),
    toggleFavorite: jest.fn().mockResolvedValue(undefined),
    retryFavoritePersistence: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  }));
  return {store, hydrate};
};

describe('application hydration gate', () => {
  it('renders explicit loading and starts hydration without mounting navigation', () => {
    const {store, hydrate} = createTestStore();
    render(<App store={store} />);

    expect(screen.getByTestId('hydration-loading')).toBeTruthy();
    expect(screen.queryByTestId('posts-route')).toBeNull();
    expect(hydrate).toHaveBeenCalledTimes(1);
  });

  it('renders a recoverable hydration error and retries when the user presses Try again', () => {
    const {store, hydrate} = createTestStore({
      hydrationStatus: 'error',
      hydrationError: {message: 'Saved posts are unavailable'},
    });
    render(<App store={store} />);

    expect(screen.getByTestId('hydration-error')).toBeTruthy();
    expect(screen.getByRole('alert')).toHaveTextContent('Saved posts are unavailable');
    fireEvent.press(screen.getByRole('button', {name: 'Try again'}));
    expect(hydrate).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('posts-route')).toBeNull();
  });

  it('transitions to the Posts initial route only after hydration becomes ready', () => {
    const {store} = createTestStore({hydrationStatus: 'hydrating'});
    render(<App store={store} />);
    expect(screen.queryByTestId('posts-route')).toBeNull();

    act(() => {
      store.setState({hydrationStatus: 'ready'});
    });
    expect(screen.getByTestId('posts-route')).toBeTruthy();
  });

  it('provides a usable production dependency composition with an idle store', () => {
    const store = createApplicationStore();
    expect(store.getState()).toMatchObject({
      hydrationStatus: 'idle',
      listStatus: 'idle',
      list: null,
      favoriteIds: [],
    });
    expect(typeof store.getState().hydrate).toBe('function');
  });

  it('keeps the detail route contract restricted to a numeric post ID at typecheck time', () => {
    const detailParams: RootStackParamList['PostDetail'] = {postId: 42};
    const postsParams: RootStackParamList['Posts'] = undefined;
    expect(detailParams.postId).toBe(42);
    expect(postsParams).toBeUndefined();
  });
});
