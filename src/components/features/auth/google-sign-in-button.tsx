'use client';

import Script from 'next/script';
import { useEffect, useId, useRef, useState } from 'react';
import { extractErrorMessage, useGoogleAuth } from '@/lib/queries/auth';
import type { AuthUserDto } from '@/server/services/auth.service';

/**
 * زر «الدخول عبر جوجل» — Google Identity Services (GSI).
 *
 * يعرض واجهة Google الرسمية داخل `<div id>` بدل زر مخصّص: زر مرسوم يدويًا
 * يخالف شروط استخدام جوجل، والـGSI هو من يرسم الزر ويستدعي `callback`
 * بـ`idToken` جاهز للتحقّق في السيرفر (`/api/v1/auth/google`).
 */

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

export interface GoogleSignInButtonProps {
  onSuccess: (user: AuthUserDto) => void;
}

export function GoogleSignInButton({ onSuccess }: GoogleSignInButtonProps) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const containerId = useId().replace(/:/g, '');
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [error, setError] = useState('');
  const googleAuth = useGoogleAuth();

  useEffect(() => {
    if (!scriptReady || !clientId || !containerRef.current || !window.google) return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        setError('');
        googleAuth.mutate(
          { idToken: response.credential },
          {
            onSuccess,
            onError: (mutationError) => setError(extractErrorMessage(mutationError)),
          }
        );
      },
    });

    window.google.accounts.id.renderButton(containerRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      width: 320,
      text: 'continue_with',
      locale: 'ar',
    });
    // `googleAuth`/`onSuccess` تتغيّر كل تصيير — التهيئة تعتمد فقط على جاهزية السكربت والـclientId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptReady, clientId]);

  if (!clientId) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />
      <div id={containerId} ref={containerRef} className="flex justify-center" />
      {error && (
        <p className="text-badge text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
