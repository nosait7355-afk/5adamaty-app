import { conflict, forbidden, unprocessable } from '@/server/lib/errors';
import { logger } from '@/server/lib/logger';
import {
  applyStatusTransition,
  countOrdersByStatus,
  findProviderOrders,
  getProviderDashboardStats,
  refreshProviderCompletionStats,
  withOptionalTransaction,
  type OrderLean,
} from '@/server/repositories/order.repository';
import {
  createNotification,
  findProviderByUserId,
  findUserById,
  writeAuditLog,
} from '@/server/repositories/provider.repository';
import { assertCanAcceptOrders } from './provider.service';
import {
  loadProviderParty,
  requirePartyOrder,
  toOrderDto,
  type OrderDto,
  type OrderPartyDto,
} from './order.service';
import { allowedTransitions, assertTransition } from '@/server/policies/order-state-machine';
import { ORDER_STATUS_LABELS_AR, type OrderStatus } from '@/shared/constants/order-status';
import {
  PROVIDER_TAB_STATUSES,
  type CompleteOrderInput,
  type ListProviderOrdersQuery,
  type UpdateOrderStatusInput,
} from '@/shared/schemas/order.schema';
import type { SessionUser } from '@/server/middleware/with-auth';

/**
 * دورة حياة الطلب — جانب مقدم الخدمة (Phase 8) — الصور 24 إلى 29.
 *
 * قواعد ثابتة:
 *   1. **لا إجراء قبل الاعتماد.** `assertCanAcceptOrders` تُفحص عند كل
 *      إجراء لا عند الإنشاء فقط — الموافقة قد تُسحب بعد منحها.
 *   2. **الإكمال مستحيل بلا تأكيد استلام المبلغ**، ويُفرض في ثلاث طبقات:
 *      المخطط (`literal(true)`)، والـState Machine، ونموذج قاعدة البيانات.
 *   3. **علامة استلام المبلغ ليست معاملة مالية.** لا سجل ولا محفظة ولا
 *      فاتورة — الدفع تمّ نقدًا خارج التطبيق (ARCHITECTURE §0.1).
 *   4. **«في الطريق» علامة يدوية.** لا GPS ولا موقع ولا ETA ولا مسافة.
 */

/* ================================================================== */
/* أشكال الإخراج                                                       */
/* ================================================================== */

export interface ProviderOrderDto extends Omit<OrderDto, 'provider'> {
  /**
   * بيانات العميل.
   *
   * تظهر للمزوّد **منذ الحالة NEW**، بعكس اتجاه العميل: العميل هو من بدأ
   * التواصل بإرسال الطلب، والمزوّد يحتاج الاسم والهاتف والعنوان ليقرّر
   * القبول أصلًا — والصورة 26 تعرضها على طلب «جديد».
   */
  customer: { id: string; fullName: string; phone?: string };
  /** ما يستطيع المزوّد فعله الآن — تحسبه الـState Machine لا الواجهة. */
  availableActions: OrderStatus[];
  canComplete: boolean;
}

type OrderWithCustomer = OrderLean & { customerName?: string; customerPhone?: string };

function toProviderOrderDto(order: OrderWithCustomer, provider: OrderPartyDto): ProviderOrderDto {
  const { provider: _provider, ...base } = toOrderDto(order, provider);
  const actions = allowedTransitions(order.status, 'PROVIDER');

  return {
    ...base,
    customer: {
      id: String(order.customerId),
      fullName: order.customerName ?? 'عميل',
      ...(order.customerPhone ? { phone: order.customerPhone } : {}),
    },
    availableActions: actions,
    canComplete: actions.includes('COMPLETED'),
  };
}

async function requireOwnProviderProfile(user: SessionUser) {
  const provider = await findProviderByUserId(user.id);
  if (!provider) throw forbidden('لا يوجد ملف مقدّم خدمة مرتبط بحسابك.');
  return provider;
}

/* ================================================================== */
/* القوائم والتفاصيل — الصورتان 25 و26                                 */
/* ================================================================== */

export interface ProviderOrderListDto {
  items: ProviderOrderDto[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  counts: Record<string, number>;
}

export async function listProviderOrders(
  user: SessionUser,
  query: ListProviderOrdersQuery
): Promise<ProviderOrderListDto> {
  const provider = await requireOwnProviderProfile(user);
  const providerId = String(provider._id);

  const { items, total } = await findProviderOrders({
    providerId,
    statuses: PROVIDER_TAB_STATUSES[query.tab],
    q: query.q,
    sort: query.sort,
    page: query.page,
    limit: query.limit,
  });

  const byStatus = await countOrdersByStatus({ providerId });
  const counts: Record<string, number> = {};
  for (const [tab, statuses] of Object.entries(PROVIDER_TAB_STATUSES)) {
    counts[tab] = statuses.reduce((sum, status) => sum + (byStatus[status] ?? 0), 0);
  }

  const party = await loadProviderParty(providerId);

  return {
    items: items.map((order) => toProviderOrderDto(order, party)),
    total,
    page: query.page,
    limit: query.limit,
    hasMore: query.page * query.limit < total,
    counts,
  };
}

export async function getProviderOrder(
  user: SessionUser,
  orderId: string
): Promise<ProviderOrderDto> {
  // نفس حارس IDOR المستخدم لجانب العميل — من ليس طرفًا يحصل على 404
  const order = await requirePartyOrder(user, orderId);
  const customer = await findUserById(String(order.customerId));

  return toProviderOrderDto(
    {
      ...order,
      ...(customer?.fullName ? { customerName: customer.fullName } : {}),
      ...(customer?.phone ? { customerPhone: customer.phone } : {}),
    },
    await loadProviderParty(String(order.providerId))
  );
}

/* ================================================================== */
/* تحديث الحالة — الصورتان 26 و27                                      */
/* ================================================================== */

const STATUS_NOTIFICATION = {
  ACCEPTED: { type: 'ORDER_ACCEPTED', title: 'تم قبول طلبك' },
  REJECTED: { type: 'ORDER_REJECTED', title: 'تم رفض طلبك' },
  IN_PROGRESS: { type: 'ORDER_STATUS_CHANGED', title: 'بدأ تنفيذ طلبك' },
  ON_THE_WAY: { type: 'ORDER_STATUS_CHANGED', title: 'مقدم الخدمة في الطريق' },
} as const;

/**
 * قبول/رفض/بدء التنفيذ/في الطريق.
 *
 * `COMPLETED` لا تمرّ من هنا: مخطط الإدخال لا يقبلها أصلًا، فلا يمكن
 * الالتفاف على شرط تأكيد استلام المبلغ بإرسال الحالة مباشرةً.
 */
export async function updateOrderStatus(
  user: SessionUser,
  orderId: string,
  input: UpdateOrderStatusInput,
  meta: { ip?: string; userAgent?: string }
): Promise<ProviderOrderDto> {
  const provider = await requireOwnProviderProfile(user);
  assertCanAcceptOrders(provider);

  const order = await requirePartyOrder(user, orderId);
  assertTransition({ from: order.status, to: input.status, role: 'PROVIDER' });

  await withOptionalTransaction(async (session) => {
    const result = await applyStatusTransition(
      {
        orderId,
        from: order.status,
        to: input.status,
        actor: { userId: user.id, role: 'PROVIDER' },
        ...(input.note ? { note: input.note } : {}),
        extraFields:
          input.status === 'REJECTED'
            ? {
                cancelledBy: 'PROVIDER',
                ...(input.note ? { cancellationReason: input.note } : {}),
              }
            : {},
      },
      session
    );

    /* `null` = تغيّرت الحالة بين القراءة والكتابة (سباق حقيقي) */
    if (!result) {
      throw conflict('تغيّرت حالة الطلب أثناء تنفيذ طلبك. حدّث الصفحة وحاول مجددًا.');
    }

    const notification = STATUS_NOTIFICATION[input.status];
    await createNotification({
      userId: String(result.customerId),
      type: notification.type,
      title: notification.title,
      body: `طلبك رقم #${result.orderNumber}: ${ORDER_STATUS_LABELS_AR[input.status]}${
        input.note ? ` — ${input.note}` : ''
      }.`,
      entityType: 'ORDER',
      entityId: orderId,
      actionUrl: `/orders/${orderId}`,
    });

    await writeAuditLog({
      actorId: user.id,
      action: 'ORDER_STATUS_CHANGED',
      entityType: 'ServiceRequest',
      entityId: orderId,
      before: { status: order.status },
      after: { status: input.status },
      ...(meta.ip ? { ip: meta.ip } : {}),
      ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
    });

    return result;
  });

  logger.info('حُدّثت حالة طلب', { orderId, from: order.status, to: input.status });

  return getProviderOrder(user, orderId);
}

/* ================================================================== */
/* الإكمال — الصورتان 28 و29                                           */
/* ================================================================== */

/**
 * يفرض تأكيدَي الإكمال ويرمي **422** برسالة عربية.
 *
 * فُصلت عن المخطط عمدًا: غياب التأكيد ليس خطأ شكل بل مخالفة قاعدة عمل،
 * ومعيار القبول في PROJECT_PLAN — Phase 8 ينصّ على 422 لا 400. النوع
 * الخاطئ (نص بدل قيمة منطقية) يبقى 400 من المخطط.
 *
 * دالة خالصة بلا وصول لقاعدة البيانات لتُختبر وحدويًا.
 */
export function assertCompletionConfirmed(input: {
  serviceCompleted?: boolean | undefined;
  cashReceivedConfirmed?: boolean | undefined;
}): void {
  if (input.serviceCompleted !== true) {
    throw unprocessable('لا يمكن إكمال الطلب قبل تأكيد إتمام الخدمة بالكامل.', {
      serviceCompleted: 'أكّد أن الخدمة تمت بالكامل.',
    });
  }

  if (input.cashReceivedConfirmed !== true) {
    throw unprocessable('لا يمكن إكمال الطلب قبل تأكيد استلام المبلغ من العميل.', {
      cashReceivedConfirmed: 'أكّد استلام المبلغ المتفق عليه من العميل مباشرة.',
    });
  }
}

/**
 * إكمال الطلب بتأكيد استلام المبلغ نقدًا.
 *
 * ثلاث طبقات مستقلة تحرس نفس القاعدة، فلا يمرّ طلب مكتمل بلا تأكيد مهما
 * كان مصدر الاستدعاء:
 *   1. `assertCompletionConfirmed` → **422** برسالة عربية.
 *   2. الـState Machine ترفض الانتقال بلا تأكيد → 409.
 *   3. نموذج قاعدة البيانات يرفض الحفظ في `pre('validate')`.
 *
 * ⚠️ العلامة **إفادة بحدوث الدفع خارج التطبيق** لا معاملة مالية: لا مجموعة
 * معاملات ولا محفظة ولا فاتورة ولا أي سجل مالي.
 */
export async function completeOrder(
  user: SessionUser,
  orderId: string,
  input: CompleteOrderInput,
  meta: { ip?: string; userAgent?: string }
): Promise<ProviderOrderDto> {
  // الطبقة الأولى: قاعدة العمل — 422 قبل أي عمل آخر
  assertCompletionConfirmed(input);

  const provider = await requireOwnProviderProfile(user);
  assertCanAcceptOrders(provider);

  const order = await requirePartyOrder(user, orderId);

  // الطبقة الثانية: الـState Machine — تحرس نفس القاعدة مستقلةً
  assertTransition({
    from: order.status,
    to: 'COMPLETED',
    role: 'PROVIDER',
    cashReceivedConfirmed: input.cashReceivedConfirmed === true,
  });

  const completedAt = new Date();

  await withOptionalTransaction(async (session) => {
    const result = await applyStatusTransition(
      {
        orderId,
        from: order.status,
        to: 'COMPLETED',
        actor: { userId: user.id, role: 'PROVIDER' },
        ...(input.note ? { note: input.note } : {}),
        extraFields: {
          cashReceivedConfirmed: true,
          cashConfirmedAt: completedAt,
          completedAt,
        },
      },
      session
    );

    if (!result) {
      throw conflict('تغيّرت حالة الطلب أثناء تنفيذ طلبك. حدّث الصفحة وحاول مجددًا.');
    }

    await createNotification({
      userId: String(result.customerId),
      type: 'ORDER_COMPLETED',
      title: 'تم إكمال طلبك',
      body: `اكتمل طلبك رقم #${result.orderNumber}. يسعدنا تقييمك للخدمة.`,
      entityType: 'ORDER',
      entityId: orderId,
      actionUrl: `/orders/${orderId}`,
    });

    await writeAuditLog({
      actorId: user.id,
      action: 'ORDER_STATUS_CHANGED',
      entityType: 'ServiceRequest',
      entityId: orderId,
      before: { status: order.status, cashReceivedConfirmed: false },
      after: { status: 'COMPLETED', cashReceivedConfirmed: true },
      ...(meta.ip ? { ip: meta.ip } : {}),
      ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
    });

    return result;
  });

  // الإحصاءات تُحدَّث بعد نجاح الانتقال لا قبله
  await refreshProviderCompletionStats(String(provider._id));

  logger.info('اكتمل طلب بتأكيد استلام المبلغ', { orderId, providerId: String(provider._id) });

  return getProviderOrder(user, orderId);
}

/* ================================================================== */
/* لوحة التحكم — الصورة 24                                             */
/* ================================================================== */

export interface ProviderDashboardDto {
  provider: {
    id: string;
    displayName: string;
    ratingAvg: number;
    ratingCount: number;
    isVerifiedBadge: boolean;
    profileCompletion: number;
    isActive: boolean;
  };
  kpis: { newOrders: number; inProgress: number; completedThisMonth: number; rating: number };
  /**
   * تقرير الأرباح: مجموع قيم الطلبات المكتملة المحصّلة **كاش خارج التطبيق**.
   * إحصاء مشتق من الطلبات لحظة القراءة — لا رصيد ولا محفظة ولا سجل مالي.
   */
  earnings: { total: number; thisMonth: number; previousMonth: number; changePercent: number };
  recentOrders: ProviderOrderDto[];
}

export async function getProviderDashboard(user: SessionUser): Promise<ProviderDashboardDto> {
  const provider = await requireOwnProviderProfile(user);
  const providerId = String(provider._id);

  const stats = await getProviderDashboardStats(providerId);
  const recent = await findProviderOrders({ providerId, sort: 'newest', page: 1, limit: 3 });
  const party = await loadProviderParty(providerId);

  /* نسبة التغيّر عن الشهر الماضي — بلا قسمة على صفر */
  const changePercent =
    stats.earningsPreviousMonth > 0
      ? Math.round(
          ((stats.earningsThisMonth - stats.earningsPreviousMonth) / stats.earningsPreviousMonth) *
            100
        )
      : stats.earningsThisMonth > 0
        ? 100
        : 0;

  return {
    provider: {
      id: providerId,
      displayName: provider.displayName,
      ratingAvg: provider.ratingAvg,
      ratingCount: provider.ratingCount,
      isVerifiedBadge: provider.isVerifiedBadge,
      profileCompletion: provider.profileCompletion,
      isActive: provider.isActive,
    },
    kpis: {
      newOrders: (stats.counts.NEW ?? 0) + (stats.counts.ACCEPTED ?? 0),
      inProgress: (stats.counts.IN_PROGRESS ?? 0) + (stats.counts.ON_THE_WAY ?? 0),
      completedThisMonth: stats.completedThisMonth,
      rating: provider.ratingAvg,
    },
    earnings: {
      total: stats.earningsTotal,
      thisMonth: stats.earningsThisMonth,
      previousMonth: stats.earningsPreviousMonth,
      changePercent,
    },
    recentOrders: recent.items.map((order) => toProviderOrderDto(order, party)),
  };
}
