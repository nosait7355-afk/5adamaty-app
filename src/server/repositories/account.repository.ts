import mongoose, { Types } from 'mongoose';
import { connectToDatabase } from '@/server/db/mongoose';
import { Address, Faq, Favorite, Notification, Review, ServiceProvider } from '@/server/db/models';
import type { AddressDocument } from '@/server/db/models/address.model';
import type { FavoriteDocument } from '@/server/db/models/favorite.model';
import type { NotificationDocument } from '@/server/db/models/notification.model';
import type { ReviewDocument } from '@/server/db/models/review.model';
import {
  NOTIFICATION_TYPE_TAB,
  type NotificationTab,
  type NotificationType,
} from '@/shared/constants/notifications';

export type NotificationLean = Omit<NotificationDocument, '_id'> & { _id: Types.ObjectId };
export type AddressLean = Omit<AddressDocument, '_id'> & { _id: Types.ObjectId };
export type FavoriteLean = Omit<FavoriteDocument, '_id'> & { _id: Types.ObjectId };
export type ReviewLean = Omit<ReviewDocument, '_id'> & { _id: Types.ObjectId };

/**
 * طبقة الوصول للأنظمة المساندة (Phase 9).
 *
 * قاعدة عابرة في كل دوال هذا الملف: **كل استعلام مقيّد بـ`userId`** — لا
 * توجد دالة تقرأ أو تكتب بمعرّف المورد وحده، فلا يمكن لمستدعٍ أن ينسى
 * الملكية ويقرأ بيانات مستخدم آخر.
 */

/* ================================================================== */
/* الإشعارات — الصورة 15                                               */
/* ================================================================== */

/** أنواع الإشعارات التي تنتمي لتبويب معيّن. */
export function typesForTab(tab: NotificationTab): NotificationType[] {
  const entries = Object.entries(NOTIFICATION_TYPE_TAB) as [NotificationType, string][];
  return entries.filter(([, value]) => value === tab).map(([type]) => type);
}

export async function findNotifications(options: {
  userId: string;
  tab: NotificationTab;
  unreadOnly: boolean;
  page: number;
  limit: number;
}): Promise<{ items: NotificationLean[]; total: number }> {
  await connectToDatabase();

  const filter: Record<string, unknown> = { userId: new Types.ObjectId(options.userId) };
  if (options.tab !== 'ALL') {
    filter.type = mongoose.trusted({ $in: typesForTab(options.tab) });
  }
  if (options.unreadOnly) filter.isRead = false;

  const skip = (options.page - 1) * options.limit;

  const [items, total] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(options.limit)
      .lean<NotificationLean[]>(),
    Notification.countDocuments(filter),
  ]);

  return { items, total };
}

/** عدّادات التبويبات + إجمالي غير المقروء — تجميعة واحدة. */
export async function countNotifications(userId: string): Promise<{
  byType: Record<string, number>;
  unreadByType: Record<string, number>;
  unreadTotal: number;
}> {
  await connectToDatabase();

  const rows = await Notification.aggregate<{
    _id: NotificationType;
    count: number;
    unread: number;
  }>([
    { $match: { userId: new Types.ObjectId(userId) } },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        unread: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } },
      },
    },
  ]);

  const byType: Record<string, number> = {};
  const unreadByType: Record<string, number> = {};
  let unreadTotal = 0;

  for (const row of rows) {
    byType[row._id] = row.count;
    unreadByType[row._id] = row.unread;
    unreadTotal += row.unread;
  }

  return { byType, unreadByType, unreadTotal };
}

/**
 * يعلّم إشعارًا مقروءًا — **بشرط ملكيته**.
 * يعيد `null` لغير المالك، فيُترجم إلى 404 لا 403.
 */
export async function markNotificationRead(
  userId: string,
  notificationId: string
): Promise<NotificationLean | null> {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(notificationId)) return null;

  return Notification.findOneAndUpdate(
    { _id: new Types.ObjectId(notificationId), userId: new Types.ObjectId(userId) },
    { $set: { isRead: true, readAt: new Date() } },
    { returnDocument: 'after' }
  ).lean<NotificationLean | null>();
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  await connectToDatabase();

  const result = await Notification.updateMany(
    { userId: new Types.ObjectId(userId), isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );

  return result.modifiedCount ?? 0;
}

/* ================================================================== */
/* التقييمات                                                           */
/* ================================================================== */

export async function findReviewByOrder(orderId: string): Promise<ReviewLean | null> {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(orderId)) return null;
  return Review.findOne({ orderId: new Types.ObjectId(orderId) }).lean<ReviewLean | null>();
}

export async function createReview(data: {
  orderId: string;
  customerId: string;
  providerId: string;
  rating: number;
  comment?: string;
}): Promise<ReviewLean> {
  await connectToDatabase();

  const created = await Review.create({
    orderId: new Types.ObjectId(data.orderId),
    customerId: new Types.ObjectId(data.customerId),
    providerId: new Types.ObjectId(data.providerId),
    rating: data.rating,
    ...(data.comment ? { comment: data.comment } : {}),
  });

  return created.toObject() as ReviewLean;
}

/**
 * يعيد حساب متوسط تقييم المزوّد وعدده من التقييمات **الظاهرة** فقط.
 *
 * إعادة الحساب لا `$inc`: التقييم قد يُخفى إداريًا لاحقًا، والمتوسط
 * التراكمي كان سيبقى محتسبًا لتقييم لم يعد ظاهرًا. القراءة من المصدر
 * تضمن أن الرقم المعروض يطابق ما يراه العميل دائمًا.
 */
export async function refreshProviderRating(providerId: string): Promise<void> {
  await connectToDatabase();
  const objectId = new Types.ObjectId(providerId);

  const [stats] = await Review.aggregate<{ avg: number; count: number }>([
    { $match: { providerId: objectId, isVisible: true } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  await ServiceProvider.updateOne(
    { _id: objectId },
    {
      $set: {
        // نقرّب لخانة عشرية واحدة — نفس ما يُعرض في الواجهة
        ratingAvg: stats ? Math.round(stats.avg * 10) / 10 : 0,
        ratingCount: stats?.count ?? 0,
      },
    }
  );
}

/* ================================================================== */
/* العناوين — الصورة 17                                                */
/* ================================================================== */

export async function findAddresses(userId: string): Promise<AddressLean[]> {
  await connectToDatabase();
  return Address.find({ userId: new Types.ObjectId(userId) })
    .sort({ isDefault: -1, createdAt: -1 })
    .lean<AddressLean[]>();
}

export async function findAddressById(
  userId: string,
  addressId: string
): Promise<AddressLean | null> {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(addressId)) return null;

  return Address.findOne({
    _id: new Types.ObjectId(addressId),
    userId: new Types.ObjectId(userId),
  }).lean<AddressLean | null>();
}

export async function countAddresses(userId: string): Promise<number> {
  await connectToDatabase();
  return Address.countDocuments({ userId: new Types.ObjectId(userId) });
}

/**
 * يجعل عنوانًا واحدًا افتراضيًا ويزيل الصفة عن الباقي.
 * عمليتان متتاليتان لا واحدة: لا يمكن التعبير عن «صفّر الكل عدا هذا» في
 * تحديث واحد، والنافذة بينهما لا تُنتج حالة خطرة (عنوانان افتراضيان في
 * أسوأ الأحوال، يصلحها التحديث التالي).
 */
export async function setDefaultAddress(userId: string, addressId: string): Promise<void> {
  await connectToDatabase();
  const owner = new Types.ObjectId(userId);

  await Address.updateMany({ userId: owner }, { $set: { isDefault: false } });
  await Address.updateOne(
    { _id: new Types.ObjectId(addressId), userId: owner },
    { $set: { isDefault: true } }
  );
}

export async function createAddress(
  userId: string,
  data: Record<string, unknown>
): Promise<AddressLean> {
  await connectToDatabase();

  const created = await Address.create({ ...data, userId: new Types.ObjectId(userId) });
  return created.toObject() as AddressLean;
}

export async function updateAddress(
  userId: string,
  addressId: string,
  patch: Record<string, unknown>
): Promise<AddressLean | null> {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(addressId)) return null;

  return Address.findOneAndUpdate(
    { _id: new Types.ObjectId(addressId), userId: new Types.ObjectId(userId) },
    { $set: patch },
    { returnDocument: 'after', runValidators: true }
  ).lean<AddressLean | null>();
}

export async function deleteAddress(userId: string, addressId: string): Promise<boolean> {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(addressId)) return false;

  const result = await Address.deleteOne({
    _id: new Types.ObjectId(addressId),
    userId: new Types.ObjectId(userId),
  });

  return (result.deletedCount ?? 0) > 0;
}

/* ================================================================== */
/* المفضلة                                                             */
/* ================================================================== */

export async function findFavorites(userId: string): Promise<FavoriteLean[]> {
  await connectToDatabase();
  return Favorite.find({ userId: new Types.ObjectId(userId) })
    .sort({ createdAt: -1 })
    .lean<FavoriteLean[]>();
}

export async function countFavorites(userId: string): Promise<number> {
  await connectToDatabase();
  return Favorite.countDocuments({ userId: new Types.ObjectId(userId) });
}

/**
 * يضيف للمفضلة أو يزيلها — تبديل لا إضافة.
 * الفهرس الفريد يمنع التكرار على مستوى قاعدة البيانات، وهذا يجعل الزر
 * الواحد في الواجهة يعمل في الاتجاهين بلا استعلام مسبق.
 */
export async function toggleFavorite(
  userId: string,
  target: { providerId?: string; serviceId?: string }
): Promise<{ added: boolean }> {
  await connectToDatabase();

  const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
  if (target.providerId) filter.providerId = new Types.ObjectId(target.providerId);
  if (target.serviceId) filter.serviceId = new Types.ObjectId(target.serviceId);

  const existing = await Favorite.findOne(filter);
  if (existing) {
    await Favorite.deleteOne({ _id: existing._id });
    return { added: false };
  }

  await Favorite.create(filter);
  return { added: true };
}

/* ================================================================== */
/* مركز المساعدة — الصورة 18                                           */
/* ================================================================== */

/** يهرّب محارف التعبير النمطي — نفس حارس البحث في Phase 5. */
function escapeRegexValue(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function findFaqs(options: { topic?: string | undefined; q?: string | undefined }) {
  await connectToDatabase();

  const filter: Record<string, unknown> = { isActive: true };
  if (options.topic) filter.topic = options.topic;

  if (options.q) {
    /*
     * النص يُهرَّب أولًا، ثم يُلفّ الشرط بـ`trusted()`: المنقّي العام
     * (`sanitizeFilter`) يجرّد `$regex` من أي مرشّح فيتحوّل إلى كائن حرفي
     * ويفشل تحويله إلى نص بخطأ 500. الهروب هو ما يجعل اللفّ آمنًا.
     */
    const pattern = escapeRegexValue(options.q);
    filter.$or = [
      { question: mongoose.trusted({ $regex: pattern, $options: 'i' }) },
      { answer: mongoose.trusted({ $regex: pattern, $options: 'i' }) },
    ];
  }

  return Faq.find(filter).sort({ order: 1 }).lean();
}

/** «مفيد / غير مفيد» — عدّاد بسيط بلا هوية المصوّت. */
export async function recordFaqFeedback(faqId: string, helpful: boolean): Promise<void> {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(faqId)) return;

  await Faq.updateOne(
    { _id: new Types.ObjectId(faqId) },
    { $inc: helpful ? { helpfulYes: 1 } : { helpfulNo: 1 } }
  );
}
