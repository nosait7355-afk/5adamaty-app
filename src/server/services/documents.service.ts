import { badRequest, forbidden, notFound, unprocessable } from '@/server/lib/errors';
import { logger } from '@/server/lib/logger';
import { buildSignedAssetUrl, deleteAsset } from '@/server/lib/cloudinary';
import { verifyAndBuildMediaRef } from './upload.service';
import {
  deleteDocument,
  findDocumentById,
  findProviderByUserId,
  listDocumentsByProvider,
  upsertDocument,
  type ProviderDocumentLean,
} from '@/server/repositories/document.repository';
import { findProfessionById } from '@/server/repositories/catalog.repository';
import { SIGNED_URL_TTL_SECONDS } from '@/shared/constants/uploads';
import type { DocumentKey, DocumentRequirement } from '@/shared/constants/documents';
import type { SessionUser } from '@/server/middleware/with-auth';

/**
 * إدارة مستندات مقدّم الخدمة.
 *
 * المستندات أخطر بيانات في النظام (بطاقة رقم قومي، مؤهلات، تراخيص).
 * ثلاث قواعد تحكم هذا الملف:
 *   1. لا يُقرأ مستند إلا من صاحبه أو ADMIN — وإلا 404 لا 403.
 *   2. لا يُحفظ مستند غير مذكور في متطلبات مهنة المزوّد.
 *   3. الروابط تُولَّد عند الطلب ولا تُخزَّن ولا تُرسل في قوائم.
 */

export interface DocumentDto {
  id: string;
  requirementKey: string;
  customKey?: string;
  label: string;
  status: string;
  rejectionReason?: string;
  format: string;
  bytes: number;
  uploadedAt: string;
  /** ملاحظة: لا يوجد `url` هنا عمدًا — يُطلب من endpoint منفصل. */
}

function toDocumentDto(doc: ProviderDocumentLean): DocumentDto {
  return {
    id: String(doc._id),
    requirementKey: doc.requirementKey,
    ...(doc.customKey ? { customKey: doc.customKey } : {}),
    label: doc.label,
    status: doc.status,
    ...(doc.rejectionReason ? { rejectionReason: doc.rejectionReason } : {}),
    format: doc.media.format,
    bytes: doc.media.bytes,
    uploadedAt: doc.createdAt.toISOString(),
  };
}

/** يجلب ملف المزوّد للمستخدم الحالي أو يرمي. */
async function requireOwnProvider(user: SessionUser) {
  const provider = await findProviderByUserId(user.id);
  if (!provider) {
    throw forbidden('لا يوجد ملف مقدّم خدمة مرتبط بحسابك.');
  }
  return provider;
}

/**
 * يبحث عن المتطلّب داخل إعدادات المهنة.
 *
 * المصدر الوحيد للحقيقة هو `profession.documentRequirements` — فلا يستطيع
 * العميل اختراع مفتاح مستند ولا رفع مستند لا تطلبه مهنته.
 */
async function findRequirement(
  professionId: string,
  requirementKey: DocumentKey,
  customKey?: string
): Promise<DocumentRequirement> {
  const profession = await findProfessionById(professionId);
  if (!profession) throw notFound('المهنة المطلوبة غير موجودة.');

  const requirement = profession.documentRequirements.find(
    (item) =>
      item.isActive &&
      item.key === requirementKey &&
      (requirementKey !== 'CUSTOM' || item.customKey === customKey)
  );

  if (!requirement) {
    throw unprocessable('هذا المستند غير مطلوب لمهنتك.');
  }
  return requirement;
}

/* ================================================================== */

/** قائمة مستندات المزوّد الحالي مع حالة اكتمالها. */
export async function listMyDocuments(user: SessionUser): Promise<{
  documents: DocumentDto[];
  requirements: DocumentRequirement[];
  isComplete: boolean;
  missingRequired: string[];
}> {
  const provider = await requireOwnProvider(user);
  const profession = await findProfessionById(String(provider.professionId));
  if (!profession) throw notFound('المهنة المرتبطة بحسابك غير موجودة.');

  const documents = await listDocumentsByProvider(String(provider._id));
  const requirements = profession.documentRequirements
    .filter((item) => item.isActive)
    .sort((a, b) => a.order - b.order);

  const uploadedKeys = new Set(
    documents.map((doc) => `${doc.requirementKey}:${doc.customKey ?? ''}`)
  );

  const missingRequired = requirements
    .filter((item) => item.required)
    .filter((item) => !uploadedKeys.has(`${item.key}:${item.customKey ?? ''}`))
    .map((item) => item.label);

  return {
    documents: documents.map(toDocumentDto),
    requirements,
    isComplete: missingRequired.length === 0,
    missingRequired,
  };
}

/** يحفظ metadata مستند بعد التحقق منه لدى Cloudinary. */
export async function saveDocument(
  user: SessionUser,
  input: { requirementKey: DocumentKey; customKey?: string; publicId: string }
): Promise<DocumentDto> {
  const provider = await requireOwnProvider(user);

  // 1) المستند مطلوب فعلًا لهذه المهنة
  const requirement = await findRequirement(
    String(provider.professionId),
    input.requirementKey,
    input.customKey
  );

  // 2) الأصل موجود ويخص هذا المستخدم وبالخصائص الصحيحة
  const media = await verifyAndBuildMediaRef({
    user,
    purpose: 'PROVIDER_DOCUMENT',
    publicId: input.publicId,
  });

  // 3) الحفظ — مع استبدال أي رفعة سابقة لنفس المتطلّب
  const { document, replaced } = await upsertDocument({
    providerId: String(provider._id),
    requirementKey: input.requirementKey,
    ...(input.customKey ? { customKey: input.customKey } : {}),
    label: requirement.label,
    media,
  });

  logger.info('حُفظ مستند مقدّم خدمة', {
    providerId: String(provider._id),
    requirementKey: input.requirementKey,
    replaced,
  });

  return toDocumentDto(document);
}

/**
 * رابط عرض موقّت لمستند.
 *
 * يعيد **404** لغير المالك — لا 403. الفرق مهم: 403 يؤكد وجود المستند
 * ويسمح بتعداد المعرّفات، و404 لا يكشف شيئًا (ARCHITECTURE §7).
 */
export async function getDocumentUrl(
  user: SessionUser,
  documentId: string
): Promise<{ url: string; expiresAt: string | null; timeLimited: boolean }> {
  const document = await findDocumentById(documentId);
  if (!document) throw notFound('المستند المطلوب غير موجود.');

  if (user.role !== 'ADMIN') {
    const provider = await findProviderByUserId(user.id);
    if (!provider || String(provider._id) !== String(document.providerId)) {
      logger.warn('محاولة وصول لمستند مستخدم آخر', {
        userId: user.id,
        documentId,
      });
      throw notFound('المستند المطلوب غير موجود.');
    }
  }

  const signed = buildSignedAssetUrl({
    publicId: document.media.publicId,
    format: document.media.format,
    ttlSeconds: SIGNED_URL_TTL_SECONDS,
    resourceType: document.media.resourceType,
  });

  logger.info('صدر رابط مستند موقّت', {
    documentId,
    byRole: user.role,
    timeLimited: signed.timeLimited,
  });

  return {
    url: signed.url,
    expiresAt: signed.expiresAt?.toISOString() ?? null,
    timeLimited: signed.timeLimited,
  };
}

/** يحذف مستندًا وأصله في Cloudinary معًا. */
export async function removeDocument(user: SessionUser, documentId: string): Promise<void> {
  const document = await findDocumentById(documentId);
  if (!document) throw notFound('المستند المطلوب غير موجود.');

  if (user.role !== 'ADMIN') {
    const provider = await findProviderByUserId(user.id);
    if (!provider || String(provider._id) !== String(document.providerId)) {
      throw notFound('المستند المطلوب غير موجود.');
    }
    // بعد الاعتماد لا يُحذف المستند إلا من الإدارة
    if (provider.verification.status === 'APPROVED') {
      throw forbidden('لا يمكن حذف المستندات بعد اعتماد الحساب. تواصل مع الدعم.');
    }
  }

  await deleteDocument(documentId);

  // حذف الأصل بعد حذف السجل — فشله لا يُبطل العملية لكن يُسجَّل
  const destroyed = await deleteAsset({
    publicId: document.media.publicId,
    resourceType: document.media.resourceType,
    type: 'authenticated',
  });

  if (!destroyed) {
    logger.warn('بقي أصل يتيم في Cloudinary بعد حذف المستند', {
      publicId: document.media.publicId,
    });
  }
}

/** متطلبات مهنة بعينها — للواجهة قبل إنشاء ملف المزوّد (أثناء التسجيل). */
export async function getRequirementsForProfession(professionId: string) {
  const profession = await findProfessionById(professionId);
  if (!profession) throw notFound('المهنة المطلوبة غير موجودة.');
  if (!professionId) throw badRequest('معرّف المهنة مطلوب.');

  return {
    professionId: String(profession._id),
    professionName: profession.name,
    requiresQualification: profession.requiresQualification,
    requiresLicense: profession.requiresLicense,
    requirements: profession.documentRequirements
      .filter((item) => item.isActive)
      .sort((a, b) => a.order - b.order),
  };
}
