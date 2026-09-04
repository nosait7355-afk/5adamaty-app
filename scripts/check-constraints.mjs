#!/usr/bin/env node
/**
 * فحص القيود غير القابلة للتفاوض (NON-NEGOTIABLE).
 *
 * يفشل البناء إذا تسرّب إلى الكود أي شيء ممنوع:
 *   1) دفع إلكتروني / بوابات دفع / معاملات مالية   (PROJECT_PLAN — قواعد الدفع)
 *   2) خرائط / GPS / تتبّع / ETA / إحداثيات        (PROJECT_PLAN — قواعد الخرائط)
 *   3) OTP / تسجيل دخول اجتماعي                     (PROJECT_PLAN — المصادقة)
 *   4) أسرار Cloudinary مكشوفة للمتصفح
 *
 * يُشغَّل عبر: npm run check:constraints
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');

const SCAN_DIRS = ['src', 'scripts'];
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css']);
const IGNORE_DIRS = new Set(['node_modules', '.next', 'android', 'dist', 'build', '.git']);

/**
 * كل قاعدة: نمط + سبب + استثناءات.
 * الأنماط تبحث عن **استخدام فعلي** لا عن ذكر الكلمة في تعليق عربي يشرح المنع.
 */
const RULES = [
  // ---- 1) الدفع ----
  {
    id: 'PAYMENT_SDK',
    // ملاحظة: نتجنّب \b لأنها لا تحدّ عند الشرطة السفلية،
    // فكان "pk_live_stripe_test" يفلت من الفحص.
    pattern:
      /(?<![a-z0-9])(stripe|paymob|fawry|paypal|braintree|razorpay|myfatoorah)(?![a-z0-9])/i,
    reason: 'مكتبة أو خدمة دفع إلكتروني — ممنوعة نهائيًا',
  },
  {
    id: 'PAYMENT_CARD',
    pattern: /\b(cardNumber|card_number|cvv|cvc|expiryDate|expiry_date|cardHolder)\b/,
    reason: 'حقل بيانات بطاقة دفع — ممنوع نهائيًا',
  },
  {
    id: 'PAYMENT_ENTITY',
    pattern:
      /\b(PaymentGateway|PaymentIntent|createPayment|processPayment|chargeCard|TransactionModel|WalletBalance)\b/,
    reason: 'كيان أو دالة معاملة مالية — ممنوعة نهائيًا',
  },

  // ---- 2) الخرائط والموقع ----
  {
    id: 'MAPS_SDK',
    pattern:
      /(?<![a-z0-9])(google-?maps|mapbox|leaflet|openstreetmap|maplibre)(?![a-z0-9])/i,
    reason: 'مكتبة خرائط — ممنوعة نهائيًا',
  },
  {
    id: 'GEOLOCATION_API',
    // نستثني `geolocation=()` في Permissions-Policy لأنه *تعطيل* لا استخدام
    pattern: /navigator\s*\.\s*geolocation|getCurrentPosition|watchPosition/,
    reason: 'استخدام Geolocation API — ممنوع نهائيًا',
  },
  {
    id: 'GEO_FIELDS',
    pattern: /\b(latitude|longitude|coordinates\s*:|GeoJSON|2dsphere|calculateDistance|haversine)\b/i,
    reason: 'حقل إحداثيات أو حساب مسافة — ممنوع نهائيًا',
  },
  {
    id: 'TRACKING',
    pattern: /\b(liveLocation|locationTracking|trackProvider|estimatedArrival|etaMinutes|routePolyline)\b/i,
    reason: 'تتبّع موقع أو ETA — ممنوع نهائيًا',
  },

  // ---- 3) المصادقة ----
  {
    id: 'OTP',
    pattern: /\b(otpCode|verifyOtp|sendOtp|OTP_SECRET|smsVerification|twilio)\b/i,
    reason: 'آلية OTP — ممنوعة نهائيًا',
  },
  {
    id: 'SOCIAL_LOGIN',
    pattern:
      /\b(signInWithGoogle|signInWithFacebook|googleOAuth|facebookLogin|appleSignIn|next-auth\/providers\/(google|facebook|apple))\b/i,
    reason: 'تسجيل دخول اجتماعي — ممنوع نهائيًا',
  },

  // ---- 4) الأسرار ----
  {
    id: 'PUBLIC_SECRET',
    pattern: /NEXT_PUBLIC_[A-Z_]*(SECRET|PRIVATE|PASSWORD|MONGODB|JWT)/,
    reason: 'سرّ مكشوف للمتصفح عبر NEXT_PUBLIC_',
  },
];

/** أسطر يُسمح لها بمخالفة قاعدة بعينها، لأنها هي التي تفرض المنع. */
const ALLOWLIST = [
  // ملف الفحص نفسه يحتوي كل الأنماط
  { file: 'scripts/check-constraints.mjs', rules: '*' },
  // next.config.ts يعطّل geolocation صراحةً في Permissions-Policy
  { file: 'src/next.config.ts', rules: ['GEOLOCATION_API'] },
];

function isAllowed(relPath, ruleId) {
  return ALLOWLIST.some(
    (entry) =>
      relPath === entry.file && (entry.rules === '*' || entry.rules.includes(ruleId))
  );
}

function collectFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }

  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stats = statSync(full);

    if (stats.isDirectory()) {
      collectFiles(full, out);
    } else if (SCAN_EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')))) {
      out.push(full);
    }
  }
  return out;
}

function main() {
  const files = [
    ...SCAN_DIRS.flatMap((dir) => collectFiles(join(ROOT, dir))),
    join(ROOT, 'next.config.ts'),
    join(ROOT, 'package.json'),
  ];

  const violations = [];

  for (const file of files) {
    let content;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    const relPath = relative(ROOT, file).split(sep).join('/');
    const lines = content.split('\n');

    for (const rule of RULES) {
      if (isAllowed(relPath, rule.id)) continue;

      lines.forEach((line, index) => {
        // نتجاهل أسطر التعليقات التي تشرح المنع نفسه.
        // شرطان معًا: السطر تعليق **و** يحمل صيغة نفي/منع صريحة.
        const isComment = /^\s*(\*|\/\/|#|\/\*)/.test(line);
        const isProhibitionNote = /ممنوع|NON-NEGOTIABLE|لا\s|بلا\s|بدون\s/.test(line);
        if (isComment && isProhibitionNote) return;

        if (rule.pattern.test(line)) {
          violations.push({
            file: relPath,
            line: index + 1,
            rule: rule.id,
            reason: rule.reason,
            snippet: line.trim().slice(0, 100),
          });
        }
      });
    }
  }

  if (violations.length > 0) {
    console.error('\n❌ فشل فحص القيود — تم العثور على مخالفات:\n');
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}`);
      console.error(`    [${v.rule}] ${v.reason}`);
      console.error(`    > ${v.snippet}\n`);
    }
    console.error(`المجموع: ${violations.length} مخالفة\n`);
    process.exit(1);
  }

  console.log(`✅ فحص القيود نجح — ${files.length} ملف، صفر مخالفة.`);
  console.log('   لا دفع إلكتروني · لا خرائط أو تتبّع · لا OTP أو دخول اجتماعي · لا أسرار مكشوفة.');
}

main();
