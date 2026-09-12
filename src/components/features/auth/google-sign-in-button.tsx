'use client';

import { useEffect, useState } from 'react';
import { Chrome } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ensureGoogleInitialized, signInWithGoogle } from '@/lib/google-social-login';
import { extractErrorMessage, useGoogleAuth } from '@/lib/queries/auth';
import type { AuthUserDto } from '@/server/services/auth.service';

/**
 * زر «المتابعة عبر جوجل» — ويب وأندرويد بنفس الكود.
 *
 * `@capgo/capacitor-social-login` يوجّه تلقائيًا: نافذة OAuth منبثقة على
 * الويب، أو Credential Manager الأصلي داخل تطبيق أندرويد — حسب البيئة التي
 * يعمل بها Capacitor، بلا أي تفريع يدوي هنا. النتيجة في الحالتين `idToken`
 * يتحقق منه السيرفر عبر `/api/v1/auth/google` (نفس المسار لكلا المنصّتين).
 */

export interface GoogleSignInButtonProps {
  onSuccess: (user: AuthUserDto) => void;
  /**
   * 'register': يجوز إنشاء حساب عميل جديد (`/register`).
   * 'login': يدخل لحساب موجود فقط، لا يُنشئ أبدًا (`/login`) — يمنع تحوّل
   * زائر بلا حساب لعميل جديد بالخطأ من صفحة الدخول.
   */
  intent: 'login' | 'register';
}

export function GoogleSignInButton({ onSuccess, intent }: GoogleSignInButtonProps) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const googleAuth = useGoogleAuth();

  useEffect(() => {
    void ensureGoogleInitialized();
  }, []);

  if (!clientId) return null;

  const signIn = async () => {
    setError('');
    setPending(true);
    try {
      const { idToken } = await signInWithGoogle();
      const user = await googleAuth.mutateAsync({ idToken, intent });
      onSuccess(user);
    } catch (signInError) {
      setError(extractErrorMessage(signInError));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        fullWidth
        loading={pending}
        onClick={() => void signIn()}
        iconStart={<Chrome size={20} />}
      >
        {intent === 'register' ? 'إنشاء حساب عبر جوجل' : 'تسجيل الدخول عبر جوجل'}
      </Button>
      {error && (
        <p className="text-badge text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
