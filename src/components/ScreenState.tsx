import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';

import {colors, spacing, typography} from '../theme';

export function LoadingState({message = 'Loading posts…'}: {message?: string}) {
  return (
    <View accessibilityRole="progressbar" style={styles.container} testID="screen-state-loading">
      <ActivityIndicator color={colors.accent} />
      <Text style={[typography.label, styles.message]}>{message}</Text>
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
  retryLabel = 'Try again',
}: {
  message: string;
  onRetry: () => void;
  retryLabel?: string;
}) {
  return (
    <View accessibilityRole="alert" style={styles.container} testID="screen-state-error">
      <Text style={[typography.body, styles.errorMessage]}>{message}</Text>
      <Pressable accessibilityLabel={retryLabel} accessibilityRole="button" onPress={onRetry} style={styles.retryButton}>
        <Text accessible={false} style={styles.retryText}>
          {retryLabel}
        </Text>
      </Pressable>
    </View>
  );
}

export function EmptyState({message = 'No posts are available yet.'}: {message?: string}) {
  return (
    <View style={styles.container} testID="screen-state-empty">
      <Text accessibilityRole="text" style={typography.body}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorMessage: {color: colors.danger, textAlign: 'center'},
  message: {marginTop: spacing.md, textAlign: 'center'},
  retryButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    marginTop: spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  retryText: {color: colors.surface, fontSize: 16, fontWeight: '600'},
});
