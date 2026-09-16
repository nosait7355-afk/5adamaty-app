import { conflict, forbidden, notFound, unprocessable } from '@/server/lib/errors';
import { logger } from '@/server/lib/logger';
import {
  applyStatusTransition,
  countOrdersByStatus,
  createOrder as insertOrder,
  findOrderById,
  findOrders,
  nextOrderNumber,
  withOptionalTransaction,
  type OrderLean,
} from '@/server/repositories/order.repository';
import {
  createNotification,
  findProviderById,
  findUserById,
  writeAuditLog,
} from '@/server/repositories/provider.repository';
import { verifyAndBuildMediaRef } from './upload.service';
import { assertCanAcceptOrders } from './provider.service';
import { findServiceById } from '@/server/repositories/discovery.repository';
import { assertTransition, canCustomerCancel, canReview } from '@/server/policies/order-state-machine';
import {
  ORDER_STATUS_LABELS_AR,
  PAYMENT_METHOD,
  type OrderStatus,
} from '@/shared/constants/order-status';
import { ORDER_TAB_STATUSES, type CreateOrderInput, type ListOrdersQuery } from '@/shared/schemas/order.schema';
import type { SessionUser } from '@/server/middleware/with-auth';
import type { MediaRef } from '@/server/db/models/shared';

/**
 * دورة حياة الطلب — جانب العميل (Phase 7).
 *
 * قواعد ثابتة في هذا الملف:
 *   1. **لا يوجد أي مسار مالي.** `paymentMethod` يثبّته الخادم على القيمة
 *      الوحيدة الممكنة، ولا يُقرأ من الطلب إطلاقًا. لا معاملة ولا محفظة ولا
 *      بوابة (ARCHITECTURE §0.1).
 *   2. **السعر ليس بيد العميل.** `agreedPrice` لم يعد يُشتق من أي سعر معلن
 *      المعلن، ولا يقبل الخادم قيمة سعر من جسم الطلب أصلًا.
 *   3. **كل تغيير حالة يمرّ بالـState Machine** ثم بتحديث شرطي ذرّي.
 *   4. **IDOR:** من ليس طرفًا في الطلب يحصل على 404 لا 403.
 */

/* ================================================================== */
/* أشكال الإخراج                                                       */
/* ================================================================== */

export interface OrderPartyDto {
  id: string;
  displayName: string;
  professionName?: string;
  avatar?: string;
  ratingAvg?: number;
  ratingCount?: number;
  /** يُملأ فقط بعد قبول الطلب — انظر `isContactUnlocked`. */
  phone?: string;
}

export interface OrderTimelineEntryDto {
  status: OrderStatus;
  label: string;
  byRole: string;
  note?: string;
  at: string;
}

export interface OrderDto {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  statusLabel: string;
  serviceType: string;
  details: string;
  notes?: string;
  address: {
    governorate: string;
    city: string;
    area: string;
    line: string;
    landmark?: string;
  };
  scheduledDate: string;
  preferredTimeFrom?: string;
  preferredTimeTo?: string;
  agreedPrice?: number;
  currency: string;
  /** قيمة واحدة ثابتة — لا يوجد اختيار ولا بوابة دفع. */
  paymentMethod: string;
  cashReceivedConfirmed: boolean;
  attachments: string[];
  provider: OrderPartyDto;
  createdAt: string;
  completedAt?: string;
  cancellationReason?: string;
  cancelledBy?: string;
  /** ما يستطيع العميل فعله الآن — تحسبه الـState Machine لا الواجهة. */
  canCancel: boolean;
  canReview: boolean;
  isContactUnlocked: boolean;
  timeline: OrderTimelineEntryDto[];
}

/* ================================================================== */
/* قواعد مشتقّة                                                        */
/* ================================================================== */

/**
 * التواصل المباشر (اتصال/واتساب في الصورة 14) يُفتح **بعد قبول المزوّد**.
 *
 * قبل القبول لا يوجد التزام بين الطرفين، وفتح الهاتف حينها يحوّل الطلب إلى
 * قناة لجمع أرقام المزوّدين. بعد القبول صار بينهما عمل متفق عليه.
 */
export function isContactUnlocked(status: OrderStatus): boolean {
  return ['ACCEPTED', 'IN_PROGRESS', 'ON_THE_WAY', 'COMPLETED'].includes(status);
}

/* ================================================================== */
/* المحوّلات                                                           */
/* ================================================================== */

function toTimeline(order: OrderLean): OrderTimelineEntryDto[] {
  return order.statusHistory.map((entry) => ({
    status: entry.to,
    label: ORDER_STATUS_LABELS_AR[entry.to],
    byRole: entry.byRole,
    ...(entry.note ? { note: entry.note } : {}),
    at: new Date(entry.at).toISOString(),
  }));
}

export function toOrderDto(
  order: OrderLean,
  provider: OrderPartyDto
): OrderDto {
  const contactUnlocked = isContactUnlocked(order.status);

  return {
    id: String(order._id),
    orderNumber: order.orderNumber,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS_AR[order.status],
    serviceType: order.serviceType,
    details: order.details,
    ...(order.notes ? { notes: order.notes } : {}),
    address: {
      governorate: order.address.governorate,
      city: order.address.city,
      area: order.address.area,
      line: order.address.line,
      ...(order.address.landmark ? { landmark: order.address.landmark } : {}),
    },
    scheduledDate: new Date(order.scheduledDate).toISOString(),
    ...(order.preferredTimeFrom ? { preferredTimeFrom: order.preferredTimeFrom } : {}),
    ...(order.preferredTimeTo ? { preferredTimeTo: order.preferredTimeTo } : {}),
    ...(order.agreedPrice != null ? { agreedPrice: order.agreedPrice } : {}),
    currency: order.currency,
    paymentMethod: order.paymentMethod,
    cashReceivedConfirmed: order.cashReceivedConfirmed,
    attachments: (order.attachments ?? []).map((file) => file.url),
    provider: contactUnlocked ? provider : stripContact(provider),
    createdAt: new Date(order.createdAt).toISOString(),
    ...(order.completedAt ? { completedAt: new Date(order.completedAt).toISOString() } : {}),
    ...(order.cancellationReason ? { cancellationReason: order.cancellationReason } : {}),
    ...(order.cancelledBy ? { cancelledBy: order.cancelledBy } : {}),
    canCancel: canCustomerCancel(order.status),
    canReview: canReview(order.status),
    isContactUnlocked: contactUnlocked,
    timeline: toTimeline(order),
  };
}

function stripContact(party: OrderPartyDto): OrderPartyDto {
  const { phone: _phone, ...rest } = party;
  return rest;
}

/** يجمع بيانات المزوّد المعروضة في بطاقة الطلب. */
export async function loadProviderParty(providerId: string): Promise<OrderPartyDto> {
  const provider = await findProviderById(providerId);
  if (!provider) {
    return { id: providerId, displayName: 'مقدم خدمة غير متاح' };
  }

  const user = await findUserById(String(provider.userId));

  return {
    id: String(provider._id),
    displayName: provider.displayName,
    ...(provider.gallery?.[0]?.url ? { avatar: provider.gallery[0].url } : {}),
    ratingAvg: provider.ratingAvg,
    ratingCount: provider.ratingCount,
    ...(user?.phone ? { phone: user.phone } : {}),
  };
}

/* ================================================================== */
/* الإنشاء — الصورتان 11 و12                                           */
/* ================================================================== */

export async function createOrder(
  user: SessionUser,
  input: CreateOrderInput,
  meta: { ip?: string; userAgent?: string }
): Promise<OrderDto> {
  const provider = await findProviderById(input.providerId);
  if (!provider) throw notFound('مقدم الخدمة المطلوب غير موجود.');

  /*
   * الحارس نفسه الذي كُتب في Phase 6: مزوّد غير معتمد لا يستقبل طلبات.
   * القاعدة مفروضة هنا لا في الواجهة، فلا ينفع تخمين معرّف مزوّد قيد المراجعة.
   */
  assertCanAcceptOrders(provider);

  if (String(provider.userId) === user.id) {
    throw unprocessable('لا يمكنك طلب خدمة من نفسك.');
  }

  /*
   * لا سعر عند الإنشاء: التسعير أُزيل من المنصة، فالقيمة تُتفق عليها بين
   * العميل والمزوّد خارج التطبيق. `agreedPrice` يبقى في النموذج لأنه
   * مصدر تقارير الإدارة، لكنه لا يُملأ من أي مصدر معلن.
   */
  const agreedPrice: number | undefined = undefined;
  let serviceType = input.serviceType;

  if (input.serviceId) {
    const service = await findServiceById(input.serviceId);
    if (!service) throw notFound('الخدمة المطلوبة غير موجودة.');
    if (String(service.providerId) !== input.providerId) {
      throw unprocessable('الخدمة المختارة لا تخصّ مقدم الخدمة المحدد.');
    }
    serviceType = service.title;
  }

  /* ---- المرفقات: يُتحقق من كل أصل لدى Cloudinary قبل حفظه ---- */
  const attachments: MediaRef[] = [];
  for (const publicId of input.attachmentPublicIds) {
    attachments.push(
      await verifyAndBuildMediaRef({ user, purpose: 'ORDER_ATTACHMENT', publicId })
    );
  }

  const orderNumber = await nextOrderNumber();

  const order = await withOptionalTransaction(async (session) => {
    const created = await insertOrder(
      {
        orderNumber,
        customerId: user.id as never,
        providerId: provider._id,
        ...(input.serviceId ? { serviceId: input.serviceId as never } : {}),
        categoryId: provider.categoryId,
        professionId: provider.professionId,

        serviceType,
        details: input.details,
        ...(input.notes ? { notes: input.notes } : {}),

        address: input.address,
        ...(input.addressId ? { addressId: input.addressId as never } : {}),

        scheduledDate: new Date(`${input.scheduledDate}T00:00:00`),
        ...(input.preferredTimeFrom ? { preferredTimeFrom: input.preferredTimeFrom } : {}),
        ...(input.preferredTimeTo ? { preferredTimeTo: input.preferredTimeTo } : {}),

        ...(agreedPrice != null ? { agreedPrice } : {}),
        currency: 'EGP',
        // القيمة الوحيدة الممكنة — لا تُقرأ من المدخلات أبدًا
        paymentMethod: PAYMENT_METHOD,
        cashReceivedConfirmed: false,

        attachments,
        status: 'NEW',
        statusHistory: [
          { from: null, to: 'NEW', byUserId: user.id as never, byRole: user.role, at: new Date() },
        ],
      },
      session
    );

    await createNotification({
      userId: String(provider.userId),
      type: 'ORDER_CREATED',
      title: 'طلب خدمة جديد',
      body: `وصلك طلب جديد رقم #${orderNumber} — ${serviceType}.`,
      entityType: 'ORDER',
      entityId: String(created._id),
      actionUrl: `/provider/orders/${String(created._id)}`,
    });

    await writeAuditLog({
      actorId: user.id,
      action: 'ORDER_STATUS_CHANGED',
      entityType: 'ServiceRequest',
      entityId: String(created._id),
      after: { status: 'NEW', orderNumber },
      ...(meta.ip ? { ip: meta.ip } : {}),
      ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
    });

    return created;
  });

  logger.info('أُنشئ طلب خدمة', {
    orderId: String(order._id),
    orderNumber,
    providerId: input.providerId,
  });

  return toOrderDto(order, await loadProviderParty(String(provider._id)));
}

/* ================================================================== */
/* القوائم والتفاصيل — الصورتان 13 و14                                 */
/* ================================================================== */

export interface OrderListResultDto {
  items: OrderDto[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  /** عدّادات التبويبات الظاهرة في الصورة 13. */
  counts: Record<string, number>;
}

export async function listMyOrders(
  user: SessionUser,
  query: ListOrdersQuery
): Promise<OrderListResultDto> {
  const statuses = query.status ? [query.status] : ORDER_TAB_STATUSES[query.tab];

  const { items, total } = await findOrders({
    customerId: user.id,
    statuses,
    page: query.page,
    limit: query.limit,
  });

  const byStatus = await countOrdersByStatus({ customerId: user.id });

  /* عدّاد لكل تبويب — مشتق من عدّادات الحالات بلا استعلام إضافي */
  const counts: Record<string, number> = {};
  for (const [tab, tabStatuses] of Object.entries(ORDER_TAB_STATUSES)) {
    counts[tab] = tabStatuses.reduce((sum, status) => sum + (byStatus[status] ?? 0), 0);
  }

  const dtos = await Promise.all(
    items.map(async (order) => toOrderDto(order, await loadProviderParty(String(order.providerId))))
  );

  return {
    items: dtos,
    total,
    page: query.page,
    limit: query.limit,
    hasMore: query.page * query.limit < total,
    counts,
  };
}

/**
 * طلب واحد.
 *
 * **حارس IDOR:** من ليس طرفًا في الطلب يحصل على 404 لا 403 — لأن 403 يؤكد
 * وجود الطلب ويسمح بتعداد المعرّفات (ARCHITECTURE §7).
 */
export async function getOrder(user: SessionUser, orderId: string): Promise<OrderDto> {
  const order = await requirePartyOrder(user, orderId);
  return toOrderDto(order, await loadProviderParty(String(order.providerId)));
}

export async function requirePartyOrder(user: SessionUser, orderId: string): Promise<OrderLean> {
  const order = await findOrderById(orderId);
  if (!order) throw notFound('الطلب المطلوب غير موجود.');

  if (user.role === 'ADMIN') return order;

  if (user.role === 'CUSTOMER') {
    if (String(order.customerId) !== user.id) {
      logger.warn('محاولة وصول لطلب مستخدم آخر', { userId: user.id, orderId });
      throw notFound('الطلب المطلوب غير موجود.');
    }
    return order;
  }

  // مقدم الخدمة: الطلب يجب أن يكون مسندًا لملفه هو
  const provider = await findProviderById(String(order.providerId));
  if (!provider || String(provider.userId) !== user.id) {
    logger.warn('محاولة وصول لطلب مزوّد آخر', { userId: user.id, orderId });
    throw notFound('الطلب المطلوب غير موجود.');
  }
  return order;
}

/* ================================================================== */
/* الإلغاء — الصورة 14                                                 */
/* ================================================================== */

export async function cancelOrder(
  user: SessionUser,
  orderId: string,
  input: { reason?: string },
  meta: { ip?: string; userAgent?: string }
): Promise<OrderDto> {
  const order = await requirePartyOrder(user, orderId);

  if (user.role === 'PROVIDER') {
    throw forbidden('إلغاء الطلب من جانب مقدم الخدمة يتم بالرفض لا بالإلغاء.');
  }

  // الـState Machine هي من تقرّر — لا شرط مكرر هنا
  assertTransition({ from: order.status, to: 'CANCELLED', role: user.role });

  const updated = await withOptionalTransaction(async (session) => {
    const result = await applyStatusTransition(
      {
        orderId,
        from: order.status,
        to: 'CANCELLED',
        actor: { userId: user.id, role: user.role },
        ...(input.reason ? { note: input.reason } : {}),
        extraFields: {
          cancelledBy: user.role,
          ...(input.reason ? { cancellationReason: input.reason } : {}),
        },
      },
      session
    );

    /*
     * `null` تعني أن الحالة تغيّرت بين القراءة والكتابة — سباق حقيقي:
     * المزوّد قبِل الطلب في نفس اللحظة مثلًا. نرفض بـ409 بدل الدهس.
     */
    if (!result) {
      throw conflict('تغيّرت حالة الطلب أثناء تنفيذ طلبك. حدّث الصفحة وحاول مجددًا.');
    }

    const provider = await findProviderById(String(result.providerId));
    if (provider) {
      await createNotification({
        userId: String(provider.userId),
        type: 'ORDER_CANCELLED',
        title: 'أُلغي طلب',
        body: `أُلغي الطلب رقم #${result.orderNumber}${input.reason ? ` — ${input.reason}` : ''}.`,
        entityType: 'ORDER',
        entityId: orderId,
        actionUrl: `/provider/orders/${orderId}`,
      });
    }

    await writeAuditLog({
      actorId: user.id,
      action: 'ORDER_STATUS_CHANGED',
      entityType: 'ServiceRequest',
      entityId: orderId,
      before: { status: order.status },
      after: { status: 'CANCELLED', cancelledBy: user.role },
      ...(meta.ip ? { ip: meta.ip } : {}),
      ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
    });

    return result;
  });

  logger.info('أُلغي طلب', { orderId, byRole: user.role });

  return toOrderDto(updated, await loadProviderParty(String(updated.providerId)));
}
