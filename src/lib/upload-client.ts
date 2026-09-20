'use client';

import { api, ApiClientError } from '@/lib/api-client';
import { readFileHeader, validateFileHeader } from '@/shared/lib/file-signature';
import { UPLOAD_RULES, type UploadPurpose } from '@/shared/constants/uploads';

/**
 * رفع الملفات من المتصفح مباشرة إلى Cloudinary.
 *
 * الملف **لا يمرّ عبر سيرفر التطبيق** — السيرفر يوقّع فقط (ARCHITECTURE §8).
 * الفحص هنا للتجربة لا للأمان: يمنع رفعة ضائعة على ملف سيُرفض، لكن الفحص
 * الملزم يتم على السيرفر عند التوقيع وبعد الرفع.
 */

export interface UploadedAsset {
  publicId: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  /** رابط مباشر — فارغ للأصول الخاصة (المستندات). */
  previewUrl?: string;
}

export class UploadError extends Error {
  /**
   * `true` = الفشل عابر (انقطاع شبكة أو مهلة) فتُجدي إعادة المحاولة.
   * الأخطاء الدلالية (نوع مرفوض، حجم زائد، صلاحية ناقصة) ليست كذلك.
   */
  readonly retriable: boolean;

  constructor(message: string, retriable = false) {
    super(message);
    this.name = 'UploadError';
    this.retriable = retriable;
  }
}

/* ================================================================== */
/* ضغط الصور قبل الرفع                                                 */
/* ================================================================== */

/** فوق هذا الحجم نحاول الضغط — تحته الرفع المباشر أسرع من فكّ الترميز. */
const COMPRESS_ABOVE_BYTES = 1024 * 1024;

/** أطول ضلع بعد التصغير — يكفي تمامًا لقراءة بطاقة أو معاينة صورة. */
const MAX_IMAGE_EDGE = 1800;

const COMPRESSIBLE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/**
 * يصغّر الصورة ويعيد ترميزها JPEG قبل الرفع.
 *
 * لماذا: أكثر أسباب فشل الرفع على شبكات الموبايل ليس الرفض بل انقطاع
 * الاتصال في منتصف رفعة طويلة — وصورة من كاميرا هاتف حديث تتجاوز 4MB
 * و4000px بلا داعٍ لملف يُعرض في بطاقة صغيرة. تقليص البايتات يقلّص زمن
 * الرفع، ومعه احتمال الانقطاع، بمقدار مرتبة كاملة.
 *
 * يفشل بصمت: أي خطأ (متصفح قديم، صورة تالفة، نفاد ذاكرة) يعيد الملف الأصلي
 * بلا تغيير — الضغط تحسين لا شرط.
 */
export async function compressImage(file: File): Promise<File> {
  if (!COMPRESSIBLE_MIME.has(file.type)) return file;
  if (file.size <= COMPRESS_ABOVE_BYTES) return file;
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') return file;

  try {
    // `createImageBitmap` يحترم دوران EXIF، بخلاف `new Image()`
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await canvasToBlob(canvas, 0.82);
    // لا نستبدل الملف إلا إذا صغُر فعلًا — PNG بسيط قد يكبر بعد ترميز JPEG
    if (!blob || blob.size >= file.size) return file;

    const name = `${file.name.replace(/\.[^.]+$/, '')}.jpg`;
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}

interface SignatureResponse {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  uploadUrl: string;
  params: Record<string, string | number>;
  publicId: string;
  maxSizeMB: number;
}

/** فحص محلي مبكر — يوفّر رحلة شبكة على ملف مرفوض. */
export async function precheckFile(
  file: File,
  purpose: UploadPurpose
): Promise<{ ok: boolean; error?: string }> {
  const rule = UPLOAD_RULES[purpose];
  const header = await readFileHeader(file);

  const result = validateFileHeader({
    header,
    declaredMime: file.type,
    sizeBytes: file.size,
    accept: rule.accept,
    maxSizeMB: rule.maxSizeMB,
  });

  return result.ok ? { ok: true } : { ok: false, error: result.error ?? 'الملف غير صالح.' };
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * يرفع ملفًا ويعيد بيانات الأصل.
 * `onProgress` يتلقى نسبة من 0 إلى 100.
 */
export async function uploadFile(params: {
  file: File;
  purpose: UploadPurpose;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}): Promise<UploadedAsset> {
  const { purpose, onProgress, signal } = params;

  // الضغط أولًا: كل ما بعده (الفحص، التوقيع، الرفع) يخصّ الملف المرسَل فعلًا
  const file = await compressImage(params.file);

  const precheck = await precheckFile(file, purpose);
  if (!precheck.ok) throw new UploadError(precheck.error ?? 'الملف غير صالح.');

  /*
   * إعادة المحاولة عند الانقطاع العابر.
   *
   * كل محاولة تطلب توقيعًا جديدًا لا تعيد استخدام السابق: التوقيع يثبّت
   * `public_id` مع `overwrite: false`، فلو كانت الرفعة السابقة قد وصلت
   * Cloudinary فعلًا قبل انقطاع الرد، لارتدّت المحاولة التالية بـ«الملف
   * موجود» بدل أن تنجح.
   */
  const MAX_ATTEMPTS = 3;
  let lastError: UploadError | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await attemptUpload({
        file,
        purpose,
        ...(onProgress ? { onProgress } : {}),
        ...(signal ? { signal } : {}),
      });
    } catch (error) {
      const uploadError =
        error instanceof UploadError ? error : new UploadError('فشل رفع الملف.');

      if (!uploadError.retriable || attempt === MAX_ATTEMPTS || signal?.aborted) {
        throw uploadError;
      }

      lastError = uploadError;
      onProgress?.(0);
      await delay(600 * attempt);
    }
  }

  throw lastError ?? new UploadError('فشل رفع الملف.');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** محاولة رفع واحدة: توقيع من السيرفر ثم رفع مباشر إلى Cloudinary. */
async function attemptUpload(params: {
  file: File;
  purpose: UploadPurpose;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}): Promise<UploadedAsset> {
  const { file, purpose, onProgress, signal } = params;

  // 1) التوقيع من السيرفر
  let signature: SignatureResponse;
  try {
    const header = await readFileHeader(file);
    const { data } = await api.post<SignatureResponse>('/uploads/signature', {
      purpose,
      contentType: file.type,
      sizeBytes: file.size,
      headerBase64: toBase64(header),
    });
    signature = data;
  } catch (error) {
    // خطأ من السيرفر = رفض مفهوم لا يُعاد؛ أي شيء آخر = انقطاع شبكة يُعاد
    if (error instanceof ApiClientError) throw new UploadError(error.message);
    throw new UploadError('تعذّر بدء الرفع. حاول مرة أخرى.', true);
  }

  // 2) الرفع المباشر — بمعاملات التوقيع كما هي بلا أي تعديل
  const form = new FormData();
  for (const [key, value] of Object.entries(signature.params)) {
    form.append(key, String(value));
  }
  form.append('api_key', signature.apiKey);
  form.append('signature', signature.signature);
  form.append('file', file);

  const asset = await uploadWithProgress(signature.uploadUrl, form, onProgress, signal);

  return {
    publicId: asset.public_id,
    format: asset.format,
    bytes: asset.bytes,
    ...(asset.width ? { width: asset.width } : {}),
    ...(asset.height ? { height: asset.height } : {}),
    ...(asset.secure_url && asset.type !== 'authenticated'
      ? { previewUrl: asset.secure_url }
      : {}),
  };
}

interface CloudinaryUploadResponse {
  public_id: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  secure_url?: string;
  type?: string;
  error?: { message: string };
}

/**
 * XMLHttpRequest لا fetch — لأن fetch لا يوفّر تقدّم الرفع،
 * وشريط التقدّم مطلوب في تجربة رفع المستندات.
 */
function uploadWithProgress(
  url: string,
  form: FormData,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal
): Promise<CloudinaryUploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    // الفيديو قد يبلغ 50MB على شبكة موبايل بطيئة
    xhr.timeout = 300_000;

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      let payload: CloudinaryUploadResponse;
      try {
        payload = JSON.parse(xhr.responseText) as CloudinaryUploadResponse;
      } catch {
        reject(new UploadError('استجابة غير صالحة من خدمة الرفع.'));
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300 && payload.public_id) {
        onProgress?.(100);
        resolve(payload);
        return;
      }

      // لا نعرض رسالة Cloudinary الخام للمستخدم — قد تكشف تفاصيل الإعداد
      reject(new UploadError('فشل رفع الملف. تأكد من نوعه وحجمه ثم حاول مرة أخرى.'));
    });

    // الانقطاع والمهلة عابران — تُعاد المحاولة تلقائيًا قبل أن يرى المستخدم الخطأ
    xhr.addEventListener('error', () =>
      reject(new UploadError('تعذّر الاتصال بخدمة الرفع.', true))
    );
    xhr.addEventListener('timeout', () => reject(new UploadError('انتهت مهلة الرفع.', true)));
    xhr.addEventListener('abort', () => reject(new UploadError('أُلغي الرفع.')));

    signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(form);
  });
}

/** يحفظ metadata مستند بعد رفعه. */
export async function saveProviderDocument(input: {
  requirementKey: string;
  customKey?: string;
  publicId: string;
}) {
  const { data } = await api.post<{ document: { id: string } }>('/provider/documents', input);
  return data.document;
}

/** يطلب رابط عرض موقّتًا لمستند. */
export async function getDocumentUrl(documentId: string) {
  const { data } = await api.get<{ url: string; expiresAt: string | null; timeLimited: boolean }>(
    `/provider/documents/${documentId}/url`
  );
  return data;
}
