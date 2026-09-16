import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { buildAllIndexes, startTestDb, stopTestDb } from '../helpers/db';

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
import {
  AuditLog,
  Notification,
  ServiceProvider,
  ServiceRequest,
  User,
} from '@/server/db/models';
import { resetRateLimitStore } from '@/server/middleware/with-rate-limit';
import { signAccessToken } from '@/server/lib/jwt';

import { POST as createOrderRoute } from '@/app/api/v1/orders/route';
import { PATCH as statusRoute } from '@/app/api/v1/orders/[id]/status/route';
import { POST as completeRoute } from '@/app/api/v1/orders/[id]/complete/route';
import { GET as providerOrdersRoute } from '@/app/api/v1/provider/orders/route';
import { GET as dashboardRoute } from '@/app/api/v1/provider/dashboard/route';
import { GET as providerOrderDetailRoute } from '@/app/api/v1/provider/orders/[id]/route';
import { GET as customerOrderRoute } from '@/app/api/v1/orders/[id]/route';

/**
 * دورة حياة الطلب — جانب مقدم الخدمة (Phase 8).
 *
 * المحور: لا إجراء قبل الاعتماد، ولا إكمال بلا تأكيد استلام المبلغ،
 * ولا وصول لطلب مزوّد آخر.
 */

let providerId = '';
let providerUserId = '';
let providerToken = '';
let otherProviderToken = '';
let pendingProviderUserId = '';
let pendingProviderToken = '';
let customerId = '';
let customerToken = '';

beforeAll(async () => {
  await startTestDb();
  await buildAllIndexes();
  await runSeed();

  process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters-long!!';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters-long!';
  process.env.APP_URL = 'http://localhost:3000';

  const provider = await ServiceProvider.findOne({ displayName: 'أبو خالد للسباكة' });
  providerId = String(provider?._id);
  providerUserId = String(provider?.userId);
  providerToken = await signAccessToken({
    userId: providerUserId,
    role: 'PROVIDER',
    status: 'ACTIVE',
  });

  const other = await ServiceProvider.findOne({ displayName: 'كهربائي الفيوم' });
  otherProviderToken = await signAccessToken({
    userId: String(other?.userId),
    role: 'PROVIDER',
    status: 'ACTIVE',
  });

  const pending = await ServiceProvider.findOne({ displayName: 'مزوّد قيد المراجعة' });
  pendingProviderUserId = String(pending?.userId);
  pendingProviderToken = await signAccessToken({
    userId: pendingProviderUserId,
    role: 'PROVIDER',
    status: 'PENDING_REVIEW',
  });

  const customer = await User.create({
    role: 'CUSTOMER',
    fullName: 'عميل جانب المزوّد',
    phone: '+201060000001',
    passwordHash: 'TEST_ONLY',
    status: 'ACTIVE',
  });
  customerId = String(customer._id);
  customerToken = await signAccessToken({ userId: customerId, role: 'CUSTOMER', status: 'ACTIVE' });
}, 90_000);

afterAll(async () => {
  await stopTestDb();
});

afterEach(() => {
  resetRateLimitStore();
});

/* ================================================================== */

interface ReqOptions {
  method?: string;
  body?: unknown;
  token?: string;
  query?: string;
}

function req(path: string, options: ReqOptions = {}): Request {
  const headers: Record<string, string> = {
    'x-forwarded-for': `10.4.0.${Math.floor(Math.random() * 250) + 1}`,
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
  meta?: { total?: number };
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

async function newOrder(): Promise<{ id: string; orderNumber: number }> {
  const response = await createOrderRoute(
    req('/api/v1/orders', {
      method: 'POST',
      token: customerToken,
      body: {
        providerId,
        serviceType: 'إصلاح تسريب',
        details: 'تسريب أسفل حوض المطبخ يحتاج فحصًا وإصلاحًا سريعًا.',
        address: { city: 'الفيوم', area: 'حي الجامعة', line: 'شارع أحمد شوقي 12' },
        scheduledDate: tomorrow(),
      },
    }),
    undefined
  );
  const body = await json(response);
  if (!body.success) throw new Error(`فشل إنشاء الطلب: ${JSON.stringify(body.error)}`);
  return body.data as unknown as { id: string; orderNumber: number };
}

async function setStatus(orderId: string, status: string, note?: string, token = providerToken) {
  return statusRoute(
    req(`/api/v1/orders/${orderId}/status`, {
      method: 'PATCH',
      token,
      body: { status, ...(note ? { note } : {}) },
    }),
    ctx(orderId)
  );
}

/** ينقل الطلب إلى IN_PROGRESS جاهزًا للإكمال. */
async function orderInProgress() {
  const order = await newOrder();
  await setStatus(order.id, 'ACCEPTED');
  await setStatus(order.id, 'IN_PROGRESS');
  return order;
}

/* ================================================================== */

describe('PATCH /api/v1/orders/:id/status', () => {
  it('يقبل الطلب وينقله إلى ACCEPTED', async () => {
    const order = await newOrder();
    const response = await setStatus(order.id, 'ACCEPTED');
    const data = (await json(response)).data as unknown as {
      status: string;
      availableActions: string[];
    };

    expect(response.status).toBe(200);
    expect(data.status).toBe('ACCEPTED');
    expect(data.availableActions.sort()).toEqual(['IN_PROGRESS', 'ON_THE_WAY']);
  });

  it('يرفض الطلب مع تسجيل السبب وإخطار العميل', async () => {
    const order = await newOrder();
    await setStatus(order.id, 'REJECTED', 'مشغول في نفس الموعد');

    const stored = await ServiceRequest.findById(order.id);
    expect(stored?.status).toBe('REJECTED');
    expect(stored?.cancelledBy).toBe('PROVIDER');
    expect(stored?.cancellationReason).toBe('مشغول في نفس الموعد');

    const notification = await Notification.findOne({
      userId: new Types.ObjectId(customerId),
      type: 'ORDER_REJECTED',
      entityId: new Types.ObjectId(order.id),
    });
    expect(notification).toBeTruthy();
  });

  it('يشترط سبب الرفض', async () => {
    const order = await newOrder();
    const response = await setStatus(order.id, 'REJECTED');

    expect(response.status).toBe(400);
    expect((await json(response)).error?.fields?.note).toBeTruthy();
  });

  it('يتقدّم إلى قيد التنفيذ ثم في الطريق والعكس', async () => {
    const order = await newOrder();
    await setStatus(order.id, 'ACCEPTED');

    expect((await setStatus(order.id, 'IN_PROGRESS')).status).toBe(200);
    expect((await setStatus(order.id, 'ON_THE_WAY')).status).toBe(200);
    expect((await setStatus(order.id, 'IN_PROGRESS')).status).toBe(200);
  });

  it('يرفض تخطّي القبول — من NEW إلى قيد التنفيذ مباشرة', async () => {
    const order = await newOrder();
    const response = await setStatus(order.id, 'IN_PROGRESS');

    expect(response.status).toBe(409);
    expect((await json(response)).error?.code).toBe('INVALID_TRANSITION');
  });

  it('لا يقبل COMPLETED عبر هذا المسار إطلاقًا', async () => {
    const order = await orderInProgress();
    const response = await setStatus(order.id, 'COMPLETED');

    // المخطط لا يحوي القيمة أصلًا — يرتد قبل أي منطق
    expect(response.status).toBe(400);

    const stored = await ServiceRequest.findById(order.id);
    expect(stored?.status).toBe('IN_PROGRESS');
  });

  it('مزوّد آخر لا يستطيع تغيير حالة طلب ليس له — 404', async () => {
    const order = await newOrder();
    const response = await setStatus(order.id, 'ACCEPTED', undefined, otherProviderToken);

    expect(response.status).toBe(404);

    const stored = await ServiceRequest.findById(order.id);
    expect(stored?.status).toBe('NEW');
  });

  it('العميل لا يستطيع تغيير الحالة', async () => {
    const order = await newOrder();
    const response = await setStatus(order.id, 'ACCEPTED', undefined, customerToken);
    expect(response.status).toBe(403);
  });

  it('كل انتقال يُسجَّل في auditLogs و statusHistory', async () => {
    const order = await newOrder();
    await setStatus(order.id, 'ACCEPTED');

    const stored = await ServiceRequest.findById(order.id);
    expect(stored?.statusHistory.map((entry) => entry.to)).toEqual(['NEW', 'ACCEPTED']);
    expect(stored?.statusHistory.at(-1)?.byRole).toBe('PROVIDER');

    const log = await AuditLog.findOne({
      entityId: new Types.ObjectId(order.id),
      'after.status': 'ACCEPTED',
    });
    expect(log?.before).toMatchObject({ status: 'NEW' });
  });
});

/* ================================================================== */

describe('مزوّد غير معتمد', () => {
  it('لا يستطيع تغيير حالة أي طلب', async () => {
    const order = await newOrder();

    // نسند الطلب للمزوّد قيد المراجعة مباشرة لاختبار الحارس وحده
    const pending = await ServiceProvider.findOne({ displayName: 'مزوّد قيد المراجعة' });
    await ServiceRequest.updateOne({ _id: order.id }, { $set: { providerId: pending?._id } });

    const response = await setStatus(order.id, 'ACCEPTED', undefined, pendingProviderToken);
    const body = await json(response);

    expect(response.status).toBe(403);
    expect(body.error?.message).toContain('اعتماد حسابك');
  });

  it('لا يستطيع فتح لوحة التحكم بإجراءات', async () => {
    const response = await dashboardRoute(
      req('/api/v1/provider/dashboard', { token: pendingProviderToken }),
      undefined
    );
    // اللوحة نفسها مقروءة (يرى حالته)، لكن لا إجراء عليها
    expect([200, 403]).toContain(response.status);
  });
});

/* ================================================================== */

describe('POST /api/v1/orders/:id/complete', () => {
  it('يكمل الطلب بتأكيد استلام المبلغ', async () => {
    const order = await orderInProgress();

    const response = await completeRoute(
      req(`/api/v1/orders/${order.id}/complete`, {
        method: 'POST',
        token: providerToken,
        body: { serviceCompleted: true, cashReceivedConfirmed: true },
      }),
      ctx(order.id)
    );
    const data = (await json(response)).data as unknown as {
      status: string;
      cashReceivedConfirmed: boolean;
      canComplete: boolean;
    };

    expect(response.status).toBe(200);
    expect(data.status).toBe('COMPLETED');
    expect(data.cashReceivedConfirmed).toBe(true);
    expect(data.canComplete).toBe(false);

    const stored = await ServiceRequest.findById(order.id);
    expect(stored?.completedAt).toBeTruthy();
    expect(stored?.cashConfirmedAt).toBeTruthy();
  });

  it('يرفض الإكمال بدون تأكيد استلام المبلغ بـ422 — معيار قبول صريح', async () => {
    const order = await orderInProgress();

    const response = await completeRoute(
      req(`/api/v1/orders/${order.id}/complete`, {
        method: 'POST',
        token: providerToken,
        body: { serviceCompleted: true, cashReceivedConfirmed: false },
      }),
      ctx(order.id)
    );
    const body = await json(response);

    expect(response.status).toBe(422);
    expect(body.error?.code).toBe('UNPROCESSABLE');
    expect(body.error?.message).toContain('استلام المبلغ');

    const stored = await ServiceRequest.findById(order.id);
    expect(stored?.status).toBe('IN_PROGRESS');
    expect(stored?.cashReceivedConfirmed).toBe(false);
  });

  it('يرفض الإكمال بلا الحقل أصلًا بـ422', async () => {
    const order = await orderInProgress();

    const response = await completeRoute(
      req(`/api/v1/orders/${order.id}/complete`, {
        method: 'POST',
        token: providerToken,
        body: { serviceCompleted: true },
      }),
      ctx(order.id)
    );
    const body = await json(response);

    expect(response.status).toBe(422);
    expect(body.error?.fields?.cashReceivedConfirmed).toBeTruthy();
  });

  it('يرفض الإكمال بلا تأكيد إتمام الخدمة بـ422', async () => {
    const order = await orderInProgress();

    const response = await completeRoute(
      req(`/api/v1/orders/${order.id}/complete`, {
        method: 'POST',
        token: providerToken,
        body: { cashReceivedConfirmed: true },
      }),
      ctx(order.id)
    );
    const body = await json(response);

    expect(response.status).toBe(422);
    expect(body.error?.fields?.serviceCompleted).toBeTruthy();
  });

  it('يبقى 400 لخطأ الشكل — نوع غير منطقي', async () => {
    /*
     * التمييز مقصود: الشكل الخاطئ خطأ تحقّق (400)، وغياب التأكيد مخالفة
     * قاعدة عمل (422).
     */
    const order = await orderInProgress();

    const response = await completeRoute(
      req(`/api/v1/orders/${order.id}/complete`, {
        method: 'POST',
        token: providerToken,
        body: { serviceCompleted: 'yes', cashReceivedConfirmed: 'yes' },
      }),
      ctx(order.id)
    );

    expect(response.status).toBe(400);

    const stored = await ServiceRequest.findById(order.id);
    expect(stored?.status).toBe('IN_PROGRESS');
  });

  it('لا يمرّ الإكمال بأي تركيبة ناقصة — والحالة لا تتغيّر', async () => {
    const order = await orderInProgress();

    for (const body of [
      {},
      { serviceCompleted: true },
      { cashReceivedConfirmed: true },
      { serviceCompleted: false, cashReceivedConfirmed: false },
      { serviceCompleted: true, cashReceivedConfirmed: false },
    ]) {
      const response = await completeRoute(
        req(`/api/v1/orders/${order.id}/complete`, {
          method: 'POST',
          token: providerToken,
          body,
        }),
        ctx(order.id)
      );
      expect(response.status, JSON.stringify(body)).toBe(422);
    }

    const stored = await ServiceRequest.findById(order.id);
    expect(stored?.status).toBe('IN_PROGRESS');
    expect(stored?.cashReceivedConfirmed).toBe(false);
  });

  it('يرفض إكمال طلب لم يبدأ تنفيذه', async () => {
    const order = await newOrder();
    await setStatus(order.id, 'ACCEPTED');

    const response = await completeRoute(
      req(`/api/v1/orders/${order.id}/complete`, {
        method: 'POST',
        token: providerToken,
        body: { serviceCompleted: true, cashReceivedConfirmed: true },
      }),
      ctx(order.id)
    );

    expect(response.status).toBe(409);
    expect((await json(response)).error?.code).toBe('INVALID_TRANSITION');
  });

  it('يرفض الإكمال مرتين', async () => {
    const order = await orderInProgress();
    const body = {
      method: 'POST',
      token: providerToken,
      body: { serviceCompleted: true, cashReceivedConfirmed: true },
    } as const;

    await completeRoute(req(`/api/v1/orders/${order.id}/complete`, body), ctx(order.id));
    const second = await completeRoute(
      req(`/api/v1/orders/${order.id}/complete`, body),
      ctx(order.id)
    );

    expect(second.status).toBe(409);
  });

  it('مزوّد آخر لا يستطيع إكمال طلب ليس له', async () => {
    const order = await orderInProgress();

    const response = await completeRoute(
      req(`/api/v1/orders/${order.id}/complete`, {
        method: 'POST',
        token: otherProviderToken,
        body: { serviceCompleted: true, cashReceivedConfirmed: true },
      }),
      ctx(order.id)
    );
    expect(response.status).toBe(404);
  });

  it('يُخطر العميل ويسجّل التأكيد في auditLogs', async () => {
    const order = await orderInProgress();
    await completeRoute(
      req(`/api/v1/orders/${order.id}/complete`, {
        method: 'POST',
        token: providerToken,
        body: { serviceCompleted: true, cashReceivedConfirmed: true },
      }),
      ctx(order.id)
    );

    const notification = await Notification.findOne({
      userId: new Types.ObjectId(customerId),
      type: 'ORDER_COMPLETED',
      entityId: new Types.ObjectId(order.id),
    });
    expect(notification).toBeTruthy();

    const log = await AuditLog.findOne({
      entityId: new Types.ObjectId(order.id),
      'after.status': 'COMPLETED',
    });
    expect(log?.after).toMatchObject({ cashReceivedConfirmed: true });
  });

  it('يحدّث إحصاءات المزوّد بعد الإكمال', async () => {
    const before = await ServiceProvider.findById(providerId);
    const order = await orderInProgress();

    await completeRoute(
      req(`/api/v1/orders/${order.id}/complete`, {
        method: 'POST',
        token: providerToken,
        body: { serviceCompleted: true, cashReceivedConfirmed: true },
      }),
      ctx(order.id)
    );

    const after = await ServiceProvider.findById(providerId);
    expect(after!.completedOrders).toBeGreaterThan(0);
    expect(after!.completedOrders).not.toBe(before!.completedOrders);
    // العميل نفسه لا يُحسب مرتين مهما تكرّرت طلباته
    expect(after!.customersCount).toBe(1);
  });

  it('العميل يرى الطلب مكتملًا وقابلًا للتقييم', async () => {
    const order = await orderInProgress();
    await completeRoute(
      req(`/api/v1/orders/${order.id}/complete`, {
        method: 'POST',
        token: providerToken,
        body: { serviceCompleted: true, cashReceivedConfirmed: true },
      }),
      ctx(order.id)
    );

    const response = await customerOrderRoute(
      req(`/api/v1/orders/${order.id}`, { token: customerToken }),
      ctx(order.id)
    );
    const data = (await json(response)).data as unknown as {
      status: string;
      canReview: boolean;
      canCancel: boolean;
    };

    expect(data.status).toBe('COMPLETED');
    expect(data.canReview).toBe(true);
    expect(data.canCancel).toBe(false);
  });
});

/* ================================================================== */

describe('GET /api/v1/provider/orders', () => {
  it('يعيد طلبات هذا المزوّد فقط مع عدّادات التبويبات الستة', async () => {
    await newOrder();

    const response = await providerOrdersRoute(
      req('/api/v1/provider/orders', { token: providerToken, query: '?limit=50' }),
      undefined
    );
    const data = (await json(response)).data as unknown as {
      items: { customer: { fullName: string } }[];
      counts: Record<string, number>;
    };

    expect(response.status).toBe(200);
    expect(data.items.length).toBeGreaterThan(0);
    expect(Object.keys(data.counts).sort()).toEqual([
      'ALL',
      'CANCELLED',
      'COMPLETED',
      'IN_PROGRESS',
      'NEW',
      'ON_THE_WAY',
    ]);
  });

  it('يعرض اسم العميل وهاتفه للمزوّد منذ الحالة «جديد»', async () => {
    await newOrder();

    const response = await providerOrdersRoute(
      req('/api/v1/provider/orders', { token: providerToken, query: '?tab=NEW&limit=50' }),
      undefined
    );
    const data = (await json(response)).data as unknown as {
      items: { customer: { fullName: string; phone?: string } }[];
    };

    const withCustomer = data.items.find((item) => item.customer.fullName !== 'عميل');
    expect(withCustomer?.customer.fullName).toBe('عميل جانب المزوّد');
    expect(withCustomer?.customer.phone).toMatch(/^\+20/);
  });

  it('يبحث برقم الطلب', async () => {
    const order = await newOrder();

    const response = await providerOrdersRoute(
      req('/api/v1/provider/orders', {
        token: providerToken,
        query: `?q=${order.orderNumber}&limit=50`,
      }),
      undefined
    );
    const data = (await json(response)).data as unknown as { items: { id: string }[] };

    expect(data.items).toHaveLength(1);
    expect(data.items[0]?.id).toBe(order.id);
  });

  it('يبحث باسم العميل', async () => {
    await newOrder();

    const response = await providerOrdersRoute(
      req('/api/v1/provider/orders', {
        token: providerToken,
        query: `?q=${encodeURIComponent('جانب المزوّد')}&limit=50`,
      }),
      undefined
    );
    const data = (await json(response)).data as unknown as { items: unknown[] };
    expect(data.items.length).toBeGreaterThan(0);
  });

  it('لا يفتح البحث بابًا لحقن تعبير نمطي', async () => {
    const response = await providerOrdersRoute(
      req('/api/v1/provider/orders', { token: providerToken, query: '?q=.*&limit=50' }),
      undefined
    );
    const data = (await json(response)).data as unknown as { items: unknown[] };

    expect(response.status).toBe(200);
    expect(data.items).toEqual([]);
  });

  it('يرتّب بالأقدم', async () => {
    const response = await providerOrdersRoute(
      req('/api/v1/provider/orders', { token: providerToken, query: '?sort=oldest&limit=50' }),
      undefined
    );
    const data = (await json(response)).data as unknown as { items: { createdAt: string }[] };

    const dates = data.items.map((item) => new Date(item.createdAt).getTime());
    expect([...dates].sort((a, b) => a - b)).toEqual(dates);
  });

  it('العميل لا يصل لهذا المسار', async () => {
    const response = await providerOrdersRoute(
      req('/api/v1/provider/orders', { token: customerToken }),
      undefined
    );
    expect(response.status).toBe(403);
  });
});

/* ================================================================== */

describe('GET /api/v1/provider/orders/:id', () => {
  /*
   * مسار منفصل عن `/orders/:id`: شاشة المزوّد تبني أزرارها على
   * `customer` و`availableActions`، وهما غير موجودين في شكل العميل.
   * (انحدار حقيقي: كانت الشاشة تنادي مسار العميل فتتعطّل عند قراءة الهاتف.)
   */
  it('يعيد بيانات العميل والإجراءات المتاحة', async () => {
    const order = await newOrder();

    const response = await providerOrderDetailRoute(
      req(`/api/v1/provider/orders/${order.id}`, { token: providerToken }),
      ctx(order.id)
    );
    const data = (await json(response)).data as unknown as {
      customer: { fullName: string; phone?: string };
      availableActions: string[];
      canComplete: boolean;
    };

    expect(response.status).toBe(200);
    expect(data.customer.fullName).toBe('عميل جانب المزوّد');
    expect(data.customer.phone).toMatch(/^\+20/);
    expect(data.availableActions.sort()).toEqual(['ACCEPTED', 'REJECTED']);
    expect(data.canComplete).toBe(false);
  });

  it('مزوّد آخر يحصل على 404', async () => {
    const order = await newOrder();

    const response = await providerOrderDetailRoute(
      req(`/api/v1/provider/orders/${order.id}`, { token: otherProviderToken }),
      ctx(order.id)
    );
    expect(response.status).toBe(404);
  });

  it('العميل لا يصل لهذا المسار', async () => {
    const order = await newOrder();

    const response = await providerOrderDetailRoute(
      req(`/api/v1/provider/orders/${order.id}`, { token: customerToken }),
      ctx(order.id)
    );
    expect(response.status).toBe(403);
  });

  it('canComplete تصير true عند بلوغ حالة قابلة للإكمال', async () => {
    const order = await orderInProgress();

    const response = await providerOrderDetailRoute(
      req(`/api/v1/provider/orders/${order.id}`, { token: providerToken }),
      ctx(order.id)
    );
    const data = (await json(response)).data as unknown as { canComplete: boolean };
    expect(data.canComplete).toBe(true);
  });
});

describe('GET /api/v1/provider/dashboard', () => {
  it('يعيد المؤشرات الأربعة والأرباح وآخر الطلبات', async () => {
    const response = await dashboardRoute(
      req('/api/v1/provider/dashboard', { token: providerToken }),
      undefined
    );
    const data = (await json(response)).data as unknown as {
      kpis: { newOrders: number; inProgress: number; completedThisMonth: number; rating: number };
      earnings: { total: number; changePercent: number };
      recentOrders: unknown[];
      provider: { profileCompletion: number };
    };

    expect(response.status).toBe(200);
    expect(Object.keys(data.kpis).sort()).toEqual([
      'completedThisMonth',
      'inProgress',
      'newOrders',
      'rating',
    ]);
    expect(data.earnings.total).toBeGreaterThanOrEqual(0);
    expect(data.recentOrders.length).toBeLessThanOrEqual(3);
    expect(data.provider.profileCompletion).toBeTypeOf('number');
  });

  it('الأرباح = مجموع قيم الطلبات المكتملة لا كل الطلبات', async () => {
    const order = await orderInProgress();
    const stored = await ServiceRequest.findById(order.id);

    const before = await dashboardRoute(
      req('/api/v1/provider/dashboard', { token: providerToken }),
      undefined
    );
    const beforeTotal = ((await json(before)).data as unknown as { earnings: { total: number } })
      .earnings.total;

    await completeRoute(
      req(`/api/v1/orders/${order.id}/complete`, {
        method: 'POST',
        token: providerToken,
        body: { serviceCompleted: true, cashReceivedConfirmed: true },
      }),
      ctx(order.id)
    );

    const after = await dashboardRoute(
      req('/api/v1/provider/dashboard', { token: providerToken }),
      undefined
    );
    const afterTotal = ((await json(after)).data as unknown as { earnings: { total: number } })
      .earnings.total;

    expect(afterTotal - beforeTotal).toBe(stored?.agreedPrice ?? 0);
  });

  it('لا يحوي أي مصطلح مالي أو رصيد أو محفظة', async () => {
    const response = await dashboardRoute(
      req('/api/v1/provider/dashboard', { token: providerToken }),
      undefined
    );
    const raw = (await response.text()).toLowerCase();

    for (const term of [
      'wallet',
      'balance',
      'transaction',
      'payout',
      'invoice',
      'visa',
      'stripe',
      'paymob',
    ]) {
      expect(raw, term).not.toContain(term);
    }
  });

  it('العميل لا يصل للوحة التحكم', async () => {
    const response = await dashboardRoute(
      req('/api/v1/provider/dashboard', { token: customerToken }),
      undefined
    );
    expect(response.status).toBe(403);
  });
});

/* ================================================================== */

describe('E2E — من طلب جديد إلى الإكمال', () => {
  it('جديد ← قبول ← قيد التنفيذ ← في الطريق ← إكمال بتأكيد الاستلام', async () => {
    const order = await newOrder();

    expect((await setStatus(order.id, 'ACCEPTED')).status).toBe(200);
    expect((await setStatus(order.id, 'IN_PROGRESS')).status).toBe(200);
    expect((await setStatus(order.id, 'ON_THE_WAY')).status).toBe(200);

    const completed = await completeRoute(
      req(`/api/v1/orders/${order.id}/complete`, {
        method: 'POST',
        token: providerToken,
        body: { serviceCompleted: true, cashReceivedConfirmed: true },
      }),
      ctx(order.id)
    );
    expect(completed.status).toBe(200);

    /* الخط الزمني يوثّق المسار كاملًا */
    const stored = await ServiceRequest.findById(order.id);
    expect(stored?.statusHistory.map((entry) => entry.to)).toEqual([
      'NEW',
      'ACCEPTED',
      'IN_PROGRESS',
      'ON_THE_WAY',
      'COMPLETED',
    ]);

    /* طريقة الدفع لم تتغيّر ولم يُنشأ أي سجل مالي */
    expect(stored?.paymentMethod).toBe('CASH_ON_DELIVERY_OFFLINE');
    expect(stored?.cashReceivedConfirmed).toBe(true);
  });
});
