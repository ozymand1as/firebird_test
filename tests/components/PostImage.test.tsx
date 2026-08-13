import {fireEvent, render, screen} from '@testing-library/react-native';
import {StyleSheet} from 'react-native';

import {PostImage} from '../../src/components/PostImage';

describe('PostImage', () => {
  it('renders supplied dimensions and replaces failed images with a stable fallback', () => {
    render(
      <PostImage
        accessibilityLabel="Post image for A title"
        height={32}
        testID="post-image"
        uri="https://example.test/post.png"
        width={32}
      />,
    );

    const image = screen.getByTestId('post-image');
    expect(image.props.style).toMatchObject({height: 32, width: 32});
    fireEvent(image, 'error');

    const fallback = screen.getByTestId('post-image-fallback');
    expect(fallback).toBeTruthy();
    expect(StyleSheet.flatten(fallback.props.style)).toMatchObject({height: 32, width: 32});
    expect(fallback.props.accessibilityLabel).toBe('Post image for A title. Image unavailable.');
    expect(screen.queryByTestId('post-image')).toBeNull();
    expect(screen.getByText('Image unavailable')).toBeTruthy();
  });
});
