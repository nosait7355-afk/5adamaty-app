import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'android/**', 'next-env.d.ts', 'coverage/**'],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // تحديد نسخة React صراحةً — يتجاوز دالة الكشف التلقائي في
    // eslint-plugin-react المضمّن، وهي غير متوافقة مع ESLint 10.
    settings: { react: { version: '19.0' } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // ممنوع حقن HTML خام — حماية من XSS (ARCHITECTURE §7)
      'react/no-danger': 'error',
    },
  },
  {
    // السجل وسكربتات CLI وحدود الخطأ تحتاج console
    files: [
      'src/server/lib/logger.ts',
      'scripts/**/*.mjs',
      'scripts/**/*.mts',
      'src/app/error.tsx',
    ],
    rules: { 'no-console': 'off' },
  },
];

export default config;
