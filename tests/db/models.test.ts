import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose, { Types } from 'mongoose';
import { buildAllIndexes, clearTestDb, startTestDb, stopTestDb } from '../helpers/db';
import {
  Address,
  AuditLog,
  Category,
  COLLECTION_NAMES,
  Favorite,
  Message,
  Notification,
  Profession,
  ProviderDocument,
  Review,
  Service,
  ServiceProvider,
  ServiceRequest,
  Setting,
  Thread,
  User,
} from '@/server/db/models';
import { buildDocumentRequirements } from '@/shared/constants/documents';

beforeAll(async () => {
  await startTestDb();
  await buildAllIndexes();
}, 60_000);

afterAll(async () => {
  await stopTestDb();
});

beforeEach(async () => {
  await clearTestDb();
});

/* ------------------------------------------------------------------ */

const oid = () => new Types.ObjectId();

const validMedia = {
  publicId: 'khadamaty/test/abc',
  url: 'https://res.cloudinary.com/demo/image/upload/abc.jpg',
  format: 'jpg',
  bytes: 12345,
  resourceType: 'image' as const,
  accessMode: 'public' as const,
};

async function makeCategory() {
  return Category.create({
    name: 'خدمات منزلية',
    slug: 'home-services',
    description: 'تنظيف، صيانة، مكافحة حشرات',
    icon: 'home',
  });
}

async function makeProfession(categoryId: Types.ObjectId, kind: 'CRAFT' | 'REGULATED' = 'CRAFT') {
  const requiresQualification = kind === 'REGULATED';
  const requiresLicense = kind === 'REGULATED';
  return Profession.create({
    categoryId,
    name: kind === 'CRAFT' ? 'سبّاك' : 'طبيب',
    slug: kind === 'CRAFT' ? 'plumber' : 'doctor',
    icon: 'wrench',
    professionKind: kind,
    requiresQualification,
    requiresLicense,
    documentRequirements: buildDocumentRequirements({ requiresQualification, requiresLicense }),
  });
}

/* ================================================================== */

describe('المجموعات الـ16', () => {
  it('كل النماذج مسجّلة', () => {
    const registered = Object.keys(mongoose.models);
    expect(registered).toEqual(
      expect.arrayContaining([
        'User',
        'ServiceProvider',
        'Category',
        'Profession',
        'Service',
        'ServiceRequest',
        'ProviderDocument',
        'Review',
        'Favorite',
        'Address',
        'Notification',
        'Thread',
        'Message',
        'Setting',
        'AuditLog',
        'Faq',
        'Report',
      ])
    );
  });

  it('قائمة أسماء المجموعات تعدّ 16', () => {
    expect(COLLECTION_NAMES).toHaveLength(16);
  });
});

describe('التحقق السلبي — القيود غير القابلة للتفاوض', () => {
  it('لا توجد أي مجموعة مالية', async () => {
    const names = Object.values(mongoose.models).map((m) => m.collection.collectionName);
    for (const forbidden of ['payments', 'transactions', 'invoices', 'wallets', 'charges']) {
      expect(names).not.toContain(forbidden);
    }
  });

  it('لا يوجد أي حقل إحداثيات في أي Schema', () => {
    const geoFields = ['lat', 'lng', 'latitude', 'longitude', 'coordinates', 'location', 'geo'];
    for (const model of Object.values(mongoose.models)) {
      const paths = Object.keys(model.schema.paths).map((p) => p.toLowerCase());
      for (const field of geoFields) {
        expect(paths, `${model.modelName} يحوي حقل ${field}`).not.toContain(field);
      }
    }
  });

  it('لا يوجد أي فهرس 2dsphere أو 2d', () => {
    for (const model of Object.values(mongoose.models)) {
      for (const [spec] of model.schema.indexes()) {
        for (const value of Object.values(spec)) {
          expect(value).not.toBe('2dsphere');
          expect(value).not.toBe('2d');
        }
      }
    }
  });

  it('طريقة الدفع لها قيمة واحدة ممكنة فقط', () => {
    const path = ServiceRequest.schema.path('paymentMethod');
    // @ts-expect-error enumValues موجودة على مسارات String
    expect(path.enumValues).toEqual(['CASH_ON_DELIVERY_OFFLINE']);
  });
});

describe('User', () => {
  it('لا يُرجع passwordHash في الاستعلامات الافتراضية', async () => {
    await User.create({
      role: 'CUSTOMER',
      fullName: 'أحمد محمد علي',
      phone: '+201012345678',
      passwordHash: 'hash-سري-جدا',
    });

    const found = await User.findOne({ phone: '+201012345678' });
    expect(found).not.toBeNull();
    expect(found?.fullName).toBe('أحمد محمد علي');
    expect(found?.passwordHash).toBeUndefined();

    // ولا في lean()
    const lean = await User.findOne({ phone: '+201012345678' }).lean();
    expect(lean).not.toHaveProperty('passwordHash');

    // يُجلب فقط عند الطلب الصريح
    const explicit = await User.findOne({ phone: '+201012345678' }).select('+passwordHash');
    expect(explicit?.passwordHash).toBe('hash-سري-جدا');
  });

  it('لا يُرجع refreshTokens افتراضيًا', async () => {
    await User.create({
      role: 'CUSTOMER',
      fullName: 'سارة محمود',
      email: 'sara@example.com',
      passwordHash: 'h',
      refreshTokens: [{ hash: 'x', expiresAt: new Date(Date.now() + 1000) }],
    });
    const found = await User.findOne({ email: 'sara@example.com' }).lean();
    expect(found).not.toHaveProperty('refreshTokens');
  });

  it('يفرض تفرّد الهاتف', async () => {
    await User.create({ role: 'CUSTOMER', fullName: 'أحمد علي', phone: '+201011111111', passwordHash: 'h' });
    await expect(
      User.create({ role: 'CUSTOMER', fullName: 'محمد علي', phone: '+201011111111', passwordHash: 'h' })
    ).rejects.toThrow();
  });

  it('يسمح بعدة مستخدمين بلا بريد (sparse)', async () => {
    await User.create({ role: 'CUSTOMER', fullName: 'أحمد علي', phone: '+201011111111', passwordHash: 'h' });
    await expect(
      User.create({ role: 'CUSTOMER', fullName: 'محمد علي', phone: '+201022222222', passwordHash: 'h' })
    ).resolves.toBeDefined();
  });

  it('يرفض المستخدم بلا هاتف ولا بريد', async () => {
    await expect(
      User.create({ role: 'CUSTOMER', fullName: 'بدون معرّف', passwordHash: 'h' })
    ).rejects.toThrow(/هاتف أو بريد/);
  });

  it('يرفض رقم هاتف غير مصري', async () => {
    await expect(
      User.create({ role: 'CUSTOMER', fullName: 'أحمد', phone: '+12025551234', passwordHash: 'h' })
    ).rejects.toThrow();
  });

  it('يحوّل البريد لأحرف صغيرة', async () => {
    const user = await User.create({
      role: 'CUSTOMER',
      fullName: 'أحمد',
      email: 'AHMED@Example.COM',
      passwordHash: 'h',
    });
    expect(user.email).toBe('ahmed@example.com');
  });
});

describe('Profession — محرّك المستندات الديناميكية', () => {
  it('كل مهنة تعرض الهوية والصورة فقط، والهوية وحدها إلزامية', async () => {
    const category = await makeCategory();

    for (const kind of ['CRAFT', 'REGULATED'] as const) {
      const profession = await makeProfession(category._id, kind);
      const keys = profession.documentRequirements.map((r) => r.key);

      expect(keys, kind).toEqual(['NATIONAL_ID', 'PERSONAL_PHOTO']);

      const required = profession.documentRequirements.filter((r) => r.required);
      expect(required.map((r) => r.key), kind).toEqual(['NATIONAL_ID']);
    }
  });

  it('يرفض مهنة بلا بطاقة رقم قومي — القاعدة الوحيدة الباقية', async () => {
    const category = await makeCategory();
    await expect(
      Profession.create({
        categoryId: category._id,
        name: 'سبّاك',
        slug: 'plumber-bad',
        icon: 'wrench',
        professionKind: 'CRAFT',
        requiresLicense: false,
        requiresQualification: false,
        documentRequirements: buildDocumentRequirements({}).filter(
          (item) => item.key !== 'NATIONAL_ID'
        ),
      })
    ).rejects.toThrow(/غير متسق/);
  });

  it('يرفض جعل بطاقة الرقم القومي اختيارية', async () => {
    const category = await makeCategory();
    await expect(
      Profession.create({
        categoryId: category._id,
        name: 'طبيب',
        slug: 'doctor-bad',
        icon: 'stethoscope',
        professionKind: 'REGULATED',
        requiresQualification: true,
        requiresLicense: false,
        documentRequirements: buildDocumentRequirements({}).map((item) =>
          item.key === 'NATIONAL_ID' ? { ...item, required: false } : item
        ),
      })
    ).rejects.toThrow(/غير متسق/);
  });

  it('لا تُنشئ المهنة الحرفية إثبات عنوان تلقائيًا بعد الآن', () => {
    const reqs = buildDocumentRequirements({ requiresQualification: false, requiresLicense: false });
    expect(reqs.find((r) => r.key === 'ADDRESS_PROOF')).toBeUndefined();
  });

  it('يرفض جعل بطاقة الرقم القومي اختيارية', async () => {
    const category = await makeCategory();
    const reqs = buildDocumentRequirements({ requiresQualification: false, requiresLicense: false });
    const nid = reqs.find((r) => r.key === 'NATIONAL_ID');
    if (nid) nid.required = false;

    await expect(
      Profession.create({
        categoryId: category._id,
        name: 'نقّاش',
        slug: 'painter-bad',
        icon: 'paint-roller',
        professionKind: 'CRAFT',
        requiresQualification: false,
        requiresLicense: false,
        documentRequirements: reqs,
      })
    ).rejects.toThrow(/إلزامية/);
  });
});

describe('ServiceRequest', () => {
  async function baseOrder(overrides: Record<string, unknown> = {}) {
    const category = await makeCategory();
    const profession = await makeProfession(category._id);
    return {
      orderNumber: 10245,
      customerId: oid(),
      providerId: oid(),
      categoryId: category._id,
      professionId: profession._id,
      serviceType: 'سباكة - إصلاح تسريب',
      details: 'يوجد تسريب مياه من تحت الحوض في المطبخ ويريد إصلاحه.',
      address: {
        governorate: 'الفيوم',
        city: 'الفيوم',
        area: 'حي الجامعة',
        line: 'شارع أحمد شوقي',
      },
      scheduledDate: new Date('2025-05-02'),
      ...overrides,
    };
  }

  it('ينشئ طلبًا بحالة NEW وطريقة دفع كاش', async () => {
    const order = await ServiceRequest.create(await baseOrder());
    expect(order.status).toBe('NEW');
    expect(order.paymentMethod).toBe('CASH_ON_DELIVERY_OFFLINE');
    expect(order.cashReceivedConfirmed).toBe(false);
  });

  it('يرفض أي طريقة دفع أخرى', async () => {
    await expect(
      ServiceRequest.create(await baseOrder({ paymentMethod: 'VISA' }))
    ).rejects.toThrow();
  });

  it('يمنع الإكمال بدون تأكيد استلام المبلغ', async () => {
    await expect(
      ServiceRequest.create(await baseOrder({ status: 'COMPLETED', cashReceivedConfirmed: false }))
    ).rejects.toThrow(/تأكيد استلام المبلغ/);
  });

  it('يسمح بالإكمال بعد تأكيد الاستلام', async () => {
    const order = await ServiceRequest.create(
      await baseOrder({ status: 'COMPLETED', cashReceivedConfirmed: true })
    );
    expect(order.status).toBe('COMPLETED');
  });

  it('يفرض تفرّد رقم الطلب', async () => {
    // نبني الحمولة مرة واحدة — استدعاء baseOrder مرتين ينشئ تصنيفًا مكررًا
    const payload = await baseOrder({ orderNumber: 1 });
    await ServiceRequest.create(payload);
    await expect(ServiceRequest.create(payload)).rejects.toThrow(/duplicate key|E11000/);
  });

  it('يحدّ المرفقات بخمس صور', async () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ ...validMedia, publicId: `p${i}` }));
    await expect(ServiceRequest.create(await baseOrder({ attachments: six }))).rejects.toThrow(/5 صور/);
  });

  it('يرفض نطاق وقت مقلوب', async () => {
    await expect(
      ServiceRequest.create(await baseOrder({ preferredTimeFrom: '14:00', preferredTimeTo: '10:00' }))
    ).rejects.toThrow(/يسبق/);
  });

  it('يقبل التاريخ بلا وقت — الوقت اختياري', async () => {
    const order = await ServiceRequest.create(await baseOrder());
    expect(order.preferredTimeFrom).toBeUndefined();
    expect(order.scheduledDate).toBeInstanceOf(Date);
  });
});

describe('ProviderDocument', () => {
  it('يرفض رفع مستند بوضع وصول عام', async () => {
    await expect(
      ProviderDocument.create({
        providerId: oid(),
        requirementKey: 'NATIONAL_ID',
        label: 'الهوية الشخصية',
        media: { ...validMedia, accessMode: 'public' },
      })
    ).rejects.toThrow(/authenticated/);
  });

  it('يقبل المستند بوضع authenticated', async () => {
    const doc = await ProviderDocument.create({
      providerId: oid(),
      requirementKey: 'NATIONAL_ID',
      label: 'الهوية الشخصية',
      media: { ...validMedia, accessMode: 'authenticated' },
    });
    expect(doc.status).toBe('PENDING');
  });

  it('يمنع تكرار نفس المستند لنفس المزوّد', async () => {
    const providerId = oid();
    const payload = {
      providerId,
      requirementKey: 'NATIONAL_ID' as const,
      label: 'الهوية',
      media: { ...validMedia, accessMode: 'authenticated' as const },
    };
    await ProviderDocument.create(payload);
    await expect(ProviderDocument.create(payload)).rejects.toThrow();
  });
});

describe('MediaRef', () => {
  it('يرفض رابطًا من خارج Cloudinary', async () => {
    await expect(
      Service.create({
        providerId: oid(),
        categoryId: oid(),
        professionId: oid(),
        title: 'تنظيف شامل',
        description: 'تنظيف أرضيات وحمامات',
        images: [{ ...validMedia, url: 'https://evil.example.com/x.jpg' }],
      })
    ).rejects.toThrow(/Cloudinary/);
  });
});

describe('Review', () => {
  it('تقييم واحد فقط لكل طلب', async () => {
    const orderId = oid();
    const payload = { orderId, customerId: oid(), providerId: oid(), rating: 5 };
    await Review.create(payload);
    await expect(Review.create({ ...payload, rating: 4 })).rejects.toThrow();
  });

  it('يرفض تقييمًا خارج النطاق 1..5', async () => {
    const base = { orderId: oid(), customerId: oid(), providerId: oid() };
    await expect(Review.create({ ...base, rating: 6 })).rejects.toThrow();
    await expect(Review.create({ ...base, rating: 0 })).rejects.toThrow();
    await expect(Review.create({ ...base, rating: 4.5 })).rejects.toThrow();
  });
});

describe('Favorite', () => {
  it('يرفض المفضلة بلا هدف أو بهدفين', async () => {
    const userId = oid();
    await expect(Favorite.create({ userId })).rejects.toThrow(/بالضبط/);
    await expect(
      Favorite.create({ userId, providerId: oid(), serviceId: oid() })
    ).rejects.toThrow(/بالضبط/);
  });

  it('يمنع تكرار نفس المزوّد لنفس المستخدم', async () => {
    const userId = oid();
    const providerId = oid();
    await Favorite.create({ userId, providerId });
    await expect(Favorite.create({ userId, providerId })).rejects.toThrow();
  });
});

describe('Address', () => {
  const base = {
    label: 'المنزل',
    governorate: 'الفيوم',
    city: 'الفيوم',
    area: 'الحوّاتم',
    line: 'شارع بطل السلام',
    contactName: 'أحمد محمد علي',
    contactPhone: '+201012345678',
  };

  it('يسمح بعنوان افتراضي واحد فقط لكل مستخدم', async () => {
    const userId = oid();
    await Address.create({ ...base, userId, isDefault: true });
    await expect(
      Address.create({ ...base, userId, label: 'العمل', isDefault: true })
    ).rejects.toThrow();
  });

  it('يسمح بعدة عناوين غير افتراضية', async () => {
    const userId = oid();
    await Address.create({ ...base, userId, isDefault: false });
    await expect(
      Address.create({ ...base, userId, label: 'العمل', isDefault: false })
    ).resolves.toBeDefined();
  });

  it('لا يحتوي أي حقل إحداثيات', () => {
    const paths = Object.keys(Address.schema.paths);
    expect(paths).not.toContain('lat');
    expect(paths).not.toContain('lng');
    expect(paths).not.toContain('coordinates');
  });
});

describe('Notification', () => {
  it('يرفض رابط إجراء خارجي', async () => {
    await expect(
      Notification.create({
        userId: oid(),
        type: 'ORDER_ACCEPTED',
        title: 'تم قبول طلبك',
        body: 'تم قبول طلب #1026',
        entityType: 'ORDER',
        actionUrl: 'https://evil.example.com/phish',
      })
    ).rejects.toThrow(/مسارًا داخليًا/);
  });

  it('يقبل مسارًا داخليًا', async () => {
    const n = await Notification.create({
      userId: oid(),
      type: 'ORDER_ACCEPTED',
      title: 'تم قبول طلبك',
      body: 'تم قبول طلب #1026',
      entityType: 'ORDER',
      actionUrl: '/orders/1026',
    });
    expect(n.isRead).toBe(false);
  });
});

describe('Thread / Message', () => {
  it('المحادثة تضم مشاركَين بالضبط', async () => {
    await expect(Thread.create({ orderId: oid(), participants: [oid()] })).rejects.toThrow(/مشاركَين/);
  });

  it('يمنع إرسال رسالة للنفس', async () => {
    const me = oid();
    await expect(
      Message.create({
        threadId: oid(),
        orderId: oid(),
        senderId: me,
        receiverId: me,
        body: 'مرحبا',
      })
    ).rejects.toThrow(/نفسك/);
  });
});

describe('ServiceProvider', () => {
  it('يبدأ غير نشط وبحالة قيد المراجعة', async () => {
    const category = await makeCategory();
    const profession = await makeProfession(category._id);
    const provider = await ServiceProvider.create({
      userId: oid(),
      displayName: 'شركة النقاء للتنظيف',
      categoryId: category._id,
      professionId: profession._id,
      yearsOfExperience: 10,
      bio: 'نوفر خدمات تنظيف احترافية بأعلى معايير الجودة.',
      coverageAreas: ['الفيوم', 'سنورس'],
      verification: { requestNumber: 'SRV-2025-000123' },
    });

    expect(provider.isActive).toBe(false);
    expect(provider.verification.status).toBe('PENDING_REVIEW');
    expect(provider.ratingAvg).toBe(0);
  });

  it('يرفض مزوّدًا بلا مناطق تغطية', async () => {
    const category = await makeCategory();
    const profession = await makeProfession(category._id);
    await expect(
      ServiceProvider.create({
        userId: oid(),
        displayName: 'مزوّد',
        categoryId: category._id,
        professionId: profession._id,
        yearsOfExperience: 5,
        bio: 'وصف',
        coverageAreas: [],
        verification: { requestNumber: 'SRV-2025-000125' },
      })
    ).rejects.toThrow(/منطقة تغطية/);
  });
});

describe('Setting / AuditLog', () => {
  it('مفتاح الإعداد فريد', async () => {
    await Setting.create({ key: 'support_phone', value: '+201012345678' });
    await expect(Setting.create({ key: 'support_phone', value: 'x' })).rejects.toThrow();
  });

  it('يسجّل إجراءً في سجل التدقيق', async () => {
    const log = await AuditLog.create({
      actorId: oid(),
      action: 'PROVIDER_VERIFICATION_CHANGED',
      entityType: 'ServiceProvider',
      entityId: oid(),
      before: { status: 'PENDING_REVIEW' },
      after: { status: 'APPROVED' },
    });
    expect(log.action).toBe('PROVIDER_VERIFICATION_CHANGED');
  });
});
