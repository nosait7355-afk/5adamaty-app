/**
 * بانرات الرئيسية — تديرها الإدارة من لوحة التحكم (`/admin/banners`).
 */

/** ألوان خلفية الشريحة — كلها رموز في globals.css، فتعمل في الوضع الليلي. */
export const BANNER_TONES = ['brand', 'success', 'warning', 'purple'] as const;
export type BannerTone = (typeof BANNER_TONES)[number];

export const BANNER_TONE_LABELS_AR: Record<BannerTone, string> = {
  brand: 'أزرق',
  success: 'أخضر',
  warning: 'برتقالي',
  purple: 'بنفسجي',
};

/** الرسومات المضمّنة في `public/banners/{art}.svg` — بديل رفع صورة. */
export const BANNER_ARTS = ['all-services', 'direct-contact'] as const;
export type BannerArt = (typeof BANNER_ARTS)[number];

export const BANNER_ART_LABELS_AR: Record<BannerArt, string> = {
  'all-services': 'تليفون وخدمات',
  'direct-contact': 'اتصال وواتساب ودفع',
};

/** سقف عدد البانرات — شرائح كثيرة لا يراها أحد قبل أن يتجاوز البانر. */
export const MAX_BANNERS = 8;

export interface DefaultBanner {
  /** مفتاح ثابت يمنع إنشاء الافتراضيات مرتين (فهرس فريد). */
  key: string;
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  tone: BannerTone;
  art: BannerArt;
  order: number;
}

/**
 * البانران الأصليان — يُنشآن تلقائيًا أول مرة تُقرأ فيها البانرات وقاعدة
 * البيانات خالية منها (الإنتاج لا يُبذر)، ثم تعدّلهما الإدارة كأي بانر.
 */
export const DEFAULT_BANNERS: readonly DefaultBanner[] = [
  {
    key: 'all-services',
    title: 'كل خدمات الفيوم في مكان واحد',
    description: 'اعثر على سبّاك أو كهربائي أو طبيب وتواصل معه مباشرة بالهاتف أو واتساب.',
    ctaLabel: 'تصفّح التصنيفات',
    href: '/categories',
    tone: 'brand',
    art: 'all-services',
    order: 0,
  },
  {
    key: 'direct-contact',
    title: 'التواصل والدفع مباشر',
    description: 'نحن وسيط إعلانات فقط — تتفق على السعر وتدفع لمقدم الخدمة مباشرة.',
    ctaLabel: 'اعرف أكثر',
    href: '/help',
    tone: 'success',
    art: 'direct-contact',
    order: 1,
  },
];

/**
 * رابط زر البانر: مسار داخل التطبيق فقط (يبدأ بـ`/` لا `//`).
 * يمنع تحويل بانر الرئيسية إلى بوابة تصيّد خارجية لو اختُرق حساب إداري.
 */
export const BANNER_HREF_PATTERN = /^\/(?!\/)[A-Za-z0-9\-._~/?=&%#]*$/;
