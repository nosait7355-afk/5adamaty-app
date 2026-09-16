'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/common/states';
import { Skeleton } from '@/components/ui/skeleton';
import { CatalogIcon } from '@/components/common/catalog-icon';
import { Rating } from './rating-stars';
import { useServices } from '@/lib/queries/discovery';

export interface PopularServicesProps {
  limit?: number;
}

/**
 * «🔥 أكثر الخدمات طلبًا» — القائمة المرقّمة 1–4 في الصورة 07.
 *
 * الترقيم جزء من التصميم لا زينة: هو ما يميّز هذا القسم عن قائمة الخدمات
 * العادية، ولذلك يُعرض كـ`<ol>` لا `<ul>`.
 */
export function PopularServices({ limit = 4 }: PopularServicesProps) {
  const query = useServices({ sort: 'rating', limit });
  const services = query.data?.pages.flatMap((page) => page.data) ?? [];

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-2" role="status" aria-label="جاري التحميل">
        {Array.from({ length: limit }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-card" />
        ))}
      </div>
    );
  }

  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  if (services.length === 0) return <EmptyState message="لا توجد خدمات متاحة الآن" compact />;

  return (
    <ol className="flex flex-col gap-2">
      {services.map((service, index) => (
        <li key={service.id}>
          <Link
            href={`/providers/${service.provider.id}?serviceId=${service.id}`}
            className="flex items-center gap-3 rounded-card border border-border bg-surface p-3 shadow-card transition-shadow hover:shadow-card-hover"
          >
            <span className="num flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-label font-extrabold text-brand-600">
              {index + 1}
            </span>

            <span className="flex size-10 shrink-0 items-center justify-center rounded-field bg-bg text-brand-600">
              <CatalogIcon name={service.professionIcon} size={20} />
            </span>

            <span className="flex min-w-0 flex-1 flex-col">
              <span className="line-clamp-1 text-label font-bold text-ink-900">{service.title}</span>
              <span className="flex items-center gap-2">
                <Rating value={service.ratingAvg} count={service.ratingCount} />
              </span>
            </span>

            <ChevronLeft size={18} className="shrink-0 text-ink-300" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ol>
  );
}
