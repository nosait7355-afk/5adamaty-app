#!/usr/bin/env node
/**
 * هجرة مستندات المهن — تطبّق القائمة الجديدة على المهن المخزّنة.
 *
 * قائمة المستندات تُخزَّن داخل كل مهنة في قاعدة البيانات، وشاشة التسجيل
 * تقرأ منها لا من الكود. تغيير \`buildDocumentRequirements\` وحده لا يمسّ
 * المهن الموجودة، فتظل تطلب الصورة الشخصية والمؤهل والترخيص إلزاميًا —
 * وهذا ما يُبقي زر الإرسال في خطوة المستندات معطّلًا.
 *
 * ما يفعله لكل مهنة:
 *   - يستبدل المستندات القياسية الأربعة بالقائمة الجديدة (الهوية وحدها إلزامية).
 *   - يُبقي المستندات المخصّصة (CUSTOM) التي أضافها Admin، اختياريةً.
 *   - يخفض \`maxSizeMB\` لكل مستند إلى الحد الجديد (3MB).
 *
 * الاستخدام:
 *   npm run db:migrate-professions -- --dry-run   # عرض بلا كتابة
 *   npm run db:migrate-professions                # التنفيذ الفعلي
 *
 * مُتكرِّر الأمان: التشغيل الثاني لا يغيّر شيئًا.
 */

import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

const { buildDocumentRequirements, DOCUMENT_MAX_SIZE_MB } = await import(
  '../src/shared/constants/documents'
);
const { connectToDatabase, disconnectFromDatabase } = await import('../src/server/db/mongoose');
const { Profession } = await import('../src/server/db/models/index');

const dryRun = process.argv.includes('--dry-run');

/** بصمة مختصرة للمقارنة — تتجاهل الحقول التي لا تغيّرها الهجرة. */
function fingerprint(list: { key: string; customKey?: string; required: boolean; maxSizeMB: number }[]) {
  return JSON.stringify(
    list.map((item) => [item.key, item.customKey ?? '', item.required, item.maxSizeMB])
  );
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI غير معرّف. أضفه في .env.local — انظر .env.example.');
    process.exit(1);
  }

  console.log(dryRun ? '🔍 وضع المعاينة — لن تُكتب أي تغييرات.' : '✍️  وضع التنفيذ — ستُكتب التغييرات.');
  console.log('⏳ الاتصال بقاعدة البيانات...');
  await connectToDatabase();

  const professions = await Profession.find();
  let changed = 0;

  for (const profession of professions) {
    const current = profession.documentRequirements.map((item) => item.toObject());

    const custom = current
      .filter((item) => item.key === 'CUSTOM')
      .map((item) => ({
        ...item,
        required: false,
        maxSizeMB: Math.min(item.maxSizeMB, DOCUMENT_MAX_SIZE_MB),
      }));

    const next = buildDocumentRequirements({ custom });

    if (fingerprint(current) === fingerprint(next)) continue;

    changed += 1;
    const requiredBefore = current.filter((item) => item.required).map((item) => item.key);
    console.log(
      `   ${profession.name}: إلزامي [${requiredBefore.join('، ')}] → [NATIONAL_ID] · ${current.length} → ${next.length} مستند`
    );

    if (!dryRun) {
      profession.set('documentRequirements', next);
      // \`save\` لا \`updateOne\`: يمرّ على حارس الاتساق في النموذج
      await profession.save();
    }
  }

  console.log(`\n📊 فُحصت ${professions.length} مهنة — ${dryRun ? 'ستُعدَّل' : 'عُدّلت'} ${changed}.`);
  if (dryRun && changed > 0) console.log('ℹ️  أعد التشغيل بلا --dry-run للتنفيذ.');

  await disconnectFromDatabase();
}

main().catch(async (error) => {
  console.error('❌ فشلت الهجرة:', error);
  await disconnectFromDatabase().catch(() => undefined);
  process.exit(1);
});
