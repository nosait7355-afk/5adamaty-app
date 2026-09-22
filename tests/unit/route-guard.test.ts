import { beforeAll, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { signAccessToken } from '@/server/lib/jwt';

/**
 * حارس المسارات (`src/proxy.ts`).
 *
 * أُضيفت هذه الاختبارات في Phase 5 بعد اكتشاف أن مطابقة البادئة المجرّدة
 * كانت تعتبر `/providers/:id` (ملف مقدم الخدمة — شاشة عميل) جزءًا من
 * مساحة `/provider` (لوحة المزوّد)، فتطرد العميل منها إلى `/home`.
 */

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-at-least-32-characters-long!!';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters-long!';
  process.env.APP_URL = 'http://localhost:3000';
});

const ACCESS_COOKIE = 'kf_at';

async function request(pathname: string, role?: 'CUSTOMER' | 'PROVIDER' | 'ADMIN') {
  const req = new NextRequest(new URL(pathname, 'http://localhost:3000'));

  if (role) {
    const token = await signAccessToken({ userId: '507f1f77bcf86cd799439011', role, status: 'ACTIVE' });
    req.cookies.set(ACCESS_COOKIE, token);
  }

  return proxy(req);
}

/** الوجهة النهائية: مسار التحويل، أو `null` إذا مُرّر الطلب كما هو. */
function redirectTo(response: Response): string | null {
  const location = response.headers.get('location');
  return location ? new URL(location).pathname : null;
}

describe('الزائر غير المسجّل', () => {
  it('يُحوَّل إلى الدخول عند فتح شاشات الاكتشاف', async () => {
    for (const path of ['/home', '/categories', '/services', '/search', '/providers/abc']) {
      expect(redirectTo(await request(path)), path).toBe('/login');
    }
  });

  it('يُحوَّل إلى الدخول عند فتح الحساب أو الإشعارات', async () => {
    for (const path of ['/account', '/notifications']) {
      expect(redirectTo(await request(path)), path).toBe('/login');
    }
  });

  it('مركز المساعدة متاح للزائر — يعمل قبل الدخول', async () => {
    expect(redirectTo(await request('/help'))).toBeNull();
  });

  it('يحتفظ بالوجهة في معامل next', async () => {
    const response = await request('/providers/507f1f77bcf86cd799439011');
    const location = new URL(response.headers.get('location') ?? '');
    expect(location.searchParams.get('next')).toBe('/providers/507f1f77bcf86cd799439011');
  });

  it('يمرّ إلى صفحات الضيوف بلا تحويل', async () => {
    expect(redirectTo(await request('/login'))).toBeNull();
  });
});

describe('معالج تسجيل مقدم الخدمة', () => {
  /*
   * المعالج يعبر حدّ المصادقة في منتصفه: الحساب يُنشأ بعد الخطوة 2/4، فتُنفَّذ
   * الخطوتان 3 و4 والمستخدم مسجّل دخوله. لولا الاستثناء لطُرد من معالجه.
   */
  it('مفتوح للزائر', async () => {
    expect(redirectTo(await request('/register/provider'))).toBeNull();
  });

  it('يبقى مفتوحًا لمقدم الخدمة بعد إنشاء حسابه', async () => {
    expect(redirectTo(await request('/register/provider', 'PROVIDER'))).toBeNull();
  });

  it('مغلق أمام عميل مسجّل — لا ينشئ حسابًا ثانيًا من حسابه', async () => {
    expect(redirectTo(await request('/register/provider', 'CUSTOMER'))).toBe('/home');
  });

  it('باقي صفحات الضيوف تبقى مغلقة على المسجّلين', async () => {
    expect(redirectTo(await request('/register', 'PROVIDER'))).toBe('/home');
  });
});

describe('العميل المسجّل', () => {
  it('يفتح ملف مقدم الخدمة بلا تحويل', async () => {
    // الانحدار الذي دفع لكتابة هذا الملف
    expect(redirectTo(await request('/providers/507f1f77bcf86cd799439011', 'CUSTOMER'))).toBeNull();
  });

  it('يفتح كل شاشات الاكتشاف بلا تحويل', async () => {
    for (const path of ['/home', '/categories', '/categories/home-services', '/services', '/search']) {
      expect(redirectTo(await request(path, 'CUSTOMER')), path).toBeNull();
    }
  });

  it('يفتح شاشات الحساب والرسائل بلا تحويل', async () => {
    for (const path of ['/account', '/account/addresses', '/notifications']) {
      expect(redirectTo(await request(path, 'CUSTOMER')), path).toBeNull();
    }
  });

  it('يُطرد من مساحة المزوّد ومن لوحة الإدارة', async () => {
    expect(redirectTo(await request('/provider/dashboard', 'CUSTOMER'))).toBe('/home');
    expect(redirectTo(await request('/admin/dashboard', 'CUSTOMER'))).toBe('/home');
  });

  it('يُحوَّل بعيدًا عن صفحات الضيوف', async () => {
    expect(redirectTo(await request('/login', 'CUSTOMER'))).toBe('/home');
  });
});

describe('مقدم الخدمة المسجّل', () => {
  /*
   * مقدم الخدمة عميل محتمل أيضًا: تبويب "الرئيسية" في شريط تنقّله يفتح
   * نفس شاشات تصفّح الخدمات التي يستخدمها العميل، فيقدر يطلب خدمة من
   * مقدم خدمة آخر (لم يعد يُطرد منها إلى لوحته كما في السابق).
   */
  it('يتصفّح شاشات الاكتشاف بلا تحويل — مثل العميل تمامًا', async () => {
    for (const path of ['/home', '/categories', '/services', '/search', '/providers/507f1f77bcf86cd799439011']) {
      expect(redirectTo(await request(path, 'PROVIDER')), path).toBeNull();
    }
  });

  it('يفتح مساحته بلا تحويل', async () => {
    expect(redirectTo(await request('/provider/dashboard', 'PROVIDER'))).toBeNull();
    expect(redirectTo(await request('/provider/profile', 'PROVIDER'))).toBeNull();
  });

  it('الصفحات القانونية عامة للجميع', async () => {
    for (const path of ['/terms', '/privacy']) {
      expect(redirectTo(await request(path)), path).toBeNull();
      expect(redirectTo(await request(path, 'PROVIDER')), path).toBeNull();
    }
  });
});

describe('الإدارة', () => {
  it('تفتح لوحة الإدارة بلا تحويل', async () => {
    expect(redirectTo(await request('/admin/dashboard', 'ADMIN'))).toBeNull();
  });
});
