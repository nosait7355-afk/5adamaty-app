import { badRequest, forbidden, unprocessable } from '@/server/lib/errors';
import { logger } from '@/server/lib/logger';
import {
  createUploadSignature,
  fetchAssetDetails,
  generatePublicId,
  type CloudinaryAsset,
  type UploadSignature,
} from '@/server/lib/cloudinary';
import { validateFileHeader } from '@/shared/lib/file-signature';
import {
  BYTES_PER_MB,
  MIME_EXTENSION,
  UPLOAD_RULES,
  type UploadPurpose,
} from '@/shared/constants/uploads';
import type { SessionUser } from '@/server/middleware/with-auth';
import type { MediaRef } from '@/server/db/models';

/**
 * إصدار تواقيع الرفع والتحقق من الأصول بعد رفعها.
 *
 * تدفق الرفع (ARCHITECTURE §8):
 *   1. المتصفح يطلب توقيعًا ويرسل النوع والحجم وأول بايتات الملف.
 *   2. السيرفر يتحقق (الدور + النوع الحقيقي + الحجم) ويوقّع معاملات محددة.
 *   3. المتصفح يرفع **مباشرة** إلى Cloudinary — الملف لا يمرّ عبر سيرفرنا.
 *   4. المتصفح يرسل metadata فقط، والسيرفر يتحقق منها لدى Cloudinary
 *      قبل الحفظ — فلا يُصدَّق ادعاء العميل.
 */

/** من يملك حق الرفع لكل غرض. */
const PURPOSE_ROLES: Record<UploadPurpose, ReadonlyArray<SessionUser['role']>> = {
  AVATAR: ['CUSTOMER', 'PROVIDER', 'ADMIN'],
  PROVIDER_GALLERY: ['PROVIDER', 'ADMIN'],
  SERVICE_IMAGE: ['PROVIDER', 'ADMIN'],
  ORDER_ATTACHMENT: ['CUSTOMER', 'ADMIN'],
  PROVIDER_DOCUMENT: ['PROVIDER', 'ADMIN'],
  MESSAGE_ATTACHMENT: ['CUSTOMER', 'PROVIDER', 'ADMIN'],
  PROVIDER_PORTFOLIO_VIDEO: ['PROVIDER', 'ADMIN'],
};

export interface SignatureRequest {
  purpose: UploadPurpose;
  contentType: string;
  sizeBytes: number;
  /** أول بايتات الملف بترميز base64 — للتعرّف على النوع الحقيقي. */
  headerBase64: string;
}

export interface SignatureResponse extends UploadSignature {
  /** المعرّف الذي سيُحفظ لاحقًا — يربط التوقيع بالـmetadata. */
  publicId: string;
  purpose: UploadPurpose;
  maxSizeMB: number;
}

/**
 * يصدر توقيع رفع بعد التحقق الكامل.
 *
 * التحقق يحدث **قبل** التوقيع لا بعده: توقيع صادر يعني إذنًا فعليًا بالرفع،
 * فلا يجوز إصداره لملف مرفوض.
 */
export function issueUploadSignature(
  user: SessionUser,
  request: SignatureRequest
): SignatureResponse {
  const rule = UPLOAD_RULES[request.purpose];
  if (!rule) throw badRequest('غرض الرفع غير معروف.');

  // 1) الدور
  if (!PURPOSE_ROLES[request.purpose].includes(user.role)) {
    throw forbidden('ليس لديك صلاحية رفع هذا النوع من الملفات.');
  }

  // 2) النوع الحقيقي من البايتات — لا من الامتداد ولا من contentType
  let header: Uint8Array;
  try {
    header = new Uint8Array(Buffer.from(request.headerBase64, 'base64'));
  } catch {
    throw badRequest('تعذّر قراءة بيانات الملف.');
  }

  const validation = validateFileHeader({
    header,
    declaredMime: request.contentType,
    sizeBytes: request.sizeBytes,
    accept: rule.accept,
    maxSizeMB: rule.maxSizeMB,
  });

  if (!validation.ok) {
    logger.warn('رُفض طلب توقيع رفع', {
      userId: user.id,
      purpose: request.purpose,
      declared: request.contentType,
      detected: validation.detectedMime ?? 'unknown',
      reason: validation.error,
    });
    throw unprocessable(validation.error ?? 'الملف غير صالح.');
  }

  /*
   * 3) المجلد يُبنى من هوية المستخدم على السيرفر — لا يأتي من الطلب أبدًا.
   * هذا يمنع رفع ملف داخل مجلد مستخدم آخر.
   */
  const folder = `${rule.folder}/${user.id}`;
  const publicId = generatePublicId(request.purpose.toLowerCase());

  const signature = createUploadSignature({
    folder,
    publicId,
    accessMode: rule.accessMode,
    allowedFormats: rule.accept.map((mime) => MIME_EXTENSION[mime] ?? '').filter(Boolean),
    resourceType: rule.resourceType,
    tags: [request.purpose.toLowerCase(), `user_${user.id}`],
  });

  logger.info('صدر توقيع رفع', {
    userId: user.id,
    purpose: request.purpose,
    detected: validation.detectedMime ?? '',
  });

  return {
    ...signature,
    publicId: `${folder}/${publicId}`,
    purpose: request.purpose,
    maxSizeMB: rule.maxSizeMB,
  };
}

/**
 * يتحقق من الأصل لدى Cloudinary ويبني MediaRef من **بياناتها هي**.
 *
 * ما يرسله العميل بعد الرفع مجرد ادعاء؛ نتجاهله ونسأل المصدر. أي تعارض
 * (مسار خارج مجلد المستخدم، حجم يتجاوز الحد، نوع وصول خاطئ) يُرفض.
 */
export async function verifyAndBuildMediaRef(params: {
  user: SessionUser;
  purpose: UploadPurpose;
  publicId: string;
}): Promise<MediaRef> {
  const rule = UPLOAD_RULES[params.purpose];
  if (!rule) throw badRequest('غرض الرفع غير معروف.');

  const expectedPrefix = `${rule.folder}/${params.user.id}/`;
  if (!params.publicId.startsWith(expectedPrefix)) {
    logger.warn('محاولة حفظ أصل خارج مجلد المستخدم', {
      userId: params.user.id,
      publicId: params.publicId,
    });
    throw forbidden('الملف لا يخص حسابك.');
  }

  const asset: CloudinaryAsset | null = await fetchAssetDetails({
    publicId: params.publicId,
    resourceType: rule.resourceType,
    type: rule.accessMode === 'authenticated' ? 'authenticated' : 'upload',
  });

  if (!asset) {
    throw unprocessable('تعذّر التحقق من الملف المرفوع. برجاء إعادة الرفع.');
  }

  // الحجم الحقيقي من Cloudinary لا من العميل
  if (asset.bytes > rule.maxSizeMB * BYTES_PER_MB) {
    throw unprocessable(`حجم الملف يتجاوز الحد المسموح (${rule.maxSizeMB}MB).`);
  }

  const allowedExtensions = rule.accept.map((mime) => MIME_EXTENSION[mime]).filter(Boolean);
  if (!allowedExtensions.includes(asset.format)) {
    throw unprocessable('نوع الملف غير مسموح به.');
  }

  // المستندات الحسّاسة يجب أن تكون authenticated فعلًا لا عامة
  if (rule.accessMode === 'authenticated' && asset.type !== 'authenticated') {
    logger.warn('أصل حسّاس مرفوع بوضع وصول عام', { publicId: params.publicId });
    throw unprocessable('تعذّر التحقق من خصوصية الملف. برجاء إعادة الرفع.');
  }

  return {
    publicId: asset.publicId,
    url: asset.secureUrl,
    format: asset.format,
    bytes: asset.bytes,
    ...(asset.width ? { width: asset.width } : {}),
    ...(asset.height ? { height: asset.height } : {}),
    resourceType: rule.resourceType,
    accessMode: rule.accessMode,
    uploadedAt: new Date(),
  };
}
