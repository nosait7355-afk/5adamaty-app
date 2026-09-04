'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/common/states';

/**
 * حدود الخطأ على مستوى التطبيق.
 * لا تعرض تفاصيل تقنية للمستخدم — الرسالة عربية عامة وزر إعادة محاولة.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // في الإنتاج يُرسل لخدمة تتبّع الأخطاء (Phase 10)
    console.error('[app-error]', error.digest ?? error.message);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center p-page">
      <ErrorState
        message="حدث خطأ غير متوقع"
        description="نعتذر عن ذلك. برجاء المحاولة مرة أخرى."
        onRetry={reset}
        className="max-w-[420px]"
      />
    </main>
  );
}
