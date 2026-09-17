#!/usr/bin/env node
/**
 * هجرة المراكز الملغاة — يحوّل السجلات القديمة إلى قائمة المراكز المعتمدة.
 *
 * قُلّصت `FAYOUM_CITIES` إلى خمسة مراكز (الفيوم، سنورس، طامية، إطسا،
 * إبشواي). أي سجل مخزَّن بمركز أو منطقة محذوفة يفشل في `z.enum` عند أول
 * تعديل، ويختفي من الفلترة. هذا السكربت يصلح السجلات مرة واحدة.
 *
 * الاستخدام:
 *   npm run db:migrate-cities -- --dry-run   # عرض ما سيتغيّر بلا كتابة
 *   npm run db:migrate-cities                # التنفيذ الفعلي
 *
 * السكربت **مُتكرِّر الأمان** (idempotent): تشغيله مرتين لا يغيّر شيئًا في
 * المرة الثانية، لأن الخرائط تربط قيمًا ملغاة فقط بقيم معتمدة.
 */

import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

const {
  RETIRED_CITY_MIGRATIONS,
  RETIRED_AREA_MIGRATIONS,
  isValidArea,
  isValidCity,
  isValidCoverageArea,
  toCoverageCities,
} = await import('../src/shared/constants/fayoum-areas');
const { connectToDatabase, disconnectFromDatabase } = await import('../src/server/db/mongoose');
const { User, Address, ServiceProvider, ServiceRequest } = await import(
  '../src/server/db/models/index'
);

const dryRun = process.argv.includes('--dry-run');

interface Counters {
  scanned: number;
  changed: number;
}

const stats: Record<string, Counters> = {
  users: { scanned: 0, changed: 0 },
  addresses: { scanned: 0, changed: 0 },
  providers: { scanned: 0, changed: 0 },
  orders: { scanned: 0, changed: 0 },
};

/** سجلّ ما تغيّر — يُطبع في الوضع الجاف ليراجعه المشغّل قبل الكتابة. */
const samples: string[] = [];

function note(line: string) {
  if (samples.length < 40) samples.push(line);
}

/** المركز البديل لمركز ملغى، أو `null` إذا كان المركز سليمًا بالفعل. */
function mapCity(city: string | undefined | null): string | null {
  if (!city) return null;
  if (isValidCity(city)) return null;
  return RETIRED_CITY_MIGRATIONS[city] ?? 'الفيوم';
}

/** المنطقة البديلة لمنطقة ملغاة، أو `null` إذا كانت سليمة بالفعل. */
function mapArea(area: string | undefined | null): { city: string; area: string } | null {
  if (!area) return null;
  if (isValidArea(area)) return null;
  return RETIRED_AREA_MIGRATIONS[area] ?? { city: 'الفيوم', area: 'حي الجامعة' };
}

/* ------------------------------------------------------------------ */
/* المستخدمون — city و area اختياريان                                  */
/* ------------------------------------------------------------------ */

async function migrateUsers() {
  const cursor = User.find({}, 'city area').cursor();

  for await (const user of cursor) {
    stats.users.scanned += 1;

    const patch: Record<string, string> = {};
    const nextCity = mapCity(user.city);
    const nextArea = mapArea(user.area);

    if (nextCity) patch.city = nextCity;
    if (nextArea) {
      patch.area = nextArea.area;
      // المنطقة الملغاة تجرّ معها مركزها الصحيح، وإلا بقي الاثنان متنافرين
      if (!patch.city) patch.city = nextArea.city;
    }

    if (Object.keys(patch).length === 0) continue;

    stats.users.changed += 1;
    note(`user ${String(user._id)}: ${user.city ?? '—'}/${user.area ?? '—'} → ${patch.city ?? user.city ?? '—'}/${patch.area ?? user.area ?? '—'}`);

    if (!dryRun) await User.updateOne({ _id: user._id }, { $set: patch });
  }
}

/* ------------------------------------------------------------------ */
/* العناوين — city و area إلزاميان                                     */
/* ------------------------------------------------------------------ */

async function migrateAddresses() {
  const cursor = Address.find({}, 'city area').cursor();

  for await (const address of cursor) {
    stats.addresses.scanned += 1;

    const patch: Record<string, string> = {};
    const nextCity = mapCity(address.city);
    const nextArea = mapArea(address.area);

    if (nextCity) patch.city = nextCity;
    if (nextArea) {
      patch.area = nextArea.area;
      if (!patch.city) patch.city = nextArea.city;
    }

    if (Object.keys(patch).length === 0) continue;

    stats.addresses.changed += 1;
    note(`address ${String(address._id)}: ${address.city}/${address.area} → ${patch.city ?? address.city}/${patch.area ?? address.area}`);

    if (!dryRun) await Address.updateOne({ _id: address._id }, { $set: patch });
  }
}

/* ------------------------------------------------------------------ */
/* مناطق تغطية المزوّدين — مصفوفة، وقد تتكرّر بعد التحويل               */
/* ------------------------------------------------------------------ */

async function migrateProviders() {
  const cursor = ServiceProvider.find({}, 'coverageAreas').cursor();

  for await (const provider of cursor) {
    stats.providers.scanned += 1;

    /*
     * مناطق التغطية صارت **مراكز** لا أحياء، فالتحويل هنا إلى المركز لا إلى
     * حيّ بديل — وإلا أعاد تشغيل هذا السكربت «الفيوم» إلى حيّ افتراضي.
     * التحويل نفسه يتولّاه `migrate-coverage`؛ هذا فرع حماية فقط.
     */
    const original = provider.coverageAreas ?? [];
    if (original.every((area) => isValidCoverageArea(area))) continue;

    const coverageAreas = toCoverageCities(original);
    if (coverageAreas.length === 0) coverageAreas.push('الفيوم');
    stats.providers.changed += 1;
    note(`provider ${String(provider._id)}: [${original.join('، ')}] → [${coverageAreas.join('، ')}]`);

    if (!dryRun) {
      await ServiceProvider.updateOne({ _id: provider._id }, { $set: { coverageAreas } });
    }
  }
}

/* ------------------------------------------------------------------ */
/* لقطة العنوان داخل الطلبات                                           */
/* ------------------------------------------------------------------ */

/*
 * الطلبات تحفظ **لقطة** من العنوان وقت الإنشاء لا مرجعًا حيًّا، فلا تتأثر
 * بتصحيح `Address`. تُهاجَر هنا كي تبقى الفلترة والتقارير متسقة؛ الطلبات
 * المكتملة تاريخ، لكن مركزًا لم يعد موجودًا في القائمة يكسر أي تجميع حسبه.
 */
async function migrateOrders() {
  const cursor = ServiceRequest.find({}, 'address').cursor();

  for await (const order of cursor) {
    stats.orders.scanned += 1;

    const patch: Record<string, string> = {};
    const nextCity = mapCity(order.address?.city);
    const nextArea = mapArea(order.address?.area);

    if (nextCity) patch['address.city'] = nextCity;
    if (nextArea) {
      patch['address.area'] = nextArea.area;
      if (!patch['address.city']) patch['address.city'] = nextArea.city;
    }

    if (Object.keys(patch).length === 0) continue;

    stats.orders.changed += 1;
    note(`order ${String(order._id)}: ${order.address.city}/${order.address.area} → ${patch['address.city'] ?? order.address.city}/${patch['address.area'] ?? order.address.area}`);

    if (!dryRun) await ServiceRequest.updateOne({ _id: order._id }, { $set: patch });
  }
}

/* ------------------------------------------------------------------ */

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI غير معرّف. أضفه في .env.local — انظر .env.example.');
    process.exit(1);
  }

  console.log(dryRun ? '🔍 وضع المعاينة — لن تُكتب أي تغييرات.' : '✍️  وضع التنفيذ — ستُكتب التغييرات.');
  console.log('\nخريطة المراكز الملغاة:');
  for (const [from, to] of Object.entries(RETIRED_CITY_MIGRATIONS)) {
    console.log(`   ${from} → ${to}`);
  }
  console.log('خريطة المناطق الملغاة:');
  for (const [from, to] of Object.entries(RETIRED_AREA_MIGRATIONS)) {
    console.log(`   ${from} → ${to.city}/${to.area}`);
  }

  console.log('\n⏳ الاتصال بقاعدة البيانات...');
  await connectToDatabase();

  await migrateUsers();
  await migrateAddresses();
  await migrateProviders();
  await migrateOrders();

  if (samples.length > 0) {
    console.log('\nعيّنة من التغييرات:');
    for (const line of samples) console.log(`   ${line}`);
  }

  console.log('\n📊 الملخّص:');
  for (const [name, counter] of Object.entries(stats)) {
    console.log(`   ${name.padEnd(10)} فُحص ${counter.scanned} — عُدّل ${counter.changed}`);
  }

  if (dryRun) {
    console.log('\nℹ️  لم تُكتب أي تغييرات. أعد التشغيل بلا --dry-run للتنفيذ.');
  } else {
    console.log('\n✅ اكتملت الهجرة.');
  }

  await disconnectFromDatabase();
}

main().catch(async (error) => {
  console.error('❌ فشلت الهجرة:', error);
  await disconnectFromDatabase().catch(() => undefined);
  process.exit(1);
});
