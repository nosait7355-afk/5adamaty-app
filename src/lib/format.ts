/**
 * دوال التنسيق الموحّدة.
 *
 * قاعدة من الصور المرجعية (UI_ANALYSIS §1.2): كل الأرقام والتواريخ والأسعار
 * تُعرض بأرقام **لاتينية** داخل النص العربي — `150 ج.م`، `4.8`، `#1026`،
 * `010 1234 5678`. لذلك نستخدم `ar-EG-u-nu-latn` في كل مكان ولا نستخدم
 * `ar-EG` وحدها (لأنها تُخرج أرقامًا هندية ٠١٢٣).
 */

const LOCALE = 'ar-EG-u-nu-latn';

/** رقم عادي بفواصل آلاف لاتينية. مثال: 3250 → "3,250" */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat(LOCALE).format(value);
}

/** سعر بالجنيه المصري كما يظهر في الصور. مثال: 150 → "150 ج.م" */
export function formatPrice(value: number): string {
  return `${formatNumber(value)} ج.م`;
}

/** نطاق سعري. مثال: (100, 500) → "100 - 500 ج.م" */
export function formatPriceRange(min: number, max?: number | null): string {
  if (max == null || max === min) return formatPrice(min);
  return `${formatNumber(min)} - ${formatNumber(max)} ج.م`;
}

/** "بيدأ من 150 ج.م" — الصيغة المستخدمة في بطاقات الخدمات (الصورة 09). */
export function formatPriceFrom(value: number): string {
  return `بيدأ من ${formatPrice(value)}`;
}

/** تقييم بخانة عشرية واحدة. مثال: 4.75 → "4.8" */
export function formatRating(value: number): string {
  if (!Number.isFinite(value)) return '0.0';
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

/** رقم الطلب كما في الصور. مثال: 10245 → "#10245" */
export function formatOrderNumber(value: number | string): string {
  return `#${value}`;
}

/**
 * رقم هاتف مصري بالتجميع الظاهر في الصور: "010 1234 5678".
 * يقبل الصيغ: 01012345678 · +201012345678 · 201012345678
 */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const local = digits.startsWith('20') && digits.length === 12 ? `0${digits.slice(2)}` : digits;
  if (local.length !== 11) return raw;
  return `${local.slice(0, 3)} ${local.slice(3, 7)} ${local.slice(7)}`;
}

/** تحويل أي صيغة مصرية إلى E.164 للتخزين. مثال: "010 1234 5678" → "+201012345678" */
export function toE164Egypt(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (/^01\d{9}$/.test(digits)) return `+20${digits.slice(1)}`;
  if (/^201\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}

/** تاريخ كامل كما في الصور. مثال: "الخميس 23 مايو 2024" */
export function formatDate(input: Date | string | number): string {
  const date = toDate(input);
  if (!date) return '';
  return new Intl.DateTimeFormat(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** تاريخ مختصر. مثال: "02 مايو 2025" */
export function formatDateShort(input: Date | string | number): string {
  const date = toDate(input);
  if (!date) return '';
  return new Intl.DateTimeFormat(LOCALE, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** وقت بصيغة 12 ساعة. مثال: "10:30 ص" */
export function formatTime(input: Date | string | number): string {
  const date = toDate(input);
  if (!date) return '';
  return new Intl.DateTimeFormat(LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/** تاريخ + وقت كما في ترويسة تفاصيل الطلب. مثال: "02 مايو 2025 - 10:30 ص" */
export function formatDateTime(input: Date | string | number): string {
  const date = toDate(input);
  if (!date) return '';
  return `${formatDateShort(date)} - ${formatTime(date)}`;
}

/** نطاق زمني. مثال: "من 10:00 ص إلى 12:00 م" */
export function formatTimeRange(from: Date | string | number, to?: Date | string | number): string {
  const start = formatTime(from);
  if (!to) return start;
  return `من ${start} إلى ${formatTime(to)}`;
}

/**
 * وقت نسبي عربي كما في شاشة الإشعارات (الصورة 15):
 * "منذ 10 دقائق" · "منذ ساعتين" · "أمس" · "الأحد"
 */
export function formatRelativeTime(input: Date | string | number, now: Date = new Date()): string {
  const date = toDate(input);
  if (!date) return '';

  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.round(diffMs / 60_000);

  if (diffMin < 1) return 'الآن';
  if (diffMin < 60) return `منذ ${pluralizeAr(diffMin, 'دقيقة', 'دقيقتين', 'دقائق')}`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `منذ ${pluralizeAr(diffHours, 'ساعة', 'ساعتين', 'ساعات')}`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'أمس';
  if (diffDays < 7) return `منذ ${pluralizeAr(diffDays, 'يوم', 'يومين', 'أيام')}`;

  return formatDateShort(date);
}

/**
 * صيغة المعدود العربية **بدون** الرقم.
 * 1 → مفرد · 2 → مثنى · 3–10 → جمع · 11+ → مفرد ("11 سنة" لا "11 سنوات").
 */
export function pluralWordAr(count: number, one: string, two: string, few: string): string {
  if (count === 1) return one;
  if (count === 2) return two;
  if (count >= 3 && count <= 10) return few;
  return one;
}

/**
 * التعددية العربية الكاملة (رقم + معدود).
 *
 * ملاحظة نحوية: المفرد والمثنى يحملان العدد في صيغتهما، فلا يُسبقان برقم:
 * "دقيقة" لا "1 دقيقة"، و"دقيقتين" لا "2 دقيقتين".
 * أما 3 فأكثر فيُسبق بالرقم: "5 دقائق"، "11 دقيقة".
 */
export function pluralizeAr(count: number, one: string, two: string, few: string): string {
  if (count === 1) return one;
  if (count === 2) return two;
  return `${formatNumber(count)} ${pluralWordAr(count, one, two, few)}`;
}

/** "124 خدمة" / "خدمتان" — كما في بطاقات التصنيفات (الصورة 08). */
export function formatServicesCount(count: number): string {
  return pluralizeAr(count, 'خدمة', 'خدمتان', 'خدمات');
}

/**
 * "+10 سنوات خبرة" — كما في بطاقات الخدمات (الصورة 09).
 * الرقم يُكتب دائمًا هنا (بعكس `pluralizeAr`) لأن الصيغة المصمَّمة تبدأ بـ "+N".
 */
export function formatExperience(years: number): string {
  return `+${formatNumber(years)} ${pluralWordAr(years, 'سنة', 'سنتان', 'سنوات')} خبرة`;
}

/**
 * عنوان نصي كامل — لا إحداثيات ولا خرائط (ARCHITECTURE §0.2).
 * مثال: "الفيوم - حي الجامعة - شارع أحمد شوقي، بجوار مدرسة النور"
 */
export function formatAddress(parts: {
  governorate?: string | null;
  city?: string | null;
  area?: string | null;
  line?: string | null;
  landmark?: string | null;
}): string {
  const main = [parts.governorate, parts.city, parts.area, parts.line]
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p))
    .join(' - ');

  const landmark = parts.landmark?.trim();
  return landmark ? `${main}، ${landmark}` : main;
}

/** قصّ نص طويل بثلاث نقاط. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

function toDate(input: Date | string | number): Date | null {
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}
