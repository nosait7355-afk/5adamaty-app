import { beforeAll, describe, expect, it } from 'vitest';
import { assertSameOrigin } from '@/server/lib/csrf';
import { getSession, requireAuth, requireRole } from '@/server/middleware/with-auth';
import { signAccessToken, signRefreshToken, verifyAccessToken } from '@/server/lib/jwt';
import { ACCESS_COOKIE, readTokenFromRequest } from '@/server/lib/cookies';
import {
  generateToken,
  hashPassword,
  hashToken,
  safeCompare,
  verifyPassword,
} from '@/server/lib/password';
import { normalizeIdentifier } from '@/shared/schemas/auth.schema';

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters-long!!';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters-long!';
  process.env.APP_URL = 'http://localhost:3000';
});

/* ================================================================== */

describe('تجزئة كلمة المرور', () => {
  it('تنتج تجزئة argon2id لا نصًا صريحًا', async () => {
    const hashed = await hashPassword('MyPassword123');
    expect(hashed).toMatch(/^\$argon2id\$/);
    expect(hashed).not.toContain('MyPassword123');
  });

  it('تنتج تجزئة مختلفة لنفس كلمة المرور (salt عشوائي)', async () => {
    const [a, b] = await Promise.all([hashPassword('Same12345'), hashPassword('Same12345')]);
    expect(a).not.toBe(b);
  });

  it('تتحقق بنجاح من كلمة المرور الصحيحة', async () => {
    const hashed = await hashPassword('Correct123');
    expect(await verifyPassword('Correct123', hashed)).toBe(true);
  });

  it('ترفض كلمة المرور الخاطئة', async () => {
    const hashed = await hashPassword('Correct123');
    expect(await verifyPassword('Wrong12345', hashed)).toBe(false);
  });

  it('ترفض التجزئة التالفة بلا رمي استثناء', async () => {
    expect(await verifyPassword('anything', 'not-a-valid-hash')).toBe(false);
    expect(await verifyPassword('anything', '')).toBe(false);
  });
});

describe('توكنات إعادة التعيين', () => {
  it('تولّد توكنات فريدة وطويلة', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateToken(32)));
    expect(tokens.size).toBe(50);
    for (const token of tokens) expect(token.length).toBeGreaterThanOrEqual(40);
  });

  it('التجزئة ثابتة وأحادية الاتجاه', () => {
    const token = generateToken();
    const hashed = hashToken(token);

    expect(hashed).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).toBe(hashed);
    expect(hashed).not.toContain(token);
  });

  it('المقارنة الثابتة الزمن تعمل بشكل صحيح', () => {
    expect(safeCompare('abc123', 'abc123')).toBe(true);
    expect(safeCompare('abc123', 'abc124')).toBe(false);
    // أطوال مختلفة لا ترمي
    expect(safeCompare('short', 'muchlongervalue')).toBe(false);
  });
});

describe('فحص المصدر (CSRF)', () => {
  const post = (headers: Record<string, string>) =>
    new Request('http://localhost:3000/api/v1/auth/login', { method: 'POST', headers });

  it('يتجاهل طلبات القراءة', () => {
    const get = new Request('http://localhost:3000/api/v1/categories', {
      headers: { origin: 'https://evil.example.com' },
    });
    expect(() => assertSameOrigin(get)).not.toThrow();
  });

  it('يقبل المصدر المعروف', () => {
    expect(() => assertSameOrigin(post({ origin: 'http://localhost:3000' }))).not.toThrow();
  });

  it('يرفض المصدر الخارجي', () => {
    expect(() => assertSameOrigin(post({ origin: 'https://evil.example.com' }))).toThrow(
      /غير مصرّح/
    );
  });

  it('يقبل مصادر Capacitor لتطبيق أندرويد', () => {
    for (const origin of ['capacitor://localhost', 'https://localhost']) {
      expect(() => assertSameOrigin(post({ origin }))).not.toThrow();
    }
  });

  it('يعود إلى referer عند غياب origin', () => {
    expect(() =>
      assertSameOrigin(post({ referer: 'http://localhost:3000/login' }))
    ).not.toThrow();

    expect(() => assertSameOrigin(post({ referer: 'https://evil.example.com/x' }))).toThrow(
      /غير مصرّح/
    );
  });

  it('يسمح بغياب origin و referer معًا (عملاء غير المتصفح)', () => {
    expect(() => assertSameOrigin(post({}))).not.toThrow();
  });

  it('يرفض referer تالفًا', () => {
    expect(() => assertSameOrigin(post({ referer: 'not-a-url' }))).toThrow(/غير مصرّح/);
  });
});

describe('استخراج الجلسة', () => {
  async function requestWithToken(token: string) {
    return new Request('http://localhost:3000/api/v1/auth/me', {
      headers: { cookie: `${ACCESS_COOKIE}=${token}` },
    });
  }

  it('يقرأ الجلسة من كوكي صالحة', async () => {
    const token = await signAccessToken({ userId: 'u1', role: 'CUSTOMER', status: 'ACTIVE' });
    const session = await getSession(await requestWithToken(token));

    expect(session).toEqual({ id: 'u1', role: 'CUSTOMER', status: 'ACTIVE' });
  });

  it('يعيد null بلا كوكي', async () => {
    expect(await getSession(new Request('http://localhost:3000/x'))).toBeNull();
  });

  it('يعيد null لتوكن مُعدَّل', async () => {
    const token = await signAccessToken({ userId: 'u1', role: 'CUSTOMER', status: 'ACTIVE' });
    const tampered = `${token.slice(0, -4)}AAAA`;
    expect(await getSession(await requestWithToken(tampered))).toBeNull();
  });

  it('🔐 لا يقبل توكن التحديث كتوكن وصول', async () => {
    const refresh = await signRefreshToken({ userId: 'u1', sessionId: 's1' });
    expect(await getSession(await requestWithToken(refresh))).toBeNull();
  });

  it('لا يقرأ التوكن من رأس Authorization', async () => {
    const token = await signAccessToken({ userId: 'u1', role: 'CUSTOMER', status: 'ACTIVE' });
    const request = new Request('http://localhost:3000/x', {
      headers: { authorization: `Bearer ${token}` },
    });
    // الكوكي httpOnly هي المصدر الوحيد
    expect(await getSession(request)).toBeNull();
  });

  it('يستخرج الكوكي الصحيحة من بين عدة كوكيز', () => {
    const request = new Request('http://localhost:3000/x', {
      headers: { cookie: `other=1; ${ACCESS_COOKIE}=my-token; another=2` },
    });
    expect(readTokenFromRequest(request, ACCESS_COOKIE)).toBe('my-token');
  });
});

describe('حُرّاس الأدوار', () => {
  async function authed(role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN', status = 'ACTIVE') {
    const token = await signAccessToken({ userId: 'u1', role, status });
    return new Request('http://localhost:3000/x', {
      headers: { cookie: `${ACCESS_COOKIE}=${token}` },
    });
  }

  it('requireAuth يرفض بلا جلسة', async () => {
    await expect(requireAuth(new Request('http://localhost:3000/x'))).rejects.toThrow(
      /تسجيل الدخول/
    );
  });

  it('requireAuth يرفض الحساب الموقوف', async () => {
    await expect(requireAuth(await authed('CUSTOMER', 'SUSPENDED'))).rejects.toThrow(
      /إيقاف حسابك/
    );
  });

  it('requireRole يقبل الدور المسموح', async () => {
    const user = await requireRole(await authed('ADMIN'), 'ADMIN');
    expect(user.role).toBe('ADMIN');
  });

  it('requireRole يرفض الدور غير المسموح', async () => {
    await expect(requireRole(await authed('CUSTOMER'), 'ADMIN')).rejects.toThrow(/صلاحية/);
  });

  it('🔐 العميل لا يستطيع انتحال دور المزوّد أو الإدارة', async () => {
    const customer = await authed('CUSTOMER');
    await expect(requireRole(customer, 'PROVIDER')).rejects.toThrow();
    await expect(requireRole(customer, 'ADMIN')).rejects.toThrow();
    await expect(requireRole(customer, 'PROVIDER', 'ADMIN')).rejects.toThrow();
  });
});

describe('تطبيع المعرّف', () => {
  it('يميّز البريد', () => {
    expect(normalizeIdentifier('Ahmed@Example.COM')).toEqual({ email: 'ahmed@example.com' });
  });

  it('يميّز الهاتف ويطبّعه', () => {
    expect(normalizeIdentifier('01012345678')).toEqual({ phone: '+201012345678' });
    expect(normalizeIdentifier('+20 101 234 5678')).toEqual({ phone: '+201012345678' });
  });

  it('يرفض المعرّفات غير الصالحة', () => {
    expect(normalizeIdentifier('abc')).toBeNull();
    expect(normalizeIdentifier('not-an-email@')).toBeNull();
    expect(normalizeIdentifier('12345')).toBeNull();
  });

  it('🔐 يرفض محاولات حقن NoSQL في المعرّف', () => {
    expect(normalizeIdentifier('{"$ne":null}')).toBeNull();
    expect(normalizeIdentifier('$gt')).toBeNull();
  });
});

describe('محتوى توكن الوصول', () => {
  it('يحمل الحد الأدنى من البيانات فقط', async () => {
    const token = await signAccessToken({ userId: 'u1', role: 'PROVIDER', status: 'ACTIVE' });
    const claims = await verifyAccessToken(token);

    expect(Object.keys(claims ?? {}).sort()).toEqual(
      ['aud', 'exp', 'iat', 'iss', 'role', 'status', 'sub'].sort()
    );
  });

  it('ينتهي خلال 15 دقيقة', async () => {
    const token = await signAccessToken({ userId: 'u1', role: 'CUSTOMER', status: 'ACTIVE' });
    const claims = await verifyAccessToken(token);

    const lifetime = (claims!.exp as number) - (claims!.iat as number);
    expect(lifetime).toBe(15 * 60);
  });
});
