import type { Metadata, Viewport } from 'next';
import { Cairo } from 'next/font/google';
import { connection } from 'next/server';
import { Suspense } from 'react';
import '@/styles/globals.css';
import { AppProviders } from '@/app/providers';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '600', '700', '800'],
  display: 'swap',
  variable: '--font-cairo',
});

export const metadata: Metadata = {
  title: {
    default: 'خدماتي الفيوم',
    template: '%s | خدماتي الفيوم',
  },
  description: 'كل الخدمات في مكان واحد — منصة تربط العملاء بمقدمي الخدمات في محافظة الفيوم',
  applicationName: 'خدماتي الفيوم',
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  // بلون الهيدر — شريط المتصفح/النظام يبدو امتدادًا للصفحة لا شريطًا منفصلًا،
  // في الوضعين (قيمة الداكن = `--color-surface` الليلي في globals.css)
  /*
   * يعلن أن الصفحة تدعم الوضعين بنفسها: WebView أندرويد لا يطبّق «التعتيم
   * الآلي» فوق ألواننا، وعناصر النماذج الأصلية تأخذ لون الوضع الحالي.
   */
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#151b26' },
  ],
  // ضروري لاحترام safe areas على iPhone
  viewportFit: 'cover',
};

/**
 * يُدخل كل صفحة في العرض الديناميكي لكل طلب، فيلتقط Next.js تلقائيًا الـnonce
 * من ترويسة CSP الصادرة (`src/proxy.ts`) ويُلحقه بسكربتات الإقلاع والترطيب
 * (بند Phase 10: تشديد CSP إلى nonce). لا يرسم شيئًا.
 *
 * ⚠️ كان `await headers()` في جسم التخطيط نفسه، فكان **كل تنقّل ينتظر** حتى
 * يرسم الخادم التخطيط، ولا يظهر `loading.tsx` أبدًا (توثيق layout.js —
 * «Interaction with loading.js»). داخل `<Suspense>` يبقى الأثر نفسه — طلب
 * ديناميكي بـnonce — دون أن يحجب التنقّل.
 */
async function RequestTimeRendering() {
  await connection();
  return null;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body>
        <Suspense fallback={null}>
          <RequestTimeRendering />
        </Suspense>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
