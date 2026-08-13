import {RemotePost} from '../../domain/post';
import {parseDetailPost, parseRemotePostCollection} from '../../domain/postValidation';

export const JSON_PLACEHOLDER_BASE_URL = 'https://jsonplaceholder.typicode.com';

export type FetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

export type FetchImplementation = (input: string) => Promise<FetchResponse>;

export type JsonPlaceholderClient = {
  getPosts: () => Promise<RemotePost[]>;
  getPost: (postId: number) => Promise<RemotePost>;
};

/** Error for transport or HTTP failures from the JSONPlaceholder boundary. */
export class JsonPlaceholderClientError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'JsonPlaceholderClientError';
  }
}

const defaultFetch: FetchImplementation = async input => globalThis.fetch(input) as Promise<FetchResponse>;

async function requestJson(fetchImplementation: FetchImplementation, url: string): Promise<unknown> {
  let response: FetchResponse;
  try {
    response = await fetchImplementation(url);
  } catch (error) {
    throw new JsonPlaceholderClientError('Unable to request posts.', error);
  }

  if (!response.ok) {
    throw new JsonPlaceholderClientError(`Posts request failed with status ${response.status}.`);
  }

  try {
    return await response.json();
  } catch (error) {
    throw new JsonPlaceholderClientError('Posts response could not be parsed.', error);
  }
}

/**
 * Creates the only remote-data gateway used by the app. Payload validation is
 * intentionally kept at this boundary so invalid API values cannot reach cache.
 */
export function createJsonPlaceholderClient(
  fetchImplementation: FetchImplementation = defaultFetch,
): JsonPlaceholderClient {
  return {
    async getPosts(): Promise<RemotePost[]> {
      const payload = await requestJson(fetchImplementation, `${JSON_PLACEHOLDER_BASE_URL}/posts`);
      return parseRemotePostCollection(payload);
    },

    async getPost(postId: number): Promise<RemotePost> {
      const payload = await requestJson(
        fetchImplementation,
        `${JSON_PLACEHOLDER_BASE_URL}/posts/${postId}`,
      );
      return parseDetailPost(payload, postId);
    },
  };
}
