import {
  createJsonPlaceholderClient,
  JsonPlaceholderClientError,
} from '../../src/data/api/jsonPlaceholderClient';
import {PostValidationError} from '../../src/domain/postValidation';

const post = {userId: 1, id: 7, title: 'Title', body: 'Body'};

const response = (payload: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: jest.fn().mockResolvedValue(payload),
});

describe('JsonPlaceholder client', () => {
  it('requests and validates the collection endpoint', async () => {
    const fetchImplementation = jest.fn().mockResolvedValue(response([post]));
    const client = createJsonPlaceholderClient(fetchImplementation);

    await expect(client.getPosts()).resolves.toEqual([post]);
    expect(fetchImplementation).toHaveBeenCalledWith('https://jsonplaceholder.typicode.com/posts');
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it('requests and validates the ID-specific detail endpoint', async () => {
    const fetchImplementation = jest.fn().mockResolvedValue(response(post));
    const client = createJsonPlaceholderClient(fetchImplementation);

    await expect(client.getPost(7)).resolves.toEqual(post);
    expect(fetchImplementation).toHaveBeenCalledWith('https://jsonplaceholder.typicode.com/posts/7');
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['collection', () => createJsonPlaceholderClient(jest.fn().mockResolvedValue(response({}, false, 500))).getPosts()],
    ['detail', () => createJsonPlaceholderClient(jest.fn().mockResolvedValue(response({}, false, 404))).getPost(7)],
    ['transport', () => createJsonPlaceholderClient(jest.fn().mockRejectedValue(new Error('offline'))).getPosts()],
    [
      'JSON parsing',
      () => createJsonPlaceholderClient(jest.fn().mockResolvedValue({ok: true, status: 200, json: jest.fn().mockRejectedValue(new Error('invalid JSON'))})).getPosts(),
    ],
  ])('rejects %s failures as recoverable client errors', async (_kind, request) => {
    await expect(request()).rejects.toBeInstanceOf(JsonPlaceholderClientError);
  });

  it('rejects malformed list, malformed detail, and mismatched detail payloads', async () => {
    const malformedList = createJsonPlaceholderClient(jest.fn().mockResolvedValue(response([{...post, title: ''}])));
    const malformedDetail = createJsonPlaceholderClient(jest.fn().mockResolvedValue(response({...post, body: ''})));
    const mismatchedDetail = createJsonPlaceholderClient(jest.fn().mockResolvedValue(response({...post, id: 8})));

    await expect(malformedList.getPosts()).rejects.toBeInstanceOf(PostValidationError);
    await expect(malformedDetail.getPost(7)).rejects.toBeInstanceOf(PostValidationError);
    await expect(mismatchedDetail.getPost(7)).rejects.toBeInstanceOf(PostValidationError);
  });
});
