import { beforeEach, describe, expect, it, vi } from 'vitest';

/* التخزين الآمن بديل في الذاكرة — الإضافة الأصلية لا تعمل خارج أندرويد */
const secure = new Map<string, unknown>();
vi.mock('@aparajita/capacitor-secure-storage', () => ({
  SecureStorage: {
    setKeyPrefix: async () => undefined,
    get: async (key: string) => secure.get(key) ?? null,
    set: async (key: string, value: unknown) => void secure.set(key, value),
    remove: async (key: string) => secure.delete(key),
  },
}));

import { createNativeTransport } from '../../mobile/src/session/native-transport';
import { getAccessToken, getRefreshToken } from '../../mobile/src/session/token-vault';

const transport = createNativeTransport('https://api.example.com');
const SESSION = { accessToken: 'at-1', refreshToken: 'rt-1', accessTokenExpiresIn: 900 };

beforeEach(async () => {
  secure.clear();
  await transport.onSessionExpired?.();
});

describe('نقل التطبيق', () => {
  it('عنوان الخادم كاملًا وبلا كوكيز', () => {
    expect(transport.baseUrl).toBe('https://api.example.com/api/v1');
    expect(transport.credentials).toBe('omit');
  });

  it('يلتقط الجلسة من الرد ويزيلها من البيانات', async () => {
    const data = await transport.receive!('/auth/login', 'POST', { user: { id: 'u1' }, session: SESSION });
    expect(data).toEqual({ user: { id: 'u1' } });
    expect(getAccessToken()).toBe('at-1');
    expect(await getRefreshToken()).toBe('rt-1');
  });

  it('يرسل رأس التطبيق وBearer', async () => {
    await transport.receive!('/auth/login', 'POST', { session: SESSION });
    const { headers } = await transport.prepare!('/me/profile', { method: 'GET', headers: {}, body: undefined });
    expect(headers['x-client']).toBe('native-app');
    expect(headers.Authorization).toBe('Bearer at-1');
  });

  it('يضع توكن التحديث في جسم التجديد', async () => {
    await transport.receive!('/auth/login', 'POST', { session: SESSION });
    const { body } = await transport.prepare!('/auth/refresh', { method: 'POST', headers: {}, body: undefined });
    expect(body).toEqual({ refreshToken: 'rt-1' });
  });

  it('🔐 الخروج يمسح الجهاز قبل الإرسال — حتى لو فشل الطلب', async () => {
    await transport.receive!('/auth/login', 'POST', { session: SESSION });
    const { body } = await transport.prepare!('/auth/logout?all=true', {
      method: 'POST',
      headers: {},
      body: undefined,
    });
    expect(body).toEqual({ refreshToken: 'rt-1' });
    expect(getAccessToken()).toBeNull();
    expect(await getRefreshToken()).toBeNull();
  });

  it('حذف الحساب يمسح الجلسة', async () => {
    await transport.receive!('/auth/login', 'POST', { session: SESSION });
    await transport.receive!('/me/account', 'DELETE', { deleted: true });
    expect(await getRefreshToken()).toBeNull();
  });

  it('لا يلتقط حقل session ليس جلسة', async () => {
    const data = { session: 'morning' };
    expect(await transport.receive!('/x', 'GET', data)).toBe(data);
  });
});
