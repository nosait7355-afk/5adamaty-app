import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * حارس المسارات على مستوى الحافة (Edge) — اصطلاح `proxy` في Next 16.
 *
 * يمنع تحميل الصفحات المحمية أصلًا قبل أن تُرسل للمتصفح — بدل إخفائها
 * بالواجهة بعد التحميل.
 *
 * ⚠️ هذا الحارس للتوجيه فقط. التفويض الحقيقي يتم في كل endpoint عبر
 * `requireAuth` و`requireRole` و`assertOwnership`. لا تعتمد عليه وحده أبدًا:
 * الـAPI قابلة للاستدعاء مباشرة بلا مرور على هذا الملف.
 *
 * ملاحظة: نستخدم `jose` لا مكتبات Node لأن Edge Runtime لا يوفّر `crypto`
 * الخاص بـNode.
 */

const ACCESS_COOKIE = 'kf_at';

/** مسارات يجب أن يكون المستخدم مسجّلًا للوصول إليها. */
const PROTECTED_PREFIXES = [
  '/home',
  '/account',
  '/notifications',
  '/categories',
  '/services',
  '/providers',
  '/search',
  '/provider',
  '/admin',
];

/** مسارات لا معنى لها بعد تسجيل الدخول. */
const GUEST_ONLY = ['/login', '/register', '/role-select', '/forgot-password', '/reset-password'];

/**
 * استثناء من قاعدة «صفحات الضيوف».
 *
 * معالج تسجيل مقدم الخدمة يعبر حدّ المصادقة في منتصفه: الحساب يُنشأ بعد
 * الخطوة 2/4 ليصير رفع المستندات ممكنًا، فالخطوتان 3 و4 تُنفَّذان والمستخدم
 * **مسجّل دخوله**. لولا هذا الاستثناء لطُرد من معالجه فور إنشاء حسابه.
 */
const GUEST_ONLY_EXCEPTIONS = ['/register/provider'];

/**
 * مطابقة مسار على بادئة **بحدود مقطعية**.
 *
 * `startsWith` المجرّدة تطابق `/providers/123` على البادئة `/provider`،
 * فتحوّل صفحة ملف مقدم الخدمة (العامة لكل عميل) إلى مساحة المزوّد وتطرد
 * العميل منها. الشرط هنا: تطابق تام، أو بادئة يتلوها `/`.
 */
function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

interface TokenClaims {
  sub: string;
  role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN';
  status: string;
}

async function readClaims(request: NextRequest): Promise<TokenClaims | null> {
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) return null;

  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      issuer: 'khadamaty-elfayoum',
      audience: 'access',
      algorithms: ['HS256'],
    });

    if (typeof payload.sub !== 'string' || typeof payload.role !== 'string') return null;
    return payload as unknown as TokenClaims;
  } catch {
    return null;
  }
}

/**
 * يبني قيمة CSP قائمة على nonce — بلا `unsafe-inline` (بند Phase 10: تشديد
 * CSP، مؤجَّل من `PRE_PRODUCTION_CHECKLIST.md`).
 *
 * Next.js يُلحق هذا الـnonce تلقائيًا بسكربتات الإقلاع والترطيب الداخلية
 * حين يجدها في ترويسة `Content-Security-Policy` الصادرة — لا حاجة لحقنها
 * يدويًا في كل صفحة.
 */
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'` +
      (process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''),
    // ملاحظة: nonce لا يغطي خاصية style="" المضمّنة (فرق style-src-attr عن
    // style-src في CSP3) — React يولّد `style={{...}}` كخاصية مضمّنة في
    // عدة مكوّنات، فتبقى 'unsafe-inline' هنا. المتجه الفعلي للخطر هو
    // script-src، وهو مُشدَّد بالكامل بلا 'unsafe-inline'.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://res.cloudinary.com",
    "font-src 'self' data:",
    // https://accounts.google.com و https://www.googleapis.com: زر «المتابعة
    // عبر جوجل» — نافذة OAuth منبثقة على الويب تستدعيهما لإصدار/فحص التوكن.
    // لا استضافة ولا تخزين لدينا.
    "connect-src 'self' https://api.cloudinary.com https://accounts.google.com https://www.googleapis.com",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const claims = await readClaims(request);

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  const csp = buildCsp(nonce);

  const withCsp = (response: NextResponse) => {
    response.headers.set('Content-Security-Policy', csp);
    return response;
  };

  const isProtected = PROTECTED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));

  /*
   * صفحة محمية بـ`Cache-Control: no-store` لا يضعها المتصفح في bfcache
   * (Back-Forward Cache). بدونها: تسجيل الخروج ثم الضغط على «رجوع» يعيد
   * عرض نسخة الصفحة المحفوظة في الذاكرة مباشرة — بلا طلب شبكة جديد، وبلا
   * مرور على هذا الحارس من الأساس — فتظهر بيانات الحساب رغم الخروج.
   */
  const withNoStore = (response: NextResponse) => {
    if (isProtected) response.headers.set('Cache-Control', 'no-store, must-revalidate');
    return response;
  };
  const isGuestOnly =
    GUEST_ONLY.some((prefix) => matchesPrefix(pathname, prefix)) &&
    !GUEST_ONLY_EXCEPTIONS.some((prefix) => matchesPrefix(pathname, prefix));

  // زائر يحاول فتح صفحة محمية
  if (isProtected && !claims) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    // نحفظ الوجهة ليعود إليها بعد الدخول
    url.searchParams.set('next', pathname);
    return withCsp(NextResponse.redirect(url));
  }

  if (claims) {
    // مستخدم مسجّل يفتح صفحة ضيوف → نوجّهه لصفحته
    if (isGuestOnly) {
      const url = request.nextUrl.clone();
      url.pathname = homeFor(claims);
      url.search = '';
      return withCsp(NextResponse.redirect(url));
    }

    // عزل المساحات حسب الدور
    if (matchesPrefix(pathname, '/admin') && claims.role !== 'ADMIN') {
      return withCsp(NextResponse.redirect(new URL(homeFor(claims), request.url)));
    }
    if (matchesPrefix(pathname, '/provider') && claims.role === 'CUSTOMER') {
      return withCsp(NextResponse.redirect(new URL('/home', request.url)));
    }
    // معالج تسجيل المزوّد مفتوح للزائر ولمقدم الخدمة فقط — لا لعميل مسجّل
    if (matchesPrefix(pathname, '/register/provider') && claims.role !== 'PROVIDER') {
      return withCsp(NextResponse.redirect(new URL(homeFor(claims), request.url)));
    }
  }

  return withNoStore(withCsp(NextResponse.next({ request: { headers: requestHeaders } })));
}

function homeFor(claims: TokenClaims): string {
  if (claims.role === 'ADMIN') return '/admin/dashboard';
  if (claims.role === 'PROVIDER') {
    return claims.status === 'ACTIVE' ? '/home' : '/provider/pending-review';
  }
  return '/home';
}

export const config = {
  /* نستثني الأصول الثابتة والـAPI — الـAPI لها حُرّاسها الخاصة. */
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:png|jpg|svg|webp)$).*)'],
};
