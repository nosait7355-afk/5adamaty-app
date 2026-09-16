'use client';

import Link from 'next/link';
import { Heart, MapPin } from 'lucide-react';
import { BackHeader } from '@/components/layout/back-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PageContainer, PageTitle } from '@/components/layout/page-container';
import { Card, SectionHeader } from '@/components/ui/card';
import { Button, LinkButton } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/states';
import { Rating } from '@/components/features/discovery/rating-stars';
import { useFavorites, useToggleFavorite } from '@/lib/queries/account';

/**
 * المفضلة — شاشة مشتقّة مبرَّرة (`UI_ANALYSIS §0.1`): عدّاد «المفضلة 12»
 * في الصورة 16 وأيقونة ♡ في الصورتين 09 و10.
 *
 * تمرّ بمستودع الاكتشاف، فيسري عليها **حارس الظهور**: مزوّد فقد اعتماده
 * يختفي من هنا كما يختفي من البحث.
 */
export default function FavoritesPage() {
  const favorites = useFavorites();
  const toggle = useToggleFavorite();

  if (favorites.isPending) {
    return (
      <>
        <BackHeader />
        <PageContainer className="flex flex-col gap-3 pt-4">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-card" />
          ))}
        </PageContainer>
        <BottomNav />
      </>
    );
  }

  if (favorites.isError || !favorites.data) {
    return (
      <>
        <BackHeader />
        <PageContainer className="pt-6">
          <ErrorState onRetry={() => void favorites.refetch()} />
        </PageContainer>
        <BottomNav />
      </>
    );
  }

  const { providers, services, total } = favorites.data;
  const isEmpty = providers.length === 0 && services.length === 0;

  return (
    <>
      <BackHeader />

      <PageContainer className="flex flex-col gap-5">
        <PageTitle title="المفضلة" subtitle="ما حفظته للرجوع إليه لاحقًا" />

        {isEmpty ? (
          <EmptyState
            icon={<Heart size={44} strokeWidth={1.5} />}
            message="لا توجد عناصر في المفضلة"
            description={
              total > 0
                ? 'العناصر المحفوظة لم تعد متاحة حاليًا.'
                : 'اضغط ♡ على أي خدمة أو مقدم خدمة لحفظه هنا.'
            }
            action={
              <LinkButton href="/categories" size="sm" variant="secondary">
                تصفّح الخدمات
              </LinkButton>
            }
          />
        ) : (
          <>
            {providers.length > 0 && (
              <section aria-label="مقدمو الخدمات">
                <SectionHeader title="مقدمو الخدمات" className="mb-3" />
                <ul className="flex flex-col gap-3">
                  {providers.map((provider) => (
                    <li key={provider.id}>
                      <Card className="flex items-center gap-3">
                        <Link href={`/providers/${provider.id}`} className="min-w-0 flex-1">
                          <h3 className="line-clamp-1 text-card-title font-bold text-ink-900">
                            {provider.displayName}
                          </h3>
                          {provider.professionName && (
                            <p className="text-meta text-ink-400">{provider.professionName}</p>
                          )}
                          <div className="mt-1 flex items-center gap-3">
                            <Rating value={provider.ratingAvg} count={provider.ratingCount} />
                            {provider.area && (
                              <span className="inline-flex items-center gap-1 text-meta text-ink-400">
                                <MapPin size={14} aria-hidden="true" />
                                {provider.area}
                              </span>
                            )}
                          </div>
                        </Link>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 text-danger hover:bg-danger-bg"
                          loading={toggle.isPending}
                          onClick={() => void toggle.mutateAsync({ providerId: provider.id })}
                          aria-label={`إزالة ${provider.displayName} من المفضلة`}
                        >
                          <Heart size={18} className="fill-danger" />
                        </Button>
                      </Card>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {services.length > 0 && (
              <section aria-label="الخدمات">
                <SectionHeader title="الخدمات" className="mb-3" />
                <ul className="flex flex-col gap-3">
                  {services.map((service) => (
                    <li key={service.id}>
                      <Card className="flex items-center gap-3">
                        <Link
                          href={`/providers/${service.providerId}?serviceId=${service.id}`}
                          className="min-w-0 flex-1"
                        >
                          <h3 className="line-clamp-1 text-card-title font-bold text-ink-900">
                            {service.title}
                          </h3>
                          <div className="mt-1 flex items-center gap-3">
                            <Rating value={service.ratingAvg} />
                          </div>
                        </Link>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 text-danger hover:bg-danger-bg"
                          loading={toggle.isPending}
                          onClick={() => void toggle.mutateAsync({ serviceId: service.id })}
                          aria-label={`إزالة ${service.title} من المفضلة`}
                        >
                          <Heart size={18} className="fill-danger" />
                        </Button>
                      </Card>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </PageContainer>

      <BottomNav />
    </>
  );
}
