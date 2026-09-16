import { conflict, notFound, unprocessable } from '@/server/lib/errors';
import { logger } from '@/server/lib/logger';
import {
  countAddresses,
  countFavorites,
  countNotifications,
  createAddress,
  createReview as insertReview,
  deleteAddress,
  findAddressById,
  findAddresses,
  findFaqs,
  findFavorites,
  findNotifications,
  findReviewByOrder,
  markAllNotificationsRead,
  markNotificationRead,
  recordFaqFeedback,
  refreshProviderRating,
  setDefaultAddress,
  toggleFavorite,
  updateAddress,
  type AddressLean,
  type NotificationLean,
} from '@/server/repositories/account.repository';
import {
  createNotification,
  findProviderById,
  findUserById,
  updateUser,
} from '@/server/repositories/provider.repository';
import { findOrderById } from '@/server/repositories/order.repository';
import { findProviders, findServices } from '@/server/repositories/discovery.repository';
import { countUnreadMessages } from '@/server/repositories/messaging.repository';
import { verifyAndBuildMediaRef } from './upload.service';
import { canReview } from '@/server/policies/order-state-machine';
import { toAuthUserDto, type AuthUserDto } from './auth.service';
import { NOTIFICATION_TYPE_TAB, type NotificationTab } from '@/shared/constants/notifications';
import type {
  CreateAddressInput,
  CreateFavoriteInput,
  CreateReviewInput,
  ListNotificationsQuery,
  SupportContactInput,
  UpdateProfileInput,
} from '@/shared/schemas/account.schema';
import type { SessionUser } from '@/server/middleware/with-auth';

/**
 * الأنظمة المساندة (Phase 9): الإشعارات والتقييمات والعناوين والمفضلة
 * والملف الشخصي ومركز المساعدة — الصور 15 إلى 18.
 *
 * ⚠️ «وسائل الدفع» في الصورة 16 **عنصر معلوماتي**: قيمته في التصميم نفسه
 * `—`، فيشرح أن الدفع كاش مباشرة بلا أي بوابة (ARCHITECTURE §0.1).
 */

/* ================================================================== */
/* الإشعارات — الصورة 15                                               */
/* ================================================================== */

export interface NotificationDto {
  id: string;
  type: string;
  tab: string;
  title: string;
  body: string;
  entityType: string;
  entityId?: string;
  actionUrl?: string;
  isRead: boolean;
  createdAt: string;
}

function toNotificationDto(notification: NotificationLean): NotificationDto {
  return {
    id: String(notification._id),
    type: notification.type,
    tab: NOTIFICATION_TYPE_TAB[notification.type],
    title: notification.title,
    body: notification.body,
    entityType: notification.entityType,
    ...(notification.entityId ? { entityId: String(notification.entityId) } : {}),
    ...(notification.actionUrl ? { actionUrl: notification.actionUrl } : {}),
    isRead: notification.isRead,
    createdAt: new Date(notification.createdAt).toISOString(),
  };
}

export async function listNotifications(user: SessionUser, query: ListNotificationsQuery) {
  const { items, total } = await findNotifications({
    userId: user.id,
    tab: query.tab,
    unreadOnly: query.unreadOnly,
    page: query.page,
    limit: query.limit,
  });

  const counts = await countNotifications(user.id);

  /* عدّاد لكل تبويب — مشتق من عدّادات الأنواع بلا استعلام إضافي */
  const tabCounts: Record<string, number> = { ALL: 0 };
  let all = 0;
  for (const [type, count] of Object.entries(counts.byType)) {
    const tab = NOTIFICATION_TYPE_TAB[type as keyof typeof NOTIFICATION_TYPE_TAB];
    tabCounts[tab] = (tabCounts[tab] ?? 0) + count;
    all += count;
  }
  tabCounts.ALL = all;

  return {
    items: items.map(toNotificationDto),
    total,
    page: query.page,
    limit: query.limit,
    hasMore: query.page * query.limit < total,
    counts: tabCounts,
    unreadTotal: counts.unreadTotal,
  };
}

export async function readNotification(user: SessionUser, notificationId: string) {
  const updated = await markNotificationRead(user.id, notificationId);
  // غير المالك يحصل على 404 لا 403 — لا نكشف وجود الإشعار (ARCHITECTURE §7)
  if (!updated) throw notFound('الإشعار المطلوب غير موجود.');
  return toNotificationDto(updated);
}

export async function readAllNotifications(user: SessionUser) {
  const updated = await markAllNotificationsRead(user.id);
  return { updated };
}

/** شارة غير المقروء: إشعارات + رسائل. */
export async function getUnreadSummary(user: SessionUser) {
  const [notifications, messages] = await Promise.all([
    countNotifications(user.id),
    countUnreadMessages(user.id),
  ]);

  return { notifications: notifications.unreadTotal, messages };
}

/* ================================================================== */
/* التقييمات                                                           */
/* ================================================================== */

export interface ReviewResultDto {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  provider: { id: string; ratingAvg: number; ratingCount: number };
}

/**
 * كتابة تقييم لطلب مكتمل.
 *
 * أربعة شروط، كلها على الخادم:
 *   1. الطلب موجود ويخصّ هذا العميل (وإلا 404 — لا 403).
 *   2. حالته `COMPLETED` (تحكمها الـState Machine لا شرط مكرر هنا).
 *   3. لم يُقيَّم من قبل — ويحرسه أيضًا **فهرس فريد** على `orderId`، فحتى
 *      طلبان متزامنان لا ينتجان تقييمين.
 *   4. التقييم عدد صحيح 1–5 (من المخطط).
 */
export async function createReview(
  user: SessionUser,
  orderId: string,
  input: CreateReviewInput
): Promise<ReviewResultDto> {
  const order = await findOrderById(orderId);
  if (!order) throw notFound('الطلب المطلوب غير موجود.');

  if (String(order.customerId) !== user.id) {
    logger.warn('محاولة تقييم طلب مستخدم آخر', { userId: user.id, orderId });
    throw notFound('الطلب المطلوب غير موجود.');
  }

  if (!canReview(order.status)) {
    throw unprocessable('لا يمكن تقييم الطلب قبل اكتماله.');
  }

  const existing = await findReviewByOrder(orderId);
  if (existing) throw conflict('سبق أن قيّمت هذا الطلب.');

  let review;
  try {
    review = await insertReview({
      orderId,
      customerId: user.id,
      providerId: String(order.providerId),
      rating: input.rating,
      ...(input.comment ? { comment: input.comment } : {}),
    });
  } catch (error) {
    // الفهرس الفريد أمسك سباقًا بين طلبين متزامنين
    if (isDuplicateKey(error)) throw conflict('سبق أن قيّمت هذا الطلب.');
    throw error;
  }

  await refreshProviderRating(String(order.providerId));

  const provider = await findProviderById(String(order.providerId));

  await createNotification({
    userId: String(provider?.userId ?? order.providerId),
    type: 'REVIEW_RECEIVED',
    title: 'تقييم جديد',
    body: `قيّم العميل الطلب رقم #${order.orderNumber} بـ${input.rating} من 5.`,
    entityType: 'REVIEW',
    entityId: String(review._id),
    actionUrl: `/provider/orders/${orderId}`,
  });

  logger.info('أُضيف تقييم', { orderId, rating: input.rating });

  return {
    id: String(review._id),
    rating: review.rating,
    ...(review.comment ? { comment: review.comment } : {}),
    createdAt: new Date(review.createdAt).toISOString(),
    provider: {
      id: String(order.providerId),
      ratingAvg: provider?.ratingAvg ?? 0,
      ratingCount: provider?.ratingCount ?? 0,
    },
  };
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;
}

/* ================================================================== */
/* العناوين — الصورة 17                                                */
/* ================================================================== */

export interface AddressDto {
  id: string;
  label: string;
  type: string;
  governorate: string;
  city: string;
  area: string;
  line: string;
  landmark?: string;
  postalCode?: string;
  contactName: string;
  contactPhone: string;
  isDefault: boolean;
}

function toAddressDto(address: AddressLean): AddressDto {
  return {
    id: String(address._id),
    label: address.label,
    type: address.type,
    governorate: address.governorate,
    city: address.city,
    area: address.area,
    line: address.line,
    ...(address.landmark ? { landmark: address.landmark } : {}),
    ...(address.postalCode ? { postalCode: address.postalCode } : {}),
    contactName: address.contactName,
    contactPhone: address.contactPhone,
    isDefault: address.isDefault,
  };
}

export async function listAddresses(user: SessionUser): Promise<AddressDto[]> {
  const addresses = await findAddresses(user.id);
  return addresses.map(toAddressDto);
}

/** أقصى عدد عناوين — يمنع إغراق القائمة. */
export const MAX_ADDRESSES = 10;

export async function addAddress(
  user: SessionUser,
  input: CreateAddressInput
): Promise<AddressDto> {
  const count = await countAddresses(user.id);
  if (count >= MAX_ADDRESSES) {
    throw unprocessable(`الحد الأقصى ${MAX_ADDRESSES} عناوين. احذف عنوانًا قبل إضافة آخر.`);
  }

  // أول عنوان يصير افتراضيًا تلقائيًا — وإلا بقي المستخدم بلا افتراضي
  const shouldBeDefault = input.isDefault || count === 0;

  const created = await createAddress(user.id, { ...input, isDefault: shouldBeDefault });
  if (shouldBeDefault) await setDefaultAddress(user.id, String(created._id));

  const stored = await findAddressById(user.id, String(created._id));
  return toAddressDto(stored ?? created);
}

export async function editAddress(
  user: SessionUser,
  addressId: string,
  patch: Record<string, unknown>
): Promise<AddressDto> {
  const { isDefault, ...rest } = patch as { isDefault?: boolean };

  const updated = await updateAddress(user.id, addressId, rest);
  if (!updated) throw notFound('العنوان المطلوب غير موجود.');

  if (isDefault === true) await setDefaultAddress(user.id, addressId);

  const stored = await findAddressById(user.id, addressId);
  return toAddressDto(stored ?? updated);
}

export async function makeAddressDefault(
  user: SessionUser,
  addressId: string
): Promise<AddressDto[]> {
  const address = await findAddressById(user.id, addressId);
  if (!address) throw notFound('العنوان المطلوب غير موجود.');

  await setDefaultAddress(user.id, addressId);
  return listAddresses(user);
}

export async function removeAddress(user: SessionUser, addressId: string): Promise<void> {
  const address = await findAddressById(user.id, addressId);
  if (!address) throw notFound('العنوان المطلوب غير موجود.');

  await deleteAddress(user.id, addressId);

  /*
   * حذف الافتراضي يترك المستخدم بلا افتراضي، فنرقّي الأقدم مكانه بدل
   * تركه يفاجأ بغياب عنوان مختار في شاشة الطلب.
   */
  if (address.isDefault) {
    const remaining = await findAddresses(user.id);
    const next = remaining[0];
    if (next) await setDefaultAddress(user.id, String(next._id));
  }
}

/* ================================================================== */
/* المفضلة                                                             */
/* ================================================================== */

export async function listFavorites(user: SessionUser) {
  const favorites = await findFavorites(user.id);

  const providerIds = favorites.filter((item) => item.providerId).map((item) => String(item.providerId));
  const serviceIds = favorites.filter((item) => item.serviceId).map((item) => String(item.serviceId));

  /*
   * نقرأ عبر مستودع الاكتشاف لا مباشرةً: بذلك يسري عليها **نفس حارس
   * الظهور** — مزوّد فقد اعتماده لا يظهر في المفضلة أيضًا.
   */
  const [providers, services] = await Promise.all([
    providerIds.length > 0
      ? findProviders({ page: 1, limit: 50 }).then((result) =>
          result.items.filter((item) => providerIds.includes(String(item._id)))
        )
      : Promise.resolve([]),
    serviceIds.length > 0
      ? findServices({ page: 1, limit: 50 }).then((result) =>
          result.items.filter((item) => serviceIds.includes(String(item._id)))
        )
      : Promise.resolve([]),
  ]);

  return {
    providers: providers.map((provider) => ({
      id: String(provider._id),
      displayName: provider.displayName,
      professionName: provider.professionName,
      ratingAvg: provider.ratingAvg,
      ratingCount: provider.ratingCount,
      area: provider.coverageAreas?.[0],
    })),
    services: services.map((service) => ({
      id: String(service._id),
      title: service.title,
      ratingAvg: service.ratingAvg,
      providerId: String(service.providerId),
    })),
    total: favorites.length,
  };
}

export async function toggleFavoriteEntry(user: SessionUser, input: CreateFavoriteInput) {
  const result = await toggleFavorite(user.id, {
    ...(input.providerId ? { providerId: input.providerId } : {}),
    ...(input.serviceId ? { serviceId: input.serviceId } : {}),
  });

  return { ...result, total: await countFavorites(user.id) };
}

/* ================================================================== */
/* الملف الشخصي — الصورة 16                                            */
/* ================================================================== */

export interface AccountSummaryDto {
  user: AuthUserDto;
  stats: {
    favorites: number;
    addresses: number;
    /** «وسائل الدفع» في الصورة 16 — معلوماتي بلا قيمة عددية. */
    paymentMethodsNote: string;
    unreadNotifications: number;
  };
  orders: Record<string, number>;
}

export async function getAccountSummary(user: SessionUser): Promise<AccountSummaryDto> {
  const account = await findUserById(user.id);
  if (!account) throw notFound('الحساب غير موجود.');

  const [favorites, addresses, notifications] = await Promise.all([
    countFavorites(user.id),
    countAddresses(user.id),
    countNotifications(user.id),
  ]);

  const { countOrdersByStatus } = await import('@/server/repositories/order.repository');
  const orders = await countOrdersByStatus({ customerId: user.id });

  return {
    user: toAuthUserDto(account as never),
    stats: {
      favorites,
      addresses,
      paymentMethodsNote: 'الدفع كاش مباشرة لمقدم الخدمة — لا يوجد دفع إلكتروني في التطبيق.',
      unreadNotifications: notifications.unreadTotal,
    },
    orders,
  };
}

export async function updateProfile(
  user: SessionUser,
  input: UpdateProfileInput
): Promise<AuthUserDto> {
  const patch: Record<string, unknown> = {};
  if (input.fullName !== undefined) patch.fullName = input.fullName;
  if (input.email !== undefined) patch.email = input.email;
  if (input.city !== undefined) patch.city = input.city;
  if (input.area !== undefined) patch.area = input.area;
  if (input.gender !== undefined) patch.gender = input.gender;

  if (input.avatarPublicId) {
    // الأصل يُتحقق منه لدى Cloudinary — لا نثق بمعرّف يرسله العميل
    patch.avatar = await verifyAndBuildMediaRef({
      user,
      purpose: 'AVATAR',
      publicId: input.avatarPublicId,
    });
  }

  const updated = await updateUser(user.id, patch);
  if (!updated) throw notFound('الحساب غير موجود.');

  return toAuthUserDto(updated as never);
}

/* ================================================================== */
/* مركز المساعدة — الصورة 18                                           */
/* ================================================================== */

export async function listFaqs(options: { topic?: string | undefined; q?: string | undefined }) {
  const faqs = await findFaqs(options);

  return faqs.map((faq) => ({
    id: String(faq._id),
    question: faq.question,
    answer: faq.answer,
    topic: faq.topic,
    helpfulYes: faq.helpfulYes,
    helpfulNo: faq.helpfulNo,
  }));
}

export async function submitFaqFeedback(faqId: string, helpful: boolean): Promise<void> {
  await recordFaqFeedback(faqId, helpful);
}

/**
 * «تواصل معنا» — ينشئ إشعارًا للمستخدم يؤكد الاستلام ويسجّل الرسالة.
 * لا تكامل بطرف ثالث ولا webhook.
 */
export async function contactSupport(
  user: SessionUser,
  input: SupportContactInput
): Promise<{ received: true }> {
  logger.info('رسالة دعم', { userId: user.id, subject: input.subject });

  await createNotification({
    userId: user.id,
    type: 'SYSTEM',
    title: 'وصلت رسالتك للدعم',
    body: `استلمنا رسالتك «${input.subject}» وسنرد عليك قريبًا.`,
    entityType: 'SYSTEM',
    actionUrl: '/help',
  });

  return { received: true };
}

/** يُستخدم في تبويب «الرسائل» بشارة غير المقروء. */
export type { NotificationTab };
