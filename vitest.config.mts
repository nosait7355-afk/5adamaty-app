import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    css: false,
    // اختبارات قاعدة البيانات تُقلع mongod حقيقيًا على القرص — مهلة أطول
    testTimeout: 30_000,
    hookTimeout: 90_000,

    /*
     * بيئتان منفصلتان:
     *  - jsdom لاختبارات المكوّنات (تحتاج DOM).
     *  - node لاختبارات السيرفر وقاعدة البيانات.
     *
     * الفصل ضروري لا تحسين: jsdom يوفّر TextEncoder من realm مختلف،
     * فيرفض jose المفتاح الناتج عنه بـ«Received an instance of Uint8Array».
     */
    projects: [
      {
        extends: true,
        test: {
          name: 'ui',
          environment: 'jsdom',
          setupFiles: ['./tests/setup.ts'],
          include: ['tests/unit/**/*.test.tsx'],
        },
      },
      {
        extends: true,
        test: {
          name: 'server',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts', 'tests/db/**/*.test.ts', 'tests/api/**/*.test.ts'],
          exclude: ['tests/unit/**/*.test.tsx'],
          /*
           * كل ملف اختبار قاعدة بيانات يُقلع mongod بذاته. تشغيلها بالتوازي
           * يُحمّل القرص بعدة عمليات mongod معًا فيتجاوز مهلة الإقلاع على
           * أجهزة القرص البطيء — فنشغّلها تباعًا بدل ذلك.
           */
          fileParallelism: false,
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
