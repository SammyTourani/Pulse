module.exports = {
  env: {
    node: true,
    es6: true,
  },
  extends: ['eslint:recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  rules: {
    'no-unused-vars': 'off', // TypeScript handles this
    'no-console': 'off',
    'no-undef': 'off', // TypeScript handles this
  },
  ignorePatterns: ['node_modules/', 'dist/'],
};
