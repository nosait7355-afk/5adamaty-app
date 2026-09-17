#!/usr/bin/env node
/**
 * هجرة مناطق التغطية — من الأحياء الفرعية إلى المراكز الخمسة.
 *
 * صارت مناطق تغطية مقدم الخدمة (\`coverageAreas\`) ومناطق خدماته (\`areas\`)
 * اختيارًا من المراكز الخمسة فقط (الفيوم، سنورس، طامية، إطسا، إبشواي). أي
 * سجل مخزَّن بأسماء أحياء («حي الجامعة»…) يفشل في التحقق عند أول تعديل ولا
 * يطابق فلتر المنطقة الجديد. هذا السكربت يحوّل كل حيّ إلى مركزه بلا تكرار.
 *
 * عناوين العملاء لا تُمسّ — الأحياء باقية فيها.
 *
 * الاستخدام:
 *   npm run db:migrate-coverage -- --dry-run   # عرض بلا كتابة
 *   npm run db:migrate-coverage                # التنفيذ الفعلي
 *
 * مُتكرِّر الأمان: التشغيل الثاني لا يغيّر شيئًا.
 */

import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

const { toCoverageCities } = await import('../src/shared/constants/fayoum-areas');
const { connectToDatabase, disconnectFromDatabase } = await import('../src/server/db/mongoose');
const { ServiceProvider, Service } = await import('../src/server/db/models/index');

const dryRun = process.argv.includes('--dry-run');

const samples: string[] = [];
function note(line: string) {
  if (samples.length < 40) samples.push(line);
}

const same = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

async function migrateProviders() {
  let scanned = 0;
  let changed = 0;
  const cursor = ServiceProvider.find({}, 'displayName coverageAreas').cursor();

  for await (const provider of cursor) {
    scanned += 1;
    const original = provider.coverageAreas ?? [];
    let next = toCoverageCities(original);

    /*
     * مناطق التغطية إلزامية (منطقة واحدة على الأقل). لو لم يُعرف مركز أي
     * قيمة — وهذا لا يحدث مع بيانات القائمة الثابتة — نضع «الفيوم» بدل ترك
     * المزوّد بلا تغطية فيفشل حفظ ملفه.
     */
    if (next.length === 0) next = ['الفيوم'];
    if (same(original, next)) continue;

    changed += 1;
    note(`provider «${provider.displayName}»: [${original.join('، ')}] → [${next.join('، ')}]`);
    if (!dryRun) {
      await ServiceProvider.updateOne({ _id: provider._id }, { $set: { coverageAreas: next } });
    }
  }
  return { scanned, changed };
}

async function migrateServices() {
  let scanned = 0;
  let changed = 0;
  const cursor = Service.find({}, 'title areas').cursor();

  for await (const service of cursor) {
    scanned += 1;
    const original = service.areas ?? [];
    // مناطق الخدمة اختيارية: القائمة الفارغة تعني «كل مناطق المزوّد»
    const next = toCoverageCities(original);
    if (same(original, next)) continue;

    changed += 1;
    note(`service «${service.title}»: [${original.join('، ')}] → [${next.join('، ')}]`);
    if (!dryRun) {
      await Service.updateOne({ _id: service._id }, { $set: { areas: next } });
    }
  }
  return { scanned, changed };
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI غير معرّف. أضفه في .env.local — انظر .env.example.');
    process.exit(1);
  }

  console.log(dryRun ? '🔍 وضع المعاينة — لن تُكتب أي تغييرات.' : '✍️  وضع التنفيذ — ستُكتب التغييرات.');
  console.log('⏳ الاتصال بقاعدة البيانات...');
  await connectToDatabase();

  const providers = await migrateProviders();
  const services = await migrateServices();

  if (samples.length > 0) {
    console.log('\nعيّنة من التغييرات:');
    for (const line of samples) console.log(`   ${line}`);
  }

  console.log('\n📊 الملخّص:');
  console.log(`   providers  فُحص ${providers.scanned} — ${dryRun ? 'سيُعدَّل' : 'عُدّل'} ${providers.changed}`);
  console.log(`   services   فُحص ${services.scanned} — ${dryRun ? 'سيُعدَّل' : 'عُدّل'} ${services.changed}`);
  if (dryRun) console.log('\nℹ️  لم تُكتب أي تغييرات. أعد التشغيل بلا --dry-run للتنفيذ.');
  else console.log('\n✅ اكتملت الهجرة.');

  await disconnectFromDatabase();
}

main().catch(async (error) => {
  console.error('❌ فشلت الهجرة:', error);
  await disconnectFromDatabase().catch(() => undefined);
  process.exit(1);
});
