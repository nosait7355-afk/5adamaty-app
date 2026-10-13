/**
 * تطبيق «خدمات الفيوم» على أندرويد — الواجهة محمَّلة داخل الـAPK وتكلّم
 * الـAPI على Vercel من مصدر مختلف (لا كالغلاف القديم الذي يفتح الموقع نفسه).
 *
 * ملف خفيف بلا تبعيات: يستورده `proxy.ts` (CORS) والسيرفر (CSRF، الجلسة).
 */

/** اسم التطبيق المنفصل على Google Play (حساب ناشر مختلف عن «خدماتي الفيوم»). */
export const NATIVE_APP_NAME_AR = 'خدمات الفيوم';
export const NATIVE_APP_ID = 'com.khadamat.fayoum';

/**
 * مصادر WebView في Capacitor: `https://localhost` افتراضي أندرويد،
 * و`capacitor://localhost` افتراضي iOS، و`http://localhost` لو ضُبط
 * `androidScheme: 'http'`.
 */
export const NATIVE_APP_ORIGINS = [
  'https://localhost',
  'capacitor://localhost',
  'http://localhost',
] as const;

/**
 * رأس يعلن أن الطالب هو التطبيق الأصلي، فيُسلَّم التوكن في جسم الرد بدل
 * الكوكي، ويُقرأ توكن التحديث من الجسم بدل الكوكي.
 *
 * ليس إثبات هوية — أي عميل يستطيع إرساله. الأمان لا يعتمد عليه: الوضعان
 * لا يختلطان أبدًا (وضع التطبيق لا يقرأ كوكي الجلسة إطلاقًا)، فلا يستطيع
 * موقع خبيث استخراج توكنات جلسة متصفح بإرسال هذا الرأس.
 */
export const NATIVE_CLIENT_HEADER = 'x-client';
export const NATIVE_CLIENT_VALUE = 'native-app';
