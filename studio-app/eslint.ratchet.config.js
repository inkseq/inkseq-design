// Broader lint rules counted by tools/check-lint.mjs (maintainability audit, 2026-10-26).
// Existing findings are a baseline that may only go down; the strict set in eslint.config.js
// still fails on any finding.
import js from '@eslint/js';
import hooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { 'react-hooks': hooks },
    rules: {
      ...js.configs.recommended.rules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Sanitisers strip control characters on purpose.
      'no-control-regex': 'off',
      // Unused catch bindings and leading-underscore placeholders are intentional. Vite builds JSX
      // in classic mode (React.createElement), so the React import is always needed.
      'no-unused-vars': [
        'warn',
        { caughtErrors: 'none', argsIgnorePattern: '^_', varsIgnorePattern: '^(_|React$)' },
      ],
      complexity: ['warn', 25],
      'max-lines-per-function': ['warn', { max: 200, skipBlankLines: true, skipComments: true }],
    },
  },
];
