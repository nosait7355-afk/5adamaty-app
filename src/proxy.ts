import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { THEME_SCRIPT_HASH } from '@/shared/theme';
import { NATIVE_APP_ORIGINS, NATIVE_CLIENT_HEADER } from '@/shared/constants/native-app';
import { isProtectedPath, resolveRouteRedirect, type RouteClaims } from '@/shared/route-access';

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
 *
 * قواعد الوصول نفسها في `shared/route-access.ts` — يطبّقها تطبيق «خدمات
 * الفيوم» أيضًا على الجهاز (`mobile/src/route-guard.tsx`).
 */

const ACCESS_COOKIE = 'kf_at';

interface TokenClaims extends RouteClaims {
  sub: string;
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
    // البصمة: سكربت المظهر المضمَّن الوحيد، الثابت النص (shared/theme.ts)
    `script-src 'self' 'nonce-${nonce}' 'sha256-${THEME_SCRIPT_HASH}' 'strict-dynamic'` +
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

/**
 * CORS للـAPI — لتطبيق «خدمات الفيوم» فقط.
 *
 * واجهته محمَّلة من `https://localhost` داخل الـAPK، فطلباته للـAPI
 * عابرة للمصدر. قائمة مسموحة صريحة لا `*`، وبلا
 * `Access-Control-Allow-Credentials`: التطبيق يصادق بـ`Authorization`
 * لا بالكوكيز، فلا يستطيع أي مصدر آخر أن يركب جلسة متصفح عبر CORS.
 *
 * الموقع نفسه من نفس المصدر فلا يتأثر بشيء هنا.
 */
const CORS_ORIGINS: readonly string[] = [
  ...NATIVE_APP_ORIGINS,
  ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000', 'http://localhost:5173']),
];

function handleApiCors(request: NextRequest): NextResponse {
  const origin = request.headers.get('origin');
  const allowed = origin !== null && CORS_ORIGINS.includes(origin);

  const headers = new Headers({ Vary: 'Origin' });
  if (allowed) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    headers.set(
      'Access-Control-Allow-Headers',
      `Content-Type, Authorization, ${NATIVE_CLIENT_HEADER}`
    );
    headers.set('Access-Control-Max-Age', '600');
  }

  // Preflight يُجاب هنا ولا يصل للمسار. مصدر غير مسموح يستلم 204 بلا
  // رؤوس السماح فيحجبه المتصفح.
  if (request.method === 'OPTIONS') return new NextResponse(null, { status: 204, headers });

  const response = NextResponse.next();
  headers.forEach((value, key) => response.headers.set(key, value));
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // الـAPI لها حُرّاسها الخاصة — هنا CORS فقط، بلا توجيه ولا CSP
  if (pathname.startsWith('/api/')) return handleApiCors(request);

  const claims = await readClaims(request);

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  const csp = buildCsp(nonce);

  const withCsp = (response: NextResponse) => {
    response.headers.set('Content-Security-Policy', csp);
    return response;
  };

  const isProtected = isProtectedPath(pathname);

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
  const target = resolveRouteRedirect(pathname, claims);
  if (target) return withCsp(NextResponse.redirect(new URL(target, request.url)));

  return withNoStore(withCsp(NextResponse.next({ request: { headers: requestHeaders } })));
}

export const config = {
  /* نستثني الأصول الثابتة. الـAPI تمرّ لأجل CORS فقط (`handleApiCors`). */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png|.*\\.(?:png|jpg|svg|webp)$).*)'],
};
