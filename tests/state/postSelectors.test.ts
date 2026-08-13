import {ListPost} from '../../src/domain/post';
import {
  selectDetailById,
  selectFavoriteFirstPosts,
  selectIsFavorite,
} from '../../src/state/postSelectors';

const posts: ListPost[] = [
  {userId: 1, id: 10, title: 'Tenth', body: 'Body', listImageUri: '10', collectionIndex: 2},
  {userId: 1, id: 11, title: 'Eleventh', body: 'Body', listImageUri: '11', collectionIndex: 0},
  {userId: 1, id: 12, title: 'Twelfth', body: 'Body', listImageUri: '12', collectionIndex: 1},
];

describe('post selectors', () => {
  it('partitions favorites first while preserving original collection order in each partition', () => {
    expect(selectFavoriteFirstPosts({list: posts, favoriteIds: [10, 12]}).map(post => post.id)).toEqual([
      12, 10, 11,
    ]);
    expect(posts.map(post => post.id)).toEqual([10, 11, 12]);
  });

  it('restores an unfavorited post to original relative non-favorite order', () => {
    expect(selectFavoriteFirstPosts({list: posts, favoriteIds: [10]}).map(post => post.id)).toEqual([
      10, 11, 12,
    ]);
    expect(selectFavoriteFirstPosts({list: posts, favoriteIds: []}).map(post => post.id)).toEqual([
      11, 12, 10,
    ]);
  });

  it('handles an absent list and reads the shared favorite/detail state by ID', () => {
    expect(selectFavoriteFirstPosts({list: null, favoriteIds: [10]})).toEqual([]);
    expect(selectIsFavorite({favoriteIds: [10]}, 10)).toBe(true);
    expect(selectIsFavorite({favoriteIds: [10]}, 12)).toBe(false);
    expect(
      selectDetailById(
        {detailsById: {'10': {...posts[0], detailImageUri: 'detail'}}},
        10,
      ),
    ).toEqual({...posts[0], detailImageUri: 'detail'});
  });
});
