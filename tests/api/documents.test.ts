import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { buildAllIndexes, clearTestDb, startTestDb, stopTestDb } from '../helpers/db';
import { Category, Profession, ProviderDocument, ServiceProvider, User } from '@/server/db/models';
import { buildDocumentRequirements } from '@/shared/constants/documents';
import {
  getDocumentUrl,
  listMyDocuments,
  removeDocument,
  saveDocument,
} from '@/server/services/documents.service';
import type { SessionUser } from '@/server/middleware/with-auth';

/**
 * المستندات أخطر بيانات في النظام (بطاقات رقم قومي، مؤهلات، تراخيص).
 * هذه الاختبارات تركّز على منع IDOR وعلى أن المحرّك الديناميكي يفرض
 * متطلبات المهنة على مستوى السيرفر لا الواجهة.
 */

beforeAll(async () => {
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
  process.env.CLOUDINARY_API_KEY = '123456789012345';
  process.env.CLOUDINARY_API_SECRET = 'test-api-secret-value';
  // إلزامي فعليًا لفتح أي مستند authenticated — انظر التعليق في cloudinary.ts
  process.env.CLOUDINARY_AUTH_TOKEN_KEY = 'deadbeefdeadbeefdeadbeefdeadbeef';
  process.env.APP_URL = 'http://localhost:3000';

  await startTestDb();
  await buildAllIndexes();
}, 60_000);

afterAll(async () => {
  await stopTestDb();
  vi.restoreAllMocks();
});

beforeEach(async () => {
  await clearTestDb();
  vi.restoreAllMocks();
});

/* ---- أدوات البناء ---- */

async function makeProvider(options: {
  kind: 'CRAFT' | 'REGULATED';
  slug: string;
  approved?: boolean;
}) {
  const category = await Category.create({
    name: 'خدمات',
    slug: `cat-${options.slug}`,
    description: 'وصف',
    icon: 'home',
  });

  const requiresQualification = options.kind === 'REGULATED';
  const requiresLicense = options.kind === 'REGULATED';

  const profession = await Profession.create({
    categoryId: category._id,
    name: options.kind === 'CRAFT' ? 'سبّاك' : 'طبيب',
    slug: options.slug,
    icon: 'wrench',
    professionKind: options.kind,
    requiresQualification,
    requiresLicense,
    documentRequirements: buildDocumentRequirements({ requiresQualification, requiresLicense }),
  });

  const user = await User.create({
    role: 'PROVIDER',
    fullName: 'مقدم خدمة',
    phone: `+2010${Math.floor(10_000_000 + Math.random() * 80_000_000)}`,
    passwordHash: 'x',
  });

  const provider = await ServiceProvider.create({
    userId: user._id,
    displayName: 'مزوّد اختبار',
    categoryId: category._id,
    professionId: profession._id,
    yearsOfExperience: 5,
    bio: 'وصف الخدمة',
    coverageAreas: ['الفيوم'],
    isActive: options.approved ?? false,
    verification: {
      status: options.approved ? 'APPROVED' : 'PENDING_REVIEW',
      requestNumber: `SRV-2025-${Math.floor(Math.random() * 900_000) + 100_000}`,
    },
  });

  const session: SessionUser = {
    id: String(user._id),
    role: 'PROVIDER',
    status: 'ACTIVE',
  };

  return { user, provider, profession, category, session };
}

/**
 * يحاكي استجابة Cloudinary لأصل مرفوع بنجاح.
 *
 * `mockImplementation` لا `mockResolvedValue`: جسم `Response` يُقرأ مرة
 * واحدة فقط، فإعادة نفس الكائن تكسر أي اختبار يحفظ أكثر من مستند.
 */
function mockCloudinaryAsset(publicId: string, overrides: Record<string, unknown> = {}) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
    new Response(
      JSON.stringify({
        public_id: publicId,
        format: 'jpg',
        bytes: 250_000,
        width: 1200,
        height: 900,
        resource_type: 'image',
        type: 'authenticated',
        secure_url: `https://res.cloudinary.com/test-cloud/image/authenticated/${publicId}.jpg`,
        ...overrides,
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )
  );
}

function documentPublicId(userId: string) {
  return `khadamaty/documents/${userId}/provider_document_abc123`;
}

/* ================================================================== */

describe('حفظ المستندات — المحرّك الديناميكي', () => {
  it('يحفظ مستندًا مطلوبًا لمهنة حرفية', async () => {
    const { session } = await makeProvider({ kind: 'CRAFT', slug: 'plumber' });
    const publicId = documentPublicId(session.id);
    mockCloudinaryAsset(publicId);

    const document = await saveDocument(session, {
      requirementKey: 'NATIONAL_ID',
      publicId,
    });

    expect(document.requirementKey).toBe('NATIONAL_ID');
    expect(document.label).toBe('الهوية الشخصية');
    expect(document.status).toBe('PENDING');
  });

  it('🔐 يرفض مفتاح مستند خارج قائمة المهنة كليًا', async () => {
    const { session } = await makeProvider({ kind: 'CRAFT', slug: 'plumber2' });
    const publicId = documentPublicId(session.id);
    mockCloudinaryAsset(publicId);

    // إثبات العنوان لم يعد في القائمة الافتراضية لأي مهنة
    await expect(
      saveDocument(session, { requirementKey: 'ADDRESS_PROOF', publicId })
    ).rejects.toThrow(/غير مطلوب لمهنتك/);
  });

  it('يقبل المؤهل والترخيص لمهنة حرفية — صارا اختياريين لكل المهن', async () => {
    const { session } = await makeProvider({ kind: 'CRAFT', slug: 'plumber3' });
    const publicId = documentPublicId(session.id);
    mockCloudinaryAsset(publicId);

    await expect(
      saveDocument(session, { requirementKey: 'PROFESSIONAL_CERT', publicId })
    ).resolves.toBeTruthy();
  });

  it('يقبل المؤهل والترخيص لمهنة منظَّمة', async () => {
    const { session } = await makeProvider({ kind: 'REGULATED', slug: 'doctor' });
    const publicId = documentPublicId(session.id);
    mockCloudinaryAsset(publicId);

    await expect(
      saveDocument(session, { requirementKey: 'PROFESSIONAL_CERT', publicId })
    ).resolves.toBeDefined();
    await expect(
      saveDocument(session, { requirementKey: 'PRACTICE_LICENSE', publicId })
    ).resolves.toBeDefined();
  });

  it('🔐 يرفض حفظ أصل خارج مجلد المستخدم', async () => {
    const { session } = await makeProvider({ kind: 'CRAFT', slug: 'plumber4' });
    const victimId = new Types.ObjectId().toString();
    const foreignPublicId = documentPublicId(victimId);
    mockCloudinaryAsset(foreignPublicId);

    await expect(
      saveDocument(session, { requirementKey: 'NATIONAL_ID', publicId: foreignPublicId })
    ).rejects.toThrow(/لا يخص حسابك/);
  });

  it('🔐 يرفض أصلًا غير موجود لدى Cloudinary', async () => {
    const { session } = await makeProvider({ kind: 'CRAFT', slug: 'plumber5' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 404 }));

    await expect(
      saveDocument(session, {
        requirementKey: 'NATIONAL_ID',
        publicId: documentPublicId(session.id),
      })
    ).rejects.toThrow(/تعذّر التحقق/);
  });

  it('🔐 يرفض أصلًا حجمه الحقيقي يتجاوز الحد', async () => {
    const { session } = await makeProvider({ kind: 'CRAFT', slug: 'plumber6' });
    const publicId = documentPublicId(session.id);
    // العميل ادّعى حجمًا صغيرًا لكن Cloudinary تقول 9MB
    mockCloudinaryAsset(publicId, { bytes: 9 * 1024 * 1024 });

    await expect(
      saveDocument(session, { requirementKey: 'NATIONAL_ID', publicId })
    ).rejects.toThrow(/يتجاوز الحد/);
  });

  it('🔐 يرفض مستندًا حسّاسًا مرفوعًا بوضع وصول عام', async () => {
    const { session } = await makeProvider({ kind: 'CRAFT', slug: 'plumber7' });
    const publicId = documentPublicId(session.id);
    mockCloudinaryAsset(publicId, { type: 'upload' });

    await expect(
      saveDocument(session, { requirementKey: 'NATIONAL_ID', publicId })
    ).rejects.toThrow(/خصوصية الملف/);
  });

  it('🔐 يرفض صيغة غير مسموحة حتى لو مرّت من Cloudinary', async () => {
    const { session } = await makeProvider({ kind: 'CRAFT', slug: 'plumber8' });
    const publicId = documentPublicId(session.id);
    mockCloudinaryAsset(publicId, { format: 'svg' });

    await expect(
      saveDocument(session, { requirementKey: 'NATIONAL_ID', publicId })
    ).rejects.toThrow(/غير مسموح/);
  });

  it('إعادة الرفع تستبدل ولا تكرّر، وتعيد الحالة للمراجعة', async () => {
    const { session, provider } = await makeProvider({ kind: 'CRAFT', slug: 'plumber9' });
    const publicId = documentPublicId(session.id);
    mockCloudinaryAsset(publicId);

    await saveDocument(session, { requirementKey: 'NATIONAL_ID', publicId });

    // الإدارة ترفض المستند
    await ProviderDocument.updateOne(
      { providerId: provider._id, requirementKey: 'NATIONAL_ID' },
      { $set: { status: 'REJECTED', rejectionReason: 'الصورة غير واضحة' } }
    );

    // المزوّد يعيد الرفع
    const republished = await saveDocument(session, { requirementKey: 'NATIONAL_ID', publicId });

    expect(republished.status).toBe('PENDING');
    expect(republished.rejectionReason).toBeUndefined();

    const count = await ProviderDocument.countDocuments({ providerId: provider._id });
    expect(count).toBe(1);
  });
});

describe('قائمة المستندات', () => {
  it('تعيد المتطلبات مع حالة الاكتمال', async () => {
    const { session } = await makeProvider({ kind: 'CRAFT', slug: 'plumber10' });
    const publicId = documentPublicId(session.id);
    mockCloudinaryAsset(publicId);

    const before = await listMyDocuments(session);
    expect(before.requirements).toHaveLength(4);
    expect(before.isComplete).toBe(false);
    // الهوية وحدها إلزامية
    expect(before.missingRequired).toEqual(['الهوية الشخصية']);

    await saveDocument(session, { requirementKey: 'NATIONAL_ID', publicId });

    const after = await listMyDocuments(session);
    expect(after.isComplete).toBe(true);
    expect(after.missingRequired).toEqual([]);
  });

  it('مهنة حرفية تكتمل بالهوية وحدها، ولا إثبات عنوان في القائمة', async () => {
    const { session } = await makeProvider({ kind: 'CRAFT', slug: 'plumber11' });
    const publicId = documentPublicId(session.id);
    mockCloudinaryAsset(publicId);

    await saveDocument(session, { requirementKey: 'NATIONAL_ID', publicId });

    const result = await listMyDocuments(session);
    expect(result.isComplete).toBe(true);
    expect(result.requirements.some((r) => r.key === 'ADDRESS_PROOF')).toBe(false);
  });

  it('المهنة المنظَّمة تكتمل هي الأخرى بالهوية وحدها', async () => {
    const { session } = await makeProvider({ kind: 'REGULATED', slug: 'doctor2' });
    const publicId = documentPublicId(session.id);
    mockCloudinaryAsset(publicId);

    const before = await listMyDocuments(session);
    expect(before.missingRequired).toEqual(['الهوية الشخصية']);

    await saveDocument(session, { requirementKey: 'NATIONAL_ID', publicId });

    expect((await listMyDocuments(session)).isComplete).toBe(true);
  });

  it('🔐 القائمة لا تحتوي أي رابط للمستندات', async () => {
    const { session } = await makeProvider({ kind: 'CRAFT', slug: 'plumber12' });
    const publicId = documentPublicId(session.id);
    mockCloudinaryAsset(publicId);
    await saveDocument(session, { requirementKey: 'NATIONAL_ID', publicId });

    const result = await listMyDocuments(session);
    const serialized = JSON.stringify(result.documents);

    expect(serialized).not.toContain('cloudinary.com');
    expect(serialized).not.toContain('publicId');
    expect(result.documents[0]).not.toHaveProperty('url');
  });
});

describe('🔐 روابط المستندات — منع IDOR', () => {
  it('المالك يحصل على رابط موقّع', async () => {
    const { session } = await makeProvider({ kind: 'CRAFT', slug: 'plumber13' });
    const publicId = documentPublicId(session.id);
    mockCloudinaryAsset(publicId);
    const document = await saveDocument(session, { requirementKey: 'NATIONAL_ID', publicId });

    const result = await getDocumentUrl(session, document.id);

    expect(result.url).toContain('res.cloudinary.com');
    expect(result.url).toContain('/authenticated/');
    // التوقيع s--xxxx-- يمنع تخمين الرابط
    expect(result.url).toMatch(/\/s--[A-Za-z0-9_-]{8}--\//);
  });

  it('🔐 مزوّد آخر يتلقى 404 لا 403', async () => {
    const owner = await makeProvider({ kind: 'CRAFT', slug: 'plumber14' });
    const attacker = await makeProvider({ kind: 'CRAFT', slug: 'plumber15' });

    const publicId = documentPublicId(owner.session.id);
    mockCloudinaryAsset(publicId);
    const document = await saveDocument(owner.session, {
      requirementKey: 'NATIONAL_ID',
      publicId,
    });

    // 404 لا 403 — لا نؤكد وجود المستند أصلًا
    await expect(getDocumentUrl(attacker.session, document.id)).rejects.toThrow(/غير موجود/);
  });

  it('🔐 عميل عادي لا يصل لمستندات أي مزوّد', async () => {
    const owner = await makeProvider({ kind: 'CRAFT', slug: 'plumber16' });
    const publicId = documentPublicId(owner.session.id);
    mockCloudinaryAsset(publicId);
    const document = await saveDocument(owner.session, {
      requirementKey: 'NATIONAL_ID',
      publicId,
    });

    const customer: SessionUser = {
      id: new Types.ObjectId().toString(),
      role: 'CUSTOMER',
      status: 'ACTIVE',
    };

    await expect(getDocumentUrl(customer, document.id)).rejects.toThrow(/غير موجود/);
  });

  it('الإدارة تصل لأي مستند — لمراجعة التوثيق', async () => {
    const owner = await makeProvider({ kind: 'CRAFT', slug: 'plumber17' });
    const publicId = documentPublicId(owner.session.id);
    mockCloudinaryAsset(publicId);
    const document = await saveDocument(owner.session, {
      requirementKey: 'NATIONAL_ID',
      publicId,
    });

    const admin: SessionUser = {
      id: new Types.ObjectId().toString(),
      role: 'ADMIN',
      status: 'ACTIVE',
    };

    await expect(getDocumentUrl(admin, document.id)).resolves.toHaveProperty('url');
  });

  it('مستند غير موجود يعيد 404', async () => {
    const { session } = await makeProvider({ kind: 'CRAFT', slug: 'plumber18' });
    await expect(
      getDocumentUrl(session, new Types.ObjectId().toString())
    ).rejects.toThrow(/غير موجود/);
  });

  /*
   * سلوك «بلا auth token key» له اختبار مخصَّص في ملف منفصل
   * (tests/unit/cloudinary-signed-url.test.ts) — `getEnv()` يخزّن مؤقتًا مرة
   * واحدة لكل عملية اختبار، فلا يمكن تبديل حالة المفتاح وسط هذا الملف بعد
   * أن ثبَّته `beforeAll` أعلاه صالحًا لبقية الاختبارات.
   */
});

describe('حذف المستندات', () => {
  it('المالك يحذف مستنده قبل الاعتماد', async () => {
    const { session, provider } = await makeProvider({ kind: 'CRAFT', slug: 'plumber20' });
    const publicId = documentPublicId(session.id);
    mockCloudinaryAsset(publicId);
    const document = await saveDocument(session, { requirementKey: 'NATIONAL_ID', publicId });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ result: 'ok' }), { status: 200 })
    );

    await removeDocument(session, document.id);
    expect(await ProviderDocument.countDocuments({ providerId: provider._id })).toBe(0);
  });

  it('🔐 مزوّد آخر لا يحذف مستندًا ليس له', async () => {
    const owner = await makeProvider({ kind: 'CRAFT', slug: 'plumber21' });
    const attacker = await makeProvider({ kind: 'CRAFT', slug: 'plumber22' });

    const publicId = documentPublicId(owner.session.id);
    mockCloudinaryAsset(publicId);
    const document = await saveDocument(owner.session, {
      requirementKey: 'NATIONAL_ID',
      publicId,
    });

    await expect(removeDocument(attacker.session, document.id)).rejects.toThrow(/غير موجود/);
    expect(await ProviderDocument.countDocuments()).toBe(1);
  });

  it('لا يُحذف بعد اعتماد الحساب', async () => {
    const { session, provider } = await makeProvider({
      kind: 'CRAFT',
      slug: 'plumber23',
      approved: true,
    });
    const publicId = documentPublicId(session.id);
    mockCloudinaryAsset(publicId);
    const document = await saveDocument(session, { requirementKey: 'NATIONAL_ID', publicId });

    await expect(removeDocument(session, document.id)).rejects.toThrow(/بعد اعتماد الحساب/);
    expect(await ProviderDocument.countDocuments({ providerId: provider._id })).toBe(1);
  });
});
