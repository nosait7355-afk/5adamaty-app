'use client';

import { SocialLogin } from '@capgo/capacitor-social-login';

/**
 * تهيئة مشتركة لـ`@capgo/capacitor-social-login` — نفس الـwebClientId
 * لكل استخدامات جوجل في التطبيق (زر الدخول/التسجيل، وتعبئة بيانات مقدم
 * الخدمة التلقائية). `initialize` آمن الاستدعاء أكثر من مرة، لكن نحصر
 * الطلب الفعلي في Promise واحد مشترك بدل تكراره من كل مكوّن.
 */
let initPromise: Promise<void> | null = null;

export function ensureGoogleInitialized(): Promise<void> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) return Promise.resolve();

  initPromise ??= SocialLogin.initialize({ google: { webClientId: clientId } });
  return initPromise;
}

export interface GoogleProfile {
  idToken: string;
  fullName: string | null;
  email: string | null;
}

/** يفتح نافذة/منتقي حساب جوجل ويعيد بيانات الملف الشخصي الأساسية + idToken. */
export async function signInWithGoogle(): Promise<GoogleProfile> {
  await ensureGoogleInitialized();

  let result;
  try {
    ({ result } = await SocialLogin.login({
      provider: 'google',
      options: { scopes: ['email', 'profile'] },
    }));
  } catch (nativeError) {
    /*
     * على أندرويد يأتي الفشل من Credential Manager قبل أي طلب للسيرفر،
     * فرسالته الأصلية هي الدليل الوحيد على السبب (بصمة SHA-1 غير مسجّلة في
     * عميل OAuth الأندرويد، لا حساب جوجل على الجهاز، إلغاء المستخدم…).
     * نمرّرها كما هي بدل إخفائها خلف «حدث خطأ غير متوقع».
     */
    const detail = nativeError instanceof Error ? nativeError.message : String(nativeError);
    throw new Error(`تعذّر تسجيل الدخول بجوجل: ${detail || 'لم يرجع جوجل أي تفصيل.'}`);
  }

  if (!('idToken' in result) || !result.idToken) {
    throw new Error('لم يصل رمز تعريف من جوجل.');
  }

  const profile = 'profile' in result ? result.profile : null;

  return {
    idToken: result.idToken,
    fullName: profile?.name ?? null,
    email: profile?.email ?? null,
  };
}
