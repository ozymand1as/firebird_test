import {faker} from '@faker-js/faker';

export type ImageDimensions = {
  width: number;
  height: number;
};

export type FakerImageSource = {
  image: {
    url: (options: ImageDimensions) => string;
  };
};

export type FakerImageFactory = {
  createImageUri: (dimensions: ImageDimensions) => string;
};

const isPositiveInteger = (value: number) => Number.isInteger(value) && value > 0;

/**
 * Produces persisted image references. The source is injected so repository
 * tests can prove generation count and requested display dimensions.
 */
export function createFakerImageFactory(source: FakerImageSource = faker): FakerImageFactory {
  return {
    createImageUri({width, height}: ImageDimensions): string {
      if (!isPositiveInteger(width) || !isPositiveInteger(height)) {
        throw new Error('Image dimensions must be positive integers.');
      }

      return source.image.url({width, height});
    },
  };
}
