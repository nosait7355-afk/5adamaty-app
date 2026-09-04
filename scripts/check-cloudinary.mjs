#!/usr/bin/env node
/**
 * فحص إعداد Cloudinary — يتحقق من صحة البيانات فعليًا قبل الاعتماد عليها.
 *
 * الاستخدام: node scripts/check-cloudinary.mjs
 *
 * يتحقق من:
 *   1. وجود المتغيرات الثلاثة.
 *   2. أن المفاتيح صحيحة (استدعاء حقيقي لـPing API).
 *   3. أن مفتاح الرموز الموقّتة مضبوط (وإلا روابط المستندات بلا انتهاء).
 *   4. أنه لا يوجد سرّ مكشوف خلف NEXT_PUBLIC_.
 */

import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

const checks = [];
function check(name, passed, detail = '') {
  checks.push({ name, passed, detail });
  console.log(`${passed ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}
function warn(name, detail) {
  checks.push({ name, passed: true, warning: true, detail });
  console.log(`⚠️  ${name} — ${detail}`);
}

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

console.log('🔍 فحص إعداد Cloudinary\n');

check('CLOUDINARY_CLOUD_NAME موجود', Boolean(cloudName));
check('CLOUDINARY_API_KEY موجود', Boolean(apiKey));
check('CLOUDINARY_API_SECRET موجود', Boolean(apiSecret));

/* لا يجوز أن يوجد أي سرّ خلف NEXT_PUBLIC_ */
const leaked = Object.keys(process.env).filter(
  (key) => key.startsWith('NEXT_PUBLIC_') && /SECRET|PRIVATE|API_KEY|PASSWORD/i.test(key)
);
check('لا سرّ مكشوف للمتصفح', leaked.length === 0, leaked.join(', '));

if (process.env.CLOUDINARY_AUTH_TOKEN_KEY) {
  check(
    'CLOUDINARY_AUTH_TOKEN_KEY مضبوط — روابط المستندات محدودة زمنيًا',
    /^[0-9a-fA-F]+$/.test(process.env.CLOUDINARY_AUTH_TOKEN_KEY)
  );
} else {
  warn(
    'CLOUDINARY_AUTH_TOKEN_KEY غير مضبوط',
    'روابط المستندات ستكون موقّعة لكن بلا انتهاء زمني. اضبطه من إعدادات الحساب لتفعيل صلاحية 5 دقائق.'
  );
}

/* استدعاء حقيقي للتأكد أن المفاتيح صالحة فعلًا */
if (cloudName && apiKey && apiSecret) {
  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/ping`, {
      headers: { Authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(10_000),
    });

    if (response.ok) {
      check('المفاتيح صالحة (Ping ناجح)', true);
    } else if (response.status === 401) {
      check('المفاتيح صالحة', false, 'API_KEY أو API_SECRET غير صحيح (401)');
    } else if (response.status === 404) {
      check('اسم السحابة صحيح', false, `لا توجد سحابة باسم "${cloudName}" (404)`);
    } else {
      check('المفاتيح صالحة', false, `استجابة غير متوقعة: ${response.status}`);
    }
  } catch (error) {
    check('الاتصال بـCloudinary', false, `تعذّر الاتصال: ${error.message}`);
  }
}

const failed = checks.filter((c) => !c.passed);
const warnings = checks.filter((c) => c.warning);

console.log(`\n${'─'.repeat(56)}`);
console.log(`النتيجة: ${checks.length - failed.length}/${checks.length} نجحت`);
if (warnings.length > 0) console.log(`تنبيهات: ${warnings.length}`);

if (failed.length > 0) {
  console.log('\nالفاشلة:');
  for (const f of failed) console.log(`  - ${f.name}${f.detail ? `: ${f.detail}` : ''}`);
  console.log('\nراجع .env.example للتفاصيل.');
  process.exit(1);
}

console.log('\n✅ Cloudinary جاهز للاستخدام.');
