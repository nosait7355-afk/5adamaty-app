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
import { Notification, ServiceProvider, User } from '@/server/db/models';
import type { NotificationType } from '@/shared/constants/notifications';
import { resetRateLimitStore } from '@/server/middleware/with-rate-limit';
import { signAccessToken } from '@/server/lib/jwt';

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


/**
 * الأنظمة المساندة (Phase 9): الإشعارات والعناوين والمفضلة والحساب.
 * لا طلبات ولا تقييمات جديدة ولا مراسلة — التطبيق دليل اتصال مباشر.
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

/** ينشئ إشعارًا مباشرة — بديل الأحداث التي كانت تولّده دورة الطلب. */
async function seedNotification(userId: string, type: NotificationType = 'SYSTEM') {
  return Notification.create({
    userId: new Types.ObjectId(userId),
    type,
    title: 'إشعار اختبار',
    body: 'نص إشعار للاختبار.',
    entityType: type === 'MESSAGE_RECEIVED' ? 'MESSAGE' : 'SYSTEM',
    isRead: false,
  });
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
    await seedNotification(providerUserId, 'PROVIDER_APPROVED');

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
    expect(data.items.some((item) => item.type === 'PROVIDER_APPROVED')).toBe(true);
    expect(data.unreadTotal).toBeGreaterThan(0);

    // العميل لا يرى إشعار المزوّد
    const mine = await notificationsRoute(
      req('/api/v1/notifications', { token: customerToken, query: '?limit=50' }),
      undefined
    );
    const mineData = (await json(mine)).data as unknown as { items: { type: string }[] };
    expect(mineData.items.some((item) => item.type === 'PROVIDER_APPROVED')).toBe(false);
  });

  it('التبويبات: الكل / المكالمات / الرسائل', async () => {
    await seedNotification(providerUserId, 'MESSAGE_RECEIVED');
    await seedNotification(providerUserId, 'SYSTEM');

    const messages = await notificationsRoute(
      req('/api/v1/notifications', { token: providerToken, query: '?tab=MESSAGES&limit=50' }),
      undefined
    );
    const messagesData = (await json(messages)).data as unknown as {
      items: { tab: string }[];
      counts: Record<string, number>;
    };
    expect(messagesData.items.length).toBeGreaterThan(0);
    expect(messagesData.items.every((item) => item.tab === 'MESSAGES')).toBe(true);
    expect(Object.keys(messagesData.counts).sort()).toEqual(['ALL', 'CALLS', 'MESSAGES']);

    // المكالمات لا تُسجَّل، فالتبويب فارغ دائمًا
    const calls = await notificationsRoute(
      req('/api/v1/notifications', { token: providerToken, query: '?tab=CALLS&limit=50' }),
      undefined
    );
    expect(((await json(calls)).data as unknown as { items: unknown[] }).items).toHaveLength(0);

    // التبويبات القديمة لم تعد مقبولة
    const legacy = await notificationsRoute(
      req('/api/v1/notifications', { token: providerToken, query: '?tab=ORDERS' }),
      undefined
    );
    expect(legacy.status).toBe(400);
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
    await seedNotification(providerUserId);
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
    await seedNotification(providerUserId);
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
    await seedNotification(providerUserId);

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
