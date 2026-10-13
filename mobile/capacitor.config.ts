import type { CapacitorConfig } from '@capacitor/cli';

/**
 * تطبيق «خدمات الفيوم» — تطبيق مستقل عن «خدماتي الفيوم» (`../capacitor.config.ts`):
 * معرّف مختلف، ومفتاح توقيع مختلف، ويُنشر من حساب Google Play آخر.
 *
 * الفرق الجوهري عن الغلاف القديم: لا `server.url`. الواجهة كلها محمَّلة
 * من داخل الـAPK (`dist/`، يبنيها `npm run mobile:build`)، والـAPI وحده من
 * الخادم — بتوكن في `Authorization` لا بالكوكيز
 * (`src/server/lib/session-transport.ts`).
 */
const config: CapacitorConfig = {
  appId: 'com.khadamat.fayoum',
  appName: 'خدمات الفيوم',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    /*
     * الواجهة محلية فترسم خلال لحظات — `NativeBridge` يخفي الشاشة عند
     * التحميل، والمدة هنا حدّ أقصى للأمان فقط.
     */
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 3000,
      launchFadeOutDuration: 200,
      backgroundColor: '#1156e0',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DEFAULT',
      backgroundColor: '#ffffff',
    },
    /*
     * جوجل فقط — يحتاج عميل OAuth أندرويد بالمعرّف الجديد وبصمة SHA-1 من
     * Play App Signing في الحساب الجديد (انظر mobile/README.md).
     */
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false,
      },
    },
  },
};

export default config;
