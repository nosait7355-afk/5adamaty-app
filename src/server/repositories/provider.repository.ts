import { Types } from 'mongoose';
import { connectToDatabase } from '@/server/db/mongoose';
import { logger } from '@/server/lib/logger';
import {
  AuditLog,
  Notification,
  ProviderDocument,
  ServiceProvider,
  Setting,
  User,
} from '@/server/db/models';
import type { AuditAction } from '@/server/db/models/misc.model';
import type { ServiceProviderDocument } from '@/server/db/models/service-provider.model';
import type { UserLean } from './user.repository';
import type { NotificationType } from '@/shared/constants/notifications';
import type { VerificationStatus } from '@/shared/constants/roles';

export type ProviderLean = Omit<ServiceProviderDocument, '_id'> & { _id: Types.ObjectId };
export type { UserLean };

/**
 * طبقة الوصول لتسجيل مقدم الخدمة والتوثيق (Phase 6).
 */

/* ================================================================== */
/* رقم الطلب                                                           */
/* ================================================================== */

const REQUEST_SEQUENCE_PREFIX = 'provider_request_seq_';

/**
 * يولّد رقم طلب فريدًا بصيغة `SRV-YYYY-NNNNNN` (الصورة 23).
 *
 * العدّاد يُزاد بعملية ذرّية واحدة (`$inc` مع `upsert`) بدل قراءة ثم كتابة:
 * تسجيلان متزامنان في نفس اللحظة يحصلان على رقمين مختلفين، ولا يصطدمان
 * بالفهرس الفريد على `verification.requestNumber`.
 */
export async function nextRequestNumber(now: Date = new Date()): Promise<string> {
  await connectToDatabase();

  const year = now.getFullYear();
  const setting = await Setting.findOneAndUpdate(
    { key: `${REQUEST_SEQUENCE_PREFIX}${year}` },
    {
      $inc: { value: 1 },
      $setOnInsert: { description: `عدّاد أرقام طلبات تسجيل مقدمي الخدمة لعام ${year}` },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  ).lean<{ value: number }>();

  const sequence = Number(setting?.value ?? 1);
  return `SRV-${year}-${String(sequence).padStart(6, '0')}`;
}

/* ================================================================== */
/* الإنشاء                                                             */
/* ================================================================== */

export interface CreateProviderAccountInput {
  user: Partial<UserLean> & { passwordHash: string };
  provider: Omit<Partial<ServiceProviderDocument>, 'userId'>;
}

/**
 * ينشئ ملف مزوّد لمستخدم قائم — مسار تحويل العميل إلى مقدم خدمة.
 *
 * منفصل عن `createProviderAccount` لأن ذاك ينشئ المستخدم أيضًا ويحذفه عند
 * الفشل؛ هنا المستخدم قائم وله بياناته وطلباته، فحذفه عند فشل إنشاء الملف
 * كارثة لا تعويض.
 */
export async function createProviderForUser(
  input: Omit<Partial<ServiceProviderDocument>, 'userId'> & { userId: string }
): Promise<ProviderLean> {
  await connectToDatabase();

  const created = await ServiceProvider.create({
    ...input,
    userId: new Types.ObjectId(input.userId),
  });

  const provider = await ServiceProvider.findById(created._id).lean<ProviderLean>();
  if (!provider) throw new Error('تعذّر قراءة ملف المزوّد بعد إنشائه.');
  return provider;
}

/**
 * ينشئ حساب المستخدم وملف المزوّد معًا.
 *
 * لا نعتمد على معاملة (transaction): النشر المستهدف قد يكون نسخة واحدة لا
 * مجموعة نسخ. بدلًا من ذلك نعوّض يدويًا — إن فشل إنشاء ملف المزوّد نحذف
 * المستخدم، فلا يبقى حساب PROVIDER بلا ملف يمنع صاحبه من إعادة المحاولة.
 */
export async function createProviderAccount(input: CreateProviderAccountInput): Promise<{
  user: UserLean;
  provider: ProviderLean;
}> {
  await connectToDatabase();

  const createdUser = await User.create(input.user);

  try {
    const createdProvider = await ServiceProvider.create({
      ...input.provider,
      userId: createdUser._id,
    });

    const user = await User.findById(createdUser._id).lean<UserLean>();
    const provider = await ServiceProvider.findById(createdProvider._id).lean<ProviderLean>();

    if (!user || !provider) throw new Error('تعذّر قراءة الحساب بعد إنشائه.');
    return { user, provider };
  } catch (error) {
    await User.deleteOne({ _id: createdUser._id }).catch(() => undefined);
    throw error;
  }
}

/* ================================================================== */
/* القراءة                                                             */
/* ================================================================== */

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

export async function findUserById(userId: string) {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(userId)) return null;
  return User.findById(userId).lean<UserLean | null>();
}

export async function countProviderDocuments(providerId: string): Promise<number> {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(providerId)) return 0;
  return ProviderDocument.countDocuments({ providerId: new Types.ObjectId(providerId) });
}

/** طابور مراجعة الإدارة — أقدم طلب أولًا، فالانتظار الأطول يُخدَم أولًا. */
export async function listProvidersByVerificationStatus(options: {
  status: VerificationStatus;
  page: number;
  limit: number;
}): Promise<{ items: (ProviderLean & { user?: UserLean })[]; total: number }> {
  await connectToDatabase();

  const filter = { 'verification.status': options.status };
  const skip = (options.page - 1) * options.limit;

  const [items, total] = await Promise.all([
    ServiceProvider.find(filter)
      .sort({ 'verification.submittedAt': 1, _id: 1 })
      .skip(skip)
      .limit(options.limit)
      .populate<{ userId: UserLean }>('userId')
      .lean<(ProviderLean & { userId: UserLean })[]>(),
    ServiceProvider.countDocuments(filter),
  ]);

  return {
    items: items.map(({ userId, ...provider }) => ({
      ...(provider as unknown as ProviderLean),
      user: userId,
    })),
    total,
  };
}

/* ================================================================== */
/* التحديث                                                             */
/* ================================================================== */

export async function updateProvider(
  providerId: string,
  patch: Record<string, unknown>
): Promise<ProviderLean | null> {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(providerId)) return null;

  return ServiceProvider.findByIdAndUpdate(
    providerId,
    { $set: patch },
    { returnDocument: 'after', runValidators: true }
  ).lean<ProviderLean | null>();
}

export async function updateUser(
  userId: string,
  patch: Record<string, unknown>
): Promise<UserLean | null> {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(userId)) return null;

  return User.findByIdAndUpdate(
    userId,
    { $set: patch },
    { returnDocument: 'after', runValidators: true }
  ).lean<UserLean | null>();
}

/* ================================================================== */
/* التدقيق والإشعارات                                                   */
/* ================================================================== */

/**
 * يسجّل إجراءً حسّاسًا.
 *
 * لا يرمي أبدًا: فشل الكتابة في السجل يجب ألا يُبطل قرارًا إداريًا نُفّذ
 * فعلًا، لكنه يُسجَّل في اللوج ليُلاحَظ.
 */
export async function writeAuditLog(entry: {
  actorId?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await connectToDatabase();

    await AuditLog.create({
      ...(entry.actorId ? { actorId: new Types.ObjectId(entry.actorId) } : {}),
      action: entry.action,
      entityType: entry.entityType,
      ...(entry.entityId ? { entityId: new Types.ObjectId(entry.entityId) } : {}),
      ...(entry.before !== undefined ? { before: entry.before } : {}),
      ...(entry.after !== undefined ? { after: entry.after } : {}),
      ...(entry.ip ? { ip: entry.ip } : {}),
      ...(entry.userAgent ? { userAgent: entry.userAgent } : {}),
    });
  } catch (error) {
    /*
     * القرار نُفِّذ فعلًا قبل هذه السطور. رمي الخطأ هنا كان سيُظهر للإدارة
     * فشلًا كاذبًا فتُعيد المحاولة على حالة تغيّرت بالفعل. نكتفي بتسجيل
     * الإخفاق بمستوى error ليظهر في المراقبة.
     */
    logger.error('فشل تسجيل إجراء في سجل التدقيق', {
      action: entry.action,
      entityId: entry.entityId,
      error,
    });
  }
}

export async function createNotification(entry: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType: 'ORDER' | 'PROVIDER' | 'REVIEW' | 'MESSAGE' | 'SYSTEM';
  entityId?: string;
  actionUrl?: string;
}): Promise<void> {
  await connectToDatabase();

  await Notification.create({
    userId: new Types.ObjectId(entry.userId),
    type: entry.type,
    title: entry.title,
    body: entry.body,
    entityType: entry.entityType,
    ...(entry.entityId ? { entityId: new Types.ObjectId(entry.entityId) } : {}),
    ...(entry.actionUrl ? { actionUrl: entry.actionUrl } : {}),
  });
}
