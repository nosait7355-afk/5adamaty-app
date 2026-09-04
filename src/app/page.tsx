'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BrandIcon } from '@/components/layout/brand-icon';
import { Spinner } from '@/components/ui/spinner';
import { BrandWave, CitySkyline } from '@/components/features/auth/city-skyline';
import { resolveHomeRoute, useMe } from '@/lib/queries/auth';

/**
 * شاشة البداية — الصورة 01.
 *
 * موجة زرقاء علوية وأخرى سفلية أكبر · اللوجو والاسم والشعار بين خطين ·
 * رسم معالم الفيوم · Spinner + «جاري التحميل…».
 *
 * المنطق: تفحص الجلسة ثم توجّه حسب الدور والحالة:
 *   مسجّل عميل   → /home
 *   مزوّد معتمد   → /provider/dashboard
 *   مزوّد قيد المراجعة → /provider/pending-review
 *   غير مسجّل     → /role-select
 */
export default function SplashPage() {
  const router = useRouter();
  const { data: user, isPending, isError } = useMe();

  useEffect(() => {
    if (isPending) return;
    // فشل الشبكة يوجّه لاختيار نوع الحساب بدل تعليق المستخدم على الشاشة
    router.replace(isError ? '/role-select' : resolveHomeRoute(user ?? null));
  }, [isPending, isError, user, router]);

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-bg">
      <BrandWave position="top" className="absolute inset-x-0 top-0 h-24" />

      <div className="relative z-10 flex flex-col items-center px-page">
        {/* الأيقونة وحدها — الاسم يُرسم نصًا أسفلها بحجم التصميم */}
        <BrandIcon size={156} priority />

        <h1 className="mt-2 text-[2.125rem] font-extrabold leading-tight text-brand-600">
          خدماتي الفيوم
        </h1>

        <div className="mt-2 flex items-center gap-3">
          <span className="h-px w-10 bg-brand-500" aria-hidden="true" />
          <span className="text-body text-ink-600">كل الخدمات في مكان واحد</span>
          <span className="h-px w-10 bg-brand-500" aria-hidden="true" />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-28 z-0 select-none opacity-60">
        <CitySkyline />
      </div>

      <div
        className="absolute inset-x-0 bottom-32 z-10 flex flex-col items-center gap-2"
        role="status"
        aria-live="polite"
      >
        <Spinner size={30} className="text-brand-600" />
        <span className="text-meta text-brand-600">جاري التحميل…</span>
      </div>

      <BrandWave className="absolute inset-x-0 bottom-0 h-28" />
    </main>
  );
}
