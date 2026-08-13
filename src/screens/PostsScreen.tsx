import {useEffect, useMemo} from 'react';
import {FlatList, StyleSheet, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';

import {PostRow} from '../components/PostRow';
import {EmptyState, ErrorState, LoadingState} from '../components/ScreenState';
import type {PostsNavigationProp} from '../navigation/types';
import {selectFavoriteFirstPosts, selectIsFavorite} from '../state/postSelectors';
import {colors} from '../theme';

import {usePostsStore} from '../app/App';

/**
 * Cache-first collection route. It only asks the shared store to acquire a
 * list after hydration is ready and no restored list is available.
 */
export function PostsScreen() {
  const navigation = useNavigation<PostsNavigationProp>();
  const hydrationStatus = usePostsStore(state => state.hydrationStatus);
  const list = usePostsStore(state => state.list);
  const favoriteIds = usePostsStore(state => state.favoriteIds);
  const listStatus = usePostsStore(state => state.listStatus);
  const listError = usePostsStore(state => state.listError);
  const ensureList = usePostsStore(state => state.ensureList);
  const retryList = usePostsStore(state => state.retryList);

  const posts = useMemo(
    () => selectFavoriteFirstPosts({list, favoriteIds}),
    [favoriteIds, list],
  );

  useEffect(() => {
    if (hydrationStatus === 'ready' && list === null && listStatus === 'idle') {
      ensureList().catch(() => undefined);
    }
  }, [ensureList, hydrationStatus, list, listStatus]);

  if (hydrationStatus !== 'ready' || (list === null && listStatus === 'loading')) {
    return <LoadingState message="Loading posts…" />;
  }

  if (listStatus === 'error') {
    return (
      <ErrorState
        message={listError?.message ?? 'Unable to load posts.'}
        onRetry={() => retryList().catch(() => undefined)}
        retryLabel="Try loading posts again"
      />
    );
  }

  if (list === null) {
    return <LoadingState message="Loading posts…" />;
  }

  if (posts.length === 0) {
    return <EmptyState message="No posts are available." />;
  }

  return (
    <View style={styles.screen} testID="posts-screen">
      <FlatList
        data={posts}
        keyExtractor={post => String(post.id)}
        renderItem={({item}) => (
          <PostRow
            isFavorite={selectIsFavorite({favoriteIds}, item.id)}
            onPress={() => navigation.navigate('PostDetail', {postId: item.id})}
            post={item}
            testID={`post-row-${item.id}`}
          />
        )}
        testID="posts-list"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
