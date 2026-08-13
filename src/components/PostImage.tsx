import {useState} from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';

import {colors} from '../theme';

export type PostImageProps = {
  uri: string;
  width: number;
  height: number;
  accessibilityLabel: string;
  testID?: string;
};

/**
 * Displays a persisted image reference and replaces a failed image with a
 * stable, in-app placeholder. The fallback deliberately does not generate a
 * replacement URI so cached acquisition semantics remain intact.
 */
export function PostImage({
  uri,
  width,
  height,
  accessibilityLabel,
  testID,
}: PostImageProps) {
  const [hasLoadError, setHasLoadError] = useState(false);
  const dimensions = {width, height};

  if (hasLoadError) {
    return (
      <View
        accessibilityLabel={`${accessibilityLabel}. Image unavailable.`}
        accessibilityRole="image"
        style={[styles.fallback, dimensions]}
        testID={testID === undefined ? 'post-image-fallback' : `${testID}-fallback`}>
        <Text accessible={false} style={styles.fallbackText}>
          Image unavailable
        </Text>
      </View>
    );
  }

  return (
    <Image
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="image"
      source={{uri}}
      style={dimensions}
      testID={testID}
      onError={() => setHasLoadError(true)}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    backgroundColor: colors.placeholder,
    justifyContent: 'center',
  },
  fallbackText: {
    color: colors.mutedText,
    fontSize: 11,
    paddingHorizontal: 2,
    textAlign: 'center',
  },
});
