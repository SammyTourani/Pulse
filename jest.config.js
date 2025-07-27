module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],

  // Files to include in coverage
  collectCoverageFrom: [
    '*.js',
    '*.ts',
    'security/**/*.js',
    'flows/**/*.js',
    '!node_modules/**',
    '!coverage/**',
    '!jest.config.js',
    '!.eslintrc.js'
  ],

  // Setup files
  setupFilesAfterEnv: [],

  // Module file extensions
  moduleFileExtensions: ['js', 'json', 'ts'],

  // Transform files
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },

  // Test timeout
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true
};