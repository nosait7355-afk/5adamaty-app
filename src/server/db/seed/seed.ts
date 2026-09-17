import { toCoverageCities } from '@/shared/constants/fayoum-areas';
import { Types, trusted } from 'mongoose';
import {
  Category,
  Faq,
  Notification,
  Profession,
  Review,
  Service,
  ServiceProvider,
  ServiceRequest,
  Setting,
  User,
} from '@/server/db/models';
import {
  SEED_CATEGORIES,
  SEED_FAQS,
  SEED_PROFESSIONS,
  SEED_PROVIDERS,
  SEED_SETTINGS,
  requirementsFor,
} from './data';
import { GOVERNORATE } from '@/shared/constants/fayoum-areas';

export interface SeedResult {
  categories: number;
  professions: number;
  users: number;
  providers: number;
  services: number;
  faqs: number;
  settings: number;
}

/**
 * يملأ قاعدة البيانات ببيانات واقعية للفيوم.
 *
 * ملاحظة أمنية: كلمات المرور هنا نصوص وهمية للتطوير فقط. التجزئة الحقيقية
 * بـargon2id تدخل في Phase 3، ولا يُشغَّل هذا السكربت على الإنتاج.
 */
export async function runSeed(options: { clear?: boolean } = {}): Promise<SeedResult> {
  if (options.clear) {
    await Promise.all([
      Category.deleteMany({}),
      Profession.deleteMany({}),
      ServiceProvider.deleteMany({}),
      Service.deleteMany({}),
      Faq.deleteMany({}),
      Setting.deleteMany({}),
      /*
       * الطلبات وما يتبعها تُمسح مع الإعدادات: عدّاد أرقام الطلبات يعيش في
       * `settings`، فمسحه وحده كان يعيد ترقيمًا مستعملًا ويصطدم بالفهرس
       * الفريد. (العدّاد صار يصالح نفسه أيضًا — حزامان لا واحد.)
       */
      ServiceRequest.deleteMany({}),
      Review.deleteMany({}),
      Notification.deleteMany({}),
      // trusted() لازم لأن sanitizeFilter يجرّد `$in` من المرشّحات
      User.deleteMany({ role: trusted({ $in: ['PROVIDER', 'CUSTOMER'] }) }),
    ]);
  }

  /* ---- 1) التصنيفات ---- */
  const categories = await Category.insertMany(
    SEED_CATEGORIES.map((c) => ({ ...c, isActive: true, servicesCount: 0 }))
  );
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));

  /* ---- 2) المهن + متطلبات المستندات الديناميكية ---- */
  const professionDocs = SEED_PROFESSIONS.map((p) => {
    const category = categoryBySlug.get(p.categorySlug);
    if (!category) throw new Error(`تصنيف غير موجود: ${p.categorySlug}`);

    return {
      categoryId: category._id,
      name: p.name,
      slug: p.slug,
      icon: p.icon,
      order: p.order,
      isActive: true,
      professionKind: p.professionKind,
      requiresQualification: p.requiresQualification,
      requiresLicense: p.requiresLicense,
      documentRequirements: requirementsFor(p),
    };
  });

  // create() لا insertMany() — لتشغيل الـpre-validate hook الذي يفرض قاعدة الاتساق
  const professions = await Profession.create(professionDocs);
  const professionBySlug = new Map(professions.map((p) => [p.slug, p]));

  /* ---- 3) المستخدمون ومقدمو الخدمات ---- */
  let providerCount = 0;
  let serviceCount = 0;
  let userCount = 0;
  let sequence = 1;

  for (const seed of SEED_PROVIDERS) {
    const profession = professionBySlug.get(seed.professionSlug);
    if (!profession) throw new Error(`مهنة غير موجودة: ${seed.professionSlug}`);

    const user = await User.create({
      role: 'PROVIDER',
      fullName: seed.displayName,
      phone: `+2010${String(10_000_000 + sequence).slice(0, 8)}`,
      email: `provider${sequence}@seed.local`,
      passwordHash: 'SEED_ONLY_NOT_A_REAL_HASH',
      status: seed.approved ? 'ACTIVE' : 'PENDING_REVIEW',
      governorate: GOVERNORATE,
      city: GOVERNORATE,
      area: seed.areas[0] ?? 'حي الجامعة',
    });
    userCount += 1;

    const provider = await ServiceProvider.create({
      userId: user._id,
      accountType: 'INDIVIDUAL',
      displayName: seed.displayName,
      categoryId: profession.categoryId,
      professionId: profession._id,
      yearsOfExperience: seed.years,
      bio: seed.bio,
      coverageAreas: toCoverageCities(seed.areas),
      ratingAvg: seed.ratingAvg,
      ratingCount: seed.ratingCount,
      completedOrders: seed.completedOrders,
      customersCount: Math.round(seed.completedOrders * 0.6),
      isActive: seed.approved,
      isVerifiedBadge: seed.approved,
      profileCompletion: seed.approved ? 85 : 40,
      verification: {
        status: seed.approved ? 'APPROVED' : 'PENDING_REVIEW',
        requestNumber: `SRV-2025-${String(sequence).padStart(6, '0')}`,
        submittedAt: new Date(),
        ...(seed.approved ? { reviewedAt: new Date() } : {}),
      },
    });
    providerCount += 1;

    // خدمتان لكل مزوّد معتمد
    if (seed.approved) {
      const titles = [`${profession.name} - خدمة أساسية`, `${profession.name} - خدمة متقدمة`];
      for (const title of titles) {
        await Service.create({
          providerId: provider._id,
          categoryId: profession.categoryId,
          professionId: profession._id,
          title,
          description: seed.bio,
          areas: toCoverageCities(seed.areas),
          isActive: true,
          ratingAvg: seed.ratingAvg,
          ratingCount: seed.ratingCount,
        });
        serviceCount += 1;
      }
    }

    sequence += 1;
  }

  /* ---- 4) تحديث العدّادات المشتقة ---- */
  for (const profession of professions) {
    const count = await Service.countDocuments({ professionId: profession._id, isActive: true });
    await Profession.updateOne({ _id: profession._id }, { $set: { servicesCount: count } });
  }
  for (const category of categories) {
    const count = await Service.countDocuments({ categoryId: category._id, isActive: true });
    await Category.updateOne({ _id: category._id }, { $set: { servicesCount: count } });
  }

  /* ---- 5) الأسئلة الشائعة والإعدادات ---- */
  const faqs = await Faq.insertMany(SEED_FAQS.map((f) => ({ ...f, isActive: true })));
  const settings = await Setting.insertMany(SEED_SETTINGS);

  return {
    categories: categories.length,
    professions: professions.length,
    users: userCount,
    providers: providerCount,
    services: serviceCount,
    faqs: faqs.length,
    settings: settings.length,
  };
}

/** يُستخدم في الاختبارات لإنشاء معرّف وهمي. */
export const newObjectId = () => new Types.ObjectId();
