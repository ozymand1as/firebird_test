import {fireEvent, render, screen} from '@testing-library/react-native';

import {EmptyState, ErrorState, LoadingState} from '../../src/components/ScreenState';

describe('ScreenState presentations', () => {
  it('renders clear loading and empty content', () => {
    const loading = render(<LoadingState message="Getting posts" />);
    expect(loading.getByTestId('screen-state-loading')).toBeTruthy();
    expect(loading.getByText('Getting posts')).toBeTruthy();
    expect(loading.getByTestId('screen-state-loading').props.accessibilityRole).toBe('progressbar');

    loading.unmount();
    const empty = render(<EmptyState message="There are no posts" />);
    expect(empty.getByTestId('screen-state-empty')).toBeTruthy();
    expect(empty.getByText('There are no posts')).toBeTruthy();
    expect(empty.getByRole('text')).toBeTruthy();
  });

  it('renders an error with an accessible retry action', () => {
    const onRetry = jest.fn();
    const error = render(<ErrorState message="Network unavailable" onRetry={onRetry} />);
    expect(error.getByTestId('screen-state-error')).toBeTruthy();
    expect(error.getByText('Network unavailable')).toBeTruthy();
    expect(error.getByTestId('screen-state-error').props.accessibilityRole).toBe('alert');
    fireEvent.press(error.getByRole('button', {name: 'Try again'}));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('uses intentional default messages for all non-content states', () => {
    const loading = render(<LoadingState />);
    expect(screen.getByText('Loading posts…')).toBeTruthy();
    loading.unmount();
    render(<EmptyState />);
    expect(screen.getByText('No posts are available yet.')).toBeTruthy();
  });
});
