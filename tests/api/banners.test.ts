import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAllIndexes, startTestDb, stopTestDb } from '../helpers/db';
import { AuditLog, Banner, User } from '@/server/db/models';
import { resetRateLimitStore } from '@/server/middleware/with-rate-limit';
import { signAccessToken } from '@/server/lib/jwt';
import { DEFAULT_BANNERS, MAX_BANNERS } from '@/shared/constants/banners';

/**
 * بانرات الرئيسية — تديرها الإدارة من لوحة التحكم.
 *
 * Cloudinary وحدها تُموَّه (كما في category-image.test.ts)؛ المسارات
 * والخدمة وقاعدة البيانات حقيقية.
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

import { GET as publicBannersRoute } from '@/app/api/v1/banners/route';
import {
  GET as adminListRoute,
  POST as adminCreateRoute,
} from '@/app/api/v1/admin/banners/route';
import {
  DELETE as adminDeleteRoute,
  PATCH as adminUpdateRoute,
} from '@/app/api/v1/admin/banners/[id]/route';

let adminId = '';
let adminToken = '';
let customerToken = '';

interface BannerBody {
  id: string;
  title: string;
  href: string;
  image?: string;
  uploadedImage?: string;
  isActive?: boolean;
}

beforeAll(async () => {
  await startTestDb();
  await buildAllIndexes();

  process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters-long!!';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters-long!';
  process.env.APP_URL = 'http://localhost:3000';
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
  process.env.CLOUDINARY_API_KEY = '123456789012345';
  process.env.CLOUDINARY_API_SECRET = 'test-api-secret-value';

  const admin = await User.create({
    role: 'ADMIN',
    fullName: 'مدير البانرات',
    phone: '+201099970001',
    passwordHash: 'TEST_ONLY',
    status: 'ACTIVE',
  });
  adminId = String(admin._id);
  adminToken = await signAccessToken({ userId: adminId, role: 'ADMIN', status: 'ACTIVE' });

  const customer = await User.create({
    role: 'CUSTOMER',
    fullName: 'عميل',
    phone: '+201099970002',
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

beforeEach(async () => {
  fetchAssetDetailsMock.mockReset();
  deleteAssetMock.mockReset().mockResolvedValue(true);
  await Banner.deleteMany({});
});

afterEach(() => {
  resetRateLimitStore();
});

function adminRequest(url: string, method: string, body?: unknown, token = adminToken) {
  return new Request(`http://localhost:3000${url}`, {
    method,
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
      'x-forwarded-for': `10.9.0.${Math.floor(Math.random() * 250) + 1}`,
      cookie: `kf_at=${token}`,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function publicBanners(): Promise<BannerBody[]> {
  const response = await publicBannersRoute(
    new Request('http://localhost:3000/api/v1/banners'),
    undefined
  );
  return ((await response.json()) as { data: BannerBody[] }).data;
}

async function create(body: unknown, token = adminToken) {
  return adminCreateRoute(adminRequest('/api/v1/admin/banners', 'POST', body, token), undefined);
}

async function update(id: string, body: unknown, token = adminToken) {
  return adminUpdateRoute(adminRequest(`/api/v1/admin/banners/${id}`, 'PATCH', body, token), {
    params: Promise.resolve({ id }),
  });
}

async function remove(id: string) {
  return adminDeleteRoute(adminRequest(`/api/v1/admin/banners/${id}`, 'DELETE'), {
    params: Promise.resolve({ id }),
  });
}

const VALID = {
  title: 'عرض الصيف',
  description: 'خصم على صيانة التكييف',
  ctaLabel: 'شوف العروض',
  href: '/search?q=ac',
};

function mockAsset(publicId: string) {
  fetchAssetDetailsMock.mockResolvedValueOnce({
    publicId,
    format: 'png',
    bytes: 80_000,
    resourceType: 'image',
    type: 'upload',
    secureUrl: `https://res.cloudinary.com/test-cloud/image/upload/v1/${publicId}.png`,
  });
}

/* ================================================================== */

describe('بانرات الرئيسية', () => {
  it('المجموعة الخالية تُملأ بالبانرين الأصليين مرة واحدة بلا تكرار', async () => {
    const [first, second] = await Promise.all([publicBanners(), publicBanners()]);
    expect(first.map((b) => b.title)).toEqual(DEFAULT_BANNERS.map((b) => b.title));
    expect(second).toHaveLength(DEFAULT_BANNERS.length);
    expect(first[0]?.image).toBe('/banners/all-services.svg');
    expect(await Banner.countDocuments()).toBe(DEFAULT_BANNERS.length);
  });

  it('الإدارة تضيف بانرًا فيظهر للعميل، وتخفيه فيختفي، ويُسجَّل في التدقيق', async () => {
    const response = await create({ ...VALID, order: 5 });
    expect(response.status).toBe(201);
    const { data } = (await response.json()) as { data: BannerBody };
    expect((await publicBanners()).map((b) => b.title)).toContain(VALID.title);

    const hidden = await update(data.id, { isActive: false });
    expect(hidden.status).toBe(200);
    expect((await publicBanners()).map((b) => b.title)).not.toContain(VALID.title);

    // الإدارة ترى المخفي
    const list = await adminListRoute(adminRequest('/api/v1/admin/banners', 'GET'), undefined);
    const all = ((await list.json()) as { data: BannerBody[] }).data;
    expect(all.find((b) => b.id === data.id)?.isActive).toBe(false);

    expect(await AuditLog.countDocuments({ action: 'BANNER_CHANGED', entityId: data.id })).toBe(2);
  });

  it('🔐 يرفض رابطًا خارجيًا — الزر يفتح صفحة داخل التطبيق فقط', async () => {
    for (const href of ['https://evil.example', '//evil.example', 'javascript:alert(1)']) {
      const response = await create({ ...VALID, href });
      expect(response.status).toBe(400);
    }
  });

  it('🔐 العميل لا يضيف ولا يعدّل', async () => {
    expect((await create(VALID, customerToken)).status).toBe(403);
    const banner = await Banner.create({ ...VALID, tone: 'brand', order: 0, isActive: true });
    expect((await update(String(banner._id), { title: 'مخترق' }, customerToken)).status).toBe(403);
  });

  it('يمنع تجاوز الحد الأقصى لعدد البانرات', async () => {
    await Banner.insertMany(
      Array.from({ length: MAX_BANNERS }, (_, i) => ({ ...VALID, title: `بانر ${i}`, order: i }))
    );
    expect((await create(VALID)).status).toBe(422);
  });

  it('الصورة المرفوعة تتقدّم على الرسمة، واستبدالها أو حذفها يحذف القديمة من Cloudinary', async () => {
    const banner = await Banner.create({ ...VALID, art: 'direct-contact', order: 0 });
    const id = String(banner._id);
    const first = `khadamaty/banners/${adminId}/b_1`;
    const second = `khadamaty/banners/${adminId}/b_2`;

    mockAsset(first);
    expect((await update(id, { imagePublicId: first })).status).toBe(200);
    expect((await publicBanners())[0]?.image).toContain(first);

    mockAsset(second);
    await update(id, { imagePublicId: second });
    expect(deleteAssetMock).toHaveBeenCalledWith({ publicId: first });

    await update(id, { imagePublicId: null });
    expect(deleteAssetMock).toHaveBeenCalledWith({ publicId: second });
    // تعود الرسمة المختارة
    expect((await publicBanners())[0]?.image).toBe('/banners/direct-contact.svg');
  });

  it('🔐 يرفض صورة من مجلد مستخدم آخر', async () => {
    const banner = await Banner.create({ ...VALID, order: 0 });
    const response = await update(String(banner._id), {
      imagePublicId: 'khadamaty/banners/507f1f77bcf86cd799439099/stolen',
    });
    expect(response.status).toBe(403);
    expect(fetchAssetDetailsMock).not.toHaveBeenCalled();
  });

  it('الحذف نهائي ويحذف الصورة من Cloudinary', async () => {
    const publicId = `khadamaty/banners/${adminId}/b_del`;
    const banner = await Banner.create({
      ...VALID,
      order: 0,
      image: {
        publicId,
        url: `https://res.cloudinary.com/test-cloud/image/upload/v1/${publicId}.png`,
        format: 'png',
        bytes: 1000,
        resourceType: 'image',
        accessMode: 'public',
        uploadedAt: new Date(),
      },
    });

    expect((await remove(String(banner._id))).status).toBe(200);
    expect(await Banner.findById(banner._id)).toBeNull();
    expect(deleteAssetMock).toHaveBeenCalledWith({ publicId });
    expect((await remove(String(banner._id))).status).toBe(404);
  });
});
