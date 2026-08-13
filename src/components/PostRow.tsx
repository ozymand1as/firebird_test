import {Pressable, StyleSheet, Text, View} from 'react-native';

import type {ListPost} from '../domain/post';
import {colors, spacing, typography} from '../theme';

import {PostImage} from './PostImage';

export type PostRowProps = {
  post: ListPost;
  isFavorite: boolean;
  onPress: () => void;
  testID?: string;
};

/** A selectable 32 × 32 list representation with a text-and-icon favorite mark. */
export function PostRow({post, isFavorite, onPress, testID}: PostRowProps) {
  const favoriteDescription = isFavorite ? 'Favorite' : 'Not favorite';

  return (
    <Pressable
      accessibilityLabel={`${post.title}. ${favoriteDescription}. Open post.`}
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [styles.row, isFavorite && styles.favoriteRow, pressed && styles.pressed]}
      testID={testID}>
      <PostImage
        accessibilityLabel={`Post image for ${post.title}`}
        height={32}
        testID={testID === undefined ? undefined : `${testID}-image`}
        uri={post.listImageUri}
        width={32}
      />
      <View style={styles.content}>
        <Text numberOfLines={2} style={typography.title}>
          {post.title}
        </Text>
        {isFavorite ? (
          <View accessibilityLabel="Favorite post" accessibilityRole="text" style={styles.favoriteIndicator}>
            <Text accessible={false} style={styles.favoriteIcon}>
              ★
            </Text>
            <Text accessible={false} style={styles.favoriteText}>
              Favorite
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {flex: 1, marginLeft: spacing.md},
  favoriteIcon: {color: colors.favorite, fontSize: 16, marginRight: spacing.xs},
  favoriteIndicator: {alignItems: 'center', flexDirection: 'row', marginTop: spacing.xs},
  favoriteRow: {backgroundColor: colors.accentSurface, borderColor: colors.accent},
  favoriteText: {color: colors.favorite, fontSize: 13, fontWeight: '600'},
  pressed: {opacity: 0.7},
  row: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
