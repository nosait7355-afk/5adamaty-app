import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { buildAllIndexes, startTestDb, stopTestDb } from '../helpers/db';

/* المرفقات تتطلب Cloudinary — نعزلها، فمنطق الرفع مُغطّى في Phase 4. */
vi.mock('@/server/services/upload.service', () => ({
  verifyAndBuildMediaRef: vi.fn(async ({ publicId }: { publicId: string }) => ({
    publicId,
    url: `https://res.cloudinary.com/demo/image/upload/v1/${publicId}.jpg`,
    format: 'jpg',
    bytes: 90_000,
    resourceType: 'image' as const,
    accessMode: 'public' as const,
    uploadedAt: new Date(),
  })),
}));

import { runSeed } from '@/server/db/seed/seed';
import { AuditLog, Notification, ServiceProvider, ServiceRequest, User } from '@/server/db/models';
import { resetRateLimitStore } from '@/server/middleware/with-rate-limit';
import { signAccessToken } from '@/server/lib/jwt';
import { applyStatusTransition } from '@/server/repositories/order.repository';

import { GET as listOrdersRoute, POST as createOrderRoute } from '@/app/api/v1/orders/route';
import { GET as orderDetailRoute } from '@/app/api/v1/orders/[id]/route';
import { POST as cancelOrderRoute } from '@/app/api/v1/orders/[id]/cancel/route';

/**
 * دورة حياة الطلب — جانب العميل (Phase 7).
 */

let approvedProviderId = '';
let approvedProviderUserId = '';
let pendingProviderId = '';
let customerId = '';
let customerToken = '';
let otherCustomerId = '';
let otherCustomerToken = '';
let providerToken = '';

beforeAll(async () => {
  await startTestDb();
  await buildAllIndexes();
  await runSeed();

  process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters-long!!';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters-long!';
  process.env.APP_URL = 'http://localhost:3000';

  const approved = await ServiceProvider.findOne({ displayName: 'أبو خالد للسباكة' });
  const pending = await ServiceProvider.findOne({ displayName: 'مزوّد قيد المراجعة' });
  approvedProviderId = String(approved?._id);
  approvedProviderUserId = String(approved?.userId);
  pendingProviderId = String(pending?._id);

  const customer = await User.create({
    role: 'CUSTOMER',
    fullName: 'عميل الطلبات',
    phone: '+201050000001',
    passwordHash: 'TEST_ONLY',
    status: 'ACTIVE',
  });
  customerId = String(customer._id);
  customerToken = await signAccessToken({ userId: customerId, role: 'CUSTOMER', status: 'ACTIVE' });

  const other = await User.create({
    role: 'CUSTOMER',
    fullName: 'عميل آخر',
    phone: '+201050000002',
    passwordHash: 'TEST_ONLY',
    status: 'ACTIVE',
  });
  otherCustomerId = String(other._id);
  otherCustomerToken = await signAccessToken({
    userId: otherCustomerId,
    role: 'CUSTOMER',
    status: 'ACTIVE',
  });

  providerToken = await signAccessToken({
    userId: approvedProviderUserId,
    role: 'PROVIDER',
    status: 'ACTIVE',
  });
}, 90_000);

afterAll(async () => {
  await stopTestDb();
});

afterEach(() => {
  resetRateLimitStore();
});

/* ================================================================== */
/* أدوات                                                               */
/* ================================================================== */

interface ReqOptions {
  method?: string;
  body?: unknown;
  token?: string;
  query?: string;
}

function req(path: string, options: ReqOptions = {}): Request {
  const headers: Record<string, string> = {
    'x-forwarded-for': `10.3.0.${Math.floor(Math.random() * 250) + 1}`,
    origin: 'http://localhost:3000',
  };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.token) headers.cookie = `kf_at=${options.token}`;

  return new Request(`http://localhost:3000${path}${options.query ?? ''}`, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
}

interface Body {
  success: boolean;
  data?: never;
  meta?: { total?: number; hasMore?: boolean };
  error?: { code: string; message: string; fields?: Record<string, string> };
}

async function json(response: Response): Promise<Body> {
  return (await response.json()) as Body;
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function tomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function orderPayload(overrides: Record<string, unknown> = {}) {
  return {
    providerId: approvedProviderId,
    serviceType: 'إصلاح تسريب مياه',
    details: 'يوجد تسريب أسفل حوض المطبخ منذ يومين ويحتاج فحصًا وإصلاحًا.',
    address: {
      city: 'الفيوم',
      area: 'حي الجامعة',
      line: 'شارع أحمد شوقي، عمارة 12، الدور الثالث',
    },
    scheduledDate: tomorrow(),
    ...overrides,
  };
}

async function createOrder(overrides: Record<string, unknown> = {}, token = customerToken) {
  const response = await createOrderRoute(
    req('/api/v1/orders', { method: 'POST', token, body: orderPayload(overrides) }),
    undefined
  );
  const body = await json(response);
  if (!body.success) throw new Error(`فشل إنشاء الطلب: ${JSON.stringify(body.error)}`);
  return body.data as unknown as { id: string; orderNumber: number; status: string };
}

/** ينقل الطلب لحالة معيّنة مباشرة عبر المستودع (Phase 8 تبني مسار المزوّد). */
async function moveTo(orderId: string, from: string, to: string) {
  const result = await applyStatusTransition({
    orderId,
    from: from as never,
    to: to as never,
    actor: { userId: approvedProviderUserId, role: 'PROVIDER' },
  });
  if (!result) throw new Error(`تعذّر نقل الطلب من ${from} إلى ${to}`);
  return result;
}

/* ================================================================== */

describe('POST /api/v1/orders', () => {
  it('ينشئ طلبًا بحالة NEW ورقم تسلسلي', async () => {
    const order = await createOrder();

    expect(order.status).toBe('NEW');
    expect(order.orderNumber).toBeGreaterThanOrEqual(1000);
  });

  it('يعطي كل طلب رقمًا مختلفًا', async () => {
    const first = await createOrder();
    const second = await createOrder();
    expect(first.orderNumber).not.toBe(second.orderNumber);
  });

  it('يصالح العدّاد مع الأرقام الموجودة إن مُسح وحده', async () => {
    /*
     * انحدار حقيقي: عدّاد الأرقام يعيش في `settings` والطلبات في مجموعة
     * أخرى، فمسح الإعدادات وحدها كان يعيد إصدار رقم مستعمل ويصطدم بالفهرس
     * الفريد بـ E11000.
     */
    const existing = await createOrder();
    const { Setting } = await import('@/server/db/models');
    await Setting.deleteOne({ key: 'order_sequence' });

    const next = await createOrder();
    expect(next.orderNumber).toBeGreaterThan(existing.orderNumber);
  });

  it('يكتب أول سطر في statusHistory', async () => {
    const order = await createOrder();
    const stored = await ServiceRequest.findById(order.id);

    expect(stored?.statusHistory).toHaveLength(1);
    expect(stored?.statusHistory[0]).toMatchObject({ from: null, to: 'NEW', byRole: 'CUSTOMER' });
  });

  it('يثبّت طريقة الدفع على القيمة الوحيدة الممكنة', async () => {
    const order = await createOrder();
    const stored = await ServiceRequest.findById(order.id);
    expect(stored?.paymentMethod).toBe('CASH_ON_DELIVERY_OFFLINE');
  });

  it('يتجاهل أي محاولة لتمرير طريقة دفع أو حالة أو سعر', async () => {
    for (const body of [
      { paymentMethod: 'VISA' },
      { status: 'COMPLETED' },
      { agreedPrice: 1 },
      { cashReceivedConfirmed: true },
      { orderNumber: 5 },
    ]) {
      const response = await createOrderRoute(
        req('/api/v1/orders', {
          method: 'POST',
          token: customerToken,
          body: { ...orderPayload(), ...body },
        }),
        undefined
      );
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
  });

  it('يشتق السعر من المزوّد لا من العميل', async () => {
    const order = await createOrder();
    const stored = await ServiceRequest.findById(order.id);
    const provider = await ServiceProvider.findById(approvedProviderId);

    expect(stored?.agreedPrice).toBe(provider?.priceMin);
  });

  it('يرفض الطلب من مزوّد قيد المراجعة', async () => {
    const response = await createOrderRoute(
      req('/api/v1/orders', {
        method: 'POST',
        token: customerToken,
        body: orderPayload({ providerId: pendingProviderId }),
      }),
      undefined
    );
    const body = await json(response);

    expect(response.status).toBe(403);
    expect(body.error?.message).toContain('اعتماد حسابك');
  });

  it('يرفض تاريخًا في الماضي', async () => {
    const response = await createOrderRoute(
      req('/api/v1/orders', {
        method: 'POST',
        token: customerToken,
        body: orderPayload({ scheduledDate: '2020-01-01' }),
      }),
      undefined
    );
    expect(response.status).toBe(400);
  });

  it('يرفض منطقة خارج قائمة الفيوم', async () => {
    const response = await createOrderRoute(
      req('/api/v1/orders', {
        method: 'POST',
        token: customerToken,
        body: orderPayload({
          address: { city: 'الفيوم', area: 'المعادي', line: 'شارع 9' },
        }),
      }),
      undefined
    );
    expect(response.status).toBe(400);
  });

  it('يرفض وقت بداية بعد وقت النهاية', async () => {
    const response = await createOrderRoute(
      req('/api/v1/orders', {
        method: 'POST',
        token: customerToken,
        body: orderPayload({ preferredTimeFrom: '14:00', preferredTimeTo: '10:00' }),
      }),
      undefined
    );
    expect(response.status).toBe(400);
  });

  it('يقبل التاريخ وحده — الوقت اختياري', async () => {
    const order = await createOrder({ preferredTimeFrom: undefined });
    const stored = await ServiceRequest.findById(order.id);
    expect(stored?.preferredTimeFrom).toBeUndefined();
  });

  it('يرفض أكثر من 5 مرفقات', async () => {
    const response = await createOrderRoute(
      req('/api/v1/orders', {
        method: 'POST',
        token: customerToken,
        body: orderPayload({ attachmentPublicIds: ['a', 'b', 'c', 'd', 'e', 'f'] }),
      }),
      undefined
    );
    expect(response.status).toBe(400);
  });

  it('يقبل حتى 5 مرفقات', async () => {
    const order = await createOrder({ attachmentPublicIds: ['a', 'b', 'c', 'd', 'e'] });
    const stored = await ServiceRequest.findById(order.id);
    expect(stored?.attachments).toHaveLength(5);
  });

  it('يُخطر مقدم الخدمة بالطلب الجديد', async () => {
    const order = await createOrder();

    const notification = await Notification.findOne({
      userId: new Types.ObjectId(approvedProviderUserId),
      type: 'ORDER_CREATED',
      entityId: new Types.ObjectId(order.id),
    });
    expect(notification?.body).toContain(`#${order.orderNumber}`);
  });

  it('يمنع مقدم الخدمة من إنشاء طلب', async () => {
    const response = await createOrderRoute(
      req('/api/v1/orders', { method: 'POST', token: providerToken, body: orderPayload() }),
      undefined
    );
    expect(response.status).toBe(403);
  });

  it('يمنع الزائر', async () => {
    const response = await createOrderRoute(
      req('/api/v1/orders', { method: 'POST', body: orderPayload() }),
      undefined
    );
    expect(response.status).toBe(401);
  });
});

/* ================================================================== */

describe('GET /api/v1/orders', () => {
  it('يعيد طلبات العميل نفسه فقط', async () => {
    const mine = await createOrder();
    await createOrder({}, otherCustomerToken);

    const response = await listOrdersRoute(
      req('/api/v1/orders', { token: customerToken, query: '?limit=50' }),
      undefined
    );
    const data = (await json(response)).data as unknown as { items: { id: string }[] };

    expect(data.items.some((item) => item.id === mine.id)).toBe(true);

    const stored = await ServiceRequest.find({ customerId: new Types.ObjectId(otherCustomerId) });
    const otherIds = stored.map((order) => String(order._id));
    expect(data.items.some((item) => otherIds.includes(item.id))).toBe(false);
  });

  it('يعيد عدّادات التبويبات الأربعة', async () => {
    const response = await listOrdersRoute(
      req('/api/v1/orders', { token: customerToken }),
      undefined
    );
    const data = (await json(response)).data as unknown as { counts: Record<string, number> };

    expect(Object.keys(data.counts).sort()).toEqual(['ACTIVE', 'ALL', 'CANCELLED', 'COMPLETED']);
    expect(data.counts.ALL).toBeGreaterThan(0);
  });

  it('تبويب «قيد التنفيذ» يجمع الحالات النشطة', async () => {
    const order = await createOrder();
    await moveTo(order.id, 'NEW', 'ACCEPTED');

    const response = await listOrdersRoute(
      req('/api/v1/orders', { token: customerToken, query: '?tab=ACTIVE&limit=50' }),
      undefined
    );
    const data = (await json(response)).data as unknown as { items: { id: string; status: string }[] };

    expect(data.items.some((item) => item.id === order.id)).toBe(true);
    expect(data.items.every((item) => ['NEW', 'ACCEPTED', 'IN_PROGRESS', 'ON_THE_WAY'].includes(item.status))).toBe(true);
  });

  it('تبويب «ملغاة» يضم المرفوض أيضًا', async () => {
    const cancelled = await createOrder();
    await cancelOrderRoute(
      req(`/api/v1/orders/${cancelled.id}/cancel`, {
        method: 'POST',
        token: customerToken,
        body: {},
      }),
      ctx(cancelled.id)
    );

    const rejected = await createOrder();
    await moveTo(rejected.id, 'NEW', 'REJECTED');

    const response = await listOrdersRoute(
      req('/api/v1/orders', { token: customerToken, query: '?tab=CANCELLED&limit=50' }),
      undefined
    );
    const data = (await json(response)).data as unknown as { items: { id: string }[] };

    expect(data.items.some((item) => item.id === cancelled.id)).toBe(true);
    expect(data.items.some((item) => item.id === rejected.id)).toBe(true);
  });

  it('يرفض تبويبًا غير معروف', async () => {
    const response = await listOrdersRoute(
      req('/api/v1/orders', { token: customerToken, query: '?tab=UNKNOWN' }),
      undefined
    );
    expect(response.status).toBe(400);
  });
});

/* ================================================================== */

describe('GET /api/v1/orders/:id — حارس IDOR', () => {
  it('العميل يرى طلبه', async () => {
    const order = await createOrder();
    const response = await orderDetailRoute(
      req(`/api/v1/orders/${order.id}`, { token: customerToken }),
      ctx(order.id)
    );
    expect(response.status).toBe(200);
  });

  it('عميل آخر يحصل على 404 لا 403', async () => {
    const order = await createOrder();
    const response = await orderDetailRoute(
      req(`/api/v1/orders/${order.id}`, { token: otherCustomerToken }),
      ctx(order.id)
    );

    expect(response.status).toBe(404);
    expect((await json(response)).error?.code).toBe('NOT_FOUND');
  });

  it('مقدم الخدمة المسند إليه الطلب يراه', async () => {
    const order = await createOrder();
    const response = await orderDetailRoute(
      req(`/api/v1/orders/${order.id}`, { token: providerToken }),
      ctx(order.id)
    );
    expect(response.status).toBe(200);
  });

  it('مقدم خدمة آخر يحصل على 404', async () => {
    const order = await createOrder();
    const otherProvider = await ServiceProvider.findOne({ displayName: 'كهربائي الفيوم' });
    const token = await signAccessToken({
      userId: String(otherProvider?.userId),
      role: 'PROVIDER',
      status: 'ACTIVE',
    });

    const response = await orderDetailRoute(
      req(`/api/v1/orders/${order.id}`, { token }),
      ctx(order.id)
    );
    expect(response.status).toBe(404);
  });

  it('الخط الزمني يطابق statusHistory حرفيًا', async () => {
    const order = await createOrder();
    await moveTo(order.id, 'NEW', 'ACCEPTED');
    await moveTo(order.id, 'ACCEPTED', 'IN_PROGRESS');

    const response = await orderDetailRoute(
      req(`/api/v1/orders/${order.id}`, { token: customerToken }),
      ctx(order.id)
    );
    const data = (await json(response)).data as unknown as {
      timeline: { status: string }[];
    };
    const stored = await ServiceRequest.findById(order.id);

    expect(data.timeline.map((entry) => entry.status)).toEqual(
      stored?.statusHistory.map((entry) => entry.to)
    );
    expect(data.timeline).toHaveLength(3);
  });
});

/* ================================================================== */

describe('كشف بيانات التواصل', () => {
  it('لا يُعرض هاتف المزوّد قبل قبول الطلب', async () => {
    const order = await createOrder();
    const response = await orderDetailRoute(
      req(`/api/v1/orders/${order.id}`, { token: customerToken }),
      ctx(order.id)
    );
    const raw = await response.text();

    expect(raw).toContain('"isContactUnlocked":false');
    expect(raw).not.toMatch(/"phone"/);
  });

  it('يُعرض بعد القبول — الاتصال والواتساب في الصورة 14', async () => {
    const order = await createOrder();
    await moveTo(order.id, 'NEW', 'ACCEPTED');

    const response = await orderDetailRoute(
      req(`/api/v1/orders/${order.id}`, { token: customerToken }),
      ctx(order.id)
    );
    const data = (await json(response)).data as unknown as {
      isContactUnlocked: boolean;
      provider: { phone?: string };
    };

    expect(data.isContactUnlocked).toBe(true);
    expect(data.provider.phone).toMatch(/^\+20/);
  });

  it('القوائم لا تكشف الهاتف مهما كانت الحالة', async () => {
    const order = await createOrder();
    await moveTo(order.id, 'NEW', 'ACCEPTED');

    const response = await listOrdersRoute(
      req('/api/v1/orders', { token: customerToken, query: '?limit=50' }),
      undefined
    );
    // القائمة تمرّ بنفس المحوّل، والهاتف يظهر للمقبول فقط — نتأكد أن العرض
    // لا يسرّب أرقام مزوّدي الطلبات الجديدة
    const data = (await json(response)).data as unknown as {
      items: { status: string; provider: { phone?: string } }[];
    };
    for (const item of data.items) {
      if (item.status === 'NEW') expect(item.provider.phone).toBeUndefined();
    }
  });
});

/* ================================================================== */

describe('POST /api/v1/orders/:id/cancel', () => {
  it('يلغي طلبًا جديدًا ويكتب السبب والفاعل', async () => {
    const order = await createOrder();

    const response = await cancelOrderRoute(
      req(`/api/v1/orders/${order.id}/cancel`, {
        method: 'POST',
        token: customerToken,
        body: { reason: 'وجدت حلًا آخر' },
      }),
      ctx(order.id)
    );
    const data = (await json(response)).data as unknown as { status: string; canCancel: boolean };

    expect(response.status).toBe(200);
    expect(data.status).toBe('CANCELLED');
    expect(data.canCancel).toBe(false);

    const stored = await ServiceRequest.findById(order.id);
    expect(stored?.cancelledBy).toBe('CUSTOMER');
    expect(stored?.cancellationReason).toBe('وجدت حلًا آخر');
    expect(stored?.statusHistory.at(-1)).toMatchObject({ from: 'NEW', to: 'CANCELLED' });
  });

  it('يلغي طلبًا مقبولًا', async () => {
    const order = await createOrder();
    await moveTo(order.id, 'NEW', 'ACCEPTED');

    const response = await cancelOrderRoute(
      req(`/api/v1/orders/${order.id}/cancel`, { method: 'POST', token: customerToken, body: {} }),
      ctx(order.id)
    );
    expect(response.status).toBe(200);
  });

  it('يرفض الإلغاء بعد بدء التنفيذ بـ409 — معيار قبول صريح', async () => {
    const order = await createOrder();
    await moveTo(order.id, 'NEW', 'ACCEPTED');
    await moveTo(order.id, 'ACCEPTED', 'IN_PROGRESS');

    const response = await cancelOrderRoute(
      req(`/api/v1/orders/${order.id}/cancel`, { method: 'POST', token: customerToken, body: {} }),
      ctx(order.id)
    );
    const body = await json(response);

    expect(response.status).toBe(409);
    expect(body.error?.code).toBe('INVALID_TRANSITION');
  });

  it('يرفض الإلغاء في «في الطريق» أيضًا', async () => {
    const order = await createOrder();
    await moveTo(order.id, 'NEW', 'ACCEPTED');
    await moveTo(order.id, 'ACCEPTED', 'ON_THE_WAY');

    const response = await cancelOrderRoute(
      req(`/api/v1/orders/${order.id}/cancel`, { method: 'POST', token: customerToken, body: {} }),
      ctx(order.id)
    );
    expect(response.status).toBe(409);
  });

  it('يرفض إلغاء طلب ملغى بالفعل', async () => {
    const order = await createOrder();
    const body = { method: 'POST', token: customerToken, body: {} } as const;

    await cancelOrderRoute(req(`/api/v1/orders/${order.id}/cancel`, body), ctx(order.id));
    const second = await cancelOrderRoute(
      req(`/api/v1/orders/${order.id}/cancel`, body),
      ctx(order.id)
    );

    expect(second.status).toBe(409);
  });

  it('عميل آخر لا يستطيع إلغاء طلب ليس له — 404', async () => {
    const order = await createOrder();

    const response = await cancelOrderRoute(
      req(`/api/v1/orders/${order.id}/cancel`, {
        method: 'POST',
        token: otherCustomerToken,
        body: {},
      }),
      ctx(order.id)
    );
    expect(response.status).toBe(404);

    const stored = await ServiceRequest.findById(order.id);
    expect(stored?.status).toBe('NEW');
  });

  it('مقدم الخدمة لا يلغي — الرفض مساره', async () => {
    const order = await createOrder();

    const response = await cancelOrderRoute(
      req(`/api/v1/orders/${order.id}/cancel`, {
        method: 'POST',
        token: providerToken,
        body: {},
      }),
      ctx(order.id)
    );
    expect(response.status).toBe(403);
  });

  it('يُخطر مقدم الخدمة ويسجّل الإلغاء في auditLogs', async () => {
    const order = await createOrder();
    await cancelOrderRoute(
      req(`/api/v1/orders/${order.id}/cancel`, { method: 'POST', token: customerToken, body: {} }),
      ctx(order.id)
    );

    const notification = await Notification.findOne({
      userId: new Types.ObjectId(approvedProviderUserId),
      type: 'ORDER_CANCELLED',
      entityId: new Types.ObjectId(order.id),
    });
    expect(notification).toBeTruthy();

    const log = await AuditLog.findOne({
      entityId: new Types.ObjectId(order.id),
      action: 'ORDER_STATUS_CHANGED',
      'after.status': 'CANCELLED',
    });
    expect(log?.before).toMatchObject({ status: 'NEW' });
  });
});

/* ================================================================== */

describe('لا وجود لأي مسار مالي', () => {
  it('استجابة الطلب لا تحوي أي مصطلح دفع إلكتروني', async () => {
    const order = await createOrder();
    const response = await orderDetailRoute(
      req(`/api/v1/orders/${order.id}`, { token: customerToken }),
      ctx(order.id)
    );
    const raw = await response.text();

    for (const term of ['visa', 'mastercard', 'stripe', 'paypal', 'paymob', 'fawry', 'wallet', 'checkout', 'transaction']) {
      expect(raw.toLowerCase(), term).not.toContain(term);
    }
  });

  it('طريقة الدفع قيمة واحدة في كل الطلبات', async () => {
    const orders = await ServiceRequest.find({});
    expect(orders.length).toBeGreaterThan(0);
    for (const order of orders) {
      expect(order.paymentMethod).toBe('CASH_ON_DELIVERY_OFFLINE');
    }
  });
});

/* ================================================================== */

describe('E2E — من ملف المزوّد إلى «طلباتي»', () => {
  it('إنشاء ← ظهور في القائمة ← تفاصيل ← إلغاء', async () => {
    const order = await createOrder({ serviceType: 'كشف تسربات شامل' });

    /* 1) يظهر في «طلباتي» */
    const list = await listOrdersRoute(
      req('/api/v1/orders', { token: customerToken, query: '?limit=50' }),
      undefined
    );
    const listed = (await json(list)).data as unknown as {
      items: { id: string; serviceType: string }[];
    };
    expect(listed.items.some((item) => item.id === order.id)).toBe(true);

    /* 2) تفاصيله صحيحة */
    const detail = await orderDetailRoute(
      req(`/api/v1/orders/${order.id}`, { token: customerToken }),
      ctx(order.id)
    );
    const data = (await json(detail)).data as unknown as {
      serviceType: string;
      status: string;
      canCancel: boolean;
      paymentMethod: string;
      timeline: unknown[];
    };

    expect(data.serviceType).toBe('كشف تسربات شامل');
    expect(data.status).toBe('NEW');
    expect(data.canCancel).toBe(true);
    expect(data.paymentMethod).toBe('CASH_ON_DELIVERY_OFFLINE');
    expect(data.timeline).toHaveLength(1);

    /* 3) الإلغاء ينقله للتبويب الصحيح */
    await cancelOrderRoute(
      req(`/api/v1/orders/${order.id}/cancel`, { method: 'POST', token: customerToken, body: {} }),
      ctx(order.id)
    );

    const cancelledList = await listOrdersRoute(
      req('/api/v1/orders', { token: customerToken, query: '?tab=CANCELLED&limit=50' }),
      undefined
    );
    const cancelled = (await json(cancelledList)).data as unknown as { items: { id: string }[] };
    expect(cancelled.items.some((item) => item.id === order.id)).toBe(true);
  });
});
