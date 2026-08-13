import {fireEvent, render, screen} from '@testing-library/react-native';

import {PostRow} from '../../src/components/PostRow';

const post = {
  body: 'Body',
  collectionIndex: 0,
  id: 1,
  listImageUri: 'https://example.test/list.png',
  title: 'Accessible post title',
  userId: 1,
};

describe('PostRow', () => {
  it('has an accessible press target, 32x32 image, title, and non-color favorite marker', () => {
    const onPress = jest.fn();
    render(<PostRow isFavorite onPress={onPress} post={post} testID="post-row" />);

    const row = screen.getByRole('button', {name: /Accessible post title\. Favorite\. Open post/i});
    expect(screen.getByText('Favorite')).toBeTruthy();
    expect(screen.getByText('★')).toBeTruthy();
    expect(screen.getByTestId('post-row-image').props.style).toMatchObject({height: 32, width: 32});
    fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('keeps title and row navigation usable when its image falls back', () => {
    const onPress = jest.fn();
    render(<PostRow isFavorite={false} onPress={onPress} post={post} testID="post-row" />);

    fireEvent(screen.getByTestId('post-row-image'), 'error');
    expect(screen.getByTestId('post-row-image-fallback')).toBeTruthy();
    expect(screen.getByText('Accessible post title')).toBeTruthy();
    const row = screen.getByRole('button', {name: /Not favorite. Open post/i});
    fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
