import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAllIndexes, startTestDb, stopTestDb } from '../helpers/db';
import { runSeed } from '@/server/db/seed/seed';
import { Category, User } from '@/server/db/models';
import { resetRateLimitStore } from '@/server/middleware/with-rate-limit';
import { signAccessToken } from '@/server/lib/jwt';
import { hashPassword } from '@/server/lib/password';

/**
 * صورة التصنيف — ترفعها الإدارة لتحلّ محل الرسمة الافتراضية.
 *
 * الاستدعاءات الشبكية لـCloudinary وحدها تُموَّه (كما في
 * provider-portfolio.test.ts)؛ المسار والمستودعات وقاعدة البيانات حقيقية.
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

import { PATCH as updateCategoryRoute } from '@/app/api/v1/admin/categories/[id]/route';
import { GET as publicCategoriesRoute } from '@/app/api/v1/categories/route';
import { issueUploadSignature } from '@/server/services/upload.service';

let adminId = '';
let adminToken = '';
let customerToken = '';
let categoryId = '';

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

  const admin = await User.create({
    role: 'ADMIN',
    fullName: 'مدير الصور',
    phone: '+201099980001',
    email: 'category-image-admin@test.local',
    passwordHash: await hashPassword('AdminPass123'),
    status: 'ACTIVE',
  });
  adminId = String(admin._id);
  adminToken = await signAccessToken({ userId: adminId, role: 'ADMIN', status: 'ACTIVE' });

  const customer = await User.create({
    role: 'CUSTOMER',
    fullName: 'عميل',
    phone: '+201099980002',
    passwordHash: 'TEST_ONLY',
    status: 'ACTIVE',
  });
  customerToken = await signAccessToken({
    userId: String(customer._id),
    role: 'CUSTOMER',
    status: 'ACTIVE',
  });

  const category = await Category.findOne({ slug: 'home-services' });
  categoryId = String(category?._id);
}, 90_000);

afterAll(async () => {
  await stopTestDb();
});

beforeEach(() => {
  fetchAssetDetailsMock.mockReset();
  deleteAssetMock.mockReset().mockResolvedValue(true);
});

afterEach(async () => {
  resetRateLimitStore();
  await Category.findByIdAndUpdate(categoryId, { $set: { image: null } });
});

async function patch(body: unknown, token = adminToken): Promise<Response> {
  const request = new Request(`http://localhost:3000/api/v1/admin/categories/${categoryId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
      'x-forwarded-for': `10.8.0.${Math.floor(Math.random() * 250) + 1}`,
      cookie: `kf_at=${token}`,
    },
    body: JSON.stringify(body),
  });
  return updateCategoryRoute(request, { params: Promise.resolve({ id: categoryId }) });
}

function adminPublicId(name: string, owner = adminId) {
  return `khadamaty/categories/${owner}/${name}`;
}

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

async function publicCategory() {
  const response = await publicCategoriesRoute(
    new Request('http://localhost:3000/api/v1/categories'),
    undefined
  );
  const body = (await response.json()) as { data: { id: string; image?: string }[] };
  return body.data.find((item) => item.id === categoryId);
}

/* ================================================================== */

describe('صورة التصنيف', () => {
  it('الإدارة تربط صورة بعد التحقق منها عند Cloudinary، وتظهر في واجهة العميل', async () => {
    const publicId = adminPublicId('cat_1');
    mockAsset(publicId);

    const response = await patch({ imagePublicId: publicId });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: { image?: string } };
    expect(body.data.image).toContain(publicId);

    // الرابط من Cloudinary نفسها لا مما أرسله المتصفح
    expect(fetchAssetDetailsMock).toHaveBeenCalledOnce();
    expect((await publicCategory())?.image).toContain(publicId);
  });

  it('الاستبدال يحذف الصورة القديمة من Cloudinary — بلا أصول يتيمة', async () => {
    const first = adminPublicId('cat_old');
    const second = adminPublicId('cat_new');
    mockAsset(first);
    await patch({ imagePublicId: first });
    mockAsset(second);
    await patch({ imagePublicId: second });

    expect(deleteAssetMock).toHaveBeenCalledWith({ publicId: first });
    expect((await publicCategory())?.image).toContain(second);
  });

  it('`null` يزيل الصورة فتعود الرسمة الافتراضية، ويحذفها من Cloudinary', async () => {
    const publicId = adminPublicId('cat_remove');
    mockAsset(publicId);
    await patch({ imagePublicId: publicId });

    const response = await patch({ imagePublicId: null });
    expect(response.status).toBe(200);
    expect(deleteAssetMock).toHaveBeenCalledWith({ publicId });
    expect((await publicCategory())?.image).toBeUndefined();
  });

  it('🔐 يرفض ملفًا من مجلد مستخدم آخر', async () => {
    const response = await patch({ imagePublicId: adminPublicId('stolen', '507f1f77bcf86cd799439099') });
    expect(response.status).toBe(403);
    expect(fetchAssetDetailsMock).not.toHaveBeenCalled();
  });

  it('🔐 العميل لا يغيّر صورة تصنيف', async () => {
    const response = await patch({ imagePublicId: adminPublicId('x') }, customerToken);
    expect(response.status).toBe(403);
  });

  it('🔐 توقيع رفع صور التصنيفات للإدارة وحدها', () => {
    const request = {
      purpose: 'CATEGORY_IMAGE' as const,
      contentType: 'image/png',
      sizeBytes: 50_000,
      headerBase64: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString('base64'),
    };
    const signed = issueUploadSignature({ id: adminId, role: 'ADMIN', status: 'ACTIVE' }, request);
    expect(signed.params.folder).toBe(`khadamaty/categories/${adminId}`);

    expect(() =>
      issueUploadSignature({ id: adminId, role: 'PROVIDER', status: 'ACTIVE' }, request)
    ).toThrow(/صلاحية/);
  });
});
