#!/usr/bin/env node
/**
 * فحص دخان لتدفق المصادقة عبر HTTP حقيقي.
 * يتحقق من الكوكيز والحماية والتوجيه — لا يُشغَّل في CI، أداة تحقق يدوية.
 *
 * الاستخدام: node scripts/smoke-auth.mjs [baseUrl]
 */

const BASE = process.argv[2] ?? 'http://localhost:3100';
const API = `${BASE}/api/v1`;
const ORIGIN = BASE;

let cookies = '';

function captureCookies(response) {
  const raw = response.headers.getSetCookie?.() ?? [];
  const jar = new Map(
    cookies
      .split('; ')
      .filter(Boolean)
      .map((c) => c.split('='))
      .map(([k, ...v]) => [k, v.join('=')])
  );

  for (const line of raw) {
    const [pair] = line.split(';');
    const [key, ...value] = pair.split('=');
    const joined = value.join('=');
    if (joined === '') jar.delete(key);
    else jar.set(key, joined);
  }

  cookies = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  return raw;
}

async function call(method, path, body, extraHeaders = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Origin: ORIGIN,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookies ? { Cookie: cookies } : {}),
      ...extraHeaders,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: 'manual',
  });

  const setCookie = captureCookies(response);
  const json = await response.json().catch(() => null);
  return { status: response.status, json, setCookie, headers: response.headers };
}

const results = [];
function check(name, passed, detail = '') {
  results.push({ name, passed, detail });
  console.log(`${passed ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

const unique = Date.now().toString().slice(-8);
const PHONE = `010${unique}`;
const EMAIL = `smoke${unique}@test.com`;
const PASSWORD = 'Smoke12345';

console.log('🔍 فحص تدفق المصادقة\n');

/* 1) التسجيل */
const registered = await call('POST', '/auth/register', {
  fullName: 'أحمد محمد علي',
  phone: PHONE,
  email: EMAIL,
  area: 'حي الجامعة',
  city: 'الفيوم',
  password: PASSWORD,
  confirmPassword: PASSWORD,
  acceptTerms: true,
});
check('التسجيل ينجح', registered.status === 201, `status ${registered.status}`);
check(
  'لا يعيد passwordHash',
  !JSON.stringify(registered.json).includes('argon2') &&
    !JSON.stringify(registered.json).includes('passwordHash')
);

/* 2) خصائص الكوكيز */
const cookieLines = registered.setCookie.join(' | ');
check('كوكي الوصول httpOnly', /kf_at=[^;]+;[^|]*HttpOnly/i.test(cookieLines));
check('كوكي التحديث httpOnly', /kf_rt=[^;]+;[^|]*HttpOnly/i.test(cookieLines));
check('SameSite=Lax على الكوكيز', /SameSite=Lax/i.test(cookieLines));
check('Path=/ على الكوكيز', /Path=\//i.test(cookieLines));

/* 3) الجلسة تعمل */
const me = await call('GET', '/auth/me');
check('me يعيد المستخدم', me.status === 200 && me.json?.data?.user?.phone === `+20${PHONE.slice(1)}`);
check('me لا يسرّب حقولًا حسّاسة', !JSON.stringify(me.json).includes('passwordHash'));

/* 4) رفض CSRF */
const csrf = await call('POST', '/auth/login', { identifier: PHONE, password: PASSWORD }, { Origin: 'https://evil.example.com' });
check('يرفض المصدر الخارجي (CSRF)', csrf.status === 403, `status ${csrf.status}`);

/* 5) الرسالة الموحّدة عند الفشل */
const badPassword = await call('POST', '/auth/login', { identifier: PHONE, password: 'WrongPass99', remember: false });
const noAccount = await call('POST', '/auth/login', { identifier: '01099887766', password: 'WrongPass99', remember: false });
check(
  'رسالة موحّدة لحساب غير موجود ولكلمة مرور خاطئة',
  badPassword.json?.error?.message === noAccount.json?.error?.message,
  badPassword.json?.error?.message ?? ''
);

/* 6) تسجيل الدخول */
const loggedIn = await call('POST', '/auth/login', { identifier: EMAIL, password: PASSWORD, remember: true });
check('الدخول بالبريد ينجح', loggedIn.status === 200, `status ${loggedIn.status}`);

/* 7) التدوير */
const rtBefore = cookies.match(/kf_rt=([^;]+)/)?.[1];
const refreshed = await call('POST', '/auth/refresh');
const rtAfter = cookies.match(/kf_rt=([^;]+)/)?.[1];
check('التحديث ينجح', refreshed.status === 200, `status ${refreshed.status}`);
check('توكن التحديث يتغيّر (rotation)', Boolean(rtBefore) && rtBefore !== rtAfter);

/* 8) كشف إعادة الاستخدام */
const reuse = await fetch(`${API}/auth/refresh`, {
  method: 'POST',
  headers: { Origin: ORIGIN, Cookie: `kf_rt=${rtBefore}` },
});
check('إعادة استخدام التوكن القديم مرفوضة', reuse.status === 401, `status ${reuse.status}`);

/* بعد كشف إعادة الاستخدام أُبطلت كل الجلسات — نتحقق */
const afterRevoke = await call('POST', '/auth/refresh');
check('كل الجلسات أُبطلت بعد كشف إعادة الاستخدام', afterRevoke.status === 401);

/* 9) حماية المسارات */
const guarded = await fetch(`${BASE}/home`, { redirect: 'manual' });
check(
  'زائر يُوجَّه من /home إلى /login',
  guarded.status === 307 && (guarded.headers.get('location') ?? '').includes('/login'),
  `status ${guarded.status} → ${guarded.headers.get('location') ?? ''}`
);

/* 10) الرؤوس الأمنية */
const health = await fetch(`${API}/health`);
const perms = health.headers.get('permissions-policy') ?? '';
check('geolocation معطّلة', perms.includes('geolocation=()'));
check('payment معطّلة', perms.includes('payment=()'));

/* الملخص */
const failed = results.filter((r) => !r.passed);
console.log(`\n${'─'.repeat(50)}`);
console.log(`النتيجة: ${results.length - failed.length}/${results.length} نجحت`);
if (failed.length > 0) {
  console.log('\nالفاشلة:');
  for (const f of failed) console.log(`  - ${f.name} ${f.detail}`);
  process.exit(1);
}
