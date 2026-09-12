import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
  {
    // Verification scripts are plain Node utilities, not application code.
    files: ['scripts/**/*.{mjs,cjs,js}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
      // These scripts destructure `{ field: _field, ...rest }` to build a
      // fixture that's missing one field — `_field` is deliberately unused,
      // it exists only so `...rest` excludes it. ignoreRestSiblings targets
      // exactly that pattern, not unused variables generally.
      '@typescript-eslint/no-unused-vars': ['warn', { ignoreRestSiblings: true }],
    },
  },
];

export default eslintConfig;
