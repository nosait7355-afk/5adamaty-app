import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { buildAllIndexes, startTestDb, stopTestDb } from '../helpers/db';
import { runSeed } from '@/server/db/seed/seed';
import {
  Category,
  Profession,
  Review,
  Service,
  ServiceProvider,
  ServiceRequest,
  User,
} from '@/server/db/models';
import { resetRateLimitStore } from '@/server/middleware/with-rate-limit';
import { signAccessToken } from '@/server/lib/jwt';
import { hashPassword } from '@/server/lib/password';
import { buildDocumentRequirements } from '@/shared/constants/documents';

import { GET as dashboardRoute } from '@/app/api/v1/admin/dashboard/route';
import { GET as listUsersRoute } from '@/app/api/v1/admin/users/route';
import { PATCH as setUserStatusRoute } from '@/app/api/v1/admin/users/[id]/status/route';
import { GET as listCategoriesRoute, POST as createCategoryRoute } from '@/app/api/v1/admin/categories/route';
import { PATCH as updateCategoryRoute } from '@/app/api/v1/admin/categories/[id]/route';
import { GET as listProfessionsRoute, POST as createProfessionRoute } from '@/app/api/v1/admin/professions/route';
import { PATCH as updateProfessionRoute } from '@/app/api/v1/admin/professions/[id]/route';
import { GET as listServicesRoute } from '@/app/api/v1/admin/services/route';
import { PATCH as setServiceActiveRoute } from '@/app/api/v1/admin/services/[id]/route';
import { GET as listOrdersRoute } from '@/app/api/v1/admin/orders/route';
import { GET as getOrderRoute } from '@/app/api/v1/admin/orders/[id]/route';
import { GET as listReviewsRoute } from '@/app/api/v1/admin/reviews/route';
import { PATCH as setReviewVisibilityRoute } from '@/app/api/v1/admin/reviews/[id]/route';
import { POST as broadcastRoute } from '@/app/api/v1/admin/notifications/broadcast/route';
import { GET as listSettingsRoute, POST as upsertSettingRoute } from '@/app/api/v1/admin/settings/route';
import { GET as listAuditLogsRoute } from '@/app/api/v1/admin/audit-logs/route';
import { GET as publicDocRequirementsRoute } from '@/app/api/v1/professions/[id]/document-requirements/route';

/**
 * لوحة الإدارة (Phase 10).
 *
 * المحور: (1) كل مسار محروس بـADMIN فعليًا لا بالواجهة فقط، (2) محرّك
 * المستندات الديناميكي قابل للتعديل من الإدارة وتغييراته تنعكس فورًا على
 * المسار العام الذي تستخدمه شاشة تسجيل مقدمي الخدمة (الصورة 21)، (3) كل
 * كتابة تُسجَّل في auditLogs.
 */

let adminId = '';
let customerId = '';
let providerId = '';
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
    fullName: 'مدير النظام',
    phone: '+201000000002',
    email: 'admin2@test.local',
    passwordHash: await hashPassword('AdminPass123'),
    status: 'ACTIVE',
  });
  adminId = String(admin._id);

  const customer = await User.create({
    role: 'CUSTOMER',
    fullName: 'عميل الاختبار',
    phone: '+201000000003',
    passwordHash: await hashPassword('CustPass123'),
    status: 'ACTIVE',
  });
  customerId = String(customer._id);

  const providerUser = await User.create({
    role: 'PROVIDER',
    fullName: 'مزوّد الاختبار',
    phone: '+201000000004',
    passwordHash: await hashPassword('ProvPass123'),
    status: 'ACTIVE',
  });
  providerId = String(providerUser._id);

  const category = await Category.findOne({ slug: 'home-services' });
  categoryId = String(category?._id);
}, 90_000);

afterAll(async () => {
  await stopTestDb();
});

afterEach(() => {
  resetRateLimitStore();
});

/* ================================================================== */
/* أدوات مساعدة                                                        */
/* ================================================================== */

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
    'x-forwarded-for': `10.3.0.${Math.floor(Math.random() * 250) + 1}`,
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
  meta?: { total?: number };
  error?: { code: string; message: string; fields?: Record<string, string> };
}

async function json(response: Response): Promise<Body> {
  return (await response.json()) as Body;
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

/* ================================================================== */
/* RBAC — كل مسار إداري محروس فعليًا                                    */
/* ================================================================== */

describe('RBAC — لوحة الإدارة', () => {
  it('يرفض زائرًا بلا جلسة بـ401', async () => {
    const response = await dashboardRoute(req('/api/v1/admin/dashboard'), undefined);
    expect(response.status).toBe(401);
  });

  it('يرفض عميلًا بـ403', async () => {
    const token = await tokenFor(customerId, 'CUSTOMER');
    const response = await dashboardRoute(req('/api/v1/admin/dashboard', { token }), undefined);
    expect(response.status).toBe(403);
  });

  it('يرفض مقدّم خدمة بـ403', async () => {
    const token = await tokenFor(providerId, 'PROVIDER');
    const response = await listUsersRoute(req('/api/v1/admin/users', { token, query: '?page=1&limit=10' }), undefined);
    expect(response.status).toBe(403);
  });

  it('🔐 لا يوجد أي احتيال دور — نفس التوكن لا يفتح مسارين بصلاحيتين مختلفتين', async () => {
    const customerToken = await tokenFor(customerId, 'CUSTOMER');
    const results = await Promise.all([
      listCategoriesRoute(req('/api/v1/admin/categories', { token: customerToken }), undefined),
      listProfessionsRoute(req('/api/v1/admin/professions', { token: customerToken, query: '?includeInactive=true' }), undefined),
      listServicesRoute(req('/api/v1/admin/services', { token: customerToken, query: '?page=1&limit=10' }), undefined),
      listOrdersRoute(req('/api/v1/admin/orders', { token: customerToken, query: '?page=1&limit=10' }), undefined),
      listReviewsRoute(req('/api/v1/admin/reviews', { token: customerToken, query: '?page=1&limit=10' }), undefined),
      listSettingsRoute(req('/api/v1/admin/settings', { token: customerToken }), undefined),
      listAuditLogsRoute(req('/api/v1/admin/audit-logs', { token: customerToken, query: '?page=1&limit=10' }), undefined),
    ]);
    for (const response of results) expect(response.status).toBe(403);
  });

  it('يسمح للإدارة بالوصول', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    const response = await dashboardRoute(req('/api/v1/admin/dashboard', { token }), undefined);
    expect(response.status).toBe(200);
  });
});

/* ================================================================== */
/* لوحة القيادة                                                        */
/* ================================================================== */

describe('لوحة القيادة', () => {
  it('لا تحتوي أي كيان مالي — إحصاء وصفي فقط', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    const response = await dashboardRoute(req('/api/v1/admin/dashboard', { token }), undefined);
    const body = await json(response);

    expect(response.status).toBe(200);
    const data = body.data as Record<string, unknown>;
    expect(data).toHaveProperty('completedOrdersTotalValue');
    expect(typeof data.completedOrdersTotalValue).toBe('number');
    // لا حقل باسم يوحي بمعاملة مالية أو رصيد محفظة
    expect(JSON.stringify(data)).not.toMatch(/transaction|wallet|balance|payment/i);
  });
});

/* ================================================================== */
/* المستخدمون                                                          */
/* ================================================================== */

describe('إدارة المستخدمين', () => {
  it('يوقف حسابًا نشطًا ويسجّل السبب', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    const response = await setUserStatusRoute(
      req(`/api/v1/admin/users/${customerId}/status`, {
        method: 'PATCH',
        token,
        body: { status: 'SUSPENDED', reason: 'شكوى متكررة' },
      }),
      ctx(customerId)
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    expect((body.data as { status: string }).status).toBe('SUSPENDED');

    const updated = await User.findById(customerId).lean();
    expect(updated?.status).toBe('SUSPENDED');

    // نعيده نشطًا حتى لا تتأثر اختبارات لاحقة تعتمد عليه
    await User.updateOne({ _id: customerId }, { $set: { status: 'ACTIVE' } });
  });

  it('🔐 يرفض تعديل الإدارة لحسابها الخاص', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    const response = await setUserStatusRoute(
      req(`/api/v1/admin/users/${adminId}/status`, {
        method: 'PATCH',
        token,
        body: { status: 'SUSPENDED' },
      }),
      ctx(adminId)
    );
    expect(response.status).toBe(403);
  });

  it('🔐 يرفض تعديل حساب إداري آخر من هنا', async () => {
    const otherAdmin = await User.create({
      role: 'ADMIN',
      fullName: 'مدير آخر',
      phone: '+201000000005',
      passwordHash: await hashPassword('Other12345'),
      status: 'ACTIVE',
    });
    const token = await tokenFor(adminId, 'ADMIN');
    const response = await setUserStatusRoute(
      req(`/api/v1/admin/users/${String(otherAdmin._id)}/status`, {
        method: 'PATCH',
        token,
        body: { status: 'SUSPENDED' },
      }),
      ctx(String(otherAdmin._id))
    );
    expect(response.status).toBe(403);
  });

  it('يعيد 404 لمستخدم غير موجود', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    const fakeId = new Types.ObjectId().toString();
    const response = await setUserStatusRoute(
      req(`/api/v1/admin/users/${fakeId}/status`, {
        method: 'PATCH',
        token,
        body: { status: 'SUSPENDED' },
      }),
      ctx(fakeId)
    );
    expect(response.status).toBe(404);
  });

  it('يفلتر بالدور والبحث', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    const response = await listUsersRoute(
      req('/api/v1/admin/users', { token, query: '?page=1&limit=50&role=CUSTOMER' })
    , undefined);
    const body = await json(response);
    const items = body.data as Array<{ role: string }>;
    expect(items.every((u) => u.role === 'CUSTOMER')).toBe(true);
  });
});

/* ================================================================== */
/* التصنيفات                                                           */
/* ================================================================== */

describe('التصنيفات', () => {
  it('ينشئ تصنيفًا ويرفض تكرار الـslug', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    const payload = {
      name: 'تصنيف اختباري',
      slug: 'test-category-admin',
      description: 'وصف اختباري',
      icon: 'wrench',
      order: 99,
    };

    const created = await createCategoryRoute(
      req('/api/v1/admin/categories', { method: 'POST', token, body: payload })
    , undefined);
    expect(created.status).toBe(201);

    const duplicate = await createCategoryRoute(
      req('/api/v1/admin/categories', { method: 'POST', token, body: payload })
    , undefined);
    expect(duplicate.status).toBe(409);
  });

  it('🔐 يرفض تعطيل تصنيف يحتوي مهنًا نشطة', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    const response = await updateCategoryRoute(
      req(`/api/v1/admin/categories/${categoryId}`, {
        method: 'PATCH',
        token,
        body: { isActive: false },
      }),
      ctx(categoryId)
    );
    expect(response.status).toBe(422);
  });

  it('يعيد كل التصنيفات بما فيها المعطّلة', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    await Category.updateOne({ _id: categoryId }, { $set: { isActive: false } });

    const response = await listCategoriesRoute(req('/api/v1/admin/categories', { token }), undefined);
    const body = await json(response);
    const items = body.data as Array<{ id: string; isActive: boolean }>;

    expect(items.some((c) => c.id === categoryId && c.isActive === false)).toBe(true);

    await Category.updateOne({ _id: categoryId }, { $set: { isActive: true } });
  });
});

/* ================================================================== */
/* المهن + محرّك المستندات الديناميكي — القلب التشغيلي                   */
/* ================================================================== */

describe('المهن ومحرّك المستندات الديناميكي', () => {
  it('🔐 يرفض 422 عند حذف بطاقة الرقم القومي من القائمة', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    const badRequirements = buildDocumentRequirements({}).filter(
      (item) => item.key !== 'NATIONAL_ID'
    );

    const response = await createProfessionRoute(
      req('/api/v1/admin/professions', {
        method: 'POST',
        token,
        body: {
          categoryId,
          name: 'مهنة متعارضة',
          slug: 'inconsistent-profession',
          icon: 'wrench',
          order: 1,
          professionKind: 'REGULATED',
          requiresQualification: false,
          requiresLicense: true,
          documentRequirements: badRequirements, // بلا هوية — مخالفة متعمّدة
        },
      })
    , undefined);

    expect(response.status).toBe(422);
  });

  it('ينشئ مهنة حرفية بالمستندات الأربعة، الهوية وحدها إلزامية', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    const requirements = buildDocumentRequirements({
      requiresQualification: false,
      requiresLicense: false,
    });

    const response = await createProfessionRoute(
      req('/api/v1/admin/professions', {
        method: 'POST',
        token,
        body: {
          categoryId,
          name: 'حرفة اختبارية',
          slug: 'test-craft-profession',
          icon: 'wrench',
          order: 1,
          professionKind: 'CRAFT',
          requiresQualification: false,
          requiresLicense: false,
          documentRequirements: requirements,
        },
      })
    , undefined);

    expect(response.status).toBe(201);
    const body = await json(response);
    const data = body.data as {
      id: string;
      documentRequirements: Array<{ key: string; required: boolean }>;
    };
    expect(data.documentRequirements).toHaveLength(4);
    expect(data.documentRequirements.filter((r) => r.required)).toHaveLength(1);
  });

  it('🔐 المسار العام يعكس فورًا تعديل الإدارة على متطلبات المستندات', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    // قائمة مقلّصة يدويًا — Admin يحرّرها بحرية ما دامت الهوية إلزامية
    const requirements = buildDocumentRequirements({}).filter((item) =>
      ['NATIONAL_ID', 'PERSONAL_PHOTO'].includes(item.key)
    );

    const created = await createProfessionRoute(
      req('/api/v1/admin/professions', {
        method: 'POST',
        token,
        body: {
          categoryId,
          name: 'حرفة قابلة للتطوير',
          slug: 'upgradable-craft',
          icon: 'wrench',
          order: 2,
          professionKind: 'CRAFT',
          requiresQualification: false,
          requiresLicense: false,
          documentRequirements: requirements,
        },
      })
    , undefined);
    const createdBody = await json(created);
    const professionId = (createdBody.data as { id: string }).id;

    // قبل التعديل: مستندان عبر المسار العام (نفس ما تراه شاشة التسجيل)
    const before = await publicDocRequirementsRoute(
      req(`/api/v1/professions/${professionId}/document-requirements`),
      ctx(professionId)
    );
    const beforeBody = await json(before);
    expect((beforeBody.data as { requirements: unknown[] }).requirements).toHaveLength(2);

    // الإدارة تحوّلها إلى مهنة منظَّمة بالقائمة الكاملة
    const upgraded = buildDocumentRequirements({
      requiresQualification: true,
      requiresLicense: true,
    });
    const updateResponse = await updateProfessionRoute(
      req(`/api/v1/admin/professions/${professionId}`, {
        method: 'PATCH',
        token,
        body: {
          professionKind: 'REGULATED',
          requiresQualification: true,
          requiresLicense: true,
          documentRequirements: upgraded,
        },
      }),
      ctx(professionId)
    );
    expect(updateResponse.status).toBe(200);

    // بعد التعديل مباشرة — بلا أي نشر كود — المسار العام يعكس 4 مستندات
    const after = await publicDocRequirementsRoute(
      req(`/api/v1/professions/${professionId}/document-requirements`),
      ctx(professionId)
    );
    const afterBody = await json(after);
    const afterData = afterBody.data as {
      requiresQualification: boolean;
      requiresLicense: boolean;
      requirements: Array<{ key: string; required: boolean }>;
    };
    expect(afterData.requiresQualification).toBe(true);
    expect(afterData.requiresLicense).toBe(true);
    expect(afterData.requirements).toHaveLength(4);
    expect(afterData.requirements.filter((r) => r.required)).toHaveLength(1);
  });

  it('يرفض slug مكررًا للمهنة', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    const requirements = buildDocumentRequirements({
      requiresQualification: false,
      requiresLicense: false,
    });
    const payload = {
      categoryId,
      name: 'مهنة مكررة',
      slug: 'test-craft-profession', // نفس slug من اختبار سابق
      icon: 'wrench',
      order: 3,
      professionKind: 'CRAFT' as const,
      requiresQualification: false,
      requiresLicense: false,
      documentRequirements: requirements,
    };

    const response = await createProfessionRoute(
      req('/api/v1/admin/professions', { method: 'POST', token, body: payload })
    , undefined);
    expect(response.status).toBe(409);
  });

  it('يعيد قائمة المهن شاملة المعطّلة عند includeInactive=true', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    const profession = await Profession.findOne({ slug: 'test-craft-profession' });
    await Profession.updateOne({ _id: profession?._id }, { $set: { isActive: false } });

    const activeOnly = await listProfessionsRoute(
      req('/api/v1/admin/professions', { token, query: '?includeInactive=false' })
    , undefined);
    const activeBody = await json(activeOnly);
    const activeItems = activeBody.data as Array<{ id: string }>;
    expect(activeItems.some((p) => p.id === String(profession?._id))).toBe(false);

    const withInactive = await listProfessionsRoute(
      req('/api/v1/admin/professions', { token, query: '?includeInactive=true' })
    , undefined);
    const withInactiveBody = await json(withInactive);
    const allItems = withInactiveBody.data as Array<{ id: string }>;
    expect(allItems.some((p) => p.id === String(profession?._id))).toBe(true);
  });
});

/* ================================================================== */
/* الخدمات (إشراف)                                                     */
/* ================================================================== */

describe('إشراف الخدمات', () => {
  it('يخفي خدمة ولا يحذفها', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    const service = await Service.findOne({ isActive: true });
    expect(service).not.toBeNull();

    const response = await setServiceActiveRoute(
      req(`/api/v1/admin/services/${String(service?._id)}`, {
        method: 'PATCH',
        token,
        body: { isActive: false, reason: 'مراجعة' },
      }),
      ctx(String(service?._id))
    );
    expect(response.status).toBe(200);

    const stillExists = await Service.findById(service?._id).lean();
    expect(stillExists).not.toBeNull();
    expect(stillExists?.isActive).toBe(false);

    await Service.updateOne({ _id: service?._id }, { $set: { isActive: true } });
  });

  it('يفلتر بحالة الإظهار', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    const response = await listServicesRoute(
      req('/api/v1/admin/services', { token, query: '?page=1&limit=50&isActive=true' })
    , undefined);
    const body = await json(response);
    const items = body.data as Array<{ isActive: boolean }>;
    expect(items.every((s) => s.isActive)).toBe(true);
  });
});

/* ================================================================== */
/* الطلبات (قراءة إشرافية)                                             */
/* ================================================================== */

describe('قراءة الطلبات الإشرافية', () => {
  it('تعيد قائمة وتفاصيل الطلب بلا أي تعديل حالة', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    const list = await listOrdersRoute(
      req('/api/v1/admin/orders', { token, query: '?page=1&limit=5' })
    , undefined);
    expect(list.status).toBe(200);

    const listBody = await json(list);
    const items = listBody.data as Array<{ id: string }>;
    if (items.length > 0) {
      const detail = await getOrderRoute(
        req(`/api/v1/admin/orders/${items[0]!.id}`, { token }),
        ctx(items[0]!.id)
      );
      expect(detail.status).toBe(200);
      const detailBody = await json(detail);
      expect(detailBody.data).toHaveProperty('statusHistory');
    }
  });

  it('يعيد 404 لطلب غير موجود', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    const fakeId = new Types.ObjectId().toString();
    const response = await getOrderRoute(req(`/api/v1/admin/orders/${fakeId}`, { token }), ctx(fakeId));
    expect(response.status).toBe(404);
  });
});

/* ================================================================== */
/* التقييمات — إخفاء يعيد حساب متوسط تقييم المزوّد                      */
/* ================================================================== */

describe('إشراف التقييمات', () => {
  it('🔐 إخفاء تقييم يعيد حساب متوسط المزوّد من التقييمات الظاهرة فقط', async () => {
    const provider = await ServiceProvider.findOne({ isActive: true });
    expect(provider).not.toBeNull();

    const orderA = await ServiceRequest.create({
      orderNumber: 900001,
      customerId,
      providerId: provider!._id,
      categoryId: provider!.categoryId,
      professionId: provider!.professionId,
      serviceType: 'اختبار',
      details: 'تفاصيل اختبارية لطلب مكتمل من أجل التقييم.',
      address: { governorate: 'الفيوم', city: 'الفيوم', area: 'حي الجامعة', line: 'شارع تجريبي' },
      scheduledDate: new Date(),
      status: 'COMPLETED',
      cashReceivedConfirmed: true,
    });
    const orderB = await ServiceRequest.create({
      orderNumber: 900002,
      customerId,
      providerId: provider!._id,
      categoryId: provider!.categoryId,
      professionId: provider!.professionId,
      serviceType: 'اختبار آخر',
      details: 'تفاصيل اختبارية ثانية لطلب مكتمل من أجل التقييم.',
      address: { governorate: 'الفيوم', city: 'الفيوم', area: 'حي الجامعة', line: 'شارع تجريبي' },
      scheduledDate: new Date(),
      status: 'COMPLETED',
      cashReceivedConfirmed: true,
    });

    const reviewA = await Review.create({
      orderId: orderA._id,
      customerId,
      providerId: provider!._id,
      rating: 5,
      isVisible: true,
    });
    await Review.create({
      orderId: orderB._id,
      customerId,
      providerId: provider!._id,
      rating: 1,
      isVisible: true,
    });

    await ServiceProvider.updateOne(
      { _id: provider!._id },
      { $set: { ratingAvg: 3, ratingCount: 2 } }
    );

    const token = await tokenFor(adminId, 'ADMIN');
    const response = await setReviewVisibilityRoute(
      req(`/api/v1/admin/reviews/${String(reviewA._id)}`, {
        method: 'PATCH',
        token,
        body: { isVisible: false, adminNote: 'محتوى غير لائق' },
      }),
      ctx(String(reviewA._id))
    );
    expect(response.status).toBe(200);

    const updatedProvider = await ServiceProvider.findById(provider!._id).lean();
    // بعد إخفاء تقييم الخمس نجوم، يبقى تقييم النجمة الواحدة فقط ظاهرًا
    expect(updatedProvider?.ratingAvg).toBe(1);
    expect(updatedProvider?.ratingCount).toBe(1);
  });
});

/* ================================================================== */
/* الإشعارات العامة (Broadcast)                                        */
/* ================================================================== */

describe('البث العام', () => {
  it('يبث لفئة العملاء فقط ويحسب المستلمين بدقة', async () => {
    const activeCustomers = await User.countDocuments({ role: 'CUSTOMER', status: 'ACTIVE' });

    const token = await tokenFor(adminId, 'ADMIN');
    const response = await broadcastRoute(
      req('/api/v1/admin/notifications/broadcast', {
        method: 'POST',
        token,
        body: {
          audience: 'CUSTOMERS',
          type: 'PROMOTION',
          title: 'خصم على خدمات التنظيف',
          body: 'خصم 20% هذا الأسبوع على خدمات التنظيف المنزلي.',
        },
      })
    , undefined);

    expect(response.status).toBe(200);
    const body = await json(response);
    expect((body.data as { recipientsCount: number }).recipientsCount).toBe(activeCustomers);
  });

  it('🔐 يرفض رابط إجراء خارجي', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    const response = await broadcastRoute(
      req('/api/v1/admin/notifications/broadcast', {
        method: 'POST',
        token,
        body: {
          audience: 'ALL',
          type: 'SYSTEM',
          title: 'عنوان',
          body: 'نص الإشعار',
          actionUrl: 'https://evil.example.com',
        },
      })
    , undefined);
    expect(response.status).toBe(400);
  });
});

/* ================================================================== */
/* الإعدادات العامة                                                    */
/* ================================================================== */

describe('الإعدادات العامة', () => {
  it('ينشئ إعدادًا ثم يعدّله بنفس المفتاح (upsert)', async () => {
    const token = await tokenFor(adminId, 'ADMIN');

    const created = await upsertSettingRoute(
      req('/api/v1/admin/settings', {
        method: 'POST',
        token,
        body: { key: 'support_phone_test', value: '01000000000' },
      })
    , undefined);
    expect(created.status).toBe(200);

    const updated = await upsertSettingRoute(
      req('/api/v1/admin/settings', {
        method: 'POST',
        token,
        body: { key: 'support_phone_test', value: '01099999999' },
      })
    , undefined);
    expect(updated.status).toBe(200);

    const list = await listSettingsRoute(req('/api/v1/admin/settings', { token }), undefined);
    const listBody = await json(list);
    const items = listBody.data as Array<{ key: string; value: unknown }>;
    const matches = items.filter((s) => s.key === 'support_phone_test');

    expect(matches).toHaveLength(1);
    expect(matches[0]?.value).toBe('01099999999');
  });
});

/* ================================================================== */
/* سجل التدقيق — كل كتابة أعلاه سجّلت أثرًا                             */
/* ================================================================== */

describe('سجل التدقيق', () => {
  it('يحوي إجراءات المهن والتصنيفات والمستخدمين التي نُفّذت أعلاه', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    const response = await listAuditLogsRoute(
      req('/api/v1/admin/audit-logs', { token, query: '?page=1&limit=50' })
    , undefined);
    const body = await json(response);
    const actions = (body.data as Array<{ action: string }>).map((l) => l.action);

    expect(actions).toContain('PROFESSION_CHANGED');
    expect(actions).toContain('CATEGORY_CHANGED');
    expect(actions).toContain('USER_STATUS_CHANGED');
    expect(actions).toContain('REVIEW_MODERATED');
    expect(actions).toContain('NOTIFICATION_BROADCAST');
  });

  it('يفلتر بنوع الكيان', async () => {
    const token = await tokenFor(adminId, 'ADMIN');
    const response = await listAuditLogsRoute(
      req('/api/v1/admin/audit-logs', { token, query: '?page=1&limit=50&entityType=Profession' })
    , undefined);
    const body = await json(response);
    const items = body.data as Array<{ entityType: string }>;
    expect(items.every((l) => l.entityType === 'Profession')).toBe(true);
    expect(items.length).toBeGreaterThan(0);
  });
});
