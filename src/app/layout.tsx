import type { Metadata, Viewport } from 'next';
import { Cairo } from 'next/font/google';
import { headers } from 'next/headers';
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
  themeColor: '#1156e0',
  // ضروري لاحترام safe areas على iPhone
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  /*
   * قراءة `headers()` هنا مقصودة لذاتها لا لقيمتها: تُدخل التخطيط في العرض
   * الديناميكي لكل طلب، فيلتقط Next.js تلقائيًا الـnonce من ترويسة CSP
   * الصادرة (`src/proxy.ts`) ويُلحقه بسكربتات الإقلاع والترطيب الداخلية —
   * دون أي تعديل يدوي آخر (بند Phase 10: تشديد CSP إلى nonce).
   */
  await headers();

  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
