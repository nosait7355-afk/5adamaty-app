/**
 * اسم المنتج كما يراه المستخدم — يختلف حسب ما يُبنى:
 *
 * - الموقع (وغلافه القديم على أندرويد): «خدماتي الفيوم».
 * - تطبيق «خدمات الفيوم» (`mobile/`): يضبط `NEXT_PUBLIC_BRAND_NAME` وقت
 *   البناء في `mobile/vite.config.ts`.
 *
 * الصفحات القانونية تذكر الاسمين صراحةً (`APP_NAME_AR` و`NATIVE_APP_NAME_AR`)
 * لأن السياسة نفسها تغطي المنتجين — لا تستبدلها بهذا.
 */
export const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME || 'خدماتي الفيوم';

/**
 * رابط عام يفتحه أي أحد (مشاركة ملف مقدم خدمة، نسخ رابط الموقع).
 *
 * في الموقع هو نفس المصدر. في التطبيق المصدر `https://localhost` — لا
 * يفتحه أحد خارج الجهاز — فيُضبط `NEXT_PUBLIC_SITE_URL` لرابط الموقع.
 */
export function publicUrl(path = ''): string {
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  return `${origin}${path}`;
}
