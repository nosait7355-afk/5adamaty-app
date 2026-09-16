import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { buildAllIndexes, startTestDb, stopTestDb } from '../helpers/db';

/*
 * `setSessionCookies` تستدعي `cookies()` من next/headers، وهي متاحة داخل
 * نطاق طلب Next فقط. استدعاء المعالج مباشرة في الاختبار ليس داخل ذلك
 * النطاق، فنستبدل المخزن بواحد في الذاكرة — الغرض اختبار منطق المسار
 * (تحقق، CSRF، حد معدّل، أخطاء) لا آلية الكوكيز نفسها (المغطّاة في Phase 3).
 */
const cookieJar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value ? { name, value } : undefined;
    },
    set: (name: string, value: string) => cookieJar.set(name, value),
    delete: (name: string) => cookieJar.delete(name),
  }),
}));

import { runSeed } from '@/server/db/seed/seed';
import {
  AuditLog,
  Notification,
  Profession,
  ProviderDocument,
  ServiceProvider,
  User,
} from '@/server/db/models';
import { resetRateLimitStore } from '@/server/middleware/with-rate-limit';
import { signAccessToken } from '@/server/lib/jwt';
import { hashPassword } from '@/server/lib/password';

import { POST as registerProviderRoute } from '@/app/api/v1/auth/register-provider/route';
import {
  GET as getProfileRoute,
  PATCH as patchProfileRoute,
} from '@/app/api/v1/provider/profile/route';
import { POST as submitRoute } from '@/app/api/v1/provider/verification/submit/route';
import { GET as adminQueueRoute } from '@/app/api/v1/admin/providers/route';
import { GET as adminDetailRoute } from '@/app/api/v1/admin/providers/[id]/route';
import { PATCH as decideRoute } from '@/app/api/v1/admin/providers/[id]/verification/route';
import { GET as searchRoute } from '@/app/api/v1/search/route';
import { GET as providersRoute } from '@/app/api/v1/providers/route';

/**
 * تسجيل مقدم الخدمة والتوثيق (Phase 6).
 *
 * المحور: الطلب لا يصير مرئيًا ولا فعّالًا إلا بقرار إداري صريح، وكل قرار
 * يُسجَّل. تُفحص القواعد على مستوى الـAPI لا الواجهة.
 */

let plumberProfessionId = '';
let plumberCategoryId = '';
let doctorProfessionId = '';
let doctorCategoryId = '';
let adminId = '';

beforeAll(async () => {
  await startTestDb();
  await buildAllIndexes();
  await runSeed();

  process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters-long!!';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters-long!';
  process.env.APP_URL = 'http://localhost:3000';

  const plumber = await Profession.findOne({ slug: 'plumber' });
  const doctor = await Profession.findOne({ slug: 'doctor' });
  plumberProfessionId = String(plumber?._id);
  plumberCategoryId = String(plumber?.categoryId);
  doctorProfessionId = String(doctor?._id);
  doctorCategoryId = String(doctor?.categoryId);

  const admin = await User.create({
    role: 'ADMIN',
    fullName: 'مدير النظام',
    phone: '+201000000001',
    email: 'admin@test.local',
    passwordHash: await hashPassword('AdminPass123'),
    status: 'ACTIVE',
  });
  adminId = String(admin._id);
}, 90_000);

afterAll(async () => {
  await stopTestDb();
});

afterEach(() => {
  resetRateLimitStore();
});

/* ================================================================== */
/* أدوات مساعدة                                                        */
/* ================================================================== */

let phoneCounter = 0;
function uniquePhone(): string {
  phoneCounter += 1;
  return `0102000${String(1000 + phoneCounter)}`;
}

async function tokenFor(userId: string, role: 'PROVIDER' | 'ADMIN' | 'CUSTOMER', status = 'ACTIVE') {
  return signAccessToken({ userId, role, status });
}

interface ReqOptions {
  method?: string;
  body?: unknown;
  token?: string;
  query?: string;
}

function req(path: string, options: ReqOptions = {}): Request {
  const headers: Record<string, string> = {
    'x-forwarded-for': `10.2.0.${Math.floor(Math.random() * 250) + 1}`,
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

/** بيانات خطوة 1/4 صالحة. */
function step1(overrides: Record<string, unknown> = {}) {
  return {
    fullName: 'محمد عبد الرحمن',
    phone: uniquePhone(),
    email: `provider${phoneCounter}@test.local`,
    password: 'Provider12345',
    confirmPassword: 'Provider12345',
    city: 'الفيوم',
    addressLine: 'شارع الحرية، بجوار مسجد النور',
    accountType: 'INDIVIDUAL',
    ...overrides,
  };
}

function step2(overrides: Record<string, unknown> = {}) {
  return {
    categoryId: plumberCategoryId,
    professionId: plumberProfessionId,
    yearsOfExperience: 8,
    bio: 'سبّاك صحي بخبرة في كشف التسربات وتركيب السخانات والأدوات الصحية.',
    coverageAreas: ['حي الجامعة', 'دار الرماد'],
    ...overrides,
  };
}

/** ينشئ حسابًا كاملًا ويعيد معرّفاته وتوكنه. */
async function createProvider(overrides: { step1?: object; step2?: object } = {}) {
  const payload = {
    step1: { ...step1(), ...(overrides.step1 ?? {}) },
    step2: { ...step2(), ...(overrides.step2 ?? {}) },
  };

  const response = await registerProviderRoute(
    req('/api/v1/auth/register-provider', { method: 'POST', body: payload }),
    undefined
  );
  const body = await json(response);
  if (!body.success) {
    throw new Error(`فشل إنشاء المزوّد: ${JSON.stringify(body.error)}`);
  }

  const data = body.data as unknown as { user: { id: string }; providerId: string };
  const token = await tokenFor(data.user.id, 'PROVIDER', 'PENDING_REVIEW');

  return { userId: data.user.id, providerId: data.providerId, token, payload };
}

/** يرفع كل المستندات الإلزامية لمهنة المزوّد مباشرة في قاعدة البيانات. */
async function uploadRequiredDocuments(providerId: string) {
  const provider = await ServiceProvider.findById(providerId);
  const profession = await Profession.findById(provider?.professionId);
  const required = (profession?.documentRequirements ?? []).filter(
    (item) => item.isActive && item.required
  );

  for (const requirement of required) {
    await ProviderDocument.create({
      providerId: new Types.ObjectId(providerId),
      requirementKey: requirement.key,
      ...(requirement.customKey ? { customKey: requirement.customKey } : {}),
      label: requirement.label,
      media: {
        publicId: `khadamaty/documents/${providerId}/${requirement.key}`,
        url: 'https://res.cloudinary.com/demo/image/upload/v1/doc.jpg',
        format: 'jpg',
        bytes: 120_000,
        resourceType: 'image',
        accessMode: 'authenticated',
        uploadedAt: new Date(),
      },
    });
  }

  return required.length;
}

/* ================================================================== */

describe('POST /api/v1/auth/register-provider', () => {
  it('ينشئ الحساب في حالة DRAFT لا PENDING_REVIEW', async () => {
    const { providerId } = await createProvider();

    const provider = await ServiceProvider.findById(providerId);
    expect(provider?.verification.status).toBe('DRAFT');
    expect(provider?.isActive).toBe(false);
    expect(provider?.isVerifiedBadge).toBe(false);
  });

  it('يولّد رقم طلب بصيغة SRV-YYYY-NNNNNN', async () => {
    const { providerId } = await createProvider();
    const provider = await ServiceProvider.findById(providerId);
    expect(provider?.verification.requestNumber).toMatch(/^SRV-\d{4}-\d{6}$/);
  });

  it('يعطي كل طلب رقمًا مختلفًا', async () => {
    const first = await createProvider();
    const second = await createProvider();

    const [a, b] = await Promise.all([
      ServiceProvider.findById(first.providerId),
      ServiceProvider.findById(second.providerId),
    ]);
    expect(a?.verification.requestNumber).not.toBe(b?.verification.requestNumber);
  });

  it('ينشئ المستخدم بدور PROVIDER وحالة PENDING_REVIEW', async () => {
    const { userId } = await createProvider();
    const user = await User.findById(userId);
    expect(user?.role).toBe('PROVIDER');
    expect(user?.status).toBe('PENDING_REVIEW');
  });

  it('يرفض بريدًا مكرّرًا', async () => {
    const first = await createProvider();
    const email = (first.payload.step1 as { email: string }).email;

    const response = await registerProviderRoute(
      req('/api/v1/auth/register-provider', {
        method: 'POST',
        body: { step1: step1({ email }), step2: step2() },
      }),
      undefined
    );
    expect(response.status).toBe(409);
  });

  it('يرفض كلمتي مرور غير متطابقتين', async () => {
    const response = await registerProviderRoute(
      req('/api/v1/auth/register-provider', {
        method: 'POST',
        body: { step1: step1({ confirmPassword: 'Different123' }), step2: step2() },
      }),
      undefined
    );
    expect(response.status).toBe(400);
    expect((await json(response)).error?.fields?.['step1.confirmPassword']).toBeTruthy();
  });

  it('يرفض بريدًا ناقصًا — إلزامي لمقدم الخدمة بعكس العميل', async () => {
    const values = step1();
    delete (values as { email?: string }).email;

    const response = await registerProviderRoute(
      req('/api/v1/auth/register-provider', { method: 'POST', body: { step1: values, step2: step2() } }),
      undefined
    );
    expect(response.status).toBe(400);
  });

  it('يرفض منطقة تغطية خارج قائمة الفيوم', async () => {
    const response = await registerProviderRoute(
      req('/api/v1/auth/register-provider', {
        method: 'POST',
        body: { step1: step1(), step2: step2({ coverageAreas: ['المعادي'] }) },
      }),
      undefined
    );
    expect(response.status).toBe(400);
  });

  it('يرفض تخصصًا لا ينتمي للتصنيف المُرسَل', async () => {
    const response = await registerProviderRoute(
      req('/api/v1/auth/register-provider', {
        method: 'POST',
        body: {
          step1: step1(),
          step2: step2({ categoryId: doctorCategoryId, professionId: plumberProfessionId }),
        },
      }),
      undefined
    );
    expect(response.status).toBe(422);
  });

  it('يرفض أي مفتاح سعر — التسعير أُزيل من مخطط التسجيل', async () => {
    const response = await registerProviderRoute(
      req('/api/v1/auth/register-provider', {
        method: 'POST',
        body: { step1: step1(), step2: step2({ priceMode: 'RANGE' }) },
      }),
      undefined
    );
    expect(response.status).toBe(400);
  });

  it('يرفض محاولة تمرير حالة توثيق مع بيانات التسجيل', async () => {
    const response = await registerProviderRoute(
      req('/api/v1/auth/register-provider', {
        method: 'POST',
        body: {
          step1: step1(),
          step2: step2(),
          verification: { status: 'APPROVED' },
        },
      }),
      undefined
    );
    expect(response.status).toBe(400);
  });

  it('لا يظهر المزوّد الجديد في نتائج البحث', async () => {
    await createProvider({ step1: { fullName: 'مزوّد مسودة فريد' } });

    const response = await searchRoute(
      req(`/api/v1/search?q=${encodeURIComponent('مزوّد مسودة فريد')}`),
      undefined
    );
    const data = (await json(response)).data as unknown as {
      providers: { displayName: string }[];
    };
    expect(data.providers).toEqual([]);
  });
});

/* ================================================================== */

describe('GET /api/v1/provider/profile', () => {
  it('يعيد حالة التوثيق ونسبة الاكتمال وحالة المستندات', async () => {
    const { token } = await createProvider();

    const response = await getProfileRoute(req('/api/v1/provider/profile', { token }), undefined);
    const profile = (await json(response)).data as unknown as {
      verification: { status: string; requestNumber: string };
      profileCompletion: number;
      canAcceptOrders: boolean;
      documents: { requiredTotal: number; isComplete: boolean; missingRequired: string[] };
    };

    expect(response.status).toBe(200);
    expect(profile.verification.status).toBe('DRAFT');
    expect(profile.profileCompletion).toBeGreaterThan(0);
    expect(profile.profileCompletion).toBeLessThan(100);
    expect(profile.documents.isComplete).toBe(false);
    expect(profile.documents.requiredTotal).toBeGreaterThan(0);
  });

  it('يمنع الوصول بلا جلسة', async () => {
    const response = await getProfileRoute(req('/api/v1/provider/profile'), undefined);
    expect(response.status).toBe(401);
  });

  it('يمنع العميل من قراءة ملف مزوّد', async () => {
    const customer = await User.create({
      role: 'CUSTOMER',
      fullName: 'عميل عادي',
      phone: uniquePhone().replace(/^0/, '+20'),
      passwordHash: 'x'.repeat(20),
      status: 'ACTIVE',
    });
    const token = await tokenFor(String(customer._id), 'CUSTOMER');

    const response = await getProfileRoute(req('/api/v1/provider/profile', { token }), undefined);
    expect(response.status).toBe(403);
  });
});

/* ================================================================== */

describe('PATCH /api/v1/provider/profile', () => {
  it('يعدّل بيانات الخطوتين 1 و2 أثناء المسودة', async () => {
    const { token } = await createProvider();

    const response = await patchProfileRoute(
      req('/api/v1/provider/profile', {
        method: 'PATCH',
        token,
        body: { bio: 'وصف محدّث لخدمات السباكة والصيانة بجودة عالية.', yearsOfExperience: 12 },
      }),
      undefined
    );
    const profile = (await json(response)).data as unknown as {
      bio: string;
      yearsOfExperience: number;
    };

    expect(response.status).toBe(200);
    expect(profile.yearsOfExperience).toBe(12);
    expect(profile.bio).toContain('محدّث');
  });

  it('يرفض تمرير verification.status', async () => {
    const { token } = await createProvider();

    const response = await patchProfileRoute(
      req('/api/v1/provider/profile', {
        method: 'PATCH',
        token,
        body: { verification: { status: 'APPROVED' } },
      }),
      undefined
    );
    expect(response.status).toBe(400);
  });

  it('يرفض تمرير isVerifiedBadge أو isActive', async () => {
    const { token } = await createProvider();

    for (const body of [{ isVerifiedBadge: true }, { isActive: true }]) {
      const response = await patchProfileRoute(
        req('/api/v1/provider/profile', { method: 'PATCH', token, body }),
        undefined
      );
      expect(response.status, JSON.stringify(body)).toBe(400);
    }
  });

  it('يمنع التعديل بعد إرسال الطلب', async () => {
    const { token, providerId } = await createProvider();
    await uploadRequiredDocuments(providerId);
    await submitRoute(
      req('/api/v1/provider/verification/submit', {
        method: 'POST',
        token,
        body: { acceptTerms: true },
      }),
      undefined
    );

    const response = await patchProfileRoute(
      req('/api/v1/provider/profile', { method: 'PATCH', token, body: { yearsOfExperience: 3 } }),
      undefined
    );
    expect(response.status).toBe(403);
  });
});

/* ================================================================== */

describe('POST /api/v1/provider/verification/submit', () => {
  it('يرفض الإرسال قبل رفع المستندات الإلزامية', async () => {
    const { token } = await createProvider();

    const response = await submitRoute(
      req('/api/v1/provider/verification/submit', {
        method: 'POST',
        token,
        body: { acceptTerms: true },
      }),
      undefined
    );
    const body = await json(response);

    expect(response.status).toBe(422);
    expect(body.error?.message).toContain('مستندات إلزامية');
  });

  it('يرفض الإرسال بلا إقرار', async () => {
    const { token, providerId } = await createProvider();
    await uploadRequiredDocuments(providerId);

    const response = await submitRoute(
      req('/api/v1/provider/verification/submit', {
        method: 'POST',
        token,
        body: { acceptTerms: false },
      }),
      undefined
    );
    expect(response.status).toBe(400);
  });

  it('يعتمد الحساب تلقائيًا (APPROVED) ويسجّله وينشئ إشعارًا', async () => {
    const { token, providerId, userId } = await createProvider();
    await uploadRequiredDocuments(providerId);

    const response = await submitRoute(
      req('/api/v1/provider/verification/submit', {
        method: 'POST',
        token,
        body: { acceptTerms: true },
      }),
      undefined
    );
    const profile = (await json(response)).data as unknown as {
      verification: { status: string; submittedAt: string };
      documents: { isComplete: boolean };
    };

    expect(response.status).toBe(200);
    expect(profile.verification.status).toBe('APPROVED');
    expect(profile.documents.isComplete).toBe(true);

    const log = await AuditLog.findOne({
      action: 'PROVIDER_VERIFICATION_CHANGED',
      entityId: new Types.ObjectId(providerId),
    });
    expect(log).toBeTruthy();

    const notification = await Notification.findOne({
      userId: new Types.ObjectId(userId),
      type: 'PROVIDER_REGISTRATION_SUBMITTED',
    });
    expect(notification?.body).toMatch(/SRV-\d{4}-\d{6}/);
  });

  it('يرفض الإرسال مرتين', async () => {
    const { token, providerId } = await createProvider();
    await uploadRequiredDocuments(providerId);

    const body = { acceptTerms: true };
    await submitRoute(
      req('/api/v1/provider/verification/submit', { method: 'POST', token, body }),
      undefined
    );
    const second = await submitRoute(
      req('/api/v1/provider/verification/submit', { method: 'POST', token, body }),
      undefined
    );

    expect(second.status).toBe(409);
  });

  it('المزوّد يظهر ويستقبل طلبات فور الإرسال — تفعيل تلقائي', async () => {
    const { token, providerId } = await createProvider({
      step1: { fullName: 'مزوّد مفعَّل تلقائيًا للاختبار' },
    });
    await uploadRequiredDocuments(providerId);
    await submitRoute(
      req('/api/v1/provider/verification/submit', {
        method: 'POST',
        token,
        body: { acceptTerms: true },
      }),
      undefined
    );

    // 1) يظهر في قائمة المزوّدين العامة بلا أي قرار إداري
    const list = await providersRoute(req('/api/v1/providers?limit=50'), undefined);
    const items = (await json(list)).data as unknown as { id: string }[];
    expect(items.some((item) => item.id === providerId)).toBe(true);

    // 2) الـAPI نفسها تقول إنه يستطيع استقبال طلبات
    const profile = await getProfileRoute(req('/api/v1/provider/profile', { token }), undefined);
    const data = (await json(profile)).data as unknown as { canAcceptOrders: boolean };
    expect(data.canAcceptOrders).toBe(true);
  });

  it('مزوّد لم يُرسل طلبه (DRAFT) لا يظهر ولا يستقبل طلبات', async () => {
    const { token, providerId } = await createProvider({
      step1: { fullName: 'مزوّد مسودة للاختبار' },
    });

    const list = await providersRoute(req('/api/v1/providers?limit=50'), undefined);
    const items = (await json(list)).data as unknown as { id: string }[];
    expect(items.some((item) => item.id === providerId)).toBe(false);

    const profile = await getProfileRoute(req('/api/v1/provider/profile', { token }), undefined);
    const data = (await json(profile)).data as unknown as { canAcceptOrders: boolean };
    expect(data.canAcceptOrders).toBe(false);
  });
});

/* ================================================================== */

describe('مستندات المهن مختلفة حسب المهنة', () => {
  it('السبّاك والطبيب سواء: الهوية وحدها إلزامية في المهنتين', async () => {
    const plumber = await createProvider();
    const doctor = await createProvider({
      step2: { categoryId: doctorCategoryId, professionId: doctorProfessionId },
    });

    const plumberCount = await uploadRequiredDocuments(plumber.providerId);
    const doctorCount = await uploadRequiredDocuments(doctor.providerId);

    expect(plumberCount).toBe(1);
    expect(doctorCount).toBe(1);

    const doctorKeys = (await ProviderDocument.find({ providerId: doctor.providerId })).map(
      (doc) => doc.requirementKey
    );
    expect(doctorKeys).toEqual(['NATIONAL_ID']);
  });

  it('طلب الطبيب يمرّ بالهوية وحدها — المؤهل والترخيص اختياريان', async () => {
    const doctor = await createProvider({
      step2: { categoryId: doctorCategoryId, professionId: doctorProfessionId },
    });
    await uploadRequiredDocuments(doctor.providerId);

    const response = await submitRoute(
      req('/api/v1/provider/verification/submit', {
        method: 'POST',
        token: doctor.token,
        body: { acceptTerms: true },
      }),
      undefined
    );
    expect(response.status).toBe(200);
  });

  it('طلب بلا بطاقة رقم قومي يُرفض بـ422', async () => {
    const doctor = await createProvider({
      step2: { categoryId: doctorCategoryId, professionId: doctorProfessionId },
    });
    await uploadRequiredDocuments(doctor.providerId);
    await ProviderDocument.deleteOne({
      providerId: new Types.ObjectId(doctor.providerId),
      requirementKey: 'NATIONAL_ID',
    });

    const response = await submitRoute(
      req('/api/v1/provider/verification/submit', {
        method: 'POST',
        token: doctor.token,
        body: { acceptTerms: true },
      }),
      undefined
    );
    expect(response.status).toBe(422);
  });
});

/* ================================================================== */

describe('لوحة الإدارة — التوثيق', () => {
  async function submittedProvider(name: string) {
    const created = await createProvider({ step1: { fullName: name } });
    await uploadRequiredDocuments(created.providerId);
    await submitRoute(
      req('/api/v1/provider/verification/submit', {
        method: 'POST',
        token: created.token,
        body: { acceptTerms: true },
      }),
      undefined
    );
    return created;
  }

  it('طابور المراجعة محروس بـADMIN', async () => {
    const provider = await createProvider();

    expect((await adminQueueRoute(req('/api/v1/admin/providers'), undefined)).status).toBe(401);
    expect(
      (await adminQueueRoute(req('/api/v1/admin/providers', { token: provider.token }), undefined))
        .status
    ).toBe(403);
  });

  it('يعرض الطلبات المرسلة فقط لا المسودات', async () => {
    const draft = await createProvider({ step1: { fullName: 'مسودة لا تظهر' } });
    const submitted = await submittedProvider('طلب مرسل يظهر');
    const token = await tokenFor(adminId, 'ADMIN');

    // الإرسال يعتمد الحساب تلقائيًا، فالطلبات المرسلة تُقرأ بحالة APPROVED
    const response = await adminQueueRoute(
      req('/api/v1/admin/providers', { token, query: '?status=APPROVED&limit=50' }),
      undefined
    );
    const items = (await json(response)).data as unknown as { id: string }[];

    expect(items.some((item) => item.id === submitted.providerId)).toBe(true);
    expect(items.some((item) => item.id === draft.providerId)).toBe(false);
  });

  it('تفاصيل الطلب تعرض المستندات بلا روابط مباشرة', async () => {
    const provider = await submittedProvider('مزوّد للتفاصيل');
    const token = await tokenFor(adminId, 'ADMIN');

    const response = await adminDetailRoute(
      req(`/api/v1/admin/providers/${provider.providerId}`, { token }),
      ctx(provider.providerId)
    );
    const raw = await response.text();

    expect(response.status).toBe(200);
    expect(raw).not.toContain('res.cloudinary.com');
    expect(raw).toContain('NATIONAL_ID');
  });

  it('الاعتماد يفعّل الحساب ويمنح الشارة ويُظهره في البحث', async () => {
    const provider = await submittedProvider('كهربائي معتمد حديثًا');
    const token = await tokenFor(adminId, 'ADMIN');

    const response = await decideRoute(
      req(`/api/v1/admin/providers/${provider.providerId}/verification`, {
        method: 'PATCH',
        token,
        body: { status: 'APPROVED' },
      }),
      ctx(provider.providerId)
    );
    expect(response.status).toBe(200);

    const updated = await ServiceProvider.findById(provider.providerId);
    expect(updated?.verification.status).toBe('APPROVED');
    expect(updated?.isActive).toBe(true);
    expect(updated?.isVerifiedBadge).toBe(true);

    const user = await User.findById(provider.userId);
    expect(user?.status).toBe('ACTIVE');

    // يظهر الآن في القائمة العامة
    const list = await providersRoute(req('/api/v1/providers?limit=50'), undefined);
    const items = (await json(list)).data as unknown as { id: string }[];
    expect(items.some((item) => item.id === provider.providerId)).toBe(true);
  });

  it('الرفض يوقف الحساب ويسجّل السبب ويُخطر المزوّد', async () => {
    const provider = await submittedProvider('مزوّد مرفوض');
    const token = await tokenFor(adminId, 'ADMIN');

    await decideRoute(
      req(`/api/v1/admin/providers/${provider.providerId}/verification`, {
        method: 'PATCH',
        token,
        body: { status: 'REJECTED', reason: 'صورة البطاقة غير واضحة.' },
      }),
      ctx(provider.providerId)
    );

    const updated = await ServiceProvider.findById(provider.providerId);
    expect(updated?.verification.status).toBe('REJECTED');
    expect(updated?.isActive).toBe(false);
    expect(updated?.verification.rejectionReason).toContain('غير واضحة');

    const notification = await Notification.findOne({
      userId: new Types.ObjectId(provider.userId),
      type: 'PROVIDER_REJECTED',
    });
    expect(notification?.body).toContain('غير واضحة');
  });

  it('طلب إعادة الإرسال يعيد فتح التعديل للمزوّد', async () => {
    const provider = await submittedProvider('مزوّد إعادة إرسال');
    const token = await tokenFor(adminId, 'ADMIN');

    await decideRoute(
      req(`/api/v1/admin/providers/${provider.providerId}/verification`, {
        method: 'PATCH',
        token,
        body: { status: 'RESUBMISSION_REQUIRED', reason: 'أضف ترخيصًا ساريًا.' },
      }),
      ctx(provider.providerId)
    );

    const patch = await patchProfileRoute(
      req('/api/v1/provider/profile', {
        method: 'PATCH',
        token: provider.token,
        body: { bio: 'وصف مُحدَّث بعد طلب الإدارة إعادة الإرسال للمراجعة.' },
      }),
      undefined
    );
    expect(patch.status).toBe(200);
  });

  it('يرفض الرفض بلا سبب', async () => {
    const provider = await submittedProvider('مزوّد بلا سبب');
    const token = await tokenFor(adminId, 'ADMIN');

    const response = await decideRoute(
      req(`/api/v1/admin/providers/${provider.providerId}/verification`, {
        method: 'PATCH',
        token,
        body: { status: 'REJECTED' },
      }),
      ctx(provider.providerId)
    );
    expect(response.status).toBe(400);
  });

  it('يرفض قرارًا على مسودة لم تُرسَل', async () => {
    const draft = await createProvider();
    const token = await tokenFor(adminId, 'ADMIN');

    const response = await decideRoute(
      req(`/api/v1/admin/providers/${draft.providerId}/verification`, {
        method: 'PATCH',
        token,
        body: { status: 'APPROVED' },
      }),
      ctx(draft.providerId)
    );
    expect(response.status).toBe(409);
  });

  it('يرفض حالة خارج القرارات الثلاثة', async () => {
    const provider = await submittedProvider('مزوّد حالة خاطئة');
    const token = await tokenFor(adminId, 'ADMIN');

    const response = await decideRoute(
      req(`/api/v1/admin/providers/${provider.providerId}/verification`, {
        method: 'PATCH',
        token,
        body: { status: 'DRAFT' },
      }),
      ctx(provider.providerId)
    );
    expect(response.status).toBe(400);
  });

  it('مقدم خدمة لا يستطيع اتخاذ قرار على نفسه', async () => {
    const provider = await submittedProvider('مزوّد يحاول اعتماد نفسه');

    const response = await decideRoute(
      req(`/api/v1/admin/providers/${provider.providerId}/verification`, {
        method: 'PATCH',
        token: provider.token,
        body: { status: 'APPROVED' },
      }),
      ctx(provider.providerId)
    );
    expect(response.status).toBe(403);

    const untouched = await ServiceProvider.findById(provider.providerId);
    expect(untouched?.verification.status).toBe('APPROVED');
  });

  it('كل قرار يُسجَّل في auditLogs بحالته قبل وبعد', async () => {
    const provider = await submittedProvider('مزوّد للتدقيق');
    const token = await tokenFor(adminId, 'ADMIN');

    await decideRoute(
      req(`/api/v1/admin/providers/${provider.providerId}/verification`, {
        method: 'PATCH',
        token,
        body: { status: 'APPROVED' },
      }),
      ctx(provider.providerId)
    );

    const log = await AuditLog.findOne({
      entityId: new Types.ObjectId(provider.providerId),
      actorId: new Types.ObjectId(adminId),
    }).sort({ createdAt: -1 });

    expect(log?.action).toBe('PROVIDER_VERIFICATION_CHANGED');
    expect(log?.before).toMatchObject({ status: 'APPROVED' });
    expect(log?.after).toMatchObject({ status: 'APPROVED', isActive: true });
  });
});

/* ================================================================== */

describe('E2E — من التسجيل إلى الظهور في البحث', () => {
  it('تسجيل كامل ← إرسال ← تفعيل تلقائي ← ظهور في نتائج البحث', async () => {
    const name = 'ورشة النور للكهرباء';
    const created = await createProvider({ step1: { fullName: name } });
    const adminToken = await tokenFor(adminId, 'ADMIN');

    /*
     * نفحص غياب **هذا** المزوّد بمعرّفه لا فراغ النتائج: البحث الجزئي قد
     * يطابق مزوّدين آخرين يشاركونه كلمة في الاسم («ورشة»).
     */
    const isListed = async () => {
      const response = await searchRoute(
        req(`/api/v1/search?q=${encodeURIComponent(name)}`),
        undefined
      );
      const data = (await json(response)).data as unknown as { providers: { id: string }[] };
      return data.providers.some((item) => item.id === created.providerId);
    };

    // 1) قبل الإرسال: لا يظهر
    expect(await isListed()).toBe(false);

    // 2) رفع المستندات وإرسال الطلب
    await uploadRequiredDocuments(created.providerId);
    const submit = await submitRoute(
      req('/api/v1/provider/verification/submit', {
        method: 'POST',
        token: created.token,
        body: { acceptTerms: true },
      }),
      undefined
    );
    expect(submit.status).toBe(200);

    // 3) الإرسال وحده يُظهره — لا قرار إداري بينهما
    expect(await isListed()).toBe(true);

    // 4) ورقابة الإدارة **بعدية**: الرفض يُخفيه مجددًا
    await decideRoute(
      req(`/api/v1/admin/providers/${created.providerId}/verification`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'REJECTED', reason: 'مخالفة الشروط' },
      }),
      ctx(created.providerId)
    );
    expect(await isListed()).toBe(false);

    // 5) وإعادة الاعتماد تُظهره من جديد
    await decideRoute(
      req(`/api/v1/admin/providers/${created.providerId}/verification`, {
        method: 'PATCH',
        token: adminToken,
        body: { status: 'APPROVED' },
      }),
      ctx(created.providerId)
    );
    expect(await isListed()).toBe(true);

    // 6) وهو قادر على استقبال الطلبات
    const activeToken = await tokenFor(created.userId, 'PROVIDER', 'ACTIVE');
    const profile = await getProfileRoute(
      req('/api/v1/provider/profile', { token: activeToken }),
      undefined
    );
    const data = (await json(profile)).data as unknown as {
      canAcceptOrders: boolean;
      profileCompletion: number;
    };
    expect(data.canAcceptOrders).toBe(true);
    expect(data.profileCompletion).toBeGreaterThanOrEqual(80);
  });
});
