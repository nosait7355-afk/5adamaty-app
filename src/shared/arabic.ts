/**
 * مطابقة نص عربي كما يكتبه الناس فعلًا: بلا تشكيل ولا همزات دقيقة.
 *
 * الكتالوج مكتوب بعناية («سبّاك»، «محامٍ»، «إطسا») والمستخدم يكتب «سباك»
 * و«محامي» و«اطسا». بدون هذا التطبيع لا تجد «سبا» كلمة «سبّاك» إطلاقًا.
 */

/** التشكيل (فتحة… سكون، الشدة)، الألف الخنجرية، والتطويل «ـ». */
const MARKS = /[ً-ٰٟـ]/;
const MARKS_GLOBAL = new RegExp(MARKS.source, 'g');

/** حرف واحد بعد التطبيع — كل الأشكال المتقاربة تصير شكلًا واحدًا. */
function foldChar(char: string): string {
  switch (char) {
    case 'أ':
    case 'إ':
    case 'آ':
    case 'ٱ':
      return 'ا';
    case 'ى':
      return 'ي';
    case 'ة':
      return 'ه';
    default:
      return char.toLowerCase();
  }
}

/** يزيل التشكيل ويوحّد الألف والياء والتاء المربوطة. */
export function normalizeArabic(value: string): string {
  return Array.from(value.replace(MARKS_GLOBAL, ''), foldChar).join('');
}

/**
 * موضع `query` داخل `text` بعد تطبيع الاثنين، بمواضع النص **الأصلي** —
 * لإبراز الجزء المطابق في «سبّاك» حين يكتب المستخدم «سبا». `null` إن لم يطابق.
 */
export function findArabic(text: string, query: string): { start: number; end: number } | null {
  const needle = normalizeArabic(query.trim());
  if (!needle) return null;

  // النص مطبَّعًا، مع موضع كل حرف منه في الأصل
  let folded = '';
  const origin: number[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const char = text.charAt(index);
    if (MARKS.test(char)) continue;
    folded += foldChar(char);
    origin.push(index);
  }

  const at = folded.indexOf(needle);
  if (at === -1) return null;

  const start = origin[at] ?? 0;
  let end = (origin[at + needle.length - 1] ?? start) + 1;
  // التشكيل الملاصق لآخر حرف مطابق جزء منه («سبّ» لا «سب»)
  while (end < text.length && MARKS.test(text.charAt(end))) end += 1;
  return { start, end };
}

/** هل يحتوي النص على الاستعلام بعد التطبيع؟ */
export function includesArabic(text: string, query: string): boolean {
  return findArabic(text, query) !== null;
}

/**
 * نمط تعبير نمطي آمن يطابق الاستعلام مهما كان تشكيل النص المخزَّن أو
 * همزاته — للبحث الجزئي في MongoDB.
 *
 * كل حرف من نص المستخدم يُهرَّب أو يصير صنف حروف ثابتًا، ويتبعه
 * `[تشكيل]*` فقط: لا مُكمّمات متداخلة يتحكم فيها المستخدم، فلا خطر ReDoS.
 */
export function arabicSearchPattern(query: string): string {
  const marks = `[${MARKS.source.slice(1, -1)}]*`;
  return Array.from(normalizeArabic(query.trim()), (char) => {
    switch (char) {
      case 'ا':
        return `[اأإآٱ]${marks}`;
      case 'ي':
        return `[يى]${marks}`;
      case 'ه':
        return `[هة]${marks}`;
      default:
        return `${char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${marks}`;
    }
  }).join('');
}
