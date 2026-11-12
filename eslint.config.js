// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  // Last, so it turns off any style rules that would fight Prettier.
  prettierConfig,
  {
    ignores: ['dist/*', '.expo/*'],
  },
]);
