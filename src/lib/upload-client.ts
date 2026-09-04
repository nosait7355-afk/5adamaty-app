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
  constructor(message: string) {
    super(message);
    this.name = 'UploadError';
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
  const { file, purpose, onProgress, signal } = params;

  const precheck = await precheckFile(file, purpose);
  if (!precheck.ok) throw new UploadError(precheck.error ?? 'الملف غير صالح.');

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
    if (error instanceof ApiClientError) throw new UploadError(error.message);
    throw new UploadError('تعذّر بدء الرفع. حاول مرة أخرى.');
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
    xhr.timeout = 120_000;

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

    xhr.addEventListener('error', () => reject(new UploadError('تعذّر الاتصال بخدمة الرفع.')));
    xhr.addEventListener('timeout', () => reject(new UploadError('انتهت مهلة الرفع.')));
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
