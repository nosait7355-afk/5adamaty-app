/**
 * قواعد الوصول للصفحات حسب الجلسة والدور — مصدر واحد لموضعين:
 *
 * - `src/proxy.ts`: الموقع، قبل إرسال الصفحة من الخادم.
 * - `mobile/src/route-guard.tsx`: تطبيق «خدمات الفيوم»، الصفحات محمَّلة
 *   محليًا فلا خادم يوجّه — الحارس يطبّق نفس القواعد على الجهاز.
 *
 * ⚠️ للتوجيه فقط. التفويض الحقيقي في كل endpoint (`requireAuth`
 * و`requireRole` و`assertOwnership`).
 */

export interface RouteClaims {
  role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN';
  status: string;
}

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
export function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function homeFor(claims: RouteClaims): string {
  if (claims.role === 'ADMIN') return '/admin/dashboard';
  if (claims.role === 'PROVIDER') {
    return claims.status === 'ACTIVE' ? '/home' : '/provider/pending-review';
  }
  return '/home';
}

/**
 * الوجهة البديلة إن كان المسار ممنوعًا على هذه الجلسة، أو `null` إن كان
 * مسموحًا. الوجهة مسار مع استعلامه (`/login?next=…`).
 */
export function resolveRouteRedirect(pathname: string, claims: RouteClaims | null): string | null {
  // زائر يحاول فتح صفحة محمية — نحفظ الوجهة ليعود إليها بعد الدخول
  if (!claims) {
    return isProtectedPath(pathname) ? `/login?next=${encodeURIComponent(pathname)}` : null;
  }

  /*
   * فتح التطبيق بجلسة صالحة: مباشرة إلى صفحته بدل شاشة البداية (`/`) التي
   * تطلب `/auth/me` ثم تحوّل. الإدارة مستثناة: وجهتها تعتمد على «معاينة
   * الواجهة» المحفوظة على الجهاز (`isAdminPreviewStored`) ولا يراها الخادم.
   */
  if (pathname === '/' && claims.role !== 'ADMIN') return homeFor(claims);

  // مستخدم مسجّل يفتح صفحة ضيوف → نوجّهه لصفحته
  const isGuestOnly =
    GUEST_ONLY.some((prefix) => matchesPrefix(pathname, prefix)) &&
    !GUEST_ONLY_EXCEPTIONS.some((prefix) => matchesPrefix(pathname, prefix));
  if (isGuestOnly) return homeFor(claims);

  // عزل المساحات حسب الدور
  if (matchesPrefix(pathname, '/admin') && claims.role !== 'ADMIN') return homeFor(claims);
  if (matchesPrefix(pathname, '/provider') && claims.role === 'CUSTOMER') return '/home';
  /*
   * `/account/become-provider` تحويل العميل إلى مقدم خدمة — مساحة عميل
   * لا مساحة مزوّد. لكن من أتمّ التحويل لم يعد له ما يفعله هنا.
   */
  if (matchesPrefix(pathname, '/account/become-provider') && claims.role !== 'CUSTOMER') {
    return homeFor(claims);
  }
  // معالج تسجيل المزوّد مفتوح للزائر ولمقدم الخدمة فقط — لا لعميل مسجّل
  if (matchesPrefix(pathname, '/register/provider') && claims.role !== 'PROVIDER') {
    return homeFor(claims);
  }

  return null;
}
