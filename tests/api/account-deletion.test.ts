import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { buildAllIndexes, startTestDb, stopTestDb } from '../helpers/db';

/* cookies() من next/headers متاحة داخل نطاق طلب Next فقط — نستبدلها بمخزن في الذاكرة */
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
  Address,
  AuditLog,
  Favorite,
  Notification,
  Review,
  Service,
  ServiceProvider,
  User,
} from '@/server/db/models';
import { resetRateLimitStore } from '@/server/middleware/with-rate-limit';
import { signAccessToken } from '@/server/lib/jwt';
import { hashPassword } from '@/server/lib/password';
import { DELETE as deleteAccountRoute } from '@/app/api/v1/me/account/route';

/**
 * حذف الحساب — مطلب Google Play.
 * المحور: لا حذف بلا كلمة مرور صحيحة، والحذف يمسح كل ما يخص الحساب.
 */

const PASSWORD = 'Delete12345';
let phoneCounter = 0;

beforeAll(async () => {
  await startTestDb();
  await buildAllIndexes();
  await runSeed();
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters-long!!';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters-long!';
  process.env.APP_URL = 'http://localhost:3000';
}, 90_000);

afterAll(async () => {
  await stopTestDb();
});

afterEach(() => {
  resetRateLimitStore();
  cookieJar.clear();
});

function req(body: unknown, token?: string): Request {
  const headers: Record<string, string> = {
    'x-forwarded-for': `10.7.0.${Math.floor(Math.random() * 250) + 1}`,
    origin: 'http://localhost:3000',
    'content-type': 'application/json',
  };
  if (token) headers.cookie = `kf_at=${token}`;
  return new Request('http://localhost:3000/api/v1/me/account', {
    method: 'DELETE',
    headers,
    body: JSON.stringify(body),
  });
}

async function makeUser(overrides: Record<string, unknown> = {}) {
  phoneCounter += 1;
  const user = await User.create({
    role: 'CUSTOMER',
    fullName: 'مستخدم للحذف',
    phone: `+2010800${String(10000 + phoneCounter)}`,
    email: `delete${phoneCounter}@test.local`,
    passwordHash: await hashPassword(PASSWORD),
    status: 'ACTIVE',
    ...overrides,
  });
  const token = await signAccessToken({
    userId: String(user._id),
    role: user.role,
    status: 'ACTIVE',
  });
  return { id: String(user._id), token };
}

describe('DELETE /api/v1/me/account', () => {
  it('يمنع الزائر', async () => {
    const response = await deleteAccountRoute(req({ password: PASSWORD }), undefined);
    expect(response.status).toBe(401);
  });

  it('🔐 يرفض كلمة مرور خاطئة ولا يحذف شيئًا', async () => {
    const user = await makeUser();
    const response = await deleteAccountRoute(req({ password: 'wrong-pass-1' }, user.token), undefined);

    expect(response.status).toBe(422);
    expect(await User.exists({ _id: user.id })).toBeTruthy();
  });

  it('يرفض الطلب بلا كلمة مرور', async () => {
    const user = await makeUser();
    const response = await deleteAccountRoute(req({}, user.token), undefined);
    expect(response.status).toBe(400);
    expect(await User.exists({ _id: user.id })).toBeTruthy();
  });

  it('يحذف العميل وعناوينه ومفضّلته وإشعاراته وتقييماته', async () => {
    const user = await makeUser();
    const userId = new Types.ObjectId(user.id);
    const provider = await ServiceProvider.findOne({ displayName: 'أبو خالد للسباكة' });

    await Address.create({
      userId,
      label: 'المنزل',
      type: 'HOME',
      governorate: 'الفيوم',
      city: 'الفيوم',
      area: 'الفيوم',
      line: 'شارع أحمد شوقي 12',
      contactName: 'مستخدم',
      contactPhone: '+201033334444',
    });
    await Favorite.create({ userId, providerId: provider?._id });
    await Notification.create({
      userId,
      type: 'SYSTEM',
      title: 'إشعار',
      body: 'نص',
      entityType: 'SYSTEM',
    });
    await Review.create({
      orderId: new Types.ObjectId(),
      customerId: userId,
      providerId: provider?._id,
      rating: 1,
    });

    const response = await deleteAccountRoute(req({ password: PASSWORD }, user.token), undefined);
    expect(response.status).toBe(200);

    expect(await User.exists({ _id: userId })).toBeNull();
    expect(await Address.countDocuments({ userId })).toBe(0);
    expect(await Favorite.countDocuments({ userId })).toBe(0);
    expect(await Notification.countDocuments({ userId })).toBe(0);
    expect(await Review.countDocuments({ customerId: userId })).toBe(0);

    // سجل التدقيق بلا بيانات شخصية
    const log = await AuditLog.findOne({ action: 'ACCOUNT_DELETED', entityId: userId }).lean();
    expect(log).toBeTruthy();
    expect(JSON.stringify(log)).not.toContain('@test.local');
  });

  it('يحذف مقدم الخدمة مع ملفه وخدماته ومفضّلات الآخرين له', async () => {
    const seeded = await ServiceProvider.findOne({ displayName: 'كهربائي الفيوم' });
    const providerId = seeded!._id;
    const providerUserId = String(seeded!.userId);
    await User.updateOne({ _id: providerUserId }, { $set: { passwordHash: await hashPassword(PASSWORD) } });
    const token = await signAccessToken({ userId: providerUserId, role: 'PROVIDER', status: 'ACTIVE' });

    const fan = await makeUser();
    await Favorite.create({ userId: new Types.ObjectId(fan.id), providerId });
    expect(await Service.countDocuments({ providerId })).toBeGreaterThan(0);

    const response = await deleteAccountRoute(req({ password: PASSWORD }, token), undefined);
    expect(response.status).toBe(200);

    expect(await User.exists({ _id: providerUserId })).toBeNull();
    expect(await ServiceProvider.exists({ _id: providerId })).toBeNull();
    expect(await Service.countDocuments({ providerId })).toBe(0);
    expect(await Favorite.countDocuments({ providerId })).toBe(0);
    // حساب المعجب نفسه باقٍ
    expect(await User.exists({ _id: fan.id })).toBeTruthy();
  });

  it('حساب جوجل بلا كلمة مرور يؤكّد بالبريد', async () => {
    const user = await makeUser({ passwordHash: undefined, googleId: `g-${Date.now()}` });

    const wrong = await deleteAccountRoute(req({ confirmEmail: 'other@test.local' }, user.token), undefined);
    expect(wrong.status).toBe(422);
    expect((await wrong.json()).error.message).toMatch(/بريدك الإلكتروني المسجّل/);

    const stored = await User.findById(user.id).lean();
    const right = await deleteAccountRoute(req({ confirmEmail: stored!.email }, user.token), undefined);
    expect(right.status).toBe(200);
    expect(await User.exists({ _id: user.id })).toBeNull();
  });

  it('🔐 لا يُحذف حساب الإدارة من التطبيق', async () => {
    const admin = await makeUser({ role: 'ADMIN' });
    const response = await deleteAccountRoute(req({ password: PASSWORD }, admin.token), undefined);
    expect(response.status).toBe(403);
    expect(await User.exists({ _id: admin.id })).toBeTruthy();
  });

  it('🔐 يرفض طلبًا من أصل آخر (CSRF)', async () => {
    const user = await makeUser();
    const request = req({ password: PASSWORD }, user.token);
    const foreign = new Request(request.url, {
      method: 'DELETE',
      headers: { ...Object.fromEntries(request.headers), origin: 'https://evil.example' },
      body: JSON.stringify({ password: PASSWORD }),
    });
    const response = await deleteAccountRoute(foreign, undefined);
    expect(response.status).toBe(403);
    expect(await User.exists({ _id: user.id })).toBeTruthy();
  });
});
