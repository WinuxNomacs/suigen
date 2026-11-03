// ESLint 9 flat config. Same rule sets as the former .eslintrc.json.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['node_modules/', 'out/', 'dist/', '.vite/'] },
  {
    files: ['**/*.ts', '**/*.tsx'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      importPlugin.flatConfigs.recommended,
      importPlugin.flatConfigs.electron,
      importPlugin.flatConfigs.typescript,
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
    },
    settings: {
      'import/resolver': { typescript: true },
    },
    rules: {
      'no-restricted-syntax': ['error', {
        selector: 'AssignmentExpression > MemberExpression[property.name=/^(innerHTML|outerHTML)$/]',
        message: 'Build DOM nodes and set textContent instead (plan item 3.4): HTML strings are an injection risk.',
      }],
    },
  },
);
