import {DetailPost, ListPost} from '../domain/post';

/** The data surface selectors need from the shared posts store. */
export type PostsDataState = {
  list: ListPost[] | null;
  detailsById: Record<string, DetailPost>;
  favoriteIds: number[];
};

/** Returns whether a post is part of the single shared favorite-ID collection. */
export const selectIsFavorite = (state: Pick<PostsDataState, 'favoriteIds'>, postId: number): boolean =>
  state.favoriteIds.includes(postId);

/** Returns a cached detail record, if that post has been opened successfully. */
export const selectDetailById = (
  state: Pick<PostsDataState, 'detailsById'>,
  postId: number,
): DetailPost | undefined => state.detailsById[String(postId)];

/**
 * Derives the list display order without mutating the persisted collection.
 * collectionIndex remains the permanent source of order inside both partitions,
 * so removing a favorite restores it to its original non-favorite position.
 */
export const selectFavoriteFirstPosts = (
  state: Pick<PostsDataState, 'list' | 'favoriteIds'>,
): ListPost[] => {
  if (state.list === null) {
    return [];
  }

  const favoriteIds = new Set(state.favoriteIds);
  const byCollectionIndex = (left: ListPost, right: ListPost) =>
    left.collectionIndex - right.collectionIndex;
  const favorites: ListPost[] = [];
  const nonFavorites: ListPost[] = [];

  state.list.forEach(post => {
    (favoriteIds.has(post.id) ? favorites : nonFavorites).push(post);
  });

  return favorites.sort(byCollectionIndex).concat(nonFavorites.sort(byCollectionIndex));
};

