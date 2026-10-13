import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { THEME_SCRIPT, THEME_SCRIPT_HASH } from '../src/shared/theme';
import { NATIVE_APP_NAME_AR } from '../src/shared/constants/native-app';

/**
 * بناء واجهة تطبيق «خدمات الفيوم» — نفس صفحات `src/app` ومكوّناتها،
 * محزومة كتطبيق صفحة واحدة يُحمَّل من داخل الـAPK (`dist/` ← Capacitor).
 *
 * `next/link` و`next/navigation` و`next/image` تُستبدل ببدائل فوق
 * react-router (`src/shims/`) — الصفحات لا تعرف الفرق.
 */

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

const DEFAULT_API_ORIGIN = 'https://5adamaty-app.vercel.app';

/**
 * سكربت المظهر قبل أول رسم (كما في `src/app/layout.tsx`)، و CSP في نسخة
 * البناء فقط — خادم التطوير يحقن سكربتات مضمّنة لإعادة التحميل الحي.
 */
const CHARSET_META = /<meta charset="UTF-8" \/>/;

function htmlHead(apiOrigin: string): Plugin {
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'sha256-${THEME_SCRIPT_HASH}'`,
    // خاصية style="" المضمّنة من React — نفس استثناء الموقع (src/proxy.ts)
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://res.cloudinary.com",
    "media-src 'self' blob: https://res.cloudinary.com",
    "font-src 'self' data:",
    `connect-src 'self' ${apiOrigin} https://api.cloudinary.com https://accounts.google.com https://www.googleapis.com`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  return {
    name: 'khadamat-html-head',
    transformIndexHtml: {
      order: 'pre',
      // بعد `<meta charset>` مباشرة: يجب أن يبقى في أول 1024 بايت، والـCSP
      // يجب أن يسبق كل سكربت ليسري عليه
      handler(html, context) {
        const head = [
          ...(context.server ? [] : [`<meta http-equiv="Content-Security-Policy" content="${csp}" />`]),
          `<script>${THEME_SCRIPT}</script>`,
        ].join('\n    ');
        return html.replace(CHARSET_META, (charset) => `${charset}\n    ${head}`);
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, here('.'), ['VITE_', 'NEXT_PUBLIC_']);
  const apiOrigin = (env.VITE_API_ORIGIN || DEFAULT_API_ORIGIN).replace(/\/+$/, '');

  return {
    root: here('.'),
    envDir: here('.'),
    // نفس أصول الموقع (الشعار، أيقونات التصنيفات والمهن، البانرات)
    publicDir: here('../public'),
    plugins: [react(), tailwindcss(), htmlHead(apiOrigin)],
    resolve: {
      alias: [
        { find: /^next\/link$/, replacement: here('src/shims/next-link.tsx') },
        { find: /^next\/navigation$/, replacement: here('src/shims/next-navigation.ts') },
        { find: /^next\/image$/, replacement: here('src/shims/next-image.tsx') },
        { find: /^@\/(.*)$/, replacement: `${here('../src')}/$1` },
      ],
    },
    define: {
      // الشيفرة المشتركة تقرأ هذه من `process.env` كما في Next
      'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
      'process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID': JSON.stringify(env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''),
      'process.env.APP_URL': JSON.stringify(apiOrigin),
      // `src/shared/brand.ts`: اسم هذا التطبيق، وروابط المشاركة للموقع لا لـlocalhost
      'process.env.NEXT_PUBLIC_BRAND_NAME': JSON.stringify(NATIVE_APP_NAME_AR),
      'process.env.NEXT_PUBLIC_SITE_URL': JSON.stringify(apiOrigin),
      // Push يعمل فقط حين يوجد ملف Firebase — بدونه يُسقط register() التطبيق (src/push.tsx)
      __PUSH_ENABLED__: JSON.stringify(existsSync(here('android/app/google-services.json'))),
    },
    build: {
      outDir: here('dist'),
      emptyOutDir: true,
      target: 'es2022',
    },
    server: { port: 5173, strictPort: true },
  };
});
