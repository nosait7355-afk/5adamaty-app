'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { BackHeader } from '@/components/layout/back-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PageContainer } from '@/components/layout/page-container';
import { Chip } from '@/components/ui/badge';
import { ServiceCardSkeleton, Skeleton, SkeletonList } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/states';
import { ProviderMiniCard } from '@/components/features/discovery/provider-mini-card';
import { SearchBox } from '@/components/features/discovery/search-box';
import { ServiceCard } from '@/components/features/discovery/service-card';
import { SectionHeader } from '@/components/ui/card';
import { formatNumber } from '@/lib/format';
import { MIN_SEARCH_LENGTH, useSearch } from '@/lib/queries/discovery';

/**
 * شاشة البحث — مشتقّة من حقل البحث في الصور 06–09 (`UI_ANALYSIS §0.1`).
 *
 * لا تصميم جديد: نفس بطاقات الخدمة والمزوّد المستخدمة في الشاشات الأصلية.
 * الطلب مؤجَّل بـdebounce ولا يُرسل قبل حرفين — مطابقًا لقاعدة الخادم.
 */
export default function SearchPage() {
  return (
    <Suspense fallback={<SearchFallback />}>
      <SearchScreen />
    </Suspense>
  );
}

type SearchTab = 'all' | 'services' | 'providers';

function SearchScreen() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('type') as SearchTab | null) ?? 'all';

  const [term, setTerm] = useState(searchParams.get('q') ?? '');
  const [tab, setTab] = useState<SearchTab>(
    ['all', 'services', 'providers'].includes(initialTab) ? initialTab : 'all'
  );

  const query = useSearch(term, tab);
  const result = query.data;

  return (
    <>
      <BackHeader />

      <PageContainer className="flex flex-col gap-4 pt-4">
        <SearchBox
          value={term}
          onValueChange={setTerm}
          autoFocus
          placeholder="ابحث عن خدمة أو مقدم خدمة…"
        />

        <div className="scroll-x flex gap-2">
          <Chip selected={tab === 'all'} onClick={() => setTab('all')}>
            الكل
          </Chip>
          <Chip selected={tab === 'services'} onClick={() => setTab('services')}>
            الخدمات
          </Chip>
          <Chip selected={tab === 'providers'} onClick={() => setTab('providers')}>
            مقدمو الخدمات
          </Chip>
        </div>

        {!query.enabled ? (
          <EmptyState
            icon={<Search size={44} strokeWidth={1.5} />}
            message="ابحث عن خدمة أو مقدم خدمة"
            description={`اكتب ${MIN_SEARCH_LENGTH} أحرف على الأقل لعرض النتائج.`}
          />
        ) : query.isPending ? (
          <SkeletonList count={3} Item={ServiceCardSkeleton} />
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : !result || (result.services.length === 0 && result.providers.length === 0) ? (
          <EmptyState
            message="لا توجد نتائج"
            description={`لم نجد ما يطابق «${query.term}». جرّب كلمة أخرى.`}
          />
        ) : (
          <>
            {result.providers.length > 0 && (
              <section aria-label="مقدمو الخدمات">
                <SectionHeader
                  title="مقدمو الخدمات"
                  action={
                    <span className="num text-meta text-ink-400">
                      {formatNumber(result.totals.providers)}
                    </span>
                  }
                  className="mb-3"
                />
                <div className="scroll-x flex gap-3 pb-1">
                  {result.providers.map((provider) => (
                    <ProviderMiniCard key={provider.id} provider={provider} />
                  ))}
                </div>
              </section>
            )}

            {result.services.length > 0 && (
              <section aria-label="الخدمات">
                <SectionHeader
                  title="الخدمات"
                  action={
                    <span className="num text-meta text-ink-400">
                      {formatNumber(result.totals.services)}
                    </span>
                  }
                  className="mb-3"
                />
                <div className="flex flex-col gap-3">
                  {result.services.map((service) => (
                    <ServiceCard key={service.id} service={service} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </PageContainer>

      <BottomNav />
    </>
  );
}

function SearchFallback() {
  return (
    <>
      <BackHeader />
      <PageContainer className="flex flex-col gap-4 pt-4">
        <Skeleton className="h-control w-full rounded-field" />
        <Skeleton className="h-10 w-2/3 rounded-pill" />
        <SkeletonList count={3} Item={ServiceCardSkeleton} />
      </PageContainer>
      <BottomNav />
    </>
  );
}
