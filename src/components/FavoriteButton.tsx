import {Pressable, StyleSheet, Text} from 'react-native';

import {colors, spacing} from '../theme';

export type FavoriteButtonProps = {
  isFavorite: boolean;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

/** A dynamic, state-exposing favorite toggle shared by detail presentation. */
export function FavoriteButton({
  isFavorite,
  onPress,
  disabled = false,
  testID,
}: FavoriteButtonProps) {
  const action = isFavorite ? 'Remove from favorites' : 'Add to favorites';
  const icon = isFavorite ? '★' : '☆';

  return (
    <Pressable
      accessibilityLabel={action}
      accessibilityRole="button"
      accessibilityState={{disabled, selected: isFavorite}}
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.button,
        isFavorite && styles.buttonSelected,
        pressed && !disabled && styles.buttonPressed,
        disabled && styles.buttonDisabled,
      ]}
      testID={testID}>
      <Text accessible={false} style={[styles.icon, isFavorite && styles.iconSelected]}>
        {icon}
      </Text>
      <Text accessible={false} style={[styles.label, isFavorite && styles.labelSelected]}>
        {action}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.accent,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  buttonDisabled: {opacity: 0.55},
  buttonPressed: {opacity: 0.75},
  buttonSelected: {backgroundColor: colors.accentSurface},
  icon: {color: colors.accent, fontSize: 21, marginRight: spacing.sm},
  iconSelected: {color: colors.favorite},
  label: {color: colors.accent, fontSize: 16, fontWeight: '600'},
  labelSelected: {color: colors.favorite},
});
