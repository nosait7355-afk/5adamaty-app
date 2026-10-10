'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { LinkButton } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import type { BannerTone } from '@/shared/constants/banners';

export interface PromoSlide {
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
  /** رسمة الشريحة (`public/banners/*.svg` أو صورة رفعتها الإدارة) — في نهاية السطر. */
  image?: string;
  /** لون خلفية الشريحة — يميّز الشرائح عن بعضها أثناء التبديل. */
  tone?: BannerTone;
}

export interface PromoBannerProps {
  slides: PromoSlide[];
  className?: string;
}

const TONES: Record<BannerTone, string> = {
  brand: 'bg-brand-50',
  success: 'bg-success-bg',
  warning: 'bg-warning-bg',
  purple: 'bg-purple-bg',
};

/**
 * بانر الرئيسية — الصورة 06.
 *
 * بطاقة بلون الشريحة: النص والزر في بداية السطر، ورسمة الشريحة في نهايته
 * (بدل رسم المدينة الباهت خلف النص، الذي لم يكن يقول شيئًا عن العرض).
 * ارتفاع ثابت للبطاقة كي لا تقفز الصفحة حين تتبدّل شريحتان بطولي نص مختلفين.
 *
 * التبديل التلقائي يتوقف احترامًا لـ`prefers-reduced-motion`: الحركة
 * التلقائية بلا تحكّم مصدر إزعاج لمن ضبط النظام على تقليل الحركة.
 */
export function PromoBanner({ slides, className }: PromoBannerProps) {
  const [index, setIndex] = useState(0);
  const slide = slides[index] ?? slides[0];

  useEffect(() => {
    if (slides.length < 2) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (!slide) return null;

  return (
    <section className={cn('flex flex-col gap-2', className)} aria-label="عروض">
      <div
        className={cn(
          'flex min-h-[9.5rem] items-center gap-2 overflow-hidden rounded-card p-4 transition-colors duration-500',
          TONES[slide.tone ?? 'brand']
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col items-start">
          <h2 className="text-card-title font-extrabold leading-snug text-ink-900">{slide.title}</h2>
          <p className="mt-1 line-clamp-3 text-meta text-ink-600">{slide.description}</p>
          <LinkButton href={slide.href} size="sm" className="mt-3">
            {slide.ctaLabel}
          </LinkButton>
        </div>

        {slide.image && (
          <Image
            // المفتاح يعيد تشغيل حركة الظهور مع كل شريحة
            key={slide.image}
            src={slide.image}
            // زخرفية: العنوان بجوارها يقول ما تقوله
            alt=""
            width={140}
            height={120}
            unoptimized
            priority={index === 0}
            className="max-h-[7.5rem] w-[44%] max-w-[10.5rem] shrink-0 object-contain animate-[banner-in_400ms_ease-out]"
          />
        )}
      </div>

      {slides.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {slides.map((entry, dotIndex) => (
            <button
              key={`${dotIndex}-${entry.title}`}
              type="button"
              onClick={() => setIndex(dotIndex)}
              aria-label={`العرض ${dotIndex + 1}`}
              aria-current={dotIndex === index}
              className={cn(
                'h-1.5 rounded-pill transition-all',
                dotIndex === index ? 'w-5 bg-brand-600' : 'w-1.5 bg-ink-300'
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** بنفس ارتفاع البانر كي لا تقفز الصفحة حين تصل البيانات. */
export function PromoBannerSkeleton() {
  return <Skeleton className="h-[9.5rem] w-full rounded-card" />;
}
