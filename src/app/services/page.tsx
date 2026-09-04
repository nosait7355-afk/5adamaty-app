'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BackHeader } from '@/components/layout/back-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PageContainer } from '@/components/layout/page-container';
import { LinkButton } from '@/components/ui/button';
import { ServiceCardSkeleton, Skeleton, SkeletonList } from '@/components/ui/skeleton';
import { CatalogIcon } from '@/components/common/catalog-icon';
import { EmptyState, ErrorState } from '@/components/common/states';
import { FilterBar } from '@/components/features/discovery/filter-bar';
import { InfiniteSentinel } from '@/components/features/discovery/infinite-list';
import { SearchBox } from '@/components/features/discovery/search-box';
import { ServiceCard } from '@/components/features/discovery/service-card';
import { useCategories, useProfessions } from '@/lib/queries/catalog';
import { useServices, type DiscoveryFilterState } from '@/lib/queries/discovery';
import { pluralizeAr } from '@/lib/format';

/**
 * الخدمات داخل التصنيف — الصورة 09.
 *
 * أيقونة التصنيف بجانب عنوانه · بحث داخلي · FilterBar · قائمة `ServiceCard`
 * · تمرير لا نهائي · Skeletons بنفس أبعاد البطاقة الحقيقية.
 */
export default function ServicesPage() {
  return (
    <Suspense fallback={<ServicesFallback />}>
      <ServicesScreen />
    </Suspense>
  );
}

function ServicesScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const categorySlug = searchParams.get('categorySlug') ?? undefined;
  const professionSlug = searchParams.get('professionSlug') ?? undefined;

  const [term, setTerm] = useState('');
  const [filters, setFilters] = useState<DiscoveryFilterState>({ sort: 'rating' });

  const categories = useCategories();
  const category = categories.data?.find((entry) => entry.slug === categorySlug);
  const professions = useProfessions(category?.id);
  const profession = professions.data?.find((entry) => entry.slug === professionSlug);

  const effectiveFilters = useMemo<DiscoveryFilterState>(
    () => ({
      ...filters,
      ...(categorySlug ? { categorySlug } : {}),
      ...(professionSlug ? { professionSlug } : {}),
      limit: 10,
    }),
    [filters, categorySlug, professionSlug]
  );

  const services = useServices(effectiveFilters);
  const items = services.data?.pages.flatMap((page) => page.data) ?? [];
  const total = services.data?.pages[0]?.meta?.total ?? 0;

  const loadMore = useCallback(() => {
    if (services.hasNextPage && !services.isFetchingNextPage) void services.fetchNextPage();
  }, [services]);

  const title = profession?.name ?? category?.name ?? 'كل الخدمات';
  const icon = profession?.icon ?? category?.icon;

  return (
    <>
      <BackHeader />

      <PageContainer className="flex flex-col gap-4 pt-4">
        <header className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <CatalogIcon name={icon} size={24} />
          </span>
          <div className="min-w-0">
            <h1 className="text-section font-extrabold text-ink-900">{title}</h1>
            {!services.isPending && (
              <p className="num text-meta text-ink-400">
                {pluralizeAr(total, 'خدمة متاحة', 'خدمتان متاحتان', 'خدمات متاحة')}
              </p>
            )}
          </div>
        </header>

        <SearchBox
          value={term}
          onValueChange={setTerm}
          onSubmit={() => {
            const trimmed = term.trim();
            if (trimmed.length > 0) router.push(`/search?q=${encodeURIComponent(trimmed)}`);
          }}
          placeholder="ابحث في الخدمات…"
        />

        <FilterBar value={filters} onChange={setFilters} />

        {services.isPending ? (
          <SkeletonList count={3} Item={ServiceCardSkeleton} />
        ) : services.isError ? (
          <ErrorState onRetry={() => void services.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            message="لا توجد خدمات مطابقة"
            description="جرّب توسيع نطاق الفلاتر أو اختيار منطقة أخرى."
            action={
              <LinkButton href="/categories" size="sm" variant="secondary">
                تصفّح التصنيفات
              </LinkButton>
            }
          />
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {items.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>

            <InfiniteSentinel
              hasNextPage={services.hasNextPage}
              isFetchingNextPage={services.isFetchingNextPage}
              onLoadMore={loadMore}
            />
          </>
        )}
      </PageContainer>

      <BottomNav />
    </>
  );
}

/** نفس هيكل الشاشة أثناء قراءة معاملات الرابط — يمنع أي قفزة تخطيط. */
function ServicesFallback() {
  return (
    <>
      <BackHeader />
      <PageContainer className="flex flex-col gap-4 pt-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-full" />
          <Skeleton className="h-7 w-40" />
        </div>
        <Skeleton className="h-control w-full rounded-field" />
        <Skeleton className="h-10 w-full rounded-pill" />
        <SkeletonList count={3} Item={ServiceCardSkeleton} />
      </PageContainer>
      <BottomNav />
    </>
  );
}
