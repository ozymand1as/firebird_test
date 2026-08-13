import {useEffect} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';

import {FavoriteButton} from '../components/FavoriteButton';
import {PostImage} from '../components/PostImage';
import {ErrorState, LoadingState} from '../components/ScreenState';
import type {PostDetailNavigationProp, PostDetailRouteProp} from '../navigation/types';
import {selectDetailById, selectIsFavorite} from '../state/postSelectors';
import {colors, spacing, typography} from '../theme';

import {usePostsStore} from '../app/App';

const isValidPostId = (postId: number): boolean =>
  Number.isFinite(postId) && Number.isInteger(postId) && postId > 0;

/**
 * Cache-first post detail route. The screen owns presentation only: the shared
 * store de-duplicates acquisition and keeps its favorite state in sync with
 * the list route.
 */
export function PostDetailScreen() {
  const navigation = useNavigation<PostDetailNavigationProp>();
  const route = useRoute<PostDetailRouteProp>();
  const {width: viewportWidth} = useWindowDimensions();
  const postId = route.params.postId;
  const hydrationStatus = usePostsStore(state => state.hydrationStatus);
  const detail = usePostsStore(state => selectDetailById(state, postId));
  const detailStatus = usePostsStore(state => state.detailStatusById[String(postId)] ?? 'idle');
  const detailError = usePostsStore(state => state.detailErrorById[String(postId)]);
  const isFavorite = usePostsStore(state => selectIsFavorite(state, postId));
  const ensureDetail = usePostsStore(state => state.ensureDetail);
  const retryDetail = usePostsStore(state => state.retryDetail);
  const toggleFavorite = usePostsStore(state => state.toggleFavorite);

  useEffect(() => {
    if (
      hydrationStatus === 'ready' &&
      isValidPostId(postId) &&
      detail === undefined &&
      detailStatus === 'idle'
    ) {
      ensureDetail(postId).catch(() => undefined);
    }
  }, [detail, detailStatus, ensureDetail, hydrationStatus, postId]);

  const backControl = (
    <Pressable
      accessibilityLabel="Back to posts"
      accessibilityRole="button"
      onPress={() => navigation.goBack()}
      style={styles.backButton}
      testID="detail-back-button">
      <Text accessible={false} style={styles.backButtonText}>
        Back to posts
      </Text>
    </Pressable>
  );

  if (!isValidPostId(postId)) {
    return (
      <View style={styles.stateScreen} testID="post-detail-not-found">
        {backControl}
        <Text accessibilityRole="alert" style={styles.notFoundText}>
          Post not found.
        </Text>
      </View>
    );
  }

  if (
    hydrationStatus !== 'ready' ||
    (detail === undefined && (detailStatus === 'idle' || detailStatus === 'loading'))
  ) {
    return <LoadingState message="Loading post…" />;
  }

  if (detailStatus === 'error') {
    return (
      <View style={styles.stateScreen} testID="post-detail-error">
        {backControl}
        <ErrorState
          message={detailError?.message ?? 'Unable to load this post.'}
          onRetry={() => retryDetail(postId).catch(() => undefined)}
          retryLabel="Try loading this post again"
        />
      </View>
    );
  }

  if (detail === undefined) {
    return (
      <View style={styles.stateScreen} testID="post-detail-not-found">
        {backControl}
        <Text accessibilityRole="alert" style={styles.notFoundText}>
          Post not found.
        </Text>
      </View>
    );
  }

  // A narrow device retains a square image that fits within the scroll area;
  // normal phone/tablet widths retain the requested 300 × 300 presentation.
  const imageSize = Math.min(300, Math.max(0, viewportWidth - spacing.lg * 2));

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      style={styles.screen}
      testID="post-detail-screen">
      {backControl}
      <PostImage
        accessibilityLabel={`Image for ${detail.title}`}
        height={imageSize}
        testID="post-detail-image"
        uri={detail.detailImageUri}
        width={imageSize}
      />
      <Text accessibilityRole="header" style={styles.title}>
        {detail.title}
      </Text>
      <Text style={styles.body}>{detail.body}</Text>
      <FavoriteButton
        isFavorite={isFavorite}
        onPress={() => toggleFavorite(postId).catch(() => undefined)}
        testID="detail-favorite-button"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  backButtonText: {color: colors.accent, fontSize: 16, fontWeight: '600'},
  body: {marginBottom: spacing.xl, ...typography.body},
  content: {padding: spacing.lg},
  notFoundText: {...typography.body, color: colors.mutedText},
  screen: {backgroundColor: colors.background, flex: 1},
  stateScreen: {backgroundColor: colors.background, flex: 1, padding: spacing.lg},
  title: {marginBottom: spacing.md, marginTop: spacing.lg, ...typography.title},
});
