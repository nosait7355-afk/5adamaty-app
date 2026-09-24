import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildAllIndexes, startTestDb, stopTestDb } from '../helpers/db';
import { runSeed } from '@/server/db/seed/seed';
import { AuditLog, Profession, Report, ServiceProvider, User } from '@/server/db/models';
import { resetRateLimitStore } from '@/server/middleware/with-rate-limit';
import { signAccessToken } from '@/server/lib/jwt';
import { POST as reportRoute } from '@/app/api/v1/providers/[id]/report/route';
import { GET as listRoute } from '@/app/api/v1/admin/reports/route';
import { PATCH as resolveRoute } from '@/app/api/v1/admin/reports/[id]/route';

/**
 * بلاغات المستخدمين عن مقدمي الخدمات — سياسة Google Play للمحتوى الذي
 * ينشئه المستخدمون (UGC): إبلاغ داخل التطبيق + مراجعة إدارية.
 */

let providerId = '';
let providerToken = '';
let customerToken = '';
let adminToken = '';

beforeAll(async () => {
  await startTestDb();
  await buildAllIndexes();
  await runSeed();

  process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters-long!!';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters-long!';
  process.env.APP_URL = 'http://localhost:3000';

  const plumber = await Profession.findOne({ slug: 'plumber' });
  const providerUser = await User.create({
    role: 'PROVIDER',
    fullName: 'مزوّد للبلاغات',
    phone: '+201099980001',
    passwordHash: 'TEST_ONLY',
    status: 'ACTIVE',
  });
  const provider = await ServiceProvider.create({
    userId: providerUser._id,
    accountType: 'INDIVIDUAL',
    displayName: 'مزوّد للبلاغات',
    categoryId: plumber?.categoryId,
    professionId: plumber?._id,
    bio: 'وصف تجريبي',
    coverageAreas: ['الفيوم'],
    isActive: true,
    verification: { status: 'APPROVED', requestNumber: 'SRV-2025-900101', submittedAt: new Date() },
  });
  providerId = String(provider._id);

  const customer = await User.create({
    role: 'CUSTOMER',
    fullName: 'عميل مُبلِّغ',
    phone: '+201099980002',
    passwordHash: 'TEST_ONLY',
    status: 'ACTIVE',
  });
  const admin = await User.create({
    role: 'ADMIN',
    fullName: 'مدير البلاغات',
    phone: '+201099980003',
    passwordHash: 'TEST_ONLY',
    status: 'ACTIVE',
  });

  providerToken = await signAccessToken({
    userId: String(providerUser._id),
    role: 'PROVIDER',
    status: 'ACTIVE',
  });
  customerToken = await signAccessToken({
    userId: String(customer._id),
    role: 'CUSTOMER',
    status: 'ACTIVE',
  });
  adminToken = await signAccessToken({ userId: String(admin._id), role: 'ADMIN', status: 'ACTIVE' });
}, 90_000);

afterAll(async () => {
  await stopTestDb();
});

afterEach(async () => {
  resetRateLimitStore();
  await Report.deleteMany({});
});

function req(
  url: string,
  options: { method?: string; body?: unknown; token?: string } = {}
): Request {
  const headers: Record<string, string> = {
    'x-forwarded-for': `10.8.0.${Math.floor(Math.random() * 250) + 1}`,
    origin: 'http://localhost:3000',
  };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.token) headers.cookie = `kf_at=${options.token}`;

  return new Request(`http://localhost:3000/api/v1${url}`, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

function report(token: string | undefined, body: unknown) {
  return reportRoute(
    req(`/providers/${providerId}/report`, { method: 'POST', body, ...(token ? { token } : {}) }),
    params(providerId)
  );
}

describe('POST /providers/:id/report', () => {
  it('يسجّل بلاغ مستخدم مسجّل الدخول', async () => {
    const response = await report(customerToken, { reason: 'FRAUD', details: 'طلب مبلغًا مقدمًا' });
    expect(response.status).toBe(201);

    const saved = await Report.find({ providerId }).lean();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ reason: 'FRAUD', details: 'طلب مبلغًا مقدمًا', status: 'OPEN' });
  });

  it('لا يكرّر بلاغًا مفتوحًا من نفس المستخدم — يحدّثه', async () => {
    await report(customerToken, { reason: 'FRAUD' });
    await report(customerToken, { reason: 'HARASSMENT' });

    const saved = await Report.find({ providerId }).lean();
    expect(saved).toHaveLength(1);
    expect(saved[0]?.reason).toBe('HARASSMENT');
  });

  it('يرفض الزائر غير المسجّل', async () => {
    const response = await report(undefined, { reason: 'FRAUD' });
    expect(response.status).toBe(401);
  });

  it('يمنع مقدم الخدمة من الإبلاغ عن نفسه', async () => {
    const response = await report(providerToken, { reason: 'FRAUD' });
    expect(response.status).toBe(400);
    expect(await Report.countDocuments()).toBe(0);
  });

  it('يرفض سببًا غير معروف', async () => {
    const response = await report(customerToken, { reason: 'SPAM' });
    expect(response.status).toBe(400);
  });
});

describe('إدارة البلاغات', () => {
  it('غير الإدارة لا يرى البلاغات', async () => {
    const response = await listRoute(req('/admin/reports', { token: customerToken }), undefined);
    expect(response.status).toBe(403);
  });

  it('الإدارة ترى البلاغ باسم المزوّد والمُبلِّغ ثم تغلقه مع أثر تدقيق', async () => {
    await report(customerToken, { reason: 'INAPPROPRIATE_CONTENT' });

    const listed = await listRoute(req('/admin/reports?status=OPEN', { token: adminToken }), undefined);
    const body = (await listed.json()) as {
      data: { id: string; provider: { displayName: string }; reporter: { fullName: string } }[];
    };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.provider.displayName).toBe('مزوّد للبلاغات');
    expect(body.data[0]?.reporter.fullName).toBe('عميل مُبلِّغ');

    const reportId = body.data[0]?.id ?? '';
    const resolve = () =>
      resolveRoute(
        req(`/admin/reports/${reportId}`, {
          method: 'PATCH',
          body: { status: 'RESOLVED' },
          token: adminToken,
        }),
        params(reportId)
      );

    expect((await resolve()).status).toBe(200);
    expect((await Report.findById(reportId).lean())?.status).toBe('RESOLVED');
    expect(await AuditLog.countDocuments({ action: 'REPORT_RESOLVED', entityId: reportId })).toBe(1);

    // البلاغ المغلق لا يُغلق مرة ثانية
    expect((await resolve()).status).toBe(404);
  });
});
