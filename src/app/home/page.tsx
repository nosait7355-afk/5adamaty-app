'use client';

import Link from 'next/link';
import { ChevronLeft, Grid2x2 } from 'lucide-react';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PageContainer } from '@/components/layout/page-container';
import { SectionHeader } from '@/components/ui/card';
import {
  ProviderMiniCardSkeleton,
  ServiceCardSkeleton,
  SkeletonList,
} from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/states';
import { CategoryRail, CategoryRailSkeleton } from '@/components/features/discovery/category-rail';
import { HomeHeader } from '@/components/features/discovery/home-header';
import { PromoBanner, type PromoSlide } from '@/components/features/discovery/promo-banner';
import { ProviderMiniCard } from '@/components/features/discovery/provider-mini-card';
import { SearchLauncher } from '@/components/features/discovery/search-launcher';
import { ServiceCard } from '@/components/features/discovery/service-card';
import { SupportCta } from '@/components/features/discovery/support-cta';
import { useCategories } from '@/lib/queries/catalog';
import { useProviders, useServices } from '@/lib/queries/discovery';
import { useDiscoveryNav } from '@/lib/queries/auth';

/**
 * الرئيسية — الصورة 06، بإعادة تصميم المرحلة 4:
 *
 * تحية باسم المستخدم · زر بحث يفتح شاشة البحث الكاملة · شريط تصنيفات
 * دائري يتمرّر أفقيًا · البانر · «الأعلى تقييمًا» (carousel) · «خدمات
 * شائعة» · بطاقة الدعم.
 */

const PROMO_SLIDES = [
  {
    title: 'كل خدمات الفيوم في مكان واحد',
    description: 'اعثر على سبّاك أو كهربائي أو طبيب وتواصل معه مباشرة بالهاتف أو واتساب.',
    ctaLabel: 'تصفّح التصنيفات',
    href: '/categories',
    image: '/banners/all-services.svg',
    tone: 'brand',
  },
  {
    title: 'التواصل والدفع مباشر',
    description: 'نحن وسيط إعلانات فقط — تتفق على السعر وتدفع لمقدم الخدمة مباشرة.',
    ctaLabel: 'اعرف أكثر',
    href: '/help',
    image: '/banners/direct-contact.svg',
    tone: 'success',
  },
] satisfies PromoSlide[];

export default function HomePage() {
  const nav = useDiscoveryNav();

  const categories = useCategories();
  const featured = useProviders({ sort: 'rating', limit: 8 });
  const popular = useServices({ sort: 'rating', limit: 4 });

  const featuredProviders = featured.data?.pages.flatMap((page) => page.data) ?? [];
  const popularServices = popular.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <>
      <HomeHeader notificationsHref={nav.notificationsHref} />

      <PageContainer className="flex flex-col gap-6 pt-4">
        <SearchLauncher />

        {/* ---- التصنيفات ---- */}
        <section aria-label="التصنيفات">
          {categories.isPending ? (
            <CategoryRailSkeleton />
          ) : categories.isError ? (
            <ErrorState onRetry={() => void categories.refetch()} />
          ) : (
            <CategoryRail categories={categories.data} />
          )}
        </section>

        <PromoBanner slides={PROMO_SLIDES} />

        {/* ---- الأعلى تقييمًا ---- */}
        <section aria-label="الأعلى تقييمًا في الفيوم">
          <SectionHeader
            title="الأعلى تقييمًا في الفيوم"
            action={<SeeAll href="/search?type=providers" />}
            className="mb-3"
          />

          {featured.isPending ? (
            <div className="-mx-page flex gap-3 overflow-hidden px-page pb-1">
              {Array.from({ length: 3 }, (_, index) => (
                <ProviderMiniCardSkeleton key={index} />
              ))}
            </div>
          ) : featured.isError ? (
            <ErrorState onRetry={() => void featured.refetch()} />
          ) : featuredProviders.length === 0 ? (
            <EmptyState message="لا يوجد مقدمو خدمات بعد" icon={<Grid2x2 size={40} />} />
          ) : (
            // يمتدّ إلى حافتي الشاشة، والبطاقة التالية نصف ظاهرة تدعو للتمرير
            <div className="scroll-x snap-row -mx-page flex scroll-px-page gap-3 px-page pb-1">
              {featuredProviders.map((provider) => (
                <ProviderMiniCard key={provider.id} provider={provider} />
              ))}
            </div>
          )}
        </section>

        {/* ---- خدمات شائعة ---- */}
        <section aria-label="خدمات شائعة">
          <SectionHeader title="خدمات شائعة" action={<SeeAll href="/services" />} className="mb-3" />

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

      <BottomNav variant={nav.variant} />
    </>
  );
}

function SeeAll({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="pressable inline-flex items-center gap-0.5 text-meta font-bold text-brand-600"
    >
      الكل
      <ChevronLeft size={16} aria-hidden="true" />
    </Link>
  );
}
