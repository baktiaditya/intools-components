module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
  },
  ignorePatterns: ['.eslintrc.js', 'jest.setup.js', 'node_modules', 'dist', '!.storybook'],
  globals: {
    React: true,
    JSX: true,
  },
  env: {
    node: true,
    browser: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:eslint-comments/recommended',
    'plugin:prettier/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'plugin:storybook/recommended',
  ],
  plugins: [
    'react',
    'react-hooks',
    'import',
    'sort-destructure-keys',
    '@typescript-eslint',
    'typescript-sort-keys',
    'simple-import-sort',
  ],
  rules: {
    // Place to specify ESLint rules. Can be used to overwrite rules specified from the extended configs
    // e.g. "@typescript-eslint/explicit-function-return-type": "off",
    '@typescript-eslint/no-unused-vars': [
      'warn',
      {
        args: 'all',
        argsIgnorePattern: '^_',
        caughtErrors: 'all',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],
    '@typescript-eslint/no-var-requires': 'off',
    'eslint-comments/disable-enable-pair': 'off',
    'eslint-comments/no-unlimited-disable': 'warn',
    'import/first': 'warn',
    'import/newline-after-import': 'warn',
    'import/no-named-as-default': 'off',
    'import/no-duplicates': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-duplicate-imports': 'warn',
    'no-extra-boolean-cast': 'warn',
    'no-nested-ternary': 'warn',
    'no-unused-vars': 'off',
    'react/display-name': 'off',
    'react/jsx-boolean-value': 'warn',
    'react/jsx-sort-props': [
      'warn',
      {
        ignoreCase: false,
        noSortAlphabetically: false,
        reservedFirst: ['key', 'ref'],
      },
    ],
    'react/no-unescaped-entities': 'off',
    'react/react-in-jsx-scope': 'off',
    'react-hooks/exhaustive-deps': [
      'warn',
      {
        additionalHooks: '(useIsomorphicLayoutEffect)',
      },
    ],
    'simple-import-sort/exports': 'warn',
    'simple-import-sort/imports': 'warn',
    'sort-destructure-keys/sort-destructure-keys': ['warn', { caseSensitive: false }],
  },
  overrides: [
    // Enable the rule specifically for TypeScript files
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        '@typescript-eslint/ban-ts-comment': 'off',
        '@typescript-eslint/ban-types': [
          'error',
          {
            extendDefaults: true,
            types: {
              // un-ban a type that's banned by default
              '{}': false,
              Function: false,
            },
          },
        ],
        '@typescript-eslint/consistent-type-imports': ['warn', { fixStyle: 'inline-type-imports' }],
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-var-requires': 'error',
        'react/prop-types': 'off',
        'typescript-sort-keys/interface': 'warn',
        'typescript-sort-keys/string-enum': 'warn',
        'simple-import-sort/imports': [
          'warn',
          {
            groups: [
              ['^react', '^@?\\w'], // Packages `react` related packages come first.
              ['^@(kpi_admin)(/.*|$)'], // Internal packages.
              ['^@(components|constants|hooks|libs|modules|theme|types|utils)(/.*|$)'], // Internal packages.
              ['^\\u0000'], // Side effect imports.
              ['^\\.', '^\\.\\.(?!/?$)', '^\\.\\./?$'], // parent imports. Put `..` last.
              // Other relative imports. Put same-folder imports and `.` last.
              ['^\\./(?=.*/)(?!/?$)', '^\\.(?!/?$)', '^\\./?$'],
              ['^.+\\.?(css)$'], // Style imports.
            ],
          },
        ],
      },
    },
    {
      files: ['.storybook/**/*.{ts,tsx}'],
      parserOptions: {
        project: ['.storybook/tsconfig.json'],
      },
    },
  ],
};
