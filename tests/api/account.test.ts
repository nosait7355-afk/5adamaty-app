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
import { Notification, Review, ServiceProvider, ServiceRequest, User } from '@/server/db/models';
import { resetRateLimitStore } from '@/server/middleware/with-rate-limit';
import { signAccessToken } from '@/server/lib/jwt';

import { POST as createOrderRoute } from '@/app/api/v1/orders/route';
import { PATCH as statusRoute } from '@/app/api/v1/orders/[id]/status/route';
import { POST as completeRoute } from '@/app/api/v1/orders/[id]/complete/route';
import { POST as reviewRoute } from '@/app/api/v1/orders/[id]/review/route';
import { GET as notificationsRoute } from '@/app/api/v1/notifications/route';
import { PATCH as readNotificationRoute } from '@/app/api/v1/notifications/[id]/read/route';
import { POST as readAllRoute } from '@/app/api/v1/notifications/read-all/route';
import { GET as unreadCountRoute } from '@/app/api/v1/notifications/unread-count/route';
import { GET as addressesRoute, POST as createAddressRoute } from '@/app/api/v1/me/addresses/route';
import {
  DELETE as deleteAddressRoute,
  PATCH as updateAddressRoute,
} from '@/app/api/v1/me/addresses/[id]/route';
import { PATCH as defaultAddressRoute } from '@/app/api/v1/me/addresses/[id]/default/route';
import { GET as favoritesRoute, POST as toggleFavoriteRoute } from '@/app/api/v1/me/favorites/route';
import { PATCH as profileRoute } from '@/app/api/v1/me/profile/route';
import { GET as accountRoute } from '@/app/api/v1/me/account/route';
import { GET as faqsRoute } from '@/app/api/v1/faqs/route';
import { POST as contactRoute } from '@/app/api/v1/support/contact/route';
import { GET as providerReviewsRoute } from '@/app/api/v1/providers/[id]/reviews/route';
import { POST as openThreadRoute } from '@/app/api/v1/orders/[id]/thread/route';
import { GET as threadsRoute } from '@/app/api/v1/threads/route';
import {
  GET as messagesRoute,
  POST as sendMessageRoute,
} from '@/app/api/v1/threads/[id]/messages/route';

/**
 * الأنظمة المساندة (Phase 9): الإشعارات والتقييمات والمراسلة والحساب.
 *
 * المحور الأمني: **لا يقرأ أحد بيانات غيره** — إشعارات، عناوين، رسائل،
 * تقييمات. وكل محاولة تعيد 404 لا 403.
 */

let providerId = '';
let providerUserId = '';
let providerToken = '';
let customerId = '';
let customerToken = '';
let otherCustomerId = '';
let otherCustomerToken = '';

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

  const customer = await User.create({
    role: 'CUSTOMER',
    fullName: 'عميل الأنظمة المساندة',
    phone: '+201070000001',
    passwordHash: 'TEST_ONLY',
    status: 'ACTIVE',
  });
  customerId = String(customer._id);
  customerToken = await signAccessToken({ userId: customerId, role: 'CUSTOMER', status: 'ACTIVE' });

  const other = await User.create({
    role: 'CUSTOMER',
    fullName: 'عميل فضولي',
    phone: '+201070000002',
    passwordHash: 'TEST_ONLY',
    status: 'ACTIVE',
  });
  otherCustomerId = String(other._id);
  otherCustomerToken = await signAccessToken({
    userId: otherCustomerId,
    role: 'CUSTOMER',
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

interface ReqOptions {
  method?: string;
  body?: unknown;
  token?: string;
  query?: string;
}

function req(path: string, options: ReqOptions = {}): Request {
  const headers: Record<string, string> = {
    'x-forwarded-for': `10.5.0.${Math.floor(Math.random() * 250) + 1}`,
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

async function newOrder(token = customerToken) {
  const response = await createOrderRoute(
    req('/api/v1/orders', {
      method: 'POST',
      token,
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

async function setStatus(orderId: string, status: string) {
  return statusRoute(
    req(`/api/v1/orders/${orderId}/status`, {
      method: 'PATCH',
      token: providerToken,
      body: { status },
    }),
    ctx(orderId)
  );
}

/** طلب مكتمل جاهز للتقييم. */
async function completedOrder() {
  const order = await newOrder();
  await setStatus(order.id, 'ACCEPTED');
  await setStatus(order.id, 'IN_PROGRESS');
  await completeRoute(
    req(`/api/v1/orders/${order.id}/complete`, {
      method: 'POST',
      token: providerToken,
      body: { serviceCompleted: true, cashReceivedConfirmed: true },
    }),
    ctx(order.id)
  );
  return order;
}

const VALID_ADDRESS = {
  label: 'المنزل',
  type: 'HOME',
  city: 'الفيوم',
  area: 'حي الجامعة',
  line: 'شارع أحمد شوقي، عمارة 12، الدور الثالث',
  contactName: 'سارة محمود',
  contactPhone: '01033334444',
};

/* ================================================================== */
/* الإشعارات                                                           */
/* ================================================================== */

describe('GET /api/v1/notifications', () => {
  it('يعيد إشعارات المستخدم نفسه فقط', async () => {
    await newOrder();

    const response = await notificationsRoute(
      req('/api/v1/notifications', { token: providerToken, query: '?limit=50' }),
      undefined
    );
    const data = (await json(response)).data as unknown as {
      items: { type: string }[];
      counts: Record<string, number>;
      unreadTotal: number;
    };

    expect(response.status).toBe(200);
    expect(data.items.some((item) => item.type === 'ORDER_CREATED')).toBe(true);
    expect(data.unreadTotal).toBeGreaterThan(0);

    // العميل لا يرى إشعار المزوّد
    const mine = await notificationsRoute(
      req('/api/v1/notifications', { token: customerToken, query: '?limit=50' }),
      undefined
    );
    const mineData = (await json(mine)).data as unknown as { items: { type: string }[] };
    expect(mineData.items.some((item) => item.type === 'ORDER_CREATED')).toBe(false);
  });

  it('يفلتر بالتبويب', async () => {
    const response = await notificationsRoute(
      req('/api/v1/notifications', { token: providerToken, query: '?tab=ORDERS&limit=50' }),
      undefined
    );
    const data = (await json(response)).data as unknown as { items: { tab: string }[] };

    expect(data.items.every((item) => item.tab === 'ORDERS')).toBe(true);
  });

  it('يفلتر غير المقروء فقط', async () => {
    const response = await notificationsRoute(
      req('/api/v1/notifications', { token: providerToken, query: '?unreadOnly=true&limit=50' }),
      undefined
    );
    const data = (await json(response)).data as unknown as { items: { isRead: boolean }[] };

    expect(data.items.every((item) => item.isRead === false)).toBe(true);
  });

  it('يرفض تبويبًا غير معروف', async () => {
    const response = await notificationsRoute(
      req('/api/v1/notifications', { token: providerToken, query: '?tab=UNKNOWN' }),
      undefined
    );
    expect(response.status).toBe(400);
  });

  it('يمنع الزائر', async () => {
    expect((await notificationsRoute(req('/api/v1/notifications'), undefined)).status).toBe(401);
  });
});

describe('تعليم الإشعارات مقروءة', () => {
  it('يعلّم إشعارًا واحدًا', async () => {
    await newOrder();
    const notification = await Notification.findOne({
      userId: new Types.ObjectId(providerUserId),
      isRead: false,
    });
    const id = String(notification?._id);

    const response = await readNotificationRoute(
      req(`/api/v1/notifications/${id}/read`, { method: 'PATCH', token: providerToken }),
      ctx(id)
    );
    const data = (await json(response)).data as unknown as { isRead: boolean };

    expect(response.status).toBe(200);
    expect(data.isRead).toBe(true);
  });

  it('إشعار مستخدم آخر يعيد 404 ولا يتغيّر', async () => {
    await newOrder();
    const notification = await Notification.findOne({
      userId: new Types.ObjectId(providerUserId),
      isRead: false,
    });
    const id = String(notification?._id);

    const response = await readNotificationRoute(
      req(`/api/v1/notifications/${id}/read`, { method: 'PATCH', token: customerToken }),
      ctx(id)
    );

    expect(response.status).toBe(404);

    const stored = await Notification.findById(id);
    expect(stored?.isRead).toBe(false);
  });

  it('«تعليم الكل كمقروء» يصفّر العدّاد', async () => {
    await newOrder();

    await readAllRoute(
      req('/api/v1/notifications/read-all', { method: 'POST', token: providerToken }),
      undefined
    );

    const response = await unreadCountRoute(
      req('/api/v1/notifications/unread-count', { token: providerToken }),
      undefined
    );
    const data = (await json(response)).data as unknown as { notifications: number };

    expect(data.notifications).toBe(0);
  });
});

/* ================================================================== */
/* التقييمات                                                           */
/* ================================================================== */

describe('POST /api/v1/orders/:id/review', () => {
  it('يقبل تقييم طلب مكتمل ويحدّث متوسط المزوّد', async () => {
    const before = await ServiceProvider.findById(providerId);
    const order = await completedOrder();

    const response = await reviewRoute(
      req(`/api/v1/orders/${order.id}/review`, {
        method: 'POST',
        token: customerToken,
        body: { rating: 5, comment: 'خدمة ممتازة وسرعة في التنفيذ.' },
      }),
      ctx(order.id)
    );
    const data = (await json(response)).data as unknown as {
      rating: number;
      provider: { ratingAvg: number; ratingCount: number };
    };

    expect(response.status).toBe(201);
    expect(data.rating).toBe(5);
    expect(data.provider.ratingCount).toBeGreaterThan(0);

    const after = await ServiceProvider.findById(providerId);
    expect(after?.ratingCount).not.toBe(before?.ratingCount);
  });

  it('المتوسط محسوب من التقييمات الظاهرة فعلًا', async () => {
    const first = await completedOrder();
    const second = await completedOrder();

    await reviewRoute(
      req(`/api/v1/orders/${first.id}/review`, {
        method: 'POST',
        token: customerToken,
        body: { rating: 5 },
      }),
      ctx(first.id)
    );
    await reviewRoute(
      req(`/api/v1/orders/${second.id}/review`, {
        method: 'POST',
        token: customerToken,
        body: { rating: 3 },
      }),
      ctx(second.id)
    );

    const visible = await Review.find({
      providerId: new Types.ObjectId(providerId),
      isVisible: true,
    });
    const expected =
      Math.round((visible.reduce((sum, item) => sum + item.rating, 0) / visible.length) * 10) / 10;

    const provider = await ServiceProvider.findById(providerId);
    expect(provider?.ratingAvg).toBe(expected);
    expect(provider?.ratingCount).toBe(visible.length);
  });

  it('يرفض تقييم طلب غير مكتمل بـ422', async () => {
    const order = await newOrder();

    const response = await reviewRoute(
      req(`/api/v1/orders/${order.id}/review`, {
        method: 'POST',
        token: customerToken,
        body: { rating: 5 },
      }),
      ctx(order.id)
    );
    const body = await json(response);

    expect(response.status).toBe(422);
    expect(body.error?.message).toContain('اكتماله');
  });

  it('يرفض التقييم المكرر بـ409', async () => {
    const order = await completedOrder();
    const payload = { method: 'POST', token: customerToken, body: { rating: 4 } } as const;

    await reviewRoute(req(`/api/v1/orders/${order.id}/review`, payload), ctx(order.id));
    const second = await reviewRoute(
      req(`/api/v1/orders/${order.id}/review`, payload),
      ctx(order.id)
    );

    expect(second.status).toBe(409);
    expect(await Review.countDocuments({ orderId: new Types.ObjectId(order.id) })).toBe(1);
  });

  it('يرفض تقييم طلب عميل آخر بـ404', async () => {
    const order = await completedOrder();

    const response = await reviewRoute(
      req(`/api/v1/orders/${order.id}/review`, {
        method: 'POST',
        token: otherCustomerToken,
        body: { rating: 1 },
      }),
      ctx(order.id)
    );

    expect(response.status).toBe(404);
    expect(await Review.countDocuments({ orderId: new Types.ObjectId(order.id) })).toBe(0);
  });

  it('يرفض تقييمًا خارج 1–5 أو غير صحيح', async () => {
    const order = await completedOrder();

    for (const rating of [0, 6, -1, 3.5]) {
      const response = await reviewRoute(
        req(`/api/v1/orders/${order.id}/review`, {
          method: 'POST',
          token: customerToken,
          body: { rating },
        }),
        ctx(order.id)
      );
      expect(response.status, String(rating)).toBe(400);
    }
  });

  it('يُخطر مقدم الخدمة بالتقييم الجديد', async () => {
    const order = await completedOrder();
    await reviewRoute(
      req(`/api/v1/orders/${order.id}/review`, {
        method: 'POST',
        token: customerToken,
        body: { rating: 5 },
      }),
      ctx(order.id)
    );

    const notification = await Notification.findOne({
      userId: new Types.ObjectId(providerUserId),
      type: 'REVIEW_RECEIVED',
    });
    expect(notification?.body).toContain('5');
  });

  it('التقييم يظهر في ملف المزوّد', async () => {
    const order = await completedOrder();
    await reviewRoute(
      req(`/api/v1/orders/${order.id}/review`, {
        method: 'POST',
        token: customerToken,
        body: { rating: 5, comment: 'تقييم يظهر في الملف العام.' },
      }),
      ctx(order.id)
    );

    const response = await providerReviewsRoute(
      req(`/api/v1/providers/${providerId}/reviews`, { query: '?limit=50' }),
      ctx(providerId)
    );
    const data = (await json(response)).data as unknown as {
      items: { comment?: string }[];
    };

    expect(data.items.some((item) => item.comment?.includes('يظهر في الملف'))).toBe(true);
  });
});

/* ================================================================== */
/* العناوين                                                            */
/* ================================================================== */

describe('العناوين', () => {
  it('ينشئ عنوانًا ويجعل الأول افتراضيًا تلقائيًا', async () => {
    const response = await createAddressRoute(
      req('/api/v1/me/addresses', {
        method: 'POST',
        token: otherCustomerToken,
        body: VALID_ADDRESS,
      }),
      undefined
    );
    const data = (await json(response)).data as unknown as { isDefault: boolean; id: string };

    expect(response.status).toBe(201);
    expect(data.isDefault).toBe(true);
  });

  it('يعيد عناوين المستخدم نفسه فقط', async () => {
    await createAddressRoute(
      req('/api/v1/me/addresses', { method: 'POST', token: customerToken, body: VALID_ADDRESS }),
      undefined
    );

    const response = await addressesRoute(req('/api/v1/me/addresses', { token: customerToken }), undefined);
    const items = (await json(response)).data as unknown as { id: string }[];

    const otherResponse = await addressesRoute(
      req('/api/v1/me/addresses', { token: otherCustomerToken }),
      undefined
    );
    const otherItems = (await json(otherResponse)).data as unknown as { id: string }[];

    const overlap = items.filter((item) => otherItems.some((entry) => entry.id === item.id));
    expect(overlap).toEqual([]);
  });

  it('يرفض منطقة خارج قائمة الفيوم', async () => {
    const response = await createAddressRoute(
      req('/api/v1/me/addresses', {
        method: 'POST',
        token: customerToken,
        body: { ...VALID_ADDRESS, area: 'المعادي' },
      }),
      undefined
    );
    expect(response.status).toBe(400);
  });

  it('لا يقبل أي حقل إحداثيات', async () => {
    for (const extra of [{ lat: 29.3 }, { lng: 30.8 }, { coordinates: [1, 2] }]) {
      const response = await createAddressRoute(
        req('/api/v1/me/addresses', {
          method: 'POST',
          token: customerToken,
          body: { ...VALID_ADDRESS, ...extra },
        }),
        undefined
      );
      expect(response.status, JSON.stringify(extra)).toBe(400);
    }
  });

  it('يعدّل عنوانه ولا يعدّل عنوان غيره', async () => {
    const created = await createAddressRoute(
      req('/api/v1/me/addresses', { method: 'POST', token: customerToken, body: VALID_ADDRESS }),
      undefined
    );
    const { id } = (await json(created)).data as unknown as { id: string };

    const mine = await updateAddressRoute(
      req(`/api/v1/me/addresses/${id}`, {
        method: 'PATCH',
        token: customerToken,
        body: { label: 'العمل' },
      }),
      ctx(id)
    );
    expect(mine.status).toBe(200);

    const theirs = await updateAddressRoute(
      req(`/api/v1/me/addresses/${id}`, {
        method: 'PATCH',
        token: otherCustomerToken,
        body: { label: 'مخترق' },
      }),
      ctx(id)
    );
    expect(theirs.status).toBe(404);
  });

  it('يغيّر الافتراضي فيصير واحدًا فقط', async () => {
    const first = await createAddressRoute(
      req('/api/v1/me/addresses', { method: 'POST', token: customerToken, body: VALID_ADDRESS }),
      undefined
    );
    const second = await createAddressRoute(
      req('/api/v1/me/addresses', {
        method: 'POST',
        token: customerToken,
        body: { ...VALID_ADDRESS, label: 'العمل' },
      }),
      undefined
    );
    const secondId = ((await json(second)).data as unknown as { id: string }).id;
    void first;

    const response = await defaultAddressRoute(
      req(`/api/v1/me/addresses/${secondId}/default`, { method: 'PATCH', token: customerToken }),
      ctx(secondId)
    );
    const items = (await json(response)).data as unknown as { id: string; isDefault: boolean }[];

    expect(items.filter((item) => item.isDefault)).toHaveLength(1);
    expect(items.find((item) => item.isDefault)?.id).toBe(secondId);
  });

  it('حذف الافتراضي يرقّي عنوانًا آخر مكانه', async () => {
    const list = await addressesRoute(req('/api/v1/me/addresses', { token: customerToken }), undefined);
    const items = (await json(list)).data as unknown as { id: string; isDefault: boolean }[];
    const current = items.find((item) => item.isDefault);

    await deleteAddressRoute(
      req(`/api/v1/me/addresses/${current?.id}`, { method: 'DELETE', token: customerToken }),
      ctx(String(current?.id))
    );

    const after = await addressesRoute(req('/api/v1/me/addresses', { token: customerToken }), undefined);
    const remaining = (await json(after)).data as unknown as { isDefault: boolean }[];

    if (remaining.length > 0) {
      expect(remaining.filter((item) => item.isDefault)).toHaveLength(1);
    }
  });

  it('لا يحذف عنوان غيره', async () => {
    const created = await createAddressRoute(
      req('/api/v1/me/addresses', { method: 'POST', token: customerToken, body: VALID_ADDRESS }),
      undefined
    );
    const { id } = (await json(created)).data as unknown as { id: string };

    const response = await deleteAddressRoute(
      req(`/api/v1/me/addresses/${id}`, { method: 'DELETE', token: otherCustomerToken }),
      ctx(id)
    );
    expect(response.status).toBe(404);
  });
});

/* ================================================================== */
/* المفضلة                                                             */
/* ================================================================== */

describe('المفضلة', () => {
  it('تبديل: تُضاف ثم تُزال بنفس الطلب', async () => {
    const add = await toggleFavoriteRoute(
      req('/api/v1/me/favorites', { method: 'POST', token: customerToken, body: { providerId } }),
      undefined
    );
    const addData = (await json(add)).data as unknown as { added: boolean; total: number };
    expect(addData.added).toBe(true);

    const remove = await toggleFavoriteRoute(
      req('/api/v1/me/favorites', { method: 'POST', token: customerToken, body: { providerId } }),
      undefined
    );
    const removeData = (await json(remove)).data as unknown as { added: boolean };
    expect(removeData.added).toBe(false);
  });

  it('يرفض تحديد مزوّد وخدمة معًا أو لا شيء', async () => {
    for (const body of [{}, { providerId, serviceId: providerId }]) {
      const response = await toggleFavoriteRoute(
        req('/api/v1/me/favorites', { method: 'POST', token: customerToken, body }),
        undefined
      );
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
  });

  it('يعيد مفضلة المستخدم نفسه فقط', async () => {
    await toggleFavoriteRoute(
      req('/api/v1/me/favorites', { method: 'POST', token: customerToken, body: { providerId } }),
      undefined
    );

    const mine = await favoritesRoute(req('/api/v1/me/favorites', { token: customerToken }), undefined);
    const mineData = (await json(mine)).data as unknown as { total: number };

    const theirs = await favoritesRoute(
      req('/api/v1/me/favorites', { token: otherCustomerToken }),
      undefined
    );
    const theirsData = (await json(theirs)).data as unknown as { total: number };

    expect(mineData.total).toBeGreaterThan(0);
    expect(theirsData.total).toBe(0);
  });
});

/* ================================================================== */
/* الحساب ومركز المساعدة                                               */
/* ================================================================== */

describe('حسابي ومركز المساعدة', () => {
  it('ملخّص الحساب يعرض «وسائل الدفع» كنص معلوماتي لا ككيان', async () => {
    const response = await accountRoute(req('/api/v1/me/account', { token: customerToken }), undefined);
    const data = (await json(response)).data as unknown as {
      stats: { paymentMethodsNote: string; favorites: number; addresses: number };
      orders: Record<string, number>;
    };

    expect(response.status).toBe(200);
    expect(data.stats.paymentMethodsNote).toContain('كاش');
    expect(data.stats.paymentMethodsNote).toContain('لا يوجد دفع إلكتروني');
  });

  it('ملخّص الحساب خالٍ من أي مصطلح بوابة دفع', async () => {
    const response = await accountRoute(req('/api/v1/me/account', { token: customerToken }), undefined);
    const raw = (await response.text()).toLowerCase();

    for (const term of ['visa', 'mastercard', 'stripe', 'paypal', 'paymob', 'fawry', 'wallet', 'card']) {
      expect(raw, term).not.toContain(term);
    }
  });

  it('يعدّل الملف الشخصي ولا يقبل حقولًا حسّاسة', async () => {
    const response = await profileRoute(
      req('/api/v1/me/profile', {
        method: 'PATCH',
        token: customerToken,
        body: { fullName: 'سارة محمود المحدَّث' },
      }),
      undefined
    );
    const data = (await json(response)).data as unknown as { fullName: string };

    expect(response.status).toBe(200);
    expect(data.fullName).toBe('سارة محمود المحدَّث');

    for (const body of [{ role: 'ADMIN' }, { status: 'ACTIVE' }, { phone: '01012345678' }]) {
      const rejected = await profileRoute(
        req('/api/v1/me/profile', { method: 'PATCH', token: customerToken, body }),
        undefined
      );
      expect(rejected.status, JSON.stringify(body)).toBe(400);
    }
  });

  it('الأسئلة الشائعة متاحة بلا مصادقة', async () => {
    const response = await faqsRoute(req('/api/v1/faqs'), undefined);
    const items = (await json(response)).data as unknown as { question: string }[];

    expect(response.status).toBe(200);
    expect(items.length).toBeGreaterThan(0);
  });

  it('البحث في الأسئلة لا يفتح بابًا لحقن تعبير نمطي', async () => {
    const response = await faqsRoute(req('/api/v1/faqs', { query: '?q=.*' }), undefined);
    const items = (await json(response)).data as unknown as unknown[];

    expect(response.status).toBe(200);
    expect(items).toEqual([]);
  });

  it('«تواصل معنا» ينشئ إشعار تأكيد للمستخدم', async () => {
    const response = await contactRoute(
      req('/api/v1/support/contact', {
        method: 'POST',
        token: customerToken,
        body: { subject: 'استفسار عن الطلب', message: 'أحتاج مساعدة في تتبع طلبي الأخير.' },
      }),
      undefined
    );

    expect(response.status).toBe(200);

    const notification = await Notification.findOne({
      userId: new Types.ObjectId(customerId),
      type: 'SYSTEM',
    });
    expect(notification?.body).toContain('استفسار عن الطلب');
  });
});

/* ================================================================== */
/* المراسلة                                                            */
/* ================================================================== */

describe('المراسلة', () => {
  it('لا تُفتح المحادثة قبل قبول الطلب', async () => {
    const order = await newOrder();

    const response = await openThreadRoute(
      req(`/api/v1/orders/${order.id}/thread`, { method: 'POST', token: customerToken }),
      ctx(order.id)
    );
    const body = await json(response);

    expect(response.status).toBe(403);
    expect(body.error?.message).toContain('قبول');
  });

  it('تُفتح بعد القبول ويشارك فيها الطرفان فقط', async () => {
    const order = await newOrder();
    await setStatus(order.id, 'ACCEPTED');

    const response = await openThreadRoute(
      req(`/api/v1/orders/${order.id}/thread`, { method: 'POST', token: customerToken }),
      ctx(order.id)
    );
    const thread = (await json(response)).data as unknown as {
      id: string;
      counterpart: { fullName: string };
    };

    expect(response.status).toBe(200);
    expect(thread.counterpart.fullName).toBeTruthy();

    // فتحها مرتين لا ينشئ محادثتين
    const again = await openThreadRoute(
      req(`/api/v1/orders/${order.id}/thread`, { method: 'POST', token: providerToken }),
      ctx(order.id)
    );
    const second = (await json(again)).data as unknown as { id: string };
    expect(second.id).toBe(thread.id);
  });

  it('طرف ثالث لا يفتح محادثة طلب ليس له — 404', async () => {
    const order = await newOrder();
    await setStatus(order.id, 'ACCEPTED');

    const response = await openThreadRoute(
      req(`/api/v1/orders/${order.id}/thread`, { method: 'POST', token: otherCustomerToken }),
      ctx(order.id)
    );
    expect(response.status).toBe(404);
  });

  it('يرسل رسالة ويعلّمها غير مقروءة للطرف الآخر', async () => {
    const order = await newOrder();
    await setStatus(order.id, 'ACCEPTED');

    const threadResponse = await openThreadRoute(
      req(`/api/v1/orders/${order.id}/thread`, { method: 'POST', token: customerToken }),
      ctx(order.id)
    );
    const { id: threadId } = (await json(threadResponse)).data as unknown as { id: string };

    const sent = await sendMessageRoute(
      req(`/api/v1/threads/${threadId}/messages`, {
        method: 'POST',
        token: customerToken,
        body: { body: 'متى تتوقع الوصول؟' },
      }),
      ctx(threadId)
    );
    const message = (await json(sent)).data as unknown as { isMine: boolean; body: string };

    expect(sent.status).toBe(201);
    expect(message.isMine).toBe(true);

    // المزوّد يرى الرسالة واردة وغير مقروءة
    const threads = await threadsRoute(req('/api/v1/threads', { token: providerToken }), undefined);
    const list = (await json(threads)).data as unknown as {
      items: { id: string; unread: number }[];
      unreadTotal: number;
    };
    expect(list.unreadTotal).toBeGreaterThan(0);
    expect(list.items.find((item) => item.id === threadId)?.unread).toBe(1);
  });

  it('فتح المحادثة يعلّم رسائلها مقروءة', async () => {
    const order = await newOrder();
    await setStatus(order.id, 'ACCEPTED');

    const threadResponse = await openThreadRoute(
      req(`/api/v1/orders/${order.id}/thread`, { method: 'POST', token: customerToken }),
      ctx(order.id)
    );
    const { id: threadId } = (await json(threadResponse)).data as unknown as { id: string };

    await sendMessageRoute(
      req(`/api/v1/threads/${threadId}/messages`, {
        method: 'POST',
        token: customerToken,
        body: { body: 'رسالة تُقرأ' },
      }),
      ctx(threadId)
    );

    await messagesRoute(
      req(`/api/v1/threads/${threadId}/messages`, { token: providerToken }),
      ctx(threadId)
    );

    const after = await threadsRoute(req('/api/v1/threads', { token: providerToken }), undefined);
    const list = (await json(after)).data as unknown as { items: { id: string; unread: number }[] };
    expect(list.items.find((item) => item.id === threadId)?.unread).toBe(0);
  });

  it('غير المشارك لا يقرأ الرسائل ولا يرسل — 404', async () => {
    const order = await newOrder();
    await setStatus(order.id, 'ACCEPTED');

    const threadResponse = await openThreadRoute(
      req(`/api/v1/orders/${order.id}/thread`, { method: 'POST', token: customerToken }),
      ctx(order.id)
    );
    const { id: threadId } = (await json(threadResponse)).data as unknown as { id: string };

    const read = await messagesRoute(
      req(`/api/v1/threads/${threadId}/messages`, { token: otherCustomerToken }),
      ctx(threadId)
    );
    expect(read.status).toBe(404);

    const send = await sendMessageRoute(
      req(`/api/v1/threads/${threadId}/messages`, {
        method: 'POST',
        token: otherCustomerToken,
        body: { body: 'رسالة متطفلة' },
      }),
      ctx(threadId)
    );
    expect(send.status).toBe(404);
  });

  it('لا إرسال على طلب أُلغي بعد فتح المحادثة', async () => {
    const order = await newOrder();
    await setStatus(order.id, 'ACCEPTED');

    const threadResponse = await openThreadRoute(
      req(`/api/v1/orders/${order.id}/thread`, { method: 'POST', token: customerToken }),
      ctx(order.id)
    );
    const { id: threadId } = (await json(threadResponse)).data as unknown as { id: string };

    await ServiceRequest.updateOne({ _id: order.id }, { $set: { status: 'CANCELLED' } });

    const response = await sendMessageRoute(
      req(`/api/v1/threads/${threadId}/messages`, {
        method: 'POST',
        token: customerToken,
        body: { body: 'رسالة بعد الإلغاء' },
      }),
      ctx(threadId)
    );
    expect(response.status).toBe(403);
  });

  it('يرفض رسالة فارغة', async () => {
    const order = await newOrder();
    await setStatus(order.id, 'ACCEPTED');

    const threadResponse = await openThreadRoute(
      req(`/api/v1/orders/${order.id}/thread`, { method: 'POST', token: customerToken }),
      ctx(order.id)
    );
    const { id: threadId } = (await json(threadResponse)).data as unknown as { id: string };

    const response = await sendMessageRoute(
      req(`/api/v1/threads/${threadId}/messages`, {
        method: 'POST',
        token: customerToken,
        body: { body: '   ' },
      }),
      ctx(threadId)
    );
    expect(response.status).toBe(400);
  });
});

/* ================================================================== */

describe('E2E — إكمال طلب ← إشعار ← تقييم ← ظهوره في الملف', () => {
  it('الحلقة كاملة', async () => {
    const order = await completedOrder();

    /* 1) إشعار الإكمال وصل للعميل */
    const notifications = await notificationsRoute(
      req('/api/v1/notifications', { token: customerToken, query: '?limit=50' }),
      undefined
    );
    const list = (await json(notifications)).data as unknown as {
      items: { type: string; entityId?: string }[];
    };
    expect(
      list.items.some((item) => item.type === 'ORDER_COMPLETED' && item.entityId === order.id)
    ).toBe(true);

    /* 2) كتابة التقييم */
    const review = await reviewRoute(
      req(`/api/v1/orders/${order.id}/review`, {
        method: 'POST',
        token: customerToken,
        body: { rating: 5, comment: 'تجربة كاملة من الطلب إلى التقييم.' },
      }),
      ctx(order.id)
    );
    expect(review.status).toBe(201);

    /* 3) ظهوره في ملف المزوّد */
    const reviews = await providerReviewsRoute(
      req(`/api/v1/providers/${providerId}/reviews`, { query: '?limit=50' }),
      ctx(providerId)
    );
    const data = (await json(reviews)).data as unknown as { items: { comment?: string }[] };
    expect(data.items.some((item) => item.comment?.includes('من الطلب إلى التقييم'))).toBe(true);

    /* 4) وإشعار التقييم وصل للمزوّد */
    const providerNotifications = await notificationsRoute(
      req('/api/v1/notifications', { token: providerToken, query: '?tab=ALERTS&limit=50' }),
      undefined
    );
    const providerList = (await json(providerNotifications)).data as unknown as {
      items: { type: string }[];
    };
    expect(providerList.items.some((item) => item.type === 'REVIEW_RECEIVED')).toBe(true);
  });
});
