/**
 * رسومات التخصصات المضمّنة في `public/professions/{slug}.svg` — بنفس أسلوب
 * رسومات التصنيفات (دائرة ملوّنة كاملة ورسمة مسطّحة في وسطها).
 *
 * تظهر مكان أيقونة المهنة: في شبكة التخصصات، واقتراحات البحث، وصورة
 * الخدمة أو مقدم الخدمة حين لا توجد صورة حقيقية.
 */
const PROFESSION_ART_SLUGS = new Set([
  'plumber',
  'electrician',
  'painter',
  'ac-technician',
  'carpenter',
  'cleaner',
  'pest-control',
  'appliance-technician',
  'moving',
  'car-mechanic',
  'computer-technician',
  'hairdresser',
  'doctor',
  'pharmacist',
  'physiotherapist',
  'lawyer',
  'accountant',
  'private-tutor',
  'event-planner',
  'photographer',
  'driver',
  'real-estate-marketing',
  'delivery-courier',
]);

/** مسار رسمة التخصص، أو `undefined` لتخصص جديد بلا رسمة — فتبقى أيقونته. */
export function professionArtSrc(slug: string | undefined): string | undefined {
  return slug && PROFESSION_ART_SLUGS.has(slug) ? `/professions/${slug}.svg` : undefined;
}
