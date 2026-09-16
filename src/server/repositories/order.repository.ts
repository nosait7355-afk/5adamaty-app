import mongoose, { Types, type PipelineStage } from 'mongoose';
import { connectToDatabase } from '@/server/db/mongoose';
import { ServiceProvider, ServiceRequest, Setting } from '@/server/db/models';
import type {
  ServiceRequestDocument,
  StatusHistoryEntry,
} from '@/server/db/models/service-request.model';
import type { OrderStatus } from '@/shared/constants/order-status';
import type { UserRole } from '@/shared/constants/roles';

export type OrderLean = Omit<ServiceRequestDocument, '_id'> & { _id: Types.ObjectId };

/**
 * طبقة الوصول للطلبات (Phase 7).
 */

/* ================================================================== */
/* رقم الطلب                                                           */
/* ================================================================== */

const ORDER_SEQUENCE_KEY = 'order_sequence';
/** الطلبات تبدأ من 1000 — الصور تعرض `#1026` لا `#1`. */
const ORDER_SEQUENCE_START = 1000;

/**
 * رقم طلب تسلسلي فريد.
 *
 * `$inc` ذرّي مع `upsert`: طلبان متزامنان يحصلان على رقمين مختلفين ولا
 * يصطدمان بالفهرس الفريد على `orderNumber`.
 */
export async function nextOrderNumber(): Promise<number> {
  await connectToDatabase();

  const setting = await Setting.findOneAndUpdate(
    { key: ORDER_SEQUENCE_KEY },
    {
      $inc: { value: 1 },
      $setOnInsert: { description: 'عدّاد أرقام الطلبات التسلسلية' },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  ).lean<{ value: number }>();

  const sequence = Number(setting?.value ?? 1);

  /*
   * مصالحة العدّاد مع الواقع عند أول زيادة.
   *
   * العدّاد يعيش في `settings` والطلبات في مجموعة أخرى، فقد يُمسح أحدهما
   * دون الآخر (سكربت بذر يمسح الإعدادات، أو استعادة نسخة احتياطية جزئية).
   * حينها يبدأ العدّاد من 1 ويصطدم بأرقام مستعملة. نفحص هذه الحالة **مرة
   * واحدة فقط** — عند `sequence === 1` — فلا تكلفة على المسار المعتاد.
   */
  if (sequence === 1) {
    const [latest] = await ServiceRequest.find({})
      .sort({ orderNumber: -1 })
      .limit(1)
      .select('orderNumber')
      .lean<{ orderNumber: number }[]>();

    if (latest && latest.orderNumber >= ORDER_SEQUENCE_START + sequence) {
      const reconciled = latest.orderNumber - ORDER_SEQUENCE_START + 1;
      await Setting.updateOne({ key: ORDER_SEQUENCE_KEY }, { $set: { value: reconciled } });
      return ORDER_SEQUENCE_START + reconciled;
    }
  }

  return ORDER_SEQUENCE_START + sequence;
}

/* ================================================================== */
/* المعاملات                                                           */
/* ================================================================== */

/**
 * ينفّذ عملية داخل معاملة **إن كانت البيئة تدعمها**.
 *
 * الإنتاج على Atlas (مجموعة نسخ) يدعم المعاملات، فيكتب الانتقال وسجل
 * التدقيق والإشعار ككتلة واحدة كما تشترط ARCHITECTURE §4. أما بيئة
 * الاختبار فتشغّل `mongod` منفردًا لا يدعمها، فينفّذ نفس المنطق بلا معاملة.
 *
 * الأمان لا يعتمد على هذا: حراسة التزامن الحقيقية هي التحديث الشرطي الذرّي
 * في `applyStatusTransition` — فحتى بلا معاملة يستحيل تنفيذ انتقالين
 * متزامنين على نفس الطلب.
 */
export async function withOptionalTransaction<T>(
  operation: (session?: mongoose.ClientSession) => Promise<T>
): Promise<T> {
  await connectToDatabase();

  if (!(await supportsTransactions())) return operation();

  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await operation(session);
    });
    return result;
  } finally {
    await session.endSession().catch(() => undefined);
  }
}

/**
 * هل تدعم هذه القاعدة المعاملات؟
 *
 * المعاملات تتطلب مجموعة نسخ (replica set) أو تجميعة مُشظّاة. نسأل الخادم
 * مرة واحدة ونحتفظ بالجواب، بدل تجربة المعاملة وقراءة نص الخطأ — فنص
 * الخطأ يتغيّر بين إصدارات السائق، وتجربة الفشل تكلّف رحلة ذهاب وإياب في
 * كل عملية.
 */
let transactionSupport: boolean | null = null;

export async function supportsTransactions(): Promise<boolean> {
  if (transactionSupport !== null) return transactionSupport;

  try {
    const info = await mongoose.connection.db!.admin().command({ hello: 1 });
    transactionSupport = Boolean(info.setName) || info.msg === 'isdbgrid';
  } catch {
    transactionSupport = false;
  }

  return transactionSupport;
}

/** للاختبارات: يمسح الجواب المخزَّن عند تبديل القاعدة. */
export function resetTransactionSupportCache(): void {
  transactionSupport = null;
}

/* ================================================================== */
/* الإنشاء والقراءة                                                    */
/* ================================================================== */

export async function createOrder(
  data: Partial<ServiceRequestDocument>,
  session?: mongoose.ClientSession
): Promise<OrderLean> {
  await connectToDatabase();

  const [created] = await ServiceRequest.create([data], session ? { session } : {});
  if (!created) throw new Error('تعذّر إنشاء الطلب.');

  return created.toObject() as OrderLean;
}

export async function findOrderById(orderId: string): Promise<OrderLean | null> {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(orderId)) return null;
  return ServiceRequest.findById(orderId).lean<OrderLean | null>();
}

export interface OrderListFilters {
  customerId?: string;
  providerId?: string;
  statuses?: readonly OrderStatus[];
  page: number;
  limit: number;
}

export async function findOrders(
  filters: OrderListFilters
): Promise<{ items: OrderLean[]; total: number }> {
  await connectToDatabase();

  const query: Record<string, unknown> = {};
  if (filters.customerId) query.customerId = new Types.ObjectId(filters.customerId);
  if (filters.providerId) query.providerId = new Types.ObjectId(filters.providerId);
  if (filters.statuses && filters.statuses.length > 0) {
    // trusted() لازم لأن sanitizeFilter يجرّد `$in` من المرشّحات
    query.status = mongoose.trusted({ $in: [...filters.statuses] });
  }

  const skip = (filters.page - 1) * filters.limit;

  const [items, total] = await Promise.all([
    ServiceRequest.find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(filters.limit)
      .lean<OrderLean[]>(),
    ServiceRequest.countDocuments(query),
  ]);

  return { items, total };
}

/** عدّادات التبويبات — تجميعة واحدة بدل استعلام لكل تبويب. */
export async function countOrdersByStatus(
  owner: { customerId?: string; providerId?: string }
): Promise<Record<string, number>> {
  await connectToDatabase();

  const match: Record<string, unknown> = {};
  if (owner.customerId) match.customerId = new Types.ObjectId(owner.customerId);
  if (owner.providerId) match.providerId = new Types.ObjectId(owner.providerId);

  const rows = await ServiceRequest.aggregate<{ _id: OrderStatus; count: number }>([
    { $match: match },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const counts: Record<string, number> = {};
  for (const row of rows) counts[row._id] = row.count;
  return counts;
}

/* ================================================================== */
/* الانتقال                                                            */
/* ================================================================== */

export interface StatusTransitionInput {
  orderId: string;
  from: OrderStatus;
  to: OrderStatus;
  actor: { userId: string; role: UserRole };
  note?: string;
  extraFields?: Record<string, unknown>;
}

/**
 * ينقل حالة الطلب **بشرط** أن يكون ما زال في الحالة المتوقعة.
 *
 * هذا الشرط (`status: from` داخل المرشّح) هو حارس التزامن الحقيقي: لو ضغط
 * طرفان في نفس اللحظة — العميل يلغي والمزوّد يقبل — ينجح أولهما فقط ويعود
 * الثاني بـ`null` فيُترجم إلى 409، بدل أن يدهس أحدهما الآخر.
 *
 * `statusHistory` تُكتب في نفس العملية الذرّية، فلا يمكن أن تتغيّر الحالة
 * بلا سطر يوثّقها.
 */
export async function applyStatusTransition(
  input: StatusTransitionInput,
  session?: mongoose.ClientSession
): Promise<OrderLean | null> {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(input.orderId)) return null;

  const historyEntry: StatusHistoryEntry = {
    from: input.from,
    to: input.to,
    byUserId: new Types.ObjectId(input.actor.userId),
    byRole: input.actor.role,
    ...(input.note ? { note: input.note } : {}),
    at: new Date(),
  };

  return ServiceRequest.findOneAndUpdate(
    { _id: new Types.ObjectId(input.orderId), status: input.from },
    {
      $set: { status: input.to, ...(input.extraFields ?? {}) },
      $push: { statusHistory: historyEntry },
    },
    { returnDocument: 'after', ...(session ? { session } : {}) }
  ).lean<OrderLean | null>();
}

/* ================================================================== */
/* جانب مقدم الخدمة (Phase 8)                                          */
/* ================================================================== */

const USERS_COLLECTION = 'users';

export interface ProviderOrderFilters {
  providerId: string;
  statuses?: readonly OrderStatus[];
  /** بحث برقم الطلب أو اسم العميل — الصورة 25. */
  q?: string | undefined;
  sort?: 'newest' | 'oldest' | 'price_desc';
  page: number;
  limit: number;
}

const PROVIDER_SORTS: Record<string, Record<string, 1 | -1>> = {
  newest: { createdAt: -1, _id: -1 },
  oldest: { createdAt: 1, _id: 1 },
};

/**
 * قائمة طلبات المزوّد مع البحث والترتيب.
 *
 * البحث يشمل **اسم العميل**، وهو في مجموعة أخرى، فلا مفرّ من الضمّ. نص
 * البحث يُهرَّب قبل استخدامه كتعبير نمطي (نفس حارس البحث في Phase 5).
 */
export async function findProviderOrders(
  filters: ProviderOrderFilters
): Promise<{ items: (OrderLean & { customerName?: string; customerPhone?: string })[]; total: number }> {
  await connectToDatabase();

  const match: Record<string, unknown> = {
    providerId: new Types.ObjectId(filters.providerId),
  };
  if (filters.statuses && filters.statuses.length > 0) {
    match.status = { $in: [...filters.statuses] };
  }

  const pipeline: PipelineStage[] = [
    { $match: match },
    {
      $lookup: {
        from: USERS_COLLECTION,
        localField: 'customerId',
        foreignField: '_id',
        as: 'customer',
      },
    },
    { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
  ];

  if (filters.q) {
    const pattern = escapeRegexValue(filters.q);
    const asNumber = Number(filters.q.replace(/^#/, ''));

    pipeline.push({
      $match: {
        $or: [
          { 'customer.fullName': { $regex: pattern, $options: 'i' } },
          { serviceType: { $regex: pattern, $options: 'i' } },
          ...(Number.isFinite(asNumber) ? [{ orderNumber: asNumber }] : []),
        ],
      },
    });
  }

  const skip = (filters.page - 1) * filters.limit;

  const [result] = await ServiceRequest.aggregate<{
    items?: (OrderLean & { customerName?: string; customerPhone?: string })[];
    total?: { value: number }[];
  }>([
    ...pipeline,
    {
      $facet: {
        items: [
          { $sort: PROVIDER_SORTS[filters.sort ?? 'newest'] ?? PROVIDER_SORTS.newest! },
          { $skip: skip },
          { $limit: filters.limit },
          {
            $addFields: {
              customerName: '$customer.fullName',
              customerPhone: '$customer.phone',
            },
          },
          { $project: { customer: 0 } },
        ],
        total: [{ $count: 'value' }],
      },
    },
  ]);

  return {
    items: result?.items ?? [],
    total: result?.total?.[0]?.value ?? 0,
  };
}

/** نفس هروب Phase 5 — نص المستخدم لا يصير تعبيرًا نمطيًا قابلًا للتنفيذ. */
function escapeRegexValue(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * يحدّث إحصاءات المزوّد بعد إكمال طلب.
 *
 * `completedOrders` بـ`$inc` (عدّاد بسيط)، أما `customersCount` فيُعاد
 * حسابه من الطلبات المكتملة فعلًا: العميل نفسه قد يطلب مرارًا، و`$inc`
 * الأعمى كان سيعدّه عميلًا جديدًا في كل مرة.
 */
export async function refreshProviderCompletionStats(providerId: string): Promise<void> {
  await connectToDatabase();
  const objectId = new Types.ObjectId(providerId);

  const [stats] = await ServiceRequest.aggregate<{ completed: number; customers: string[] }>([
    { $match: { providerId: objectId, status: 'COMPLETED' } },
    { $group: { _id: null, completed: { $sum: 1 }, customers: { $addToSet: '$customerId' } } },
  ]);

  await ServiceProvider.updateOne(
    { _id: objectId },
    {
      $set: {
        completedOrders: stats?.completed ?? 0,
        customersCount: stats?.customers.length ?? 0,
      },
    }
  );
}

/* ================================================================== */
/* لوحة التحكم — الصورة 24                                             */
/* ================================================================== */

export interface ProviderDashboardStats {
  counts: Record<string, number>;
  completedThisMonth: number;
}

export async function getProviderDashboardStats(
  providerId: string
): Promise<ProviderDashboardStats> {
  await connectToDatabase();
  const objectId = new Types.ObjectId(providerId);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [byStatus, completed] = await Promise.all([
    ServiceRequest.aggregate<{ _id: OrderStatus; count: number }>([
      { $match: { providerId: objectId } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    ServiceRequest.aggregate<{ completedThisMonth: number }>([
      { $match: { providerId: objectId, status: 'COMPLETED' } },
      {
        $group: {
          _id: null,
          completedThisMonth: {
            $sum: { $cond: [{ $gte: ['$completedAt', monthStart] }, 1, 0] },
          },
        },
      },
    ]),
  ]);

  const counts: Record<string, number> = {};
  for (const row of byStatus) counts[row._id] = row.count;

  return {
    counts,
    completedThisMonth: completed[0]?.completedThisMonth ?? 0,
  };
}
