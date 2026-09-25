import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildAllIndexes, startTestDb, stopTestDb } from '../helpers/db';

/*
 * `setSessionCookies` تستدعي `cookies()` من next/headers المتاحة داخل نطاق
 * طلب Next فقط. نستبدل المخزن بواحد في الذاكرة — وهو هنا ليس تفصيلًا
 * جانبيًا: الجلسة الجديدة الصادرة عند تحوّل الدور تُكتب فيه، ونقرأ منه
 * لنتحقق أن التوكن الجديد يحمل `PROVIDER` فعلًا.
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
import { Favorite, Profession, ProviderDocument, ServiceProvider, User } from '@/server/db/models';
import { resetRateLimitStore } from '@/server/middleware/with-rate-limit';
import { signAccessToken, verifyAccessToken } from '@/server/lib/jwt';
import { hashPassword } from '@/server/lib/password';

import { POST as becomeProviderRoute } from '@/app/api/v1/me/become-provider/route';
import { POST as submitRoute } from '@/app/api/v1/provider/verification/submit/route';
import { GET as getProfileRoute } from '@/app/api/v1/provider/profile/route';
import { GET as favoritesRoute } from '@/app/api/v1/me/favorites/route';

/**
 * تحويل عميل قائم إلى مقدم خدمة.
 *
 * المحور الذي تدور حوله كل الاختبارات: **الدور لا يتغيّر إلا بنجاح
 * الإرسال**. من يتوقف في المنتصف يبقى عميلًا كامل الصلاحيات، ومن يُتمّ
 * يحصل على جلسة جديدة تحمل دوره الجديد فورًا — لا بعد انتهاء صلاحية
 * التوكن القديم.
 */

let plumberProfessionId = '';
let plumberCategoryId = '';

beforeAll(async () => {
  await startTestDb();
  await buildAllIndexes();
  await runSeed();

  process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters-long!!';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters-long!';
  process.env.APP_URL = 'http://localhost:3000';

  const plumber = await Profession.findOne({ slug: 'plumber' });
  plumberProfessionId = String(plumber?._id);
  plumberCategoryId = String(plumber?.categoryId);
}, 90_000);

afterAll(async () => {
  await stopTestDb();
});

afterEach(() => {
  resetRateLimitStore();
  cookieJar.clear();
});

/* ================================================================== */
/* أدوات مساعدة                                                        */
/* ================================================================== */

let counter = 0;

/** عميل مسجَّل — بلا رقم هاتف افتراضيًا، وهو الوضع المسموح به فعلًا. */
async function makeCustomer(overrides: Record<string, unknown> = {}) {
  counter += 1;
  const user = await User.create({
    role: 'CUSTOMER',
    fullName: `عميل رقم ${counter}`,
    email: `customer${counter}@test.local`,
    passwordHash: await hashPassword('CustomerPass123'),
    status: 'ACTIVE',
    governorate: 'الفيوم',
    city: 'الفيوم',
    area: 'الفيوم',
    ...overrides,
  });
  return user;
}

function req(path: string, options: { method?: string; body?: unknown; token?: string } = {}) {
  const headers: Record<string, string> = {
    'x-forwarded-for': `10.7.0.${Math.floor(Math.random() * 250) + 1}`,
    origin: 'http://localhost:3000',
  };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.token) headers.cookie = `kf_at=${options.token}`;

  return new Request(`http://localhost:3000${path}`, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
}

interface Body {
  success: boolean;
  data?: never;
  error?: { code: string; message: string; fields?: Record<string, string> };
}

async function json(response: Response): Promise<Body> {
  return (await response.json()) as Body;
}

function conversionBody(overrides: Record<string, unknown> = {}) {
  counter += 1;
  return {
    fullName: 'محمد أحمد علي',
    phone: `0103000${String(1000 + counter)}`,
    whatsapp: `0103000${String(1000 + counter)}`,
    city: 'الفيوم',
    addressLine: 'شارع البحر بجوار المسجد',
    accountType: 'INDIVIDUAL',
    categoryId: plumberCategoryId,
    professionId: plumberProfessionId,
    yearsOfExperience: 5,
    bio: 'سباك بخبرة في التركيبات',
    coverageAreas: ['الفيوم'],
    ...overrides,
  };
}

/** يرفع الهوية الإلزامية مباشرةً في القاعدة — الرفع نفسه مُختبَر في مكانه. */
async function uploadNationalId(userId: string) {
  const provider = await ServiceProvider.findOne({ userId });
  await ProviderDocument.create({
    providerId: provider!._id,
    requirementKey: 'NATIONAL_ID',
    label: 'الهوية الشخصية',
    status: 'PENDING',
    media: {
      publicId: `khadamaty/documents/${userId}/id_${counter}`,
      url: 'https://res.cloudinary.com/demo/image/authenticated/id.jpg',
      format: 'jpg',
      bytes: 2048,
      resourceType: 'image',
      accessMode: 'authenticated',
      uploadedAt: new Date(),
    },
  });
}

/* ================================================================== */
/* الاختبارات                                                          */
/* ================================================================== */

describe('POST /api/v1/me/become-provider — بدء التحويل', () => {
  it('ينشئ ملف مزوّد بحالة مسودة ويكمل بيانات المستخدم', async () => {
    const customer = await makeCustomer();
    const token = await signAccessToken({
      userId: String(customer._id),
      role: 'CUSTOMER',
      status: 'ACTIVE',
    });

    const body = conversionBody();
    const response = await becomeProviderRoute(
      req('/api/v1/me/become-provider', { method: 'POST', body, token }), undefined
    );

    expect(response.status).toBe(200);

    const provider = await ServiceProvider.findOne({ userId: customer._id });
    expect(provider).not.toBeNull();
    expect(provider!.verification.status).toBe('DRAFT');
    expect(provider!.isActive).toBe(false);

    // الهاتف كان ناقصًا عند التسجيل كعميل
    const updated = await User.findById(customer._id);
    expect(updated!.phone).toBe(`+2${body.phone}`);
    expect(updated!.addressLine).toBe(body.addressLine);
  });

  it('🔒 لا يغيّر الدور — يبقى عميلًا حتى يرسل الطلب', async () => {
    const customer = await makeCustomer();
    const token = await signAccessToken({
      userId: String(customer._id),
      role: 'CUSTOMER',
      status: 'ACTIVE',
    });

    await becomeProviderRoute(
      req('/api/v1/me/become-provider', { method: 'POST', body: conversionBody(), token }), undefined
    );

    const updated = await User.findById(customer._id);
    expect(updated!.role).toBe('CUSTOMER');
    expect(updated!.status).toBe('ACTIVE');
  });

  it('لا ينشئ ملفين — الاستدعاء الثاني يحدّث المسودة القائمة', async () => {
    const customer = await makeCustomer();
    const token = await signAccessToken({
      userId: String(customer._id),
      role: 'CUSTOMER',
      status: 'ACTIVE',
    });

    await becomeProviderRoute(
      req('/api/v1/me/become-provider', { method: 'POST', body: conversionBody(), token }), undefined
    );
    const second = await becomeProviderRoute(
      req('/api/v1/me/become-provider', {
        method: 'POST',
        body: conversionBody({ bio: 'وصف محدَّث' }),
        token,
      }), undefined
    );

    expect(second.status).toBe(200);
    expect(await ServiceProvider.countDocuments({ userId: customer._id })).toBe(1);

    const provider = await ServiceProvider.findOne({ userId: customer._id });
    expect(provider!.bio).toBe('وصف محدَّث');
  });

  it('🔒 يرفض رقم هاتف مسجَّلًا بحساب آخر', async () => {
    const taken = await makeCustomer({ phone: '+201099887766' });
    expect(taken.phone).toBe('+201099887766');

    const customer = await makeCustomer();
    const token = await signAccessToken({
      userId: String(customer._id),
      role: 'CUSTOMER',
      status: 'ACTIVE',
    });

    const response = await becomeProviderRoute(
      req('/api/v1/me/become-provider', {
        method: 'POST',
        body: conversionBody({ phone: '01099887766' }),
        token,
      }), undefined
    );

    expect(response.status).toBe(409);
    expect(await ServiceProvider.countDocuments({ userId: customer._id })).toBe(0);
  });

  it('🔒 يرفض الزائر بلا جلسة', async () => {
    const response = await becomeProviderRoute(
      req('/api/v1/me/become-provider', { method: 'POST', body: conversionBody() }), undefined
    );
    expect(response.status).toBe(401);
  });

  it('يرفض تخصصًا لا ينتمي للتصنيف المُرسَل', async () => {
    const customer = await makeCustomer();
    const token = await signAccessToken({
      userId: String(customer._id),
      role: 'CUSTOMER',
      status: 'ACTIVE',
    });

    const doctor = await Profession.findOne({ slug: 'doctor' });
    const response = await becomeProviderRoute(
      req('/api/v1/me/become-provider', {
        method: 'POST',
        body: conversionBody({ professionId: String(doctor!._id) }),
        token,
      }), undefined
    );

    expect(response.status).toBe(422);
  });
});

describe('مساحة المزوّد أثناء التحويل', () => {
  it('صاحب المسودة يقرأ ملفه وهو ما يزال عميلًا', async () => {
    const customer = await makeCustomer();
    const token = await signAccessToken({
      userId: String(customer._id),
      role: 'CUSTOMER',
      status: 'ACTIVE',
    });

    await becomeProviderRoute(
      req('/api/v1/me/become-provider', { method: 'POST', body: conversionBody(), token }), undefined
    );

    const response = await getProfileRoute(req('/api/v1/provider/profile', { token }), undefined);
    expect(response.status).toBe(200);
  });

  it('🔒 عميل بلا مسودة يُمنع من مساحة المزوّد', async () => {
    const customer = await makeCustomer();
    const token = await signAccessToken({
      userId: String(customer._id),
      role: 'CUSTOMER',
      status: 'ACTIVE',
    });

    const response = await getProfileRoute(req('/api/v1/provider/profile', { token }), undefined);
    expect(response.status).toBe(403);
  });
});

describe('POST /provider/verification/submit — لحظة التحوّل', () => {
  async function convertedCustomer() {
    const customer = await makeCustomer();
    const token = await signAccessToken({
      userId: String(customer._id),
      role: 'CUSTOMER',
      status: 'ACTIVE',
    });

    await becomeProviderRoute(
      req('/api/v1/me/become-provider', { method: 'POST', body: conversionBody(), token }), undefined
    );
    await uploadNationalId(String(customer._id));

    return { customer, token };
  }

  it('يحوّل الدور إلى PROVIDER ويفعّل الملف', async () => {
    const { customer, token } = await convertedCustomer();

    const response = await submitRoute(
      req('/api/v1/provider/verification/submit', {
        method: 'POST',
        body: { acceptTerms: true },
        token,
      }), undefined
    );

    expect(response.status).toBe(200);

    const updated = await User.findById(customer._id);
    expect(updated!.role).toBe('PROVIDER');
    expect(updated!.status).toBe('ACTIVE');

    const provider = await ServiceProvider.findOne({ userId: customer._id });
    expect(provider!.verification.status).toBe('APPROVED');
    expect(provider!.isActive).toBe(true);
  });

  it('🔑 يصدر جلسة جديدة تحمل الدور الجديد — لا ينتظر انتهاء التوكن القديم', async () => {
    const { token } = await convertedCustomer();

    await submitRoute(
      req('/api/v1/provider/verification/submit', {
        method: 'POST',
        body: { acceptTerms: true },
        token,
      }), undefined
    );

    const fresh = cookieJar.get('kf_at');
    expect(fresh).toBeTruthy();
    expect(fresh).not.toBe(token);

    const claims = await verifyAccessToken(fresh!);
    expect(claims?.role).toBe('PROVIDER');
  });

  it('🔒 يرفض الإرسال بلا الهوية الإلزامية ويُبقي الحساب عميلًا', async () => {
    const customer = await makeCustomer();
    const token = await signAccessToken({
      userId: String(customer._id),
      role: 'CUSTOMER',
      status: 'ACTIVE',
    });

    await becomeProviderRoute(
      req('/api/v1/me/become-provider', { method: 'POST', body: conversionBody(), token }), undefined
    );

    const response = await submitRoute(
      req('/api/v1/provider/verification/submit', {
        method: 'POST',
        body: { acceptTerms: true },
        token,
      }), undefined
    );

    expect(response.status).toBe(422);
    expect((await json(response)).error?.message).toContain('الهوية');

    const updated = await User.findById(customer._id);
    expect(updated!.role).toBe('CUSTOMER');
  });

  it('بيانات العميل القديمة تبقى بعد التحوّل', async () => {
    const { customer, token } = await convertedCustomer();

    const provider = await ServiceProvider.findOne({ slug: undefined, isActive: true });
    await Favorite.create({ userId: customer._id, providerId: provider!._id });

    await submitRoute(
      req('/api/v1/provider/verification/submit', {
        method: 'POST',
        body: { acceptTerms: true },
        token,
      }), undefined
    );

    // التوكن الجديد يحمل PROVIDER — والمفضلة ما زالت تُقرأ بلا اعتراض
    const fresh = cookieJar.get('kf_at')!;
    const response = await favoritesRoute(req('/api/v1/me/favorites', { token: fresh }), undefined);

    expect(response.status).toBe(200);
    expect(await Favorite.countDocuments({ userId: customer._id })).toBe(1);
  });
});
