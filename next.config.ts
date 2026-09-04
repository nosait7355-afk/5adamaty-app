import type { NextConfig } from 'next';

/**
 * Security headers applied to every response.
 *
 * NOTE (NON-NEGOTIABLE — see ARCHITECTURE.md §0.2):
 * `geolocation=()` disables the Geolocation API outright. The app has no maps,
 * no GPS, no tracking and no ETA of any kind. Do not relax this.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  {
    key: 'Permissions-Policy',
    value: [
      'geolocation=()',
      'camera=(self)',
      'microphone=()',
      'payment=()',
      'usb=()',
      'magnetometer=()',
      'gyroscope=()',
      'interest-cohort=()',
    ].join(', '),
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  /*
   * لا يوجد Content-Security-Policy هنا عمدًا: القيمة تحتاج nonce يتغيّر مع
   * كل طلب، وهذا الملف الساكن لا يقدر على ذلك. الـCSP الفعلي — القائم على
   * nonce، بلا `unsafe-inline` — يُبنى في `src/proxy.ts` لكل صفحة.
   * (استجابات الـAPI والأصول الثابتة مستثناة من مطابقة `proxy.ts أصلًا، ولا
   * تُنفّذ سكربتات فتُغني عن الحاجة لـCSP.)
   */
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Only Cloudinary is allowed as a remote image source.
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
