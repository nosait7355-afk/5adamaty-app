import {
  FORBIDDEN_MIME_TYPES,
  MAGIC_HEADER_BYTES,
  MAGIC_SIGNATURES,
} from '@/shared/constants/uploads';

/**
 * التعرّف على نوع الملف من محتواه الفعلي (magic bytes).
 *
 * يعمل في المتصفح وعلى السيرفر معًا: المتصفح يستخدمه لرفض الملف مبكرًا
 * قبل استهلاك رفعة، والسيرفر يستخدمه كفحص ملزم عند التوقيع.
 *
 * ⚠️ لا تعتمد على `File.type` ولا على الامتداد — كلاهما من العميل وقابل
 * للتزوير. هذه الدالة تقرأ البايتات نفسها.
 */

/** يطابق تسلسل بايتات مع بداية المخزن. */
function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/** WEBP يحتاج فحصًا مزدوجًا: "RIFF" في 0 و"WEBP" في 8. */
function isWebp(bytes: Uint8Array): boolean {
  const RIFF = [0x52, 0x49, 0x46, 0x46];
  const WEBP = [0x57, 0x45, 0x42, 0x50];
  return startsWith(bytes, RIFF, 0) && startsWith(bytes, WEBP, 8);
}

/**
 * يعيد نوع MIME الحقيقي، أو `null` إذا لم يطابق أي نوع مسموح.
 * `null` تعني «ارفض» — لا نخمّن ولا نتساهل.
 */
export function sniffMimeType(header: Uint8Array): string | null {
  if (isWebp(header)) return 'image/webp';

  for (const [mime, signatures] of Object.entries(MAGIC_SIGNATURES)) {
    if (mime === 'image/webp') continue; // عولج أعلاه
    for (const signature of signatures) {
      if (startsWith(header, signature)) return mime;
    }
  }
  return null;
}

export interface FileValidationResult {
  ok: boolean;
  /** النوع الحقيقي المكتشف من المحتوى. */
  detectedMime?: string;
  /** رسالة عربية جاهزة للعرض. */
  error?: string;
}

/**
 * يتحقق من الملف: النوع الحقيقي + الحجم + قائمة السماح.
 *
 * ترتيب الفحوص مقصود: نرفض المحظور صراحةً أولًا، ثم نتحقق أن النوع الحقيقي
 * ضمن المسموح، ثم أن المُعلن يطابق الحقيقي، ثم الحجم.
 */
export function validateFileHeader(params: {
  header: Uint8Array;
  /** النوع الذي أعلنه العميل — يُستخدم للمقارنة فقط، لا للثقة. */
  declaredMime: string;
  sizeBytes: number;
  accept: readonly string[];
  maxSizeMB: number;
}): FileValidationResult {
  const { header, declaredMime, sizeBytes, accept, maxSizeMB } = params;

  // 1) رفض صريح للأنواع الخطرة مهما ادّعى العميل
  if ((FORBIDDEN_MIME_TYPES as readonly string[]).includes(declaredMime)) {
    return { ok: false, error: 'نوع الملف غير مسموح به.' };
  }

  // 2) النوع الحقيقي من المحتوى
  const detectedMime = sniffMimeType(header);
  if (!detectedMime) {
    return {
      ok: false,
      error: 'تعذّر التعرّف على نوع الملف. ارفع صورة JPG أو PNG أو WEBP أو ملف PDF.',
    };
  }

  // 3) النوع الحقيقي ضمن المسموح لهذا الغرض
  if (!accept.includes(detectedMime)) {
    return { ok: false, detectedMime, error: 'نوع الملف غير مسموح به.' };
  }

  /*
   * 4) تطابق المُعلن مع الحقيقي.
   * الاختلاف يعني إما خطأ في المتصفح أو محاولة تحايل — نرفض في الحالتين.
   */
  if (declaredMime && declaredMime !== detectedMime) {
    return {
      ok: false,
      detectedMime,
      error: 'محتوى الملف لا يطابق نوعه المُعلن.',
    };
  }

  // 5) الحجم
  if (sizeBytes <= 0) {
    return { ok: false, detectedMime, error: 'الملف فارغ.' };
  }
  const maxBytes = maxSizeMB * 1024 * 1024;
  if (sizeBytes > maxBytes) {
    return {
      ok: false,
      detectedMime,
      error: `حجم الملف يتجاوز الحد المسموح (${maxSizeMB}MB).`,
    };
  }

  return { ok: true, detectedMime };
}

/** يقرأ أول بايتات من ملف في المتصفح. */
export async function readFileHeader(file: File): Promise<Uint8Array> {
  const slice = file.slice(0, MAGIC_HEADER_BYTES);
  const buffer = await slice.arrayBuffer();
  return new Uint8Array(buffer);
}
