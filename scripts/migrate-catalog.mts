#!/usr/bin/env node
/**
 * هجرة الكتالوج — تطبّق تعديلات التصنيفات والمهن على قاعدة البيانات الحية.
 *
 * `SEED_CATEGORIES` و`SEED_PROFESSIONS` لا تُقرآن إلا عند البذر، والبذر لا
 * يُشغَّل على الإنتاج. تعديل ملف البذر وحده لا يغيّر شيئًا في قاعدة قائمة،
 * فهذه الهجرة هي ما ينقل التغييرات فعليًا.
 *
 * ما تفعله:
 *   1. تضيف تصنيفَي «عقارات» و«توصيل» إن لم يكونا موجودين.
 *   2. تضيف مهن «سائق» و«تسويق عقارات» و«دليفري».
 *   3. تعيد تسمية تصنيف `plumbing-electric` إلى «مهن حرفية».
 *   4. تنقل النقّاش والنجّار إليه ليجتمع الحرفيون الأربعة في تصنيف واحد،
 *      وتنقل معهم مقدّمي الخدمات المرتبطين بهاتين المهنتين — وإلا بقي
 *      `categoryId` في ملفاتهم مشيرًا للتصنيف القديم فاختفوا من التصفية.
 *   5. ترفع حدّ حجم الهوية الشخصية إلى 5MB في كل المهن.
 *
 * الاستخدام:
 *   npm run db:migrate-catalog -- --dry-run   # عرض بلا كتابة
 *   npm run db:migrate-catalog                # التنفيذ الفعلي
 *
 * مُتكرِّر الأمان: التشغيل الثاني لا يغيّر شيئًا.
 */

import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

const { buildDocumentRequirements, maxSizeForDocument } = await import(
  '../src/shared/constants/documents'
);
const { connectToDatabase, disconnectFromDatabase } = await import('../src/server/db/mongoose');
const { Category, Profession, ServiceProvider } = await import('../src/server/db/models/index');

const dryRun = process.argv.includes('--dry-run');

/** التصنيف الجامع للحرفيين — الـslug ثابت كي لا تنكسر الروابط. */
const CRAFT_CATEGORY_SLUG = 'plumbing-electric';
const CRAFT_CATEGORY_NAME = 'مهن حرفية';
const CRAFT_CATEGORY_DESCRIPTION = 'سباك، كهربائي، نقاش ونجار';

/** المهن التي تنتقل إلى التصنيف الجامع (السبّاك والكهربائي فيه أصلًا). */
const CRAFT_PROFESSION_SLUGS = ['plumber', 'electrician', 'painter', 'carpenter'];

const NEW_CATEGORIES = [
  {
    name: 'عقارات',
    slug: 'real-estate',
    description: 'تسويق عقاري، وساطة وبيع وإيجار',
    icon: 'building-2',
    order: 10,
  },
  {
    name: 'توصيل',
    slug: 'delivery',
    description: 'دليفري وتوصيل طلبات وطرود داخل الفيوم',
    icon: 'package',
    order: 11,
  },
];

const NEW_PROFESSIONS = [
  {
    categorySlug: 'car-services',
    name: 'سائق',
    slug: 'driver',
    icon: 'car-taxi-front',
    professionKind: 'CRAFT' as const,
    order: 21,
  },
  {
    categorySlug: 'real-estate',
    name: 'تسويق عقارات',
    slug: 'real-estate-marketing',
    icon: 'building-2',
    professionKind: 'CRAFT' as const,
    order: 22,
  },
  {
    categorySlug: 'delivery',
    name: 'دليفري',
    slug: 'delivery-courier',
    icon: 'bike',
    professionKind: 'CRAFT' as const,
    order: 23,
  },
];

function log(line: string) {
  console.log(`   ${line}`);
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI غير معرّف. أضفه في .env.local — انظر .env.example.');
    process.exit(1);
  }

  console.log(
    dryRun ? '🔍 وضع المعاينة — لن تُكتب أي تغييرات.' : '✍️  وضع التنفيذ — ستُكتب التغييرات.'
  );
  console.log('⏳ الاتصال بقاعدة البيانات...');
  await connectToDatabase();

  /* ---- 1) التصنيفات الجديدة ---- */
  console.log('\n📁 التصنيفات:');
  for (const category of NEW_CATEGORIES) {
    const existing = await Category.findOne({ slug: category.slug });
    if (existing) {
      log(`${category.name}: موجود — لا تغيير.`);
      continue;
    }
    log(`${category.name}: ${dryRun ? 'سيُضاف' : 'أُضيف'}.`);
    if (!dryRun) await Category.create({ ...category, isActive: true });
  }

  /* ---- 2) إعادة تسمية التصنيف الحرفي ---- */
  const craftCategory = await Category.findOne({ slug: CRAFT_CATEGORY_SLUG });
  if (!craftCategory) {
    console.error(`❌ التصنيف ${CRAFT_CATEGORY_SLUG} غير موجود — أُلغيت الهجرة.`);
    await disconnectFromDatabase();
    process.exit(1);
  }

  if (craftCategory.name !== CRAFT_CATEGORY_NAME) {
    log(`${craftCategory.name} → ${CRAFT_CATEGORY_NAME}`);
    if (!dryRun) {
      craftCategory.set({
        name: CRAFT_CATEGORY_NAME,
        description: CRAFT_CATEGORY_DESCRIPTION,
      });
      await craftCategory.save();
    }
  } else {
    log(`${CRAFT_CATEGORY_NAME}: الاسم محدَّث بالفعل.`);
  }

  /* ---- 3) المهن الجديدة ---- */
  console.log('\n🧰 المهن الجديدة:');
  for (const profession of NEW_PROFESSIONS) {
    const existing = await Profession.findOne({ slug: profession.slug });
    if (existing) {
      log(`${profession.name}: موجودة — لا تغيير.`);
      continue;
    }

    const category = await Category.findOne({ slug: profession.categorySlug });
    if (!category) {
      log(`⚠️  ${profession.name}: تصنيفها (${profession.categorySlug}) غير موجود — تُخطّى.`);
      continue;
    }

    log(`${profession.name}: ${dryRun ? 'ستُضاف' : 'أُضيفت'} تحت «${category.name}».`);
    if (!dryRun) {
      await Profession.create({
        categoryId: category._id,
        name: profession.name,
        slug: profession.slug,
        icon: profession.icon,
        isActive: true,
        order: profession.order,
        professionKind: profession.professionKind,
        requiresQualification: false,
        requiresLicense: false,
        documentRequirements: buildDocumentRequirements({}),
      });
    }
  }

  /* ---- 4) تجميع المهن الحرفية ---- */
  console.log('\n🔧 تجميع المهن الحرفية:');
  for (const slug of CRAFT_PROFESSION_SLUGS) {
    const profession = await Profession.findOne({ slug });
    if (!profession) {
      log(`⚠️  ${slug}: غير موجودة — تُخطّى.`);
      continue;
    }
    if (String(profession.categoryId) === String(craftCategory._id)) {
      log(`${profession.name}: في التصنيف الصحيح بالفعل.`);
      continue;
    }

    /*
     * ملفات مقدّمي الخدمات تحمل `categoryId` منسوخًا بجوار `professionId`
     * (لتفادي join في كل استعلام تصفية)، فنقل المهنة وحدها يترك نسخهم
     * القديمة تشير لتصنيف لم تعد المهنة تنتمي إليه.
     */
    const affected = await ServiceProvider.countDocuments({ professionId: profession._id });
    log(
      `${profession.name}: ${dryRun ? 'ستُنقل' : 'نُقلت'} إلى «${CRAFT_CATEGORY_NAME}» (${affected} مقدّم خدمة).`
    );

    if (!dryRun) {
      profession.set('categoryId', craftCategory._id);
      await profession.save();
      await ServiceProvider.updateMany(
        { professionId: profession._id },
        { $set: { categoryId: craftCategory._id } }
      );
    }
  }

  /* ---- 5) حدّ حجم الهوية ---- */
  console.log('\n📏 حدّ حجم المستندات:');
  const professions = await Profession.find();
  let resized = 0;

  for (const profession of professions) {
    let changed = false;

    for (const requirement of profession.documentRequirements) {
      if (requirement.key === 'CUSTOM') continue;
      const target = maxSizeForDocument(requirement.key);
      if (requirement.maxSizeMB === target) continue;
      requirement.maxSizeMB = target;
      changed = true;
    }

    if (!changed) continue;
    resized += 1;
    if (!dryRun) await profession.save();
  }

  log(`${dryRun ? 'ستُعدَّل' : 'عُدّلت'} ${resized} مهنة من أصل ${professions.length}.`);

  console.log('\n✅ اكتملت الهجرة.');
  if (dryRun) console.log('ℹ️  أعد التشغيل بلا --dry-run للتنفيذ.');

  await disconnectFromDatabase();
}

main().catch(async (error) => {
  console.error('❌ فشلت الهجرة:', error);
  await disconnectFromDatabase().catch(() => undefined);
  process.exit(1);
});
