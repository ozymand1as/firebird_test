import {fireEvent, render, screen} from '@testing-library/react-native';

import {FavoriteButton} from '../../src/components/FavoriteButton';

describe('FavoriteButton', () => {
  it.each([
    [false, 'Add to favorites', '☆'],
    [true, 'Remove from favorites', '★'],
  ])('exposes the current favorite state (%s)', (isFavorite, label, icon) => {
    const onPress = jest.fn();
    render(<FavoriteButton isFavorite={isFavorite} onPress={onPress} />);

    const button = screen.getByRole('button', {name: label});
    expect(button.props.accessibilityState).toMatchObject({selected: isFavorite});
    expect(screen.getByText(icon)).toBeTruthy();
    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes disabled state and prevents the callback while disabled', () => {
    const onPress = jest.fn();
    render(<FavoriteButton disabled isFavorite={false} onPress={onPress} />);

    const button = screen.getByRole('button', {name: 'Add to favorites'});
    expect(button.props.accessibilityState).toMatchObject({disabled: true, selected: false});
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});
