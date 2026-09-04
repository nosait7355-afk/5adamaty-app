'use client';

import { useEffect, useRef } from 'react';
import { Spinner } from '@/components/ui/spinner';

export interface InfiniteSentinelProps {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}

/**
 * حارس التمرير اللانهائي — الصورة 09.
 *
 * `IntersectionObserver` بدل مستمع `scroll`: لا يعمل إلا عند اقتراب الحارس
 * من الشاشة، فلا يطلق مئات الاستدعاءات أثناء التمرير.
 *
 * يبقى زر «تحميل المزيد» ظاهرًا كبديل: بعض المتصفحات القديمة بلا
 * `IntersectionObserver`، ومستخدم لوحة المفاتيح يحتاج هدفًا قابلًا للتركيز.
 */
export function InfiniteSentinel({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: InfiniteSentinelProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !hasNextPage || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
      },
      { rootMargin: '240px' }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [hasNextPage, onLoadMore]);

  if (!hasNextPage) return null;

  return (
    <div ref={ref} className="flex justify-center py-4">
      {isFetchingNextPage ? (
        <span className="flex items-center gap-2 text-meta text-ink-400" role="status">
          <Spinner size={18} />
          جاري تحميل المزيد…
        </span>
      ) : (
        <button
          type="button"
          onClick={onLoadMore}
          className="rounded-pill border border-border bg-surface px-5 py-2 text-label font-semibold text-brand-600 transition-colors hover:bg-brand-50"
        >
          تحميل المزيد
        </button>
      )}
    </div>
  );
}
