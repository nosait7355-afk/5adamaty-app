import type { CapacitorConfig } from '@capacitor/cli';

/**
 * تطبيق أندرويد بغلاف Capacitor حول التطبيق المنشور — لا `next export`.
 *
 * السبب: التطبيق يعتمد كليًا على SSR ومسارات API (مصادقة بكوكيز httpOnly،
 * لوحة إدارة، رفع مستندات موقّع) — التصدير الساكن يكسرها جميعًا. الغلاف
 * هنا يفتح WebView على رابط الإنتاج المنشور، ويضيف طبقة أندرويد أصلية رفيعة
 * فوقه (شاشة بداية، أيقونة، زر الرجوع، إشعارات Push) — نفس نمط WebView حول
 * تطبيق مُستضاف، شائع لتطبيقات SSR الثقيلة.
 *
 * انظر PHASE_10_REVIEW.md لتفاصيل حاجز البيئة (لا JDK مثبّتًا في صندوق
 * التطوير هذا، فبناء AAB/APK فعلي يتم عبر GitHub Actions بدلًا من محليًا —
 * `.github/workflows/android-debug-apk.yml`).
 */
const config: CapacitorConfig = {
  appId: 'com.khadamaty.elfayoum',
  appName: 'خدماتي الفيوم',
  webDir: 'public',
  server: {
    url: process.env.CAPACITOR_SERVER_URL ?? 'https://5adamaty-app.vercel.app',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#1156e0',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1156e0',
    },
  },
};

export default config;
