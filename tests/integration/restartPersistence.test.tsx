import {JsonPlaceholderClient} from '../../src/data/api/jsonPlaceholderClient';
import {FakerImageFactory} from '../../src/data/images/fakerImageFactory';
import {createPostsRepository} from '../../src/data/postsRepository';
import {createPostsStorage, KeyValueStorage} from '../../src/data/storage/postsStorage';
import {RemotePost} from '../../src/domain/post';
import {selectFavoriteFirstPosts, selectIsFavorite} from '../../src/state/postSelectors';
import {createPostsStore} from '../../src/state/postsStore';
import {RootNavigator} from '../../src/navigation/RootNavigator';
import {PostDetailScreen} from '../../src/screens/PostDetailScreen';
import {PostsScreen} from '../../src/screens/PostsScreen';
import {render, screen} from '@testing-library/react-native';

jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({children}: {children: React.ReactNode}) => children,
}));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: () => ({
    Navigator: ({children, ...props}: {children: React.ReactNode}) => {
      const {View} = require('react-native');
      return <View testID="root-stack" {...props}>{children}</View>;
    },
    Screen: ({component, name, ...props}: {component: unknown; name: string}) => {
      const {View} = require('react-native');
      return <View component={component} routeName={name} testID={`route-${name}`} {...props} />;
    },
  }),
}));

const firstPost: RemotePost = {userId: 1, id: 1, title: 'First post', body: 'First body'};
const secondPost: RemotePost = {userId: 1, id: 2, title: 'Second post', body: 'Second body'};

function createMemoryStorage(): jest.Mocked<KeyValueStorage> {
  let value: string | null = null;

  return {
    getItem: jest.fn(async (_key: string) => value),
    setItem: jest.fn(async (_key, nextValue) => {
      value = nextValue;
    }),
    removeItem: jest.fn(async (_key: string) => {
      value = null;
    }),
  };
}

function createExternalGateways() {
  const api: jest.Mocked<JsonPlaceholderClient> = {
    getPosts: jest.fn().mockResolvedValue([firstPost, secondPost]),
    getPost: jest.fn().mockImplementation(async postId => (postId === 2 ? secondPost : firstPost)),
  };
  const images: jest.Mocked<FakerImageFactory> = {
    createImageUri: jest.fn(({width, height}) => `faker://${width}x${height}`),
  };

  return {api, images};
}

describe('restart persistence integration', () => {
  it('restores enriched posts, detail, favorites, and stable ordering without remote or Faker work', async () => {
    const keyValueStorage = createMemoryStorage();
    const firstRun = createExternalGateways();
    const firstRepository = createPostsRepository({
      api: firstRun.api,
      images: firstRun.images,
      storage: createPostsStorage(keyValueStorage),
    });
    const firstStore = createPostsStore(firstRepository);

    await firstStore.getState().hydrate();
    await firstStore.getState().ensureList();
    await firstStore.getState().ensureDetail(2);
    await firstStore.getState().toggleFavorite(2);

    expect(firstRun.api.getPosts).toHaveBeenCalledTimes(1);
    expect(firstRun.api.getPost).toHaveBeenCalledTimes(1);
    expect(firstRun.api.getPost).toHaveBeenCalledWith(2);
    expect(firstRun.images.createImageUri).toHaveBeenNthCalledWith(1, {width: 32, height: 32});
    expect(firstRun.images.createImageUri).toHaveBeenNthCalledWith(2, {width: 32, height: 32});
    expect(firstRun.images.createImageUri).toHaveBeenNthCalledWith(3, {width: 300, height: 300});

    const persistedListImages = firstStore.getState().list?.map(post => post.listImageUri);
    const persistedDetailImage = firstStore.getState().detailsById['2'].detailImageUri;

    // Recreate all production stateful layers, as a new app process would.
    const restarted = createExternalGateways();
    const restartedRepository = createPostsRepository({
      api: restarted.api,
      images: restarted.images,
      storage: createPostsStorage(keyValueStorage),
    });
    const restartedStore = createPostsStore(restartedRepository);

    await restartedStore.getState().hydrate();
    await restartedStore.getState().ensureList();
    await restartedStore.getState().ensureDetail(2);

    const restoredState = restartedStore.getState();
    expect(restoredState.hydrationStatus).toBe('ready');
    expect(restoredState.list?.map(post => post.id)).toEqual([1, 2]);
    expect(restoredState.detailsById['2']).toMatchObject({
      ...secondPost,
      detailImageUri: persistedDetailImage,
    });
    expect(restoredState.list?.map(post => post.listImageUri)).toEqual(persistedListImages);
    expect(selectIsFavorite(restoredState, 2)).toBe(true);
    expect(selectFavoriteFirstPosts(restoredState).map(post => post.id)).toEqual([2, 1]);

    expect(restarted.api.getPosts).not.toHaveBeenCalled();
    expect(restarted.api.getPost).not.toHaveBeenCalled();
    expect(restarted.images.createImageUri).not.toHaveBeenCalled();
  });

  it('registers production Posts first and wires the real detail screen into the typed stack', () => {
    render(<RootNavigator />);

    expect(screen.getByTestId('root-stack').props.initialRouteName).toBe('Posts');
    expect(screen.getByTestId('route-Posts').props.component).toBe(PostsScreen);
    expect(screen.getByTestId('route-PostDetail').props.component).toBe(PostDetailScreen);
    expect(screen.getByTestId('route-PostDetail').props.routeName).toBe('PostDetail');
  });
});
