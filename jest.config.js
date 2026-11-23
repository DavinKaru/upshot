const preset = require('jest-expo/jest-preset');

// d3 ships as ES modules (.mjs). Run those through the same Babel transform as our code.
const [babelJest, babelOptions] = preset.transform['\\.[jt]sx?$'];

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // jest-expo's environment, plus a time zone switch for tests. See jest.environment.js.
  testEnvironment: '<rootDir>/jest.environment.js',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transform: {
    ...preset.transform,
    '\\.mjs$': [babelJest, babelOptions],
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@shopify/react-native-skia|d3-.*|internmap)',
  ],
};
