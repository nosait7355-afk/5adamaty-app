'use client';

import { useEffect, useState } from 'react';
import { CitySkyline } from '@/components/features/auth/city-skyline';
import { LinkButton } from '@/components/ui/button';
import { cn } from '@/lib/cn';

export interface PromoSlide {
  title: string;
  description: string;
  ctaLabel: string;
  href: string;
}

export interface PromoBannerProps {
  slides: PromoSlide[];
  className?: string;
}

/**
 * بانر الرئيسية — الصورة 06.
 *
 * بطاقة `--brand-50` radius 16، النص في بداية السطر ورسم المدينة في نهايته،
 * زر صغير أسفل النص، ونقاط carousel تحت البطاقة.
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
      <div className="relative overflow-hidden rounded-card bg-brand-50 p-4">
        <div className="relative z-10 max-w-[62%]">
          <h2 className="text-card-title font-extrabold text-ink-900">{slide.title}</h2>
          <p className="mt-1 text-meta text-ink-600">{slide.description}</p>
          <LinkButton href={slide.href} size="sm" className="mt-3">
            {slide.ctaLabel}
          </LinkButton>
        </div>

        <CitySkyline className="pointer-events-none absolute -bottom-2 start-auto end-0 z-0 w-[46%] opacity-80" />
      </div>

      {slides.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {slides.map((entry, dotIndex) => (
            <button
              key={entry.title}
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
