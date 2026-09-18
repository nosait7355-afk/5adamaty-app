import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { buildAllIndexes, clearTestDb, startTestDb, stopTestDb } from '../helpers/db';
import { runSeed } from '@/server/db/seed/seed';
import { Category, Profession, Service, ServiceProvider, User } from '@/server/db/models';
import { COVERAGE_AREAS } from '@/shared/constants/fayoum-areas';

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

describe('البذر', () => {
  it('يملأ قاعدة البيانات بالحد الأدنى المطلوب', async () => {
    const result = await runSeed();

    // معايير القبول في PROJECT_PLAN — Phase 2
    expect(result.categories).toBeGreaterThanOrEqual(9);
    expect(result.professions).toBeGreaterThanOrEqual(14);
    expect(result.providers).toBeGreaterThanOrEqual(20);
    expect(result.services).toBeGreaterThanOrEqual(40);
    expect(result.faqs).toBeGreaterThan(0);
    expect(result.settings).toBeGreaterThan(0);
  });

  it('يوزّع المهن على القالبين', async () => {
    await runSeed();

    const craft = await Profession.countDocuments({ professionKind: 'CRAFT' });
    const regulated = await Profession.countDocuments({ professionKind: 'REGULATED' });

    expect(craft).toBeGreaterThan(0);
    expect(regulated).toBeGreaterThan(0);
  });

  it('كل مهنة تعرض الهوية والصورة فقط، والهوية وحدها إلزامية', async () => {
    await runSeed();
    const professions = await Profession.find().lean();

    expect(professions.length).toBeGreaterThan(0);

    for (const profession of professions) {
      const keys = profession.documentRequirements.map((r) => r.key);
      expect(keys, profession.name).toEqual(['NATIONAL_ID', 'PERSONAL_PHOTO']);

      const required = profession.documentRequirements.filter((r) => r.required).map((r) => r.key);
      expect(required, profession.name).toEqual(['NATIONAL_ID']);
    }
  });

  it('كل مناطق التغطية من قائمة الفيوم النصية', async () => {
    await runSeed();
    const providers = await ServiceProvider.find().lean();

    for (const provider of providers) {
      for (const area of provider.coverageAreas) {
        expect(COVERAGE_AREAS, `${provider.displayName}: ${area}`).toContain(area);
      }
    }
  });

  it('يبذر مزوّدين قيد المراجعة غير نشطين', async () => {
    await runSeed();

    const pending = await ServiceProvider.find({ 'verification.status': 'PENDING_REVIEW' }).lean();
    expect(pending.length).toBeGreaterThan(0);

    for (const provider of pending) {
      // المزوّد غير المعتمد لا يكون نشطًا أبدًا
      expect(provider.isActive).toBe(false);
      expect(provider.isVerifiedBadge).toBe(false);
    }
  });

  it('المزوّدون غير المعتمدين بلا خدمات منشورة', async () => {
    await runSeed();
    const pending = await ServiceProvider.find({ isActive: false }).lean();

    for (const provider of pending) {
      const count = await Service.countDocuments({ providerId: provider._id });
      expect(count, provider.displayName).toBe(0);
    }
  });

  it('يحدّث العدّادات المشتقة', async () => {
    await runSeed();

    const category = await Category.findOne({ slug: 'plumbing-electric' }).lean();
    expect(category?.servicesCount).toBeGreaterThan(0);

    const profession = await Profession.findOne({ slug: 'plumber' }).lean();
    expect(profession?.servicesCount).toBeGreaterThan(0);
  });

  it('لا يُرجع passwordHash لأي مستخدم مبذور', async () => {
    await runSeed();
    const users = await User.find().lean();

    expect(users.length).toBeGreaterThan(0);
    for (const user of users) {
      expect(user).not.toHaveProperty('passwordHash');
    }
  });

  it('--clear يمسح ثم يبذر بلا تكرار', async () => {
    await runSeed();
    const firstCount = await Category.countDocuments();

    await runSeed({ clear: true });
    const secondCount = await Category.countDocuments();

    expect(secondCount).toBe(firstCount);
  });
});

describe('بيانات البذر تطويرية فقط', () => {
  /*
   * قاعدة ملزِمة (PRE_PRODUCTION_CHECKLIST §2): كل حساب في البذر تطويري
   * بحت. هذه الاختبارات تمنع تحوّل بيانات العرض إلى حسابات قابلة للاستخدام
   * لو بُذرت على بيئة حقيقية بالخطأ.
   */
  it('كل حسابات البذر تحمل نطاقًا تطويريًا لا يصلح للإنتاج', async () => {
    await runSeed();
    const users = await User.find({ role: 'PROVIDER' }).select('+passwordHash');

    expect(users.length).toBeGreaterThan(0);
    for (const user of users) {
      expect(user.email, 'بريد بذر بنطاق حقيقي').toMatch(/@seed.local$/);
    }
  });

  it('لا حساب بذر يملك تجزئة كلمة مرور صالحة — الدخول به مستحيل', async () => {
    await runSeed();
    const users = await User.find({ role: 'PROVIDER' }).select('+passwordHash');

    expect(users.length).toBeGreaterThan(0);
    for (const user of users) {
      // argon2id يبدأ دائمًا بـ$argon2id$ — أي شيء غيره لا يُنتج جلسة صالحة
      expect(user.passwordHash, user.email).not.toMatch(/^$argon2id$/);
    }
  });

  it('لا يوجد أي حساب بدور ADMIN في بيانات البذر', async () => {
    await runSeed();
    expect(await User.countDocuments({ role: 'ADMIN' })).toBe(0);
  });
});

describe('الفهارس', () => {
  it('تُنشأ فعليًا في قاعدة البيانات', async () => {
    const expected: Record<string, string[]> = {
      users: ['phone_1', 'email_1', 'role_1_status_1'],
      categories: ['slug_1'],
      professions: ['slug_1', 'categoryId_1_isActive_1_order_1'],
      serviceproviders: ['userId_1', 'verification.status_1'],
      servicerequests: ['orderNumber_1', 'customerId_1_status_1_createdAt_-1'],
      reviews: ['orderId_1'],
    };

    for (const [collection, indexNames] of Object.entries(expected)) {
      const indexes = await mongoose.connection.db!.collection(collection).indexes();
      const names = indexes.map((i) => i.name);
      for (const name of indexNames) {
        expect(names, `${collection} ينقصه الفهرس ${name}`).toContain(name);
      }
    }
  });

  it('الفهارس الفريدة معلّمة unique فعلًا', async () => {
    const indexes = await mongoose.connection.db!.collection('servicerequests').indexes();
    const orderNumber = indexes.find((i) => i.name === 'orderNumber_1');
    expect(orderNumber?.unique).toBe(true);
  });

  it('لا يوجد فهرس جغرافي في أي مجموعة', async () => {
    const collections = await mongoose.connection.db!.listCollections().toArray();

    for (const { name } of collections) {
      const indexes = await mongoose.connection.db!.collection(name).indexes();
      for (const index of indexes) {
        for (const value of Object.values(index.key)) {
          expect(value, `${name}.${index.name}`).not.toBe('2dsphere');
          expect(value, `${name}.${index.name}`).not.toBe('2d');
        }
      }
    }
  });
});
