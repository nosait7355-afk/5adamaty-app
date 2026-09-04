'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Grid2x2 } from 'lucide-react';
import { AppHeader } from '@/components/layout/app-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PageContainer } from '@/components/layout/page-container';
import { SectionHeader } from '@/components/ui/card';
import {
  ProviderMiniCardSkeleton,
  ServiceCardSkeleton,
  SkeletonList,
} from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/states';
import { CategoryTile } from '@/components/features/discovery/category-cards';
import { SearchBox } from '@/components/features/discovery/search-box';
import { PromoBanner } from '@/components/features/discovery/promo-banner';
import { ProviderMiniCard } from '@/components/features/discovery/provider-mini-card';
import { ServiceCard } from '@/components/features/discovery/service-card';
import { SupportCta } from '@/components/features/discovery/support-cta';
import { useCategories } from '@/lib/queries/catalog';
import { useProviders, useServices } from '@/lib/queries/discovery';

/**
 * الرئيسية — الصورة 06.
 *
 * الأقسام الخمسة بالترتيب المرسوم: البحث · البانر · شريط التصنيفات المصغّر
 * (6 مربعات آخرها «المزيد») · «مقدمو خدمات مميزون» (carousel) · «خدمات
 * شائعة» · بطاقة الدعم.
 */

const PROMO_SLIDES = [
  {
    title: 'كل خدمات الفيوم في مكان واحد',
    description: 'اطلب سبّاكًا أو كهربائيًا أو طبيبًا من مقدمي خدمات موثّقين.',
    ctaLabel: 'تصفّح التصنيفات',
    href: '/categories',
  },
  {
    title: 'الدفع كاش بعد تنفيذ الخدمة',
    description: 'لا دفع داخل التطبيق — تتفق على السعر وتدفع لمقدم الخدمة مباشرة.',
    ctaLabel: 'اعرف أكثر',
    href: '/help',
  },
];

/** صف واحد من ستة مربعات كما في الصورة 06: خمسة تصنيفات + «المزيد». */
const HOME_TILES = 5;

export default function HomePage() {
  const router = useRouter();
  const [term, setTerm] = useState('');

  const categories = useCategories();
  const featured = useProviders({ sort: 'rating', limit: 8 });
  const popular = useServices({ sort: 'rating', limit: 4 });

  const featuredProviders = featured.data?.pages.flatMap((page) => page.data) ?? [];
  const popularServices = popular.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <>
      <AppHeader />

      <PageContainer className="flex flex-col gap-5 pt-4">
        <SearchBox
          value={term}
          onValueChange={setTerm}
          onSubmit={() => {
            const trimmed = term.trim();
            if (trimmed.length > 0) router.push(`/search?q=${encodeURIComponent(trimmed)}`);
          }}
        />

        <PromoBanner slides={PROMO_SLIDES} />

        {/* ---- شريط التصنيفات المصغّر ---- */}
        <section aria-label="التصنيفات">
          <SectionHeader
            title="التصنيفات"
            action={
              <Link
                href="/categories"
                className="inline-flex items-center gap-1 text-meta font-semibold text-brand-600"
              >
                عرض الكل
                <ChevronLeft size={16} aria-hidden="true" />
              </Link>
            }
            className="mb-3"
          />

          {categories.isPending ? (
            <div className="grid grid-cols-6 gap-1.5">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="aspect-square animate-pulse rounded-field bg-border" />
              ))}
            </div>
          ) : categories.isError ? (
            <ErrorState onRetry={() => void categories.refetch()} />
          ) : (
            <div className="grid grid-cols-6 gap-1.5">
              {categories.data.slice(0, HOME_TILES).map((category) => (
                <CategoryTile
                  key={category.id}
                  href={`/categories/${category.slug}`}
                  label={category.name}
                  icon={category.icon}
                />
              ))}
              <CategoryTile href="/categories" label="المزيد" icon="grid" />
            </div>
          )}
        </section>

        {/* ---- مقدمو خدمات مميزون ---- */}
        <section aria-label="مقدمو خدمات مميزون">
          <SectionHeader
            title="مقدمو خدمات مميزون"
            action={
              <Link
                href="/search?type=providers"
                className="inline-flex items-center gap-1 text-meta font-semibold text-brand-600"
              >
                عرض الكل
                <ChevronLeft size={16} aria-hidden="true" />
              </Link>
            }
            className="mb-3"
          />

          {featured.isPending ? (
            <div className="scroll-x flex gap-3 pb-1">
              {Array.from({ length: 3 }, (_, index) => (
                <ProviderMiniCardSkeleton key={index} />
              ))}
            </div>
          ) : featured.isError ? (
            <ErrorState onRetry={() => void featured.refetch()} />
          ) : featuredProviders.length === 0 ? (
            <EmptyState message="لا يوجد مقدمو خدمات بعد" icon={<Grid2x2 size={40} />} />
          ) : (
            <div className="scroll-x flex gap-3 pb-1">
              {featuredProviders.map((provider) => (
                <ProviderMiniCard key={provider.id} provider={provider} />
              ))}
            </div>
          )}
        </section>

        {/* ---- خدمات شائعة ---- */}
        <section aria-label="خدمات شائعة">
          <SectionHeader
            title="خدمات شائعة"
            action={
              <Link
                href="/services"
                className="inline-flex items-center gap-1 text-meta font-semibold text-brand-600"
              >
                عرض الكل
                <ChevronLeft size={16} aria-hidden="true" />
              </Link>
            }
            className="mb-3"
          />

          {popular.isPending ? (
            <SkeletonList count={2} Item={ServiceCardSkeleton} />
          ) : popular.isError ? (
            <ErrorState onRetry={() => void popular.refetch()} />
          ) : popularServices.length === 0 ? (
            <EmptyState message="لا توجد خدمات متاحة الآن" />
          ) : (
            <div className="flex flex-col gap-3">
              {popularServices.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          )}
        </section>

        <SupportCta />
      </PageContainer>

      <BottomNav />
    </>
  );
}
