/** @type {import('jest').Config} */
module.exports = {
  // Root directory for this package's tests
  rootDir: '.',

  // Use jsdom to simulate a browser environment for React components
  testEnvironment: 'jsdom',

  // Runs setup file after the test framework is installed in the environment
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Map internal import aliases to source files instead of built outputs
  moduleNameMapper: {
    // mock all CSS imports to an empty file
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@kpi_admin/intools-hooks(.*)$': '<rootDir>/../hooks/src$1',
    '^@kpi_admin/intools-theme(.*)$': '<rootDir>/../theme/src$1',
    '^@kpi_admin/intools-utils(.*)$': '<rootDir>/../utils/src$1',
    '^@kpi_admin/react-select(.*)$': '<rootDir>/../react-select/src$1',
  },

  // Resolve modules from node_modules and src directories
  moduleDirectories: ['node_modules', 'src'],

  // Patterns Jest uses to detect test files
  testMatch: ['**/__tests__/**/*.(spec|test).ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],

  // Ignore specific paths or files (e.g. dist, storybook, story files)
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/storybook/',
    '\\.stories\\.ts$',
    '\\.stories\\.tsx$',
  ],

  // Use ts-jest to transform TypeScript files
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.jest.json',
      },
    ],
  },
  transformIgnorePatterns: ['/node_modules/(?!(jsondiffpatch|lodash-es|@kpi_admin)/)'],

  // Add Emotion serializer for better snapshot testing of styled components and css prop
  snapshotSerializers: ['@emotion/jest/serializer'],

  // Enable code coverage and specify reporters
  collectCoverage: true,
  coverageReporters: ['html', 'text', 'json-summary'],
  coverageDirectory: '<rootDir>/coverage',

  // Specify files to collect coverage from, excluding type definitions, stories, and index files
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/constants.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/storybook/**',
  ],
};
