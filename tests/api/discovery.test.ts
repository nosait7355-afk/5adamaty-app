import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildAllIndexes, startTestDb, stopTestDb } from '../helpers/db';
import { runSeed } from '@/server/db/seed/seed';
import { Category, Profession, Review, ServiceProvider, User } from '@/server/db/models';
import { resetRateLimitStore } from '@/server/middleware/with-rate-limit';

import { GET as getProviders } from '@/app/api/v1/providers/route';
import { GET as getProvider } from '@/app/api/v1/providers/[id]/route';
import { GET as getProviderReviews } from '@/app/api/v1/providers/[id]/reviews/route';
import { GET as getServices } from '@/app/api/v1/services/route';
import { GET as getService } from '@/app/api/v1/services/[id]/route';
import { GET as getSearch } from '@/app/api/v1/search/route';

/**
 * اختبارات الاكتشاف (Phase 5).
 *
 * المحور الأمني هنا واحد: **لا يظهر مزوّد غير معتمد في أي مخرج**، ولا يخرج
 * أي حقل اتصال. تُفحص القاعدتان على مستوى الـAPI لا الواجهة.
 */

let approvedProviderId = '';
let pendingProviderId = '';
let approvedServiceId = '';
let homeCategoryId = '';
let plumberCategoryId = '';
let plumberProfessionId = '';

beforeAll(async () => {
  await startTestDb();
  await buildAllIndexes();
  await runSeed();

  const approved = await ServiceProvider.findOne({
    isActive: true,
    displayName: 'شركة النقاء للتنظيف',
  });
  const pending = await ServiceProvider.findOne({ displayName: 'مزوّد قيد المراجعة' });
  approvedProviderId = String(approved?._id);
  pendingProviderId = String(pending?._id);

  const category = await Category.findOne({ slug: 'home-services' });
  const profession = await Profession.findOne({ slug: 'plumber' });
  homeCategoryId = String(category?._id);
  plumberProfessionId = String(profession?._id);
  // السبّاك يقع تحت «سباكة وكهرباء» لا «خدمات منزلية»
  plumberCategoryId = String(profession?.categoryId);

  // تقييم ظاهر وآخر مخفي إداريًا على المزوّد نفسه
  const customer = await User.create({
    role: 'CUSTOMER',
    fullName: 'عميل الاختبار',
    phone: '+201000000999',
    passwordHash: 'TEST_ONLY',
    status: 'ACTIVE',
  });

  await Review.create({
    orderId: new (await import('mongoose')).Types.ObjectId(),
    customerId: customer._id,
    providerId: approved?._id,
    rating: 5,
    comment: 'خدمة ممتازة وسرعة في التنفيذ.',
    isVisible: true,
  });
  await Review.create({
    orderId: new (await import('mongoose')).Types.ObjectId(),
    customerId: customer._id,
    providerId: approved?._id,
    rating: 1,
    comment: 'تقييم مخفي إداريًا لا يجب أن يظهر.',
    isVisible: false,
  });
}, 90_000);

afterAll(async () => {
  await stopTestDb();
});

afterEach(() => {
  resetRateLimitStore();
});

/* ---- أدوات مساعدة ---- */

function req(path: string): Request {
  return new Request(`http://localhost:3000${path}`, {
    headers: { 'x-forwarded-for': `10.1.0.${Math.floor(Math.random() * 250) + 1}` },
  });
}

interface Body {
  success: boolean;
  data?: unknown;
  meta?: { page?: number; limit?: number; total?: number; hasMore?: boolean };
  error?: { code: string; message: string; fields?: Record<string, string> };
}

async function json(response: Response): Promise<Body> {
  return (await response.json()) as Body;
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

/** يفحص أن أي نص في الاستجابة لا يحوي حقول اتصال أو حقول داخلية. */
function assertNoLeaks(raw: string) {
  expect(raw).not.toMatch(/"phone"/);
  expect(raw).not.toMatch(/"email"/);
  expect(raw).not.toMatch(/passwordHash/);
  expect(raw).not.toMatch(/requestNumber/);
  expect(raw).not.toMatch(/rejectionReason/);
  expect(raw).not.toMatch(/"userId"/);
  expect(raw).not.toMatch(/@seed\.local/);
  expect(raw).not.toMatch(/\+20\d/);
}

/* ================================================================== */

describe('GET /api/v1/providers', () => {
  it('يعيد المزوّدين المعتمدين فقط مع ترقيم كامل', async () => {
    const response = await getProviders(req('/api/v1/providers?limit=50'), undefined);
    const body = await json(response);

    expect(response.status).toBe(200);
    const items = body.data as { id: string; displayName: string }[];
    expect(items.length).toBeGreaterThan(0);
    expect(body.meta?.total).toBe(items.length);
    expect(body.meta?.page).toBe(1);
    expect(items.some((p) => p.displayName === 'مزوّد قيد المراجعة')).toBe(false);
    expect(items.some((p) => p.displayName === 'طبيب قيد المراجعة')).toBe(false);
  });

  it('لا يسرّب هاتفًا ولا بريدًا ولا حقول التوثيق الداخلية', async () => {
    const response = await getProviders(req('/api/v1/providers?limit=50'), undefined);
    assertNoLeaks(await response.text());
  });

  it('يفلتر بالتصنيف', async () => {
    const response = await getProviders(
      req(`/api/v1/providers?categoryId=${homeCategoryId}&limit=50`),
      undefined
    );
    const items = (await json(response)).data as { categoryId: string }[];
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((p) => p.categoryId === homeCategoryId)).toBe(true);
  });

  it('يفلتر بالمهنة عبر الـslug', async () => {
    const response = await getProviders(
      req('/api/v1/providers?professionSlug=plumber&limit=50'),
      undefined
    );
    const items = (await json(response)).data as { professionId: string }[];
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((p) => p.professionId === plumberProfessionId)).toBe(true);
  });

  it('slug غير موجود يعيد قائمة فارغة لا كل النتائج', async () => {
    const response = await getProviders(
      req('/api/v1/providers?categorySlug=does-not-exist'),
      undefined
    );
    expect((await json(response)).data).toEqual([]);
  });

  it('يفلتر بالمنطقة النصية', async () => {
    const response = await getProviders(
      req(`/api/v1/providers?area=${encodeURIComponent('حي الجامعة')}&limit=50`),
      undefined
    );
    const items = (await json(response)).data as { coverageAreas: string[] }[];
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((p) => p.coverageAreas.includes('حي الجامعة'))).toBe(true);
  });

  it('يرفض منطقة خارج قائمة الفيوم الثابتة', async () => {
    const response = await getProviders(req('/api/v1/providers?area=Cairo'), undefined);
    expect(response.status).toBe(400);
    expect((await json(response)).error?.code).toBe('VALIDATION_ERROR');
  });

  it('يفلتر بالحد الأدنى للتقييم', async () => {
    const response = await getProviders(req('/api/v1/providers?minRating=4.8&limit=50'), undefined);
    const items = (await json(response)).data as { ratingAvg: number }[];
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((p) => p.ratingAvg >= 4.8)).toBe(true);
  });

  it('يرتّب بالأعلى تقييمًا افتراضيًا', async () => {
    const response = await getProviders(req('/api/v1/providers?limit=50'), undefined);
    const items = (await json(response)).data as { ratingAvg: number }[];
    const ratings = items.map((p) => p.ratingAvg);
    expect([...ratings].sort((a, b) => b - a)).toEqual(ratings);
  });

  it('يرفض ترتيبًا غير معروف', async () => {
    const response = await getProviders(req('/api/v1/providers?sort=cheapest'), undefined);
    expect(response.status).toBe(400);
  });

  it('يرفض الترتيب بالسعر — لم يعد خيارًا', async () => {
    for (const sort of ['price_asc', 'price_desc']) {
      const response = await getProviders(req(`/api/v1/providers?sort=${sort}`), undefined);
      expect(response.status, sort).toBe(400);
    }
  });

  it('يرفض أي فلتر سعر — لم يعد مفتاحًا معروفًا', async () => {
    const response = await getProviders(
      req('/api/v1/providers?priceMin=100&priceMax=500'),
      undefined
    );
    expect(response.status).toBe(400);
  });

  it('الصفحات لا تتداخل ولا تُسقط عنصرًا', async () => {
    const first = (await json(await getProviders(req('/api/v1/providers?limit=5&page=1'), undefined)))
      .data as { id: string }[];
    const second = (
      await json(await getProviders(req('/api/v1/providers?limit=5&page=2'), undefined))
    ).data as { id: string }[];

    expect(first).toHaveLength(5);
    expect(second).toHaveLength(5);
    const overlap = first.filter((a) => second.some((b) => b.id === a.id));
    expect(overlap).toEqual([]);
  });

  it('hasMore يعكس وجود صفحة تالية', async () => {
    const body = await json(await getProviders(req('/api/v1/providers?limit=5&page=1'), undefined));
    expect(body.meta?.hasMore).toBe(true);
  });

  it('يرفض مفاتيح استعلام غير معرّفة', async () => {
    const response = await getProviders(req('/api/v1/providers?isActive=false'), undefined);
    expect(response.status).toBe(400);
  });
});

/* ================================================================== */

describe('GET /api/v1/providers/:id', () => {
  it('يعيد ملف مزوّد معتمد بكل أقسام الصورة 10', async () => {
    const response = await getProvider(req(`/api/v1/providers/${approvedProviderId}`), ctx(approvedProviderId));
    const body = await json(response);

    expect(response.status).toBe(200);
    const provider = body.data as Record<string, unknown>;
    expect(provider.displayName).toBe('شركة النقاء للتنظيف');
    expect(provider.servicesCount).toBe(2);
    expect(provider).toHaveProperty('customersCount');
    expect(provider).toHaveProperty('memberSince');
    expect(Array.isArray(provider.gallery)).toBe(true);
    // التسعير أُزيل من المنصة — لا مفتاح سعر في أي استجابة
    expect(provider).not.toHaveProperty('priceMode');
    expect(provider).not.toHaveProperty('priceMin');
  });

  it('مزوّد قيد المراجعة يعيد 404 لا 403', async () => {
    const response = await getProvider(
      req(`/api/v1/providers/${pendingProviderId}`),
      ctx(pendingProviderId)
    );
    expect(response.status).toBe(404);
    expect((await json(response)).error?.code).toBe('NOT_FOUND');
  });

  it('لا يسرّب حقول اتصال في التفاصيل', async () => {
    const response = await getProvider(
      req(`/api/v1/providers/${approvedProviderId}`),
      ctx(approvedProviderId)
    );
    assertNoLeaks(await response.text());
  });

  it('معرّف غير صالح يعيد 400', async () => {
    const response = await getProvider(req('/api/v1/providers/abc'), ctx('abc'));
    expect(response.status).toBe(400);
  });
});

/* ================================================================== */

describe('GET /api/v1/providers/:id/reviews', () => {
  it('يعيد التقييمات الظاهرة فقط', async () => {
    const response = await getProviderReviews(
      req(`/api/v1/providers/${approvedProviderId}/reviews`),
      ctx(approvedProviderId)
    );
    const body = await json(response);
    const data = body.data as { items: { comment?: string; customerName: string }[] };

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0]?.comment).toContain('ممتازة');
    expect(data.items[0]?.customerName).toBe('عميل الاختبار');
    expect(body.meta?.total).toBe(1);
  });

  it('لا يسرّب بيانات اتصال صاحب التقييم', async () => {
    const response = await getProviderReviews(
      req(`/api/v1/providers/${approvedProviderId}/reviews`),
      ctx(approvedProviderId)
    );
    assertNoLeaks(await response.text());
  });

  it('تقييمات مزوّد قيد المراجعة تعيد 404', async () => {
    const response = await getProviderReviews(
      req(`/api/v1/providers/${pendingProviderId}/reviews`),
      ctx(pendingProviderId)
    );
    expect(response.status).toBe(404);
  });
});

/* ================================================================== */

describe('GET /api/v1/services', () => {
  it('يعيد خدمات المزوّدين المعتمدين فقط', async () => {
    const response = await getServices(req('/api/v1/services?limit=50'), undefined);
    const body = await json(response);
    const items = body.data as { id: string; provider: { id: string } }[];

    expect(response.status).toBe(200);
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((s) => s.provider.id === pendingProviderId)).toBe(false);
    approvedServiceId = items[0]?.id ?? '';
  });

  it('كل بطاقة تحمل ما ترسمه الصورة 09', async () => {
    const response = await getServices(req('/api/v1/services?limit=1'), undefined);
    const [service] = (await json(response)).data as Record<string, unknown>[];

    expect(service).toMatchObject({
      title: expect.any(String),
      description: expect.any(String),
    });
    expect(service).not.toHaveProperty('priceFrom');
    expect(service).not.toHaveProperty('currency');
    expect(service?.categoryName).toBeTruthy();
    expect((service?.provider as { displayName: string }).displayName).toBeTruthy();
    expect((service?.provider as { yearsOfExperience: number }).yearsOfExperience).toBeTypeOf(
      'number'
    );
  });

  it('يفلتر بالتصنيف والمهنة معًا', async () => {
    const response = await getServices(
      req(`/api/v1/services?categoryId=${plumberCategoryId}&professionId=${plumberProfessionId}&limit=50`),
      undefined
    );
    const items = (await json(response)).data as { categoryId: string; professionId: string }[];
    expect(items.length).toBeGreaterThan(0);
    expect(
      items.every((s) => s.categoryId === plumberCategoryId && s.professionId === plumberProfessionId)
    ).toBe(true);
  });

  it('يجمع كل الفلاتر مع الترتيب في استعلام واحد', async () => {
    const response = await getServices(
      req(
        `/api/v1/services?categoryId=${homeCategoryId}&area=${encodeURIComponent('حي الجامعة')}&minRating=4.5&sort=newest&limit=50`
      ),
      undefined
    );
    const items = (await json(response)).data as {
      categoryId: string;
      areas: string[];
      ratingAvg: number;
    }[];

    expect(items.every((s) => s.categoryId === homeCategoryId)).toBe(true);
    expect(items.every((s) => s.areas.includes('حي الجامعة'))).toBe(true);
    expect(items.every((s) => s.ratingAvg >= 4.5)).toBe(true);
  });

  it('لا يسرّب حقول اتصال', async () => {
    const response = await getServices(req('/api/v1/services?limit=50'), undefined);
    assertNoLeaks(await response.text());
  });
});

/* ================================================================== */

describe('GET /api/v1/services/:id', () => {
  it('يعيد تفاصيل خدمة مزوّد معتمد', async () => {
    const response = await getService(
      req(`/api/v1/services/${approvedServiceId}`),
      ctx(approvedServiceId)
    );
    const service = (await json(response)).data as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(service.id).toBe(approvedServiceId);
    expect(Array.isArray(service.images)).toBe(true);
  });

  it('معرّف غير موجود يعيد 404', async () => {
    const missing = '000000000000000000000000';
    const response = await getService(req(`/api/v1/services/${missing}`), ctx(missing));
    expect(response.status).toBe(404);
  });
});

/* ================================================================== */

describe('GET /api/v1/search', () => {
  it('يبحث في الخدمات والمزوّدين معًا', async () => {
    const response = await getSearch(
      req(`/api/v1/search?q=${encodeURIComponent('سباك')}`),
      undefined
    );
    const body = await json(response);
    const data = body.data as { services: unknown[]; providers: unknown[]; totals: unknown };

    expect(response.status).toBe(200);
    expect(Array.isArray(data.services)).toBe(true);
    expect(Array.isArray(data.providers)).toBe(true);
    expect(data.totals).toBeTruthy();
  });

  it('يقصر النتائج على النوع المطلوب', async () => {
    const response = await getSearch(
      req(`/api/v1/search?q=${encodeURIComponent('سباك')}&type=providers`),
      undefined
    );
    const data = (await json(response)).data as { services: unknown[]; providers: unknown[] };
    expect(data.services).toEqual([]);
  });

  it('لا يعيد مزوّدًا قيد المراجعة', async () => {
    const response = await getSearch(
      req(`/api/v1/search?q=${encodeURIComponent('المراجعة')}`),
      undefined
    );
    const data = (await json(response)).data as { providers: { displayName: string }[] };
    expect(data.providers.some((p) => p.displayName.includes('قيد المراجعة'))).toBe(false);
  });

  it('يجد نتائج ببادئة كلمة رغم أن الفهرس النصي يطابق الكلمات الكاملة', async () => {
    // «كهرب» بادئة «كهربائي» — الفهرس النصي وحده يعيد صفرًا
    const response = await getSearch(
      req(`/api/v1/search?q=${encodeURIComponent('كهرب')}`),
      undefined
    );
    const data = (await json(response)).data as { totals: { providers: number; services: number } };
    expect(data.totals.providers + data.totals.services).toBeGreaterThan(0);
  });

  it('لا يفتح البحث الجزئي بابًا لحقن تعبير نمطي', async () => {
    // بلا هروب كان '.*' ليطابق كل شيء
    const response = await getSearch(req('/api/v1/search?q=.*'), undefined);
    const data = (await json(response)).data as { totals: { providers: number; services: number } };
    expect(response.status).toBe(200);
    expect(data.totals.providers + data.totals.services).toBe(0);
  });

  it('البحث الجزئي لا يكشف مزوّدًا قيد المراجعة', async () => {
    const response = await getSearch(
      req(`/api/v1/search?q=${encodeURIComponent('مزوّد قيد')}`),
      undefined
    );
    const data = (await json(response)).data as { providers: { displayName: string }[] };
    expect(data.providers).toEqual([]);
  });

  it('يرفض بحثًا بحرف واحد', async () => {
    const response = await getSearch(req('/api/v1/search?q=a'), undefined);
    expect(response.status).toBe(400);
  });

  it('يفرض حدًا أضيق على معدّل البحث', async () => {
    resetRateLimitStore();
    const ip = '10.9.9.9';
    const call = () =>
      getSearch(
        new Request(`http://localhost:3000/api/v1/search?q=${encodeURIComponent('سباك')}`, {
          headers: { 'x-forwarded-for': ip },
        }),
        undefined
      );

    let limited = false;
    for (let attempt = 0; attempt < 31; attempt += 1) {
      const response = await call();
      if (response.status === 429) {
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);
  });
});
