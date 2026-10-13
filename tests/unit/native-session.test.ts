import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/* كوكيز وهمية بدل `next/headers` — لا سياق طلب Next في الاختبارات */
const cookieJar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    set: (name: string, value: string) => cookieJar.set(name, value),
    get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined),
  }),
}));

import { getSession } from '@/server/middleware/with-auth';
import { signAccessToken } from '@/server/lib/jwt';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/server/lib/cookies';
import {
  deliverSession,
  isNativeClient,
  readPresentedRefreshToken,
  withSession,
} from '@/server/lib/session-transport';
import { proxy } from '@/proxy';

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters-long!!';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters-long!';
  process.env.APP_URL = 'http://localhost:3000';
});

beforeEach(() => cookieJar.clear());

const NATIVE = { 'x-client': 'native-app' };
const API = 'https://api.example.com/api/v1/auth/refresh';

/* ================================================================== */

describe('Bearer — تطبيق «خدمات الفيوم»', () => {
  it('يقرأ الجلسة من Authorization: Bearer', async () => {
    const token = await signAccessToken({ userId: 'u1', role: 'CUSTOMER', status: 'ACTIVE' });
    const session = await getSession(
      new Request(API, { headers: { authorization: `Bearer ${token}` } })
    );
    expect(session?.id).toBe('u1');
  });

  it('يفضّل Bearer الصريح على كوكي عالقة', async () => {
    const [bearer, cookie] = await Promise.all([
      signAccessToken({ userId: 'from-bearer', role: 'CUSTOMER', status: 'ACTIVE' }),
      signAccessToken({ userId: 'from-cookie', role: 'CUSTOMER', status: 'ACTIVE' }),
    ]);
    const session = await getSession(
      new Request(API, {
        headers: { authorization: `Bearer ${bearer}`, cookie: `${ACCESS_COOKIE}=${cookie}` },
      })
    );
    expect(session?.id).toBe('from-bearer');
  });

  it('يرفض Bearer بتوقيع خاطئ أو رأسًا مشوّهًا', async () => {
    expect(
      await getSession(new Request(API, { headers: { authorization: 'Bearer not.a.jwt' } }))
    ).toBeNull();
    expect(
      await getSession(new Request(API, { headers: { authorization: 'Basic abc' } }))
    ).toBeNull();
  });
});

describe('تسليم الجلسة', () => {
  const tokens = { accessToken: 'at', refreshToken: 'rt' };

  it('التطبيق: التوكنان في جسم الرد ولا كوكيز', async () => {
    const session = await deliverSession(new Request(API, { headers: NATIVE }), tokens, {
      remember: true,
    });
    expect(session).toMatchObject({ accessToken: 'at', refreshToken: 'rt' });
    expect(session?.accessTokenExpiresIn).toBeGreaterThan(0);
    expect(cookieJar.size).toBe(0);
    expect(withSession({ user: 1 }, session)).toHaveProperty('session.refreshToken', 'rt');
  });

  it('الموقع: كوكيز كما كانت ولا توكن في الرد', async () => {
    const session = await deliverSession(new Request(API), tokens, { remember: true });
    expect(session).toBeNull();
    expect(cookieJar.get(ACCESS_COOKIE)).toBe('at');
    expect(withSession({ user: 1 }, session)).toEqual({ user: 1 });
  });

  it('رأس غير مطابق لا يُعدّ تطبيقًا', () => {
    expect(isNativeClient(new Request(API, { headers: { 'x-client': 'web' } }))).toBe(false);
  });
});

describe('🔐 توكن التحديث — الوضعان لا يختلطان', () => {
  it('التطبيق يقرأ من الجسم ويتجاهل كوكي المتصفح', async () => {
    const request = new Request(API, {
      method: 'POST',
      headers: { ...NATIVE, cookie: `${REFRESH_COOKIE}=browser-token` },
      body: JSON.stringify({ refreshToken: 'app-token' }),
    });
    expect(await readPresentedRefreshToken(request)).toBe('app-token');
  });

  it('التطبيق بلا جسم لا يرث كوكي المتصفح', async () => {
    const request = new Request(API, {
      method: 'POST',
      headers: { ...NATIVE, cookie: `${REFRESH_COOKIE}=browser-token` },
    });
    expect(await readPresentedRefreshToken(request)).toBeNull();
  });

  it('الموقع يقرأ من الكوكي ويتجاهل الجسم', async () => {
    const request = new Request(API, {
      method: 'POST',
      headers: { cookie: `${REFRESH_COOKIE}=browser-token` },
      body: JSON.stringify({ refreshToken: 'injected' }),
    });
    expect(await readPresentedRefreshToken(request)).toBe('browser-token');
  });
});

describe('CORS للـAPI', () => {
  const preflight = (origin: string) =>
    proxy(
      new NextRequest(API, {
        method: 'OPTIONS',
        headers: { origin, 'access-control-request-method': 'POST' },
      })
    );

  it('يسمح لمصدر التطبيق مع رأسي Authorization وx-client', async () => {
    const response = await preflight('https://localhost');
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://localhost');
    expect(response.headers.get('access-control-allow-headers')).toMatch(/authorization/i);
    expect(response.headers.get('access-control-allow-headers')).toMatch(/x-client/i);
  });

  it('لا يسمح بالكوكيز عبر المصادر', async () => {
    const response = await preflight('https://localhost');
    expect(response.headers.get('access-control-allow-credentials')).toBeNull();
  });

  it('مصدر غريب لا يحصل على رؤوس السماح', async () => {
    const response = await preflight('https://evil.example');
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('طلب عادي من التطبيق يمرّ للمسار مع رأس السماح', async () => {
    const response = await proxy(
      new NextRequest('https://api.example.com/api/v1/categories', {
        headers: { origin: 'https://localhost' },
      })
    );
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get('access-control-allow-origin')).toBe('https://localhost');
  });
});
