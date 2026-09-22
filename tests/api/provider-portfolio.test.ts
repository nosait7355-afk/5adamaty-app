import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAllIndexes, startTestDb, stopTestDb } from '../helpers/db';
import { runSeed } from '@/server/db/seed/seed';
import { Profession, ServiceProvider, User } from '@/server/db/models';
import { resetRateLimitStore } from '@/server/middleware/with-rate-limit';
import { signAccessToken } from '@/server/lib/jwt';
import { hashPassword } from '@/server/lib/password';

/**
 * «سابقة أعمالي» (portfolio) — الإضافة والحذف (provider.service.ts).
 *
 * لا تغطية سابقة لهذا المسار: لا اختبار وحدة ولا API. الحدود المفحوصة هنا:
 * سقف الصور (12) والفيديوهات (3) منفصلان، منع التكرار، أن الحذف يمسح من
 * القاعدة ومن Cloudinary معًا، وأن قراءة الأصل تأتي من Cloudinary نفسها لا
 * من ادعاء العميل.
 *
 * الاستدعاءات الشبكية لـCloudinary وحدها تُموَّه (fetchAssetDetails,
 * deleteAsset) — بقية الطبقات (repositories, مسار الـAPI الفعلي) حقيقية،
 * كما في provider-registration.test.ts.
 *
 * ملاحظة: مجلد الأصل على Cloudinary مبني من **معرّف المستخدم** لا معرّف
 * ملف المزوّد (`verifyAndBuildMediaRef` في upload.service.ts)، فكل
 * publicId هنا يُبنى بـ`providerUserId`.
 */

const fetchAssetDetailsMock = vi.fn();
const deleteAssetMock = vi.fn();

vi.mock('@/server/lib/cloudinary', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/lib/cloudinary')>();
  return {
    ...actual,
    fetchAssetDetails: (...args: Parameters<typeof actual.fetchAssetDetails>) =>
      fetchAssetDetailsMock(...args),
    deleteAsset: (...args: Parameters<typeof actual.deleteAsset>) => deleteAssetMock(...args),
  };
});

import { POST as addRoute, DELETE as removeRoute } from '@/app/api/v1/provider/portfolio/route';

let providerId = '';
let providerUserId = '';
let providerToken = '';
let customerToken = '';

beforeAll(async () => {
  await startTestDb();
  await buildAllIndexes();
  await runSeed();

  process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters-long!!';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters-long!';
  process.env.APP_URL = 'http://localhost:3000';
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
  process.env.CLOUDINARY_API_KEY = '123456789012345';
  process.env.CLOUDINARY_API_SECRET = 'test-api-secret-value';

  const plumber = await Profession.findOne({ slug: 'plumber' });
  const user = await User.create({
    role: 'PROVIDER',
    fullName: 'مزوّد لسابقة الأعمال',
    phone: '+201099990001',
    email: 'portfolio-provider@test.local',
    passwordHash: await hashPassword('Provider12345'),
    status: 'ACTIVE',
  });
  const provider = await ServiceProvider.create({
    userId: user._id,
    accountType: 'INDIVIDUAL',
    displayName: 'مزوّد لسابقة الأعمال',
    categoryId: plumber?.categoryId,
    professionId: plumber?._id,
    bio: 'وصف تجريبي',
    coverageAreas: ['الفيوم'],
    isActive: true,
    isVerifiedBadge: true,
    profileCompletion: 80,
    verification: { status: 'APPROVED', requestNumber: 'SRV-2025-900001', submittedAt: new Date() },
  });
  providerId = String(provider._id);
  providerUserId = String(user._id);
  providerToken = await signAccessToken({
    userId: providerUserId,
    role: 'PROVIDER',
    status: 'ACTIVE',
  });

  const customer = await User.create({
    role: 'CUSTOMER',
    fullName: 'عميل لسابقة الأعمال',
    phone: '+201099990002',
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

beforeEach(() => {
  fetchAssetDetailsMock.mockReset();
  deleteAssetMock.mockReset();
});

afterEach(async () => {
  resetRateLimitStore();
  await ServiceProvider.findByIdAndUpdate(providerId, { $set: { gallery: [] } });
});

function req(options: { method?: string; body?: unknown; token?: string } = {}): Request {
  const headers: Record<string, string> = {
    'x-forwarded-for': `10.7.0.${Math.floor(Math.random() * 250) + 1}`,
    origin: 'http://localhost:3000',
  };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.token) headers.cookie = `kf_at=${options.token}`;

  return new Request('http://localhost:3000/api/v1/provider/portfolio', {
    method: options.method ?? 'POST',
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
}

interface Body {
  success: boolean;
  data?: { portfolio: { publicId: string; kind: string }[] };
  error?: { code: string; message: string };
}

async function json(response: Response): Promise<Body> {
  return (await response.json()) as unknown as Body;
}

/** publicId صورة صالح — داخل مجلد مستخدم المزوّد. */
function imagePublicId(name: string): string {
  return `khadamaty/providers/${providerUserId}/${name}`;
}

/** publicId فيديو صالح — غرض ومجلد منفصلان عن الصور. */
function videoPublicId(name: string): string {
  return `khadamaty/providers/videos/${providerUserId}/${name}`;
}

function mockAsset(publicId: string, overrides: Partial<Record<string, unknown>> = {}) {
  fetchAssetDetailsMock.mockResolvedValueOnce({
    publicId,
    format: 'jpg',
    bytes: 200_000,
    resourceType: 'image',
    type: 'upload',
    secureUrl: `https://res.cloudinary.com/test-cloud/image/upload/v1/${encodeURIComponent(publicId)}.jpg`,
    ...overrides,
  });
}

/* ================================================================== */

describe('POST /api/v1/provider/portfolio', () => {
  it('يضيف صورة بعد التحقق من Cloudinary — لا بادعاء العميل', async () => {
    const publicId = imagePublicId('img_1');
    mockAsset(publicId);

    const response = await addRoute(
      req({ token: providerToken, body: { publicId, kind: 'IMAGE' } }),
      undefined
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.data?.portfolio).toHaveLength(1);
    expect(body.data?.portfolio[0]).toMatchObject({ publicId, kind: 'IMAGE' });
  });

  it('يرفض ادعاء حجم مخالف — الحجم الحقيقي من Cloudinary وحده', async () => {
    const publicId = imagePublicId('img_big');
    mockAsset(publicId, { bytes: 50 * 1024 * 1024 });

    const response = await addRoute(
      req({ token: providerToken, body: { publicId, kind: 'IMAGE' } }),
      undefined
    );
    expect(response.status).toBe(422);
  });

  it('يرفض ملفًا خارج مجلد المستخدم', async () => {
    const response = await addRoute(
      req({
        token: providerToken,
        body: { publicId: 'khadamaty/providers/OTHER_USER/img_1', kind: 'IMAGE' },
      }),
      undefined
    );
    expect(response.status).toBe(403);
    expect(fetchAssetDetailsMock).not.toHaveBeenCalled();
  });

  it('يرفض ملفًا غير موجود فعليًا على Cloudinary', async () => {
    fetchAssetDetailsMock.mockResolvedValueOnce(null);
    const publicId = imagePublicId('missing');

    const response = await addRoute(
      req({ token: providerToken, body: { publicId, kind: 'IMAGE' } }),
      undefined
    );
    expect(response.status).toBe(422);
  });

  it('يرفض تكرار نفس الملف', async () => {
    const publicId = imagePublicId('img_dup');
    mockAsset(publicId);
    await addRoute(req({ token: providerToken, body: { publicId, kind: 'IMAGE' } }), undefined);

    mockAsset(publicId);
    const response = await addRoute(
      req({ token: providerToken, body: { publicId, kind: 'IMAGE' } }),
      undefined
    );
    expect(response.status).toBe(409);
  });

  it('سقف الصور 12 منفصل عن سقف الفيديوهات 3', async () => {
    for (let i = 0; i < 12; i += 1) {
      const publicId = imagePublicId(`img_${i}`);
      mockAsset(publicId);
      const response = await addRoute(
        req({ token: providerToken, body: { publicId, kind: 'IMAGE' } }),
        undefined
      );
      expect(response.status, `صورة رقم ${i}`).toBe(200);
    }

    // السقف يُفحص قبل أي استعلام عن Cloudinary — لا حاجة لتمويه أصل هنا
    const overflowId = imagePublicId('img_13');
    const overflow = await addRoute(
      req({ token: providerToken, body: { publicId: overflowId, kind: 'IMAGE' } }),
      undefined
    );
    expect(overflow.status).toBe(422);

    // الفيديو غرض ومجلد منفصلان — لا يتأثر بسقف الصور
    const videoId = videoPublicId('vid_1');
    fetchAssetDetailsMock.mockResolvedValueOnce({
      publicId: videoId,
      format: 'mp4',
      bytes: 1_000_000,
      resourceType: 'video',
      type: 'upload',
      secureUrl: 'https://res.cloudinary.com/test-cloud/video/upload/v1/vid_1.mp4',
    });
    const video = await addRoute(
      req({ token: providerToken, body: { publicId: videoId, kind: 'VIDEO' } }),
      undefined
    );
    expect(video.status).toBe(200);
  });

  it('يمنع العميل من الإضافة', async () => {
    const response = await addRoute(
      req({ token: customerToken, body: { publicId: imagePublicId('img_x'), kind: 'IMAGE' } }),
      undefined
    );
    expect(response.status).toBe(403);
  });

  it('يمنع الوصول بلا جلسة', async () => {
    const response = await addRoute(
      req({ body: { publicId: imagePublicId('img_x'), kind: 'IMAGE' } }),
      undefined
    );
    expect(response.status).toBe(401);
  });
});

/* ================================================================== */

describe('DELETE /api/v1/provider/portfolio', () => {
  async function addOne(publicId: string) {
    mockAsset(publicId);
    await addRoute(req({ token: providerToken, body: { publicId, kind: 'IMAGE' } }), undefined);
  }

  it('يحذف من القاعدة ومن Cloudinary معًا', async () => {
    const publicId = imagePublicId('img_del');
    await addOne(publicId);
    deleteAssetMock.mockResolvedValueOnce(true);

    const response = await removeRoute(
      req({ method: 'DELETE', token: providerToken, body: { publicId } }),
      undefined
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.data?.portfolio.some((item) => item.publicId === publicId)).toBe(false);
    expect(deleteAssetMock).toHaveBeenCalledWith(
      expect.objectContaining({ publicId, resourceType: 'image' })
    );
  });

  it('لا يفشل الحذف من القاعدة حتى لو فشل حذفه من Cloudinary', async () => {
    const publicId = imagePublicId('img_orphan');
    await addOne(publicId);
    deleteAssetMock.mockResolvedValueOnce(false);

    const response = await removeRoute(
      req({ method: 'DELETE', token: providerToken, body: { publicId } }),
      undefined
    );
    expect(response.status).toBe(200);

    const provider = await ServiceProvider.findById(providerId);
    expect(provider?.gallery?.some((item) => item.publicId === publicId)).toBe(false);
  });

  it('يرفض حذف عنصر غير موجود', async () => {
    const response = await removeRoute(
      req({
        method: 'DELETE',
        token: providerToken,
        body: { publicId: imagePublicId('never_added') },
      }),
      undefined
    );
    expect(response.status).toBe(404);
  });

  it('يمنع العميل من الحذف', async () => {
    const publicId = imagePublicId('img_protected');
    await addOne(publicId);

    const response = await removeRoute(
      req({ method: 'DELETE', token: customerToken, body: { publicId } }),
      undefined
    );
    expect(response.status).toBe(403);
  });
});
