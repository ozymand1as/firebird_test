import {
  isPersistedPostsState,
  isRemotePost,
  parseDetailPost,
  parsePersistedPostsState,
  parseRemotePost,
  parseRemotePostCollection,
  PostValidationError,
} from '../../src/domain/postValidation';

const remotePost = {userId: 1, id: 2, title: 'A title', body: 'A body'};

const snapshot = {
  version: 1,
  list: [{...remotePost, listImageUri: 'https://example.test/list.png', collectionIndex: 0}],
  detailsById: {
    '2': {...remotePost, detailImageUri: 'https://example.test/detail.png'},
  },
  favoriteIds: [2],
};

const expectValidationError = (operation: () => unknown) =>
  expect(operation).toThrow(PostValidationError);

describe('remote post validation', () => {
  it('accepts valid posts without coercion and preserves all required fields', () => {
    expect(isRemotePost(remotePost)).toBe(true);
    expect(parseRemotePost(remotePost)).toEqual(remotePost);
    expect(parseRemotePostCollection([remotePost])).toEqual([remotePost]);
    expect(parseDetailPost(remotePost, 2)).toEqual(remotePost);
  });

  it.each([
    null,
    [],
    'post',
    2,
    {...remotePost, userId: 0},
    {...remotePost, userId: Number.POSITIVE_INFINITY},
    {...remotePost, id: -1},
    {...remotePost, id: Number.NaN},
    {...remotePost, title: ''},
    {...remotePost, title: '   '},
    {...remotePost, body: ''},
    {...remotePost, body: '   '},
    {...remotePost, id: '2'},
  ])('rejects malformed remote record %p', payload => {
    expect(isRemotePost(payload)).toBe(false);
    expectValidationError(() => parseRemotePost(payload));
  });

  it.each([
    null,
    {},
    [remotePost, {...remotePost}],
    [remotePost, {...remotePost, id: 3, title: ''}],
  ])('rejects malformed or duplicate collections %p', payload => {
    expectValidationError(() => parseRemotePostCollection(payload));
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid requested detail ID %p',
    requestedId => {
      expectValidationError(() => parseDetailPost(remotePost, requestedId));
    },
  );

  it('rejects a malformed or mismatched detail response as a validation error', () => {
    expectValidationError(() => parseDetailPost({...remotePost, id: 3}, 2));
    expectValidationError(() => parseDetailPost({...remotePost, body: ''}, 2));
  });
});

describe('persisted snapshot validation', () => {
  it('accepts a complete valid snapshot without changing cached values', () => {
    expect(parsePersistedPostsState(snapshot)).toEqual(snapshot);
    expect(isPersistedPostsState(snapshot)).toBe(true);
  });

  it.each([
    null,
    [],
    'corrupt JSON shape',
    {},
    {...snapshot, version: 2},
    {...snapshot, version: '1'},
    {...snapshot, list: {}},
    {...snapshot, list: [{...snapshot.list[0], listImageUri: ' '}]},
    {...snapshot, list: [{...snapshot.list[0], collectionIndex: -1}]},
    {...snapshot, list: [{...snapshot.list[0], collectionIndex: 0.5}]},
    {...snapshot, list: [snapshot.list[0], {...snapshot.list[0], collectionIndex: 1}]},
    {...snapshot, list: [snapshot.list[0], {...snapshot.list[0], id: 3}]},
    {...snapshot, detailsById: null},
    {...snapshot, detailsById: {'3': snapshot.detailsById['2']}},
    {...snapshot, detailsById: {'2': {...snapshot.detailsById['2'], detailImageUri: ''}}},
    {...snapshot, favoriteIds: null},
    {...snapshot, favoriteIds: [2, 2]},
    {...snapshot, favoriteIds: [0]},
  ])('rejects corrupt or incompatible JSON-compatible snapshots', payload => {
    expect(isPersistedPostsState(payload)).toBe(false);
    expectValidationError(() => parsePersistedPostsState(payload));
  });

  it('accepts a null list with valid cached detail records and no favorites', () => {
    const detailOnlySnapshot = {...snapshot, list: null, favoriteIds: []};
    expect(parsePersistedPostsState(detailOnlySnapshot)).toEqual(detailOnlySnapshot);
  });
});
