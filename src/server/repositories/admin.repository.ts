import { Types } from 'mongoose';
import { connectToDatabase } from '@/server/db/mongoose';
import {
  AuditLog,
  Notification,
  Review,
  Service,
  ServiceProvider,
  ServiceRequest,
  Setting,
  User,
} from '@/server/db/models';
import type { UserLean } from './user.repository';
import type { AuditAction } from '@/server/db/models/misc.model';
import type { NotificationType } from '@/shared/constants/notifications';
import type { OrderStatus } from '@/shared/constants/order-status';
import type { UserRole, UserStatus } from '@/shared/constants/roles';

/**
 * الوصول لبيانات لوحة الإدارة — قراءة إشرافية عبر كل المجموعات + كتابة
 * محدودة (حالة المستخدم، إظهار/إخفاء خدمة أو تقييم، الإعدادات).
 *
 * قاعدة: أي كتابة تُغيّر حالة كيان جوهري (توثيق مزوّد، حالة طلب) تبقى في
 * ملفها المتخصّص (`provider.repository.ts`, `order.repository.ts`) — هذا
 * الملف لعمليات الإدارة العامة فقط، فلا تتكرر منطق دورة الحياة في مكانين.
 */

/* ================================================================== */
/* لوحة القيادة                                                        */
/* ================================================================== */

export interface DashboardCounts {
  totalCustomers: number;
  totalProviders: number;
  pendingVerifications: number;
  activeProviders: number;
  ordersByStatus: Record<OrderStatus, number>;
  completedOrdersTotalValue: number;
  reviewsCount: number;
  avgPlatformRating: number;
  servicesActive: number;
  categoriesCount: number;
  professionsCount: number;
}

export async function getDashboardCounts(): Promise<DashboardCounts> {
  await connectToDatabase();

  const [
    totalCustomers,
    totalProviders,
    pendingVerifications,
    activeProviders,
    orderStatusAgg,
    completedValueAgg,
    reviewsCount,
    avgRatingAgg,
    servicesActive,
    categoriesCount,
    professionsCount,
  ] = await Promise.all([
    User.countDocuments({ role: 'CUSTOMER' }),
    User.countDocuments({ role: 'PROVIDER' }),
    ServiceProvider.countDocuments({ 'verification.status': 'PENDING_REVIEW' }),
    ServiceProvider.countDocuments({ isActive: true }),
    ServiceRequest.aggregate<{ _id: OrderStatus; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    // مجموع قيم الطلبات المكتملة — تقرير إحصائي بحت، لا معاملة مالية
    // (ARCHITECTURE §0.1). الدفع يتم كاشًا خارج التطبيق دائمًا.
    ServiceRequest.aggregate<{ total: number }>([
      { $match: { status: 'COMPLETED', cashReceivedConfirmed: true } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$agreedPrice', 0] } } } },
    ]),
    Review.countDocuments({ isVisible: true }),
    ServiceProvider.aggregate<{ avg: number }>([
      { $match: { isActive: true, ratingCount: { $gt: 0 } } },
      { $group: { _id: null, avg: { $avg: '$ratingAvg' } } },
    ]),
    Service.countDocuments({ isActive: true }),
    // نستورد Category/Profession هنا محليًا لتفادي دورة استيراد غير ضرورية
    (await import('@/server/db/models')).Category.countDocuments({}),
    (await import('@/server/db/models')).Profession.countDocuments({}),
  ]);

  const ordersByStatus = orderStatusAgg.reduce(
    (acc, row) => ({ ...acc, [row._id]: row.count }),
    {} as Record<OrderStatus, number>
  );

  return {
    totalCustomers,
    totalProviders,
    pendingVerifications,
    activeProviders,
    ordersByStatus,
    completedOrdersTotalValue: completedValueAgg[0]?.total ?? 0,
    reviewsCount,
    avgPlatformRating: Math.round((avgRatingAgg[0]?.avg ?? 0) * 10) / 10,
    servicesActive,
    categoriesCount,
    professionsCount,
  };
}

/* ================================================================== */
/* المستخدمون                                                          */
/* ================================================================== */

export interface ListUsersOptions {
  page: number;
  limit: number;
  role?: UserRole | undefined;
  status?: UserStatus | undefined;
  q?: string | undefined;
}

export async function listUsersForAdmin(
  options: ListUsersOptions
): Promise<{ items: UserLean[]; total: number }> {
  await connectToDatabase();

  const filter: Record<string, unknown> = {};
  if (options.role) filter.role = options.role;
  if (options.status) filter.status = options.status;
  if (options.q) {
    const escaped = options.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { fullName: { $regex: escaped, $options: 'i' } },
      { phone: { $regex: escaped, $options: 'i' } },
      { email: { $regex: escaped, $options: 'i' } },
    ];
  }

  const skip = (options.page - 1) * options.limit;
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(options.limit).lean<UserLean[]>(),
    User.countDocuments(filter),
  ]);

  return { items, total };
}

export async function findUserByIdForAdmin(id: string) {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(id)) return null;
  return User.findById(id).lean<UserLean | null>();
}

export async function setUserStatusRecord(id: string, status: UserStatus) {
  await connectToDatabase();
  return User.findByIdAndUpdate(id, { $set: { status } }, { returnDocument: 'after' }).lean<UserLean | null>();
}

/* ================================================================== */
/* الخدمات (إشراف)                                                     */
/* ================================================================== */

export interface AdminServiceLean {
  _id: Types.ObjectId;
  providerId: Types.ObjectId;
  categoryId: Types.ObjectId;
  professionId: Types.ObjectId;
  title: string;
  priceFrom: number;
  priceTo?: number;
  isActive: boolean;
  ratingAvg: number;
  ratingCount: number;
  ordersCount: number;
  createdAt: Date;
}

export async function listServicesForAdmin(options: {
  page: number;
  limit: number;
  q?: string | undefined;
  isActive?: boolean | undefined;
  providerId?: string | undefined;
}): Promise<{ items: AdminServiceLean[]; total: number }> {
  await connectToDatabase();

  const filter: Record<string, unknown> = {};
  if (options.isActive !== undefined) filter.isActive = options.isActive;
  if (options.providerId) filter.providerId = new Types.ObjectId(options.providerId);
  if (options.q) {
    const escaped = options.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.title = { $regex: escaped, $options: 'i' };
  }

  const skip = (options.page - 1) * options.limit;
  const [items, total] = await Promise.all([
    Service.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(options.limit)
      .lean<AdminServiceLean[]>(),
    Service.countDocuments(filter),
  ]);

  return { items, total };
}

export async function findServiceByIdForAdmin(id: string) {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(id)) return null;
  return Service.findById(id).lean<AdminServiceLean | null>();
}

export async function setServiceActiveRecord(id: string, isActive: boolean) {
  await connectToDatabase();
  return Service.findByIdAndUpdate(id, { $set: { isActive } }, { returnDocument: 'after' }).lean<
    AdminServiceLean | null
  >();
}

/* ================================================================== */
/* الطلبات (قراءة إشرافية)                                             */
/* ================================================================== */

export async function listOrdersForAdmin(options: {
  page: number;
  limit: number;
  status?: OrderStatus | undefined;
  q?: string | undefined;
}) {
  await connectToDatabase();

  const filter: Record<string, unknown> = {};
  if (options.status) filter.status = options.status;
  if (options.q) {
    const asNumber = Number(options.q);
    if (Number.isFinite(asNumber)) filter.orderNumber = asNumber;
  }

  const skip = (options.page - 1) * options.limit;
  const [items, total] = await Promise.all([
    ServiceRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(options.limit).lean(),
    ServiceRequest.countDocuments(filter),
  ]);

  return { items, total };
}

export async function findOrderByIdForAdmin(id: string) {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(id)) return null;
  return ServiceRequest.findById(id).lean();
}

/* ================================================================== */
/* التقييمات (إشراف)                                                   */
/* ================================================================== */

export async function listReviewsForAdmin(options: {
  page: number;
  limit: number;
  isVisible?: boolean | undefined;
  providerId?: string | undefined;
}) {
  await connectToDatabase();

  const filter: Record<string, unknown> = {};
  if (options.isVisible !== undefined) filter.isVisible = options.isVisible;
  if (options.providerId) filter.providerId = new Types.ObjectId(options.providerId);

  const skip = (options.page - 1) * options.limit;
  const [items, total] = await Promise.all([
    Review.find(filter).sort({ createdAt: -1 }).skip(skip).limit(options.limit).lean(),
    Review.countDocuments(filter),
  ]);

  return { items, total };
}

export async function findReviewByIdForAdmin(id: string) {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(id)) return null;
  return Review.findById(id).lean();
}

export async function setReviewVisibilityRecord(
  id: string,
  isVisible: boolean,
  adminNote?: string
) {
  await connectToDatabase();
  return Review.findByIdAndUpdate(
    id,
    { $set: { isVisible, ...(adminNote !== undefined ? { adminNote } : {}) } },
    { returnDocument: 'after' }
  ).lean();
}

/** يعيد حساب متوسط تقييم المزوّد من المراجعات **الظاهرة فقط** بعد إخفاء/إظهار تقييم. */
export async function refreshProviderRatingFromVisibleReviews(providerId: Types.ObjectId) {
  await connectToDatabase();
  const agg = await Review.aggregate<{ avg: number; count: number }>([
    { $match: { providerId, isVisible: true } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  const avg = agg[0]?.avg ?? 0;
  const count = agg[0]?.count ?? 0;

  await ServiceProvider.updateOne(
    { _id: providerId },
    { $set: { ratingAvg: Math.round(avg * 10) / 10, ratingCount: count } }
  );
}

/* ================================================================== */
/* الإعدادات العامة                                                    */
/* ================================================================== */

export async function listSettingsRecords() {
  await connectToDatabase();
  return Setting.find({}).sort({ key: 1 }).lean();
}

export async function upsertSettingRecord(
  key: string,
  value: unknown,
  description: string | undefined,
  updatedBy: string
) {
  await connectToDatabase();
  return Setting.findOneAndUpdate(
    { key },
    {
      $set: {
        value,
        ...(description !== undefined ? { description } : {}),
        updatedBy: new Types.ObjectId(updatedBy),
      },
    },
    { upsert: true, returnDocument: 'after', runValidators: true }
  ).lean();
}

/* ================================================================== */
/* سجل التدقيق                                                         */
/* ================================================================== */

export async function listAuditLogsForAdmin(options: {
  page: number;
  limit: number;
  entityType?: string | undefined;
  action?: AuditAction | undefined;
}) {
  await connectToDatabase();

  const filter: Record<string, unknown> = {};
  if (options.entityType) filter.entityType = options.entityType;
  if (options.action) filter.action = options.action;

  const skip = (options.page - 1) * options.limit;
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(options.limit).lean(),
    AuditLog.countDocuments(filter),
  ]);

  return { items, total };
}

/* ================================================================== */
/* البث العام (Notifications)                                          */
/* ================================================================== */

/**
 * حد أقصى للبث الواحد — يمنع استعلامًا وكتابة ضخمَين بلا حدود لو تضخّمت
 * قاعدة المستخدمين. البث لدفعات أكبر يحتاج Job خلفية، خارج نطاق Phase 10.
 */
const BROADCAST_MAX_RECIPIENTS = 5000;

export async function broadcastNotificationRecords(params: {
  audience: 'ALL' | 'CUSTOMERS' | 'PROVIDERS';
  type: NotificationType;
  title: string;
  body: string;
  actionUrl?: string | undefined;
}): Promise<number> {
  await connectToDatabase();

  const roleFilter: Record<string, unknown> =
    params.audience === 'ALL'
      ? { role: { $in: ['CUSTOMER', 'PROVIDER'] } }
      : { role: params.audience === 'CUSTOMERS' ? 'CUSTOMER' : 'PROVIDER' };

  const recipients = await User.find({ ...roleFilter, status: 'ACTIVE' })
    .select('_id')
    .limit(BROADCAST_MAX_RECIPIENTS)
    .lean<{ _id: Types.ObjectId }[]>();

  if (recipients.length === 0) return 0;

  await Notification.insertMany(
    recipients.map((user) => ({
      userId: user._id,
      type: params.type,
      title: params.title,
      body: params.body,
      entityType: 'SYSTEM',
      ...(params.actionUrl ? { actionUrl: params.actionUrl } : {}),
    })),
    { ordered: false }
  );

  return recipients.length;
}
