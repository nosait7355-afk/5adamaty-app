import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { buildAllIndexes, startTestDb, stopTestDb } from '../helpers/db';
import { runSeed } from '@/server/db/seed/seed';
import { Category, Notification, Profession, User } from '@/server/db/models';
import { resetRateLimitStore } from '@/server/middleware/with-rate-limit';
import { signAccessToken } from '@/server/lib/jwt';
import { hashPassword } from '@/server/lib/password';
import { buildDocumentRequirements } from '@/shared/constants/documents';

import { PATCH as setUserStatusRoute } from '@/app/api/v1/admin/users/[id]/status/route';
import { POST as createCategoryRoute } from '@/app/api/v1/admin/categories/route';
import { PATCH as updateCategoryRoute } from '@/app/api/v1/admin/categories/[id]/route';
import { POST as createProfessionRoute } from '@/app/api/v1/admin/professions/route';
import { PATCH as updateProfessionRoute } from '@/app/api/v1/admin/professions/[id]/route';
import { PATCH as setServiceActiveRoute } from '@/app/api/v1/admin/services/[id]/route';
import { PATCH as setReviewVisibilityRoute } from '@/app/api/v1/admin/reviews/[id]/route';
import { POST as broadcastRoute } from '@/app/api/v1/admin/notifications/broadcast/route';
import { GET as listAuditLogsRoute } from '@/app/api/v1/admin/audit-logs/route';

/**
 * ثغرات تغطية admin.service.ts لم يفحصها admin.test.ts:
 * فروع 404، تعارض slug عند التعديل لا الإنشاء فقط، اتساق متطلبات
 * المستندات عند *تعديل* مهنة موجودة (لا إنشاء جديدة فقط)، دقة عدّاد
 * جمهور البث لكل فئة على حدة، وأن إعادة تفعيل حساب لا تُرسل إشعار
 * إيقاف.
 */

let adminId = '';
let categoryId = '';

beforeAll(async () => {
  await startTestDb();
  await buildAllIndexes();
  await runSeed();

  process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters-long!!';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters-long!';
  process.env.APP_URL = 'http://localhost:3000';

  const admin = await User.create({
    role: 'ADMIN',
    fullName: 'مدير للثغرات',
    phone: '+201000000101',
    email: 'admin-gaps@test.local',
    passwordHash: await hashPassword('AdminPass123'),
    status: 'ACTIVE',
  });
  adminId = String(admin._id);

  const category = await Category.findOne({ slug: 'home-services' });
  categoryId = String(category?._id);
}, 90_000);

afterAll(async () => {
  await stopTestDb();
});

afterEach(() => {
  resetRateLimitStore();
});

async function tokenFor(userId: string, role: 'PROVIDER' | 'ADMIN' | 'CUSTOMER', status = 'ACTIVE') {
  return signAccessToken({ userId, role, status });
}

interface ReqOptions {
  method?: string;
  body?: unknown;
  token?: string;
  query?: string;
}

function req(path: string, options: ReqOptions = {}): Request {
  const headers: Record<string, string> = {
    'x-forwarded-for': `10.9.0.${Math.floor(Math.random() * 250) + 1}`,
    origin: 'http://localhost:3000',
  };
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  if (options.token) headers.cookie = `kf_at=${options.token}`;

  return new Request(`http://localhost:3000${path}${options.query ?? ''}`, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
}

interface Body {
  success: boolean;
  data?: unknown;
  error?: { code: string; message: string };
}

async function json(response: Response): Promise<Body> {
  return (await response.json()) as Body;
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

/* ================================================================== */

describe('إدارة المستخدمين — إعادة التفعيل', () => {
  it('إعادة تفعيل حساب موقوف لا تُرسل إشعار إيقاف', async () => {
    const suspended = await User.create({
      role: 'CUSTOMER',
      fullName: 'عميل موقوف لإعادة التفعيل',
      phone: '+201000000103',
      passwordHash: await hashPassword('CustPass123'),
      status: 'SUSPENDED',
    });
    const token = await tokenFor(adminId, 'ADMIN');

    const response = await setUserStatusRoute(
      req(`/api/v1/admin/users/${suspended._id}/status`, {
        method: 'PATCH',
        token,
        body: { status: 'ACTIVE' },
      }),
      ctx(String(suspended._id))
    );
    expect(response.status).toBe(200);

    const updated = await User.findById(suspended._id).lean();
    expect(updated?.status).toBe('ACTIVE');

    const notification = await Notification.findOne({ userId: suspended._id, type: 'SYSTEM' });
    expect(notification).toBeNull();
  });
});

/* ================================================================== */

describe('التصنيفات — فروع لم تُفحص', () => {
  it('يعيد 404 عند تعديل تصنيف غير موجود', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    const fakeId = new Types.ObjectId().toString();

    const response = await updateCategoryRoute(
      req(`/api/v1/admin/categories/${fakeId}`, {
        method: 'PATCH',
        token,
        body: { name: 'اسم جديد' },
      }),
      ctx(fakeId)
    );
    expect(response.status).toBe(404);
  });

  it('يرفض تعديل slug إلى قيمة تصنيف آخر يملكها بالفعل', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    await createCategoryRoute(
      req('/api/v1/admin/categories', {
        method: 'POST',
        token,
        body: {
          name: 'تصنيف أول',
          slug: 'gap-category-a',
          description: 'وصف',
          icon: 'wrench',
          order: 50,
        },
      }),
      undefined
    );
    const second = await createCategoryRoute(
      req('/api/v1/admin/categories', {
        method: 'POST',
        token,
        body: {
          name: 'تصنيف ثانٍ',
          slug: 'gap-category-b',
          description: 'وصف',
          icon: 'wrench',
          order: 51,
        },
      }),
      undefined
    );
    const secondId = ((await json(second)).data as { id: string }).id;

    const response = await updateCategoryRoute(
      req(`/api/v1/admin/categories/${secondId}`, {
        method: 'PATCH',
        token,
        body: { slug: 'gap-category-a' },
      }),
      ctx(secondId)
    );
    expect(response.status).toBe(409);
  });

  it('لا يرفض إعادة إرسال نفس الـslug الحالي للتصنيف نفسه', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    const created = await createCategoryRoute(
      req('/api/v1/admin/categories', {
        method: 'POST',
        token,
        body: {
          name: 'تصنيف ثالث',
          slug: 'gap-category-c',
          description: 'وصف',
          icon: 'wrench',
          order: 52,
        },
      }),
      undefined
    );
    const id = ((await json(created)).data as { id: string }).id;

    const response = await updateCategoryRoute(
      req(`/api/v1/admin/categories/${id}`, {
        method: 'PATCH',
        token,
        body: { slug: 'gap-category-c', description: 'وصف محدَّث' },
      }),
      ctx(id)
    );
    expect(response.status).toBe(200);
    const body = (await json(response)).data as { description: string };
    expect(body.description).toBe('وصف محدَّث');
  });
});

/* ================================================================== */

describe('المهن — فروع لم تُفحص', () => {
  it('يعيد 404 عند تعديل مهنة غير موجودة', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    const fakeId = new Types.ObjectId().toString();

    const response = await updateProfessionRoute(
      req(`/api/v1/admin/professions/${fakeId}`, {
        method: 'PATCH',
        token,
        body: { name: 'اسم جديد' },
      }),
      ctx(fakeId)
    );
    expect(response.status).toBe(404);
  });

  it('يعيد 404 عند تعديل categoryId إلى تصنيف غير موجود', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    const created = await createProfessionRoute(
      req('/api/v1/admin/professions', {
        method: 'POST',
        token,
        body: {
          categoryId,
          name: 'مهنة لفحص تعديل التصنيف',
          slug: 'gap-profession-category',
          icon: 'wrench',
          order: 10,
          professionKind: 'CRAFT',
          requiresQualification: false,
          requiresLicense: false,
          documentRequirements: buildDocumentRequirements({
            requiresQualification: false,
            requiresLicense: false,
          }),
        },
      }),
      undefined
    );
    const id = ((await json(created)).data as { id: string }).id;
    const fakeCategoryId = new Types.ObjectId().toString();

    const response = await updateProfessionRoute(
      req(`/api/v1/admin/professions/${id}`, {
        method: 'PATCH',
        token,
        body: { categoryId: fakeCategoryId },
      }),
      ctx(id)
    );
    expect(response.status).toBe(404);
  });

  it('يرفض تعديل slug إلى قيمة مهنة أخرى تملكها بالفعل', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    const base = { icon: 'wrench', professionKind: 'CRAFT' as const, requiresQualification: false, requiresLicense: false };
    const requirements = buildDocumentRequirements({ requiresQualification: false, requiresLicense: false });

    await createProfessionRoute(
      req('/api/v1/admin/professions', {
        method: 'POST',
        token,
        body: { categoryId, ...base, name: 'مهنة أ', slug: 'gap-profession-a', order: 11, documentRequirements: requirements },
      }),
      undefined
    );
    const b = await createProfessionRoute(
      req('/api/v1/admin/professions', {
        method: 'POST',
        token,
        body: { categoryId, ...base, name: 'مهنة ب', slug: 'gap-profession-b', order: 12, documentRequirements: requirements },
      }),
      undefined
    );
    const bId = ((await json(b)).data as { id: string }).id;

    const response = await updateProfessionRoute(
      req(`/api/v1/admin/professions/${bId}`, {
        method: 'PATCH',
        token,
        body: { slug: 'gap-profession-a' },
      }),
      ctx(bId)
    );
    expect(response.status).toBe(409);
  });

  it('يقبل تعطيل requiresLicense بلا تعديل قائمة المستندات — القاعدة الوحيدة الباقية هي الهوية', async () => {
    /*
     * `validateRequirementsConsistency` (shared/constants/documents.ts) توثّق
     * صراحةً أن requiresQualification/requiresLicense لم تعودا تُقارَنان
     * بقائمة المستندات — القاعدة الوحيدة الباقية هي وجود NATIONAL_ID إلزاميًا.
     * هذا الاختبار يثبّت هذا السلوك المقصود لا يخالف بالخطأ لاحقًا.
     */
    const token = await tokenFor(adminId, 'ADMIN');
    const regulated = buildDocumentRequirements({ requiresQualification: false, requiresLicense: true });

    const created = await createProfessionRoute(
      req('/api/v1/admin/professions', {
        method: 'POST',
        token,
        body: {
          categoryId,
          name: 'مهنة منظمة للتعديل',
          slug: 'gap-profession-regulated',
          icon: 'wrench',
          order: 13,
          professionKind: 'REGULATED',
          requiresQualification: false,
          requiresLicense: true,
          documentRequirements: regulated,
        },
      }),
      undefined
    );
    const id = ((await json(created)).data as { id: string }).id;

    const response = await updateProfessionRoute(
      req(`/api/v1/admin/professions/${id}`, {
        method: 'PATCH',
        token,
        body: { requiresLicense: false },
      }),
      ctx(id)
    );
    expect(response.status).toBe(200);

    const updated = await Profession.findById(id);
    expect(updated?.requiresLicense).toBe(false);
  });
});

/* ================================================================== */

describe('إشراف الخدمات والتقييمات — 404', () => {
  it('يعيد 404 لخدمة غير موجودة', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    const fakeId = new Types.ObjectId().toString();

    const response = await setServiceActiveRoute(
      req(`/api/v1/admin/services/${fakeId}`, {
        method: 'PATCH',
        token,
        body: { isActive: false },
      }),
      ctx(fakeId)
    );
    expect(response.status).toBe(404);
  });

  it('يعيد 404 لتقييم غير موجود', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    const fakeId = new Types.ObjectId().toString();

    const response = await setReviewVisibilityRoute(
      req(`/api/v1/admin/reviews/${fakeId}`, {
        method: 'PATCH',
        token,
        body: { isVisible: false },
      }),
      ctx(fakeId)
    );
    expect(response.status).toBe(404);
  });
});

/* ================================================================== */

describe('البث العام — دقة العدّاد لكل جمهور', () => {
  it('جمهور PROVIDERS يحسب مقدّمي الخدمة النشطين فقط', async () => {
    const activeProviders = await User.countDocuments({ role: 'PROVIDER', status: 'ACTIVE' });
    const token = await tokenFor(adminId, 'ADMIN');

    const response = await broadcastRoute(
      req('/api/v1/admin/notifications/broadcast', {
        method: 'POST',
        token,
        body: {
          audience: 'PROVIDERS',
          type: 'SYSTEM',
          title: 'تحديث للمزوّدين',
          body: 'رسالة نظام لمقدّمي الخدمة النشطين.',
        },
      }),
      undefined
    );
    expect(response.status).toBe(200);
    const body = (await json(response)).data as { recipientsCount: number };
    expect(body.recipientsCount).toBe(activeProviders);
  });

  it('جمهور ALL يحسب العملاء ومقدّمي الخدمة النشطين — لا حسابات الإدارة', async () => {
    const activeCustomersAndProviders = await User.countDocuments({
      role: mongoose.trusted({ $in: ['CUSTOMER', 'PROVIDER'] }),
      status: 'ACTIVE',
    });
    const activeAdmins = await User.countDocuments({ role: 'ADMIN', status: 'ACTIVE' });
    expect(activeAdmins).toBeGreaterThan(0); // يضمن أن التمييز فعليًا يُختبر لا بالصدفة
    const token = await tokenFor(adminId, 'ADMIN');

    const response = await broadcastRoute(
      req('/api/v1/admin/notifications/broadcast', {
        method: 'POST',
        token,
        body: {
          audience: 'ALL',
          type: 'SYSTEM',
          title: 'رسالة عامة',
          body: 'رسالة نظام لكل المستخدمين النشطين.',
        },
      }),
      undefined
    );
    expect(response.status).toBe(200);
    const body = (await json(response)).data as { recipientsCount: number };
    expect(body.recipientsCount).toBe(activeCustomersAndProviders);
  });
});

/* ================================================================== */

describe('سجل التدقيق — الفلترة بنوع الإجراء', () => {
  it('يفلتر بـaction لا entityType فقط', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    const response = await listAuditLogsRoute(
      req('/api/v1/admin/audit-logs', {
        token,
        query: '?page=1&limit=50&action=CATEGORY_CHANGED',
      }),
      undefined
    );
    const body = await json(response);
    const items = body.data as Array<{ action: string }>;

    expect(items.length).toBeGreaterThan(0);
    expect(items.every((l) => l.action === 'CATEGORY_CHANGED')).toBe(true);
  });
});
