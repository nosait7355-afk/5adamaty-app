import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildAllIndexes, startTestDb, stopTestDb } from '../helpers/db';
import { runSeed } from '@/server/db/seed/seed';
import { Service, ServiceProvider, User } from '@/server/db/models';
import { resetRateLimitStore } from '@/server/middleware/with-rate-limit';
import { signAccessToken } from '@/server/lib/jwt';
import { GET as dashboardRoute } from '@/app/api/v1/provider/dashboard/route';

/**
 * لوحة تحكم مقدم الخدمة بعد إزالة نظام الطلبات: مؤشرات من الملف فقط.
 */

let providerId = '';
let providerToken = '';
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
  providerToken = await signAccessToken({
    userId: String(provider?.userId),
    role: 'PROVIDER',
    status: 'ACTIVE',
  });

  const customer = await User.create({
    role: 'CUSTOMER',
    fullName: 'عميل للوحة التحكم',
    phone: '+201060000011',
    passwordHash: 'TEST_ONLY',
    status: 'ACTIVE',
  });
  customerToken = await signAccessToken({
    userId: String(customer._id),
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

function req(path: string, token?: string): Request {
  const headers: Record<string, string> = {
    'x-forwarded-for': `10.6.0.${Math.floor(Math.random() * 250) + 1}`,
    origin: 'http://localhost:3000',
  };
  if (token) headers.cookie = `kf_at=${token}`;
  return new Request(`http://localhost:3000${path}`, { headers });
}

describe('GET /api/v1/provider/dashboard', () => {
  it('يعيد مؤشرات الملف فقط — بلا طلبات ولا أرباح', async () => {
    const response = await dashboardRoute(req('/api/v1/provider/dashboard', providerToken), undefined);
    const body = (await response.json()) as {
      data: {
        kpis: { rating: number; ratingCount: number; servicesCount: number };
        provider: { profileCompletion: number };
      };
    };

    expect(response.status).toBe(200);
    expect(Object.keys(body.data.kpis).sort()).toEqual(['rating', 'ratingCount', 'servicesCount']);
    expect(body.data.kpis.servicesCount).toBe(await Service.countDocuments({ providerId }));
    expect(body.data).not.toHaveProperty('recentOrders');
    expect(body.data).not.toHaveProperty('earnings');
    expect(body.data.provider.profileCompletion).toBeTypeOf('number');
  });

  it('لا يحوي أي مصطلح مالي', async () => {
    const response = await dashboardRoute(req('/api/v1/provider/dashboard', providerToken), undefined);
    const raw = (await response.text()).toLowerCase();
    for (const term of ['wallet', 'balance', 'transaction', 'payout', 'invoice', 'order']) {
      expect(raw, term).not.toContain(term);
    }
  });

  it('العميل لا يصل للوحة التحكم', async () => {
    const response = await dashboardRoute(req('/api/v1/provider/dashboard', customerToken), undefined);
    expect(response.status).toBe(403);
  });
});
