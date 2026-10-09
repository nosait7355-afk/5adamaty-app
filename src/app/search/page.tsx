'use client';

import { Suspense, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, Clock, Search, TrendingUp, X } from 'lucide-react';
import { PageContainer } from '@/components/layout/page-container';
import { Chip } from '@/components/ui/badge';
import { ServiceCardSkeleton, Skeleton, SkeletonList } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/states';
import { CatalogIcon } from '@/components/common/catalog-icon';
import { ProviderMiniCard } from '@/components/features/discovery/provider-mini-card';
import { ServiceCard } from '@/components/features/discovery/service-card';
import { SectionHeader } from '@/components/ui/card';
import { formatNumber, formatServicesCount } from '@/lib/format';
import { useSafeBack } from '@/lib/navigation-history';
import { useCategories, useProfessions } from '@/lib/queries/catalog';
import { MIN_SEARCH_LENGTH, useSearch } from '@/lib/queries/discovery';
import { addRecentSearch, clearRecentSearches, useRecentSearches } from '@/lib/recent-searches';
import { NAV_FORWARD } from '@/lib/view-transitions';
import { findArabic, includesArabic } from '@/shared/arabic';
import type { ProfessionDto } from '@/server/services/catalog.service';

/**
 * شاشة البحث الكاملة — المرحلة 4.
 *
 * حقل البحث في الترويسة نفسها مع «إلغاء» (نمط iOS)، ولوحة المفاتيح تظهر
 * فورًا. قبل الكتابة: عمليات البحث السابقة والتخصصات الأكثر طلبًا — يصل
 * المستخدم بلمسة دون أن يكتب. أثناء الكتابة: التخصصات المطابقة أولًا (من
 * الكتالوج المحمَّل مسبقًا، فورية بلا طلب)، ثم نتائج الخادم بعد حرفين.
 *
 * بلا شريط تنقّل سفلي: الشاشة مهمة واحدة ولوحة المفاتيح تغطيه أصلًا.
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
  const safeBack = useSafeBack();

  const [term, setTerm] = useState(searchParams.get('q') ?? '');
  const [tab, setTab] = useState<SearchTab>(
    ['all', 'services', 'providers'].includes(initialTab) ? initialTab : 'all'
  );
  const recents = useRecentSearches();

  const query = useSearch(term, tab);
  const result = query.data;

  const categories = useCategories();
  const professions = useProfessions();

  const categorySlugById = useMemo(
    () => new Map((categories.data ?? []).map((category) => [category.id, category.slug])),
    [categories.data]
  );

  const trimmed = term.trim();

  /** التخصصات المطابقة لما يُكتب — من الكتالوج المحمَّل، فلا انتظار. */
  const suggestions = useMemo(
    () =>
      trimmed
        ? // «سبا» تجد «سبّاك» و«اطسا» تجد «إطسا» — التشكيل والهمزات لا تمنع المطابقة
          (professions.data ?? []).filter((item) => includesArabic(item.name, trimmed)).slice(0, 4)
        : [],
    [professions.data, trimmed]
  );

  /** الأكثر طلبًا = التخصصات صاحبة أكبر عدد من الخدمات المعروضة. */
  const trending = useMemo(
    () =>
      [...(professions.data ?? [])]
        .filter((item) => item.servicesCount > 0)
        .sort((a, b) => b.servicesCount - a.servicesCount)
        .slice(0, 6),
    [professions.data]
  );

  const professionHref = (profession: ProfessionDto) => {
    const slug = categorySlugById.get(profession.categoryId);
    return slug
      ? `/services?categorySlug=${slug}&professionSlug=${profession.slug}`
      : `/search?q=${encodeURIComponent(profession.name)}`;
  };

  const remember = addRecentSearch;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (trimmed) remember(trimmed);
    // يُغلق لوحة المفاتيح لتظهر النتائج كاملة
    (document.activeElement as HTMLElement | null)?.blur();
  };

  return (
    <>
      {/* ---- الترويسة: الحقل نفسه + إلغاء ---- */}
      <header
        style={{ viewTransitionName: 'app-header' }}
        className="sticky top-0 z-30 border-b border-border bg-surface/95 pt-safe backdrop-blur-md"
      >
        <div className="mx-auto flex max-w-[520px] items-center gap-2 py-2 pe-1 ps-page">
          <form role="search" onSubmit={submit} className="min-w-0 flex-1">
            <div className="flex h-11 items-center gap-2 rounded-pill bg-bg px-4 ring-1 ring-border focus-within:ring-2 focus-within:ring-brand-600">
              <Search size={18} className="shrink-0 text-ink-400" aria-hidden="true" />
              <input
                type="search"
                enterKeyHint="search"
                autoFocus
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="خدمة، تخصص، أو اسم مقدم خدمة"
                aria-label="بحث"
                className="min-w-0 flex-1 bg-transparent text-body text-ink-900 outline-none placeholder:text-ink-400 [&::-webkit-search-cancel-button]:hidden"
              />
              {term && (
                <button
                  type="button"
                  onClick={() => setTerm('')}
                  aria-label="مسح البحث"
                  className="pressable -me-1 shrink-0 rounded-full p-1 text-ink-400"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </form>
          <button
            type="button"
            onClick={safeBack}
            className="pressable shrink-0 rounded-field px-3 py-2 text-label font-bold text-brand-600"
          >
            إلغاء
          </button>
        </div>
      </header>

      <PageContainer withBottomNav={false} className="flex flex-col gap-5 pb-10 pt-4">
        {!trimmed ? (
          /* ---- قبل الكتابة ---- */
          <>
            {recents.length > 0 && (
              <section aria-label="عمليات بحث سابقة">
                <SectionHeader
                  title="عمليات بحث سابقة"
                  action={
                    <button
                      type="button"
                      onClick={clearRecentSearches}
                      className="pressable text-meta font-semibold text-ink-400"
                    >
                      مسح
                    </button>
                  }
                  className="mb-3"
                />
                <div className="flex flex-wrap gap-2">
                  {recents.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setTerm(item)}
                      className="pressable inline-flex items-center gap-1.5 rounded-pill bg-bg px-3.5 py-2 text-label font-semibold text-ink-700 ring-1 ring-border"
                    >
                      <Clock size={15} className="text-ink-400" aria-hidden="true" />
                      {item}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section aria-label="الأكثر طلبًا في الفيوم">
              <SectionHeader title="الأكثر طلبًا في الفيوم" className="mb-3" />
              {professions.isPending ? (
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 6 }, (_, index) => (
                    <Skeleton key={index} className="h-9 w-24 rounded-pill" />
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {trending.map((profession) => (
                    <Link
                      key={profession.id}
                      href={professionHref(profession)}
                      transitionTypes={NAV_FORWARD}
                      onClick={() => remember(profession.name)}
                      className="pressable inline-flex items-center gap-1.5 rounded-pill bg-brand-50 px-3.5 py-2 text-label font-semibold text-brand-700"
                    >
                      <TrendingUp size={15} aria-hidden="true" />
                      {profession.name}
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          /* ---- أثناء الكتابة ---- */
          <>
            {suggestions.length > 0 && (
              <ul aria-label="تخصصات مطابقة" className="-mt-1 flex flex-col">
                {suggestions.map((profession) => (
                  <li key={profession.id}>
                    <Link
                      href={professionHref(profession)}
                      transitionTypes={NAV_FORWARD}
                      onClick={() => remember(trimmed)}
                      className="pressable flex items-center gap-3 border-b border-border py-3"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-field bg-brand-50 text-brand-600">
                        <CatalogIcon name={profession.icon} size={20} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-body font-semibold text-ink-900">
                          <Highlight text={profession.name} match={trimmed} />
                        </span>
                        <span className="block text-meta text-ink-400">
                          {profession.servicesCount > 0
                            ? `تخصص · ${formatServicesCount(profession.servicesCount)}`
                            : 'تخصص'}
                        </span>
                      </span>
                      <ChevronLeft size={18} className="text-ink-300" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}

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

            {/* لمس أي نتيجة يحفظ البحث في «السابقة» */}
            <div
              className="flex flex-col gap-5"
              onClickCapture={(event) => {
                if ((event.target as Element).closest('a')) remember(trimmed);
              }}
            >
              {!query.enabled ? (
                <p className="text-center text-meta text-ink-400">
                  اكتب {MIN_SEARCH_LENGTH} أحرف على الأقل لعرض الخدمات ومقدميها.
                </p>
              ) : query.isPending ? (
                <SkeletonList count={3} Item={ServiceCardSkeleton} />
              ) : query.isError ? (
                <ErrorState onRetry={() => void query.refetch()} />
              ) : !result || (result.services.length === 0 && result.providers.length === 0) ? (
                <EmptyState
                  icon={<Search size={44} strokeWidth={1.5} />}
                  message="لا توجد نتائج"
                  description={`لم نجد ما يطابق «${query.term}». جرّب كلمة أخرى أو تصفّح التصنيفات.`}
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
                      <div className="scroll-x snap-row -mx-page flex scroll-px-page gap-3 px-page pb-1">
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
            </div>
          </>
        )}
      </PageContainer>
    </>
  );
}

/** يبرز الجزء المطابق مما كتبه المستخدم — يرى لماذا ظهر الاقتراح. */
function Highlight({ text, match }: { text: string; match: string }) {
  const range = findArabic(text, match);
  if (!range) return <>{text}</>;
  return (
    <>
      {text.slice(0, range.start)}
      <mark className="bg-transparent font-extrabold text-brand-600">
        {text.slice(range.start, range.end)}
      </mark>
      {text.slice(range.end)}
    </>
  );
}

function SearchFallback() {
  return (
    <>
      <div className="sticky top-0 z-30 border-b border-border bg-surface pt-safe">
        <div className="mx-auto flex max-w-[520px] items-center gap-2 px-page py-2">
          <Skeleton className="h-11 flex-1 rounded-pill" />
          <Skeleton className="h-6 w-12" />
        </div>
      </div>
      <PageContainer withBottomNav={false} className="flex flex-col gap-4 pt-4">
        <Skeleton className="h-6 w-40" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-9 w-24 rounded-pill" />
          ))}
        </div>
      </PageContainer>
    </>
  );
}
