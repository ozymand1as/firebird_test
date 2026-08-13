import {StyleSheet} from 'react-native';

/** Shared presentation tokens for the Posts and detail experiences. */
export const colors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  text: '#172033',
  mutedText: '#5B677A',
  border: '#D8E0EA',
  accent: '#155EEF',
  accentSurface: '#E8F0FF',
  danger: '#B42318',
  dangerSurface: '#FEF3F2',
  placeholder: '#E5EAF0',
  favorite: '#9A6700',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const typography = StyleSheet.create({
  title: {color: colors.text, fontSize: 17, fontWeight: '600', lineHeight: 23},
  body: {color: colors.text, fontSize: 16, lineHeight: 23},
  label: {color: colors.mutedText, fontSize: 14, lineHeight: 20},
  caption: {color: colors.mutedText, fontSize: 12, lineHeight: 16},
});
