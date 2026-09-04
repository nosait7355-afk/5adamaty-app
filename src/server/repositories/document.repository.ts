import { Types } from 'mongoose';
import { connectToDatabase } from '@/server/db/mongoose';
import { ProviderDocument, ServiceProvider } from '@/server/db/models';
import type { ProviderDocumentRecord } from '@/server/db/models/provider-document.model';
import type { ServiceProviderDocument } from '@/server/db/models/service-provider.model';
import type { DocumentKey } from '@/shared/constants/documents';

export type ProviderDocumentLean = Omit<ProviderDocumentRecord, '_id'> & { _id: Types.ObjectId };
export type ProviderLean = Omit<ServiceProviderDocument, '_id'> & { _id: Types.ObjectId };

/** ملف المزوّد المرتبط بحساب المستخدم. */
export async function findProviderByUserId(userId: string) {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(userId)) return null;
  return ServiceProvider.findOne({ userId: new Types.ObjectId(userId) }).lean<ProviderLean | null>();
}

export async function findProviderById(providerId: string) {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(providerId)) return null;
  return ServiceProvider.findById(providerId).lean<ProviderLean | null>();
}

export async function listDocumentsByProvider(providerId: string) {
  await connectToDatabase();
  return ProviderDocument.find({ providerId: new Types.ObjectId(providerId) })
    .sort({ createdAt: 1 })
    .lean<ProviderDocumentLean[]>();
}

export async function findDocumentById(documentId: string) {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(documentId)) return null;
  return ProviderDocument.findById(documentId).lean<ProviderDocumentLean | null>();
}

/**
 * يحفظ المستند أو يستبدله إن كان موجودًا.
 *
 * `upsert` مقصود: إعادة رفع نفس المستند (بعد رفضه مثلًا) يجب أن تستبدل
 * القديم لا أن تُنشئ سجلًا ثانيًا — والفهرس الفريد يمنع التكرار أصلًا.
 */
export async function upsertDocument(data: {
  providerId: string;
  requirementKey: DocumentKey;
  customKey?: string;
  label: string;
  media: ProviderDocumentRecord['media'];
}) {
  await connectToDatabase();

  const filter = {
    providerId: new Types.ObjectId(data.providerId),
    requirementKey: data.requirementKey,
    ...(data.customKey ? { customKey: data.customKey } : {}),
  };

  const existed = await ProviderDocument.exists(filter);

  /*
   * تحديث ذرّي بدل قراءة ثم حفظ: يتفادى سباق رفعتين متزامنتين لنفس المتطلّب،
   * ويمسح أثر المراجعة السابقة في نفس العملية.
   */
  const document = await ProviderDocument.findOneAndUpdate(
    filter,
    {
      $set: {
        label: data.label,
        media: data.media,
        // إعادة الرفع تعيد المستند لقائمة المراجعة
        status: 'PENDING',
      },
      $unset: { rejectionReason: '', reviewedAt: '', reviewedBy: '' },
      $setOnInsert: filter,
    },
    { upsert: true, returnDocument: 'after', runValidators: true }
  ).lean<ProviderDocumentLean>();

  return { document, replaced: Boolean(existed) };
}

export async function deleteDocument(documentId: string): Promise<void> {
  await connectToDatabase();
  await ProviderDocument.deleteOne({ _id: new Types.ObjectId(documentId) });
}
