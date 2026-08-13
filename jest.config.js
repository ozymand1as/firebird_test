module.exports = {
  preset: '@react-native/jest-preset',
  watchman: false,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((@)?react-native|@react-native-community|@react-navigation)/)',
  ],
};
