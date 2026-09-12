'use client';

import { useEffect, useState } from 'react';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { Chrome } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

let initPromise: Promise<void> | null = null;

function ensureInitialized(): Promise<void> {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) return Promise.resolve();

  initPromise ??= SocialLogin.initialize({ google: { webClientId: clientId } });
  return initPromise;
}

export interface GoogleSignInButtonProps {
  onSuccess: (user: AuthUserDto) => void;
}

export function GoogleSignInButton({ onSuccess }: GoogleSignInButtonProps) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const googleAuth = useGoogleAuth();

  useEffect(() => {
    void ensureInitialized();
  }, []);

  if (!clientId) return null;

  const signIn = async () => {
    setError('');
    setPending(true);
    try {
      await ensureInitialized();
      const { result } = await SocialLogin.login({
        provider: 'google',
        options: { scopes: ['email', 'profile'] },
      });
      const idToken = 'idToken' in result ? result.idToken : null;
      if (!idToken) throw new Error('لم يصل رمز تعريف من جوجل.');

      const user = await googleAuth.mutateAsync({ idToken });
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
        المتابعة عبر جوجل
      </Button>
      {error && (
        <p className="text-badge text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
