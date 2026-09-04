/**
 * تحسين روابط صور Cloudinary.
 *
 * الخادم يخزّن الرابط الأصلي كاملًا في `MediaRef.url`. عرضه كما هو يحمّل
 * الصورة بأبعادها الأصلية (قد تكون 4000px) داخل مربع 120px — فنحقن
 * تحويلات الاقتصاص والجودة في الرابط قبل العرض.
 *
 * `q_auto` و`f_auto` يتركان الجودة والصيغة (AVIF/WebP) لتفاوض Cloudinary
 * مع المتصفح، و`dpr_auto` يضاعف الدقة على الشاشات عالية الكثافة.
 */

const UPLOAD_MARKER = '/upload/';

export interface CloudinaryTransformOptions {
  width: number;
  height?: number;
  /** `fill` يقتصّ للأبعاد المطلوبة، `fit` يحافظ على الصورة كاملة داخلها. */
  crop?: 'fill' | 'fit';
}

export function cloudinaryUrl(
  url: string | undefined,
  { width, height, crop = 'fill' }: CloudinaryTransformOptions
): string | undefined {
  if (!url) return undefined;

  const markerIndex = url.indexOf(UPLOAD_MARKER);
  // رابط من مصدر آخر أو بصيغة غير متوقّعة — يُعاد كما هو بلا كسر
  if (markerIndex === -1) return url;

  const transforms = [
    `c_${crop}`,
    `w_${Math.round(width)}`,
    ...(height ? [`h_${Math.round(height)}`] : []),
    'q_auto',
    'f_auto',
    'dpr_auto',
  ].join(',');

  const head = url.slice(0, markerIndex + UPLOAD_MARKER.length);
  const tail = url.slice(markerIndex + UPLOAD_MARKER.length);

  return `${head}${transforms}/${tail}`;
}
