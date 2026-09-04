'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  BadgeCheck,
  CalendarDays,
  ChevronLeft,
  Clock,
  Heart,
  ImageIcon,
  MapPin,
  Share2,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { BackHeader } from '@/components/layout/back-header';
import { PageContainer } from '@/components/layout/page-container';
import { Badge, Chip } from '@/components/ui/badge';
import { Button, LinkButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/states';
import { CatalogIcon } from '@/components/common/catalog-icon';
import { MediaThumb } from '@/components/features/discovery/media-thumb';
import { ProfileTabs } from '@/components/features/discovery/profile-tabs';
import { Rating } from '@/components/features/discovery/rating-stars';
import { ServiceCard } from '@/components/features/discovery/service-card';
import { cloudinaryUrl } from '@/lib/cloudinary-url';
import {
  formatDateShort,
  formatExperience,
  formatNumber,
  formatPriceRange,
  formatRelativeTime,
  pluralizeAr,
} from '@/lib/format';
import { useProvider, useProviderReviews, useServices } from '@/lib/queries/discovery';

/**
 * ملف مقدم الخدمة — الصورة 10.
 *
 * ملاحظة أمنية مقصودة: لا يعرض هذا الملف رقم هاتف ولا بريدًا. الـAPI لا
 * يعيدهما أصلًا في أي مسار عام؛ قناة التواصل المباشر تُفتح بعد قبول الطلب
 * (Phase 7/8)، ولذلك يظهر زر «تواصل واتساب» معطّلًا بنص يوضّح السبب.
 */
export default function ProviderProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [tab, setTab] = useState('about');

  const provider = useProvider(id);
  const services = useServices({ providerId: id, limit: 20 }, Boolean(provider.data));
  const reviews = useProviderReviews(id, Boolean(provider.data));

  const serviceItems = services.data?.pages.flatMap((page) => page.data) ?? [];
  const reviewItems = reviews.data?.data.items ?? [];
  const reviewsTotal = reviews.data?.meta?.total ?? 0;

  if (provider.isPending) return <ProfileSkeleton />;

  if (provider.isError) {
    return (
      <>
        <BackHeader />
        <PageContainer className="pt-6">
          <ErrorState
            message="تعذّر عرض ملف مقدم الخدمة"
            description="ربما لم يعد متاحًا، أو حدث خطأ في الاتصال."
            onRetry={() => void provider.refetch()}
          />
          <LinkButton href="/categories" variant="secondary" fullWidth className="mt-4">
            تصفّح التصنيفات
          </LinkButton>
        </PageContainer>
      </>
    );
  }

  const data = provider.data;
  const heroImage = cloudinaryUrl(data.gallery[0], { width: 520, height: 240 });

  return (
    <>
      <BackHeader />

      {/* الحشو السفلي يعادل ارتفاع فوتر الإجراءات الثابت — بدونه يغطّي آخر المحتوى */}
      <PageContainer className="flex flex-col gap-4 pb-32 pt-3" withBottomNav={false}>
        {/* ---- مسار التنقّل ---- */}
        <nav aria-label="مسار التنقّل" className="flex items-center gap-1 text-meta text-ink-400">
          <Link href="/categories" className="hover:text-brand-600">
            التصنيفات
          </Link>
          <ChevronLeft size={14} aria-hidden="true" />
          {data.categorySlug ? (
            <Link href={`/categories/${data.categorySlug}`} className="hover:text-brand-600">
              {data.categoryName}
            </Link>
          ) : (
            <span>{data.categoryName}</span>
          )}
          <ChevronLeft size={14} aria-hidden="true" />
          <span className="line-clamp-1 text-ink-600">{data.displayName}</span>
        </nav>

        {/* ---- صورة كبيرة + عدّاد الصور + إجراءات ---- */}
        <div className="relative h-[200px] overflow-hidden rounded-card bg-brand-50">
          {heroImage ? (
            <Image
              src={heroImage}
              alt={data.displayName}
              fill
              sizes="(max-width: 520px) 100vw, 520px"
              priority
              className="object-cover"
            />
          ) : (
            <span className="flex size-full items-center justify-center text-brand-600">
              <CatalogIcon name={data.professionIcon} size={72} strokeWidth={1.25} />
            </span>
          )}

          <div className="absolute end-3 top-3 flex gap-2">
            <ProfileIconButton label="مشاركة الملف" icon={<Share2 size={18} />} />
            <ProfileIconButton label="إضافة إلى المفضلة" icon={<Heart size={18} />} />
          </div>

          {data.gallery.length > 0 && (
            <span className="absolute bottom-3 start-3 inline-flex items-center gap-1 rounded-pill bg-ink-900/70 px-3 py-1 text-badge font-semibold text-white">
              <ImageIcon size={14} aria-hidden="true" />
              <span className="num">{formatNumber(data.gallery.length)} صورة</span>
            </span>
          )}
        </div>

        {/* ---- الهوية ---- */}
        <header className="flex flex-col gap-2">
          <h1 className="flex flex-wrap items-center gap-2 text-section font-extrabold text-ink-900">
            {data.displayName}
            {data.isVerifiedBadge && (
              <Badge tone="success" icon={<BadgeCheck size={14} />}>
                موثّق
              </Badge>
            )}
          </h1>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-ink-600">
            <Rating value={data.ratingAvg} count={data.ratingCount} />
            {data.area && (
              <span className="inline-flex items-center gap-1 text-ink-400">
                <MapPin size={15} aria-hidden="true" />
                {data.area}
              </span>
            )}
            <span className="num inline-flex items-center gap-1 text-ink-400">
              <ShieldCheck size={15} className="text-success" aria-hidden="true" />
              {formatExperience(data.yearsOfExperience)}
            </span>
          </div>

          {data.professionName && (
            <span className="inline-flex w-fit items-center gap-1.5 rounded-pill bg-brand-50 px-3 py-1 text-badge font-semibold text-brand-600">
              <CatalogIcon name={data.professionIcon} size={14} />
              {data.professionName}
            </span>
          )}
        </header>

        {/* ---- شريط السعر المبدئي ---- */}
        <div className="flex items-center justify-between rounded-card border border-brand-100 bg-brand-50 px-4 py-3">
          <span className="text-label font-semibold text-ink-600">السعر المبدئي</span>
          <span className="num text-card-title font-extrabold text-brand-600">
            {data.priceMode === 'RANGE' && data.priceMin != null
              ? formatPriceRange(data.priceMin, data.priceMax)
              : 'يُحدَّد بعد الاتفاق'}
          </span>
        </div>

        {/* ---- الإحصاءات الأربع ---- */}
        <Card className="grid grid-cols-4 divide-x divide-x-reverse divide-border p-0">
          <StatCell
            icon={<CalendarDays size={18} />}
            label="عضو منذ"
            value={data.memberSince ? formatDateShort(data.memberSince).split(' ').slice(-1)[0] ?? '—' : '—'}
          />
          <StatCell
            icon={<Users size={18} />}
            label="العملاء"
            value={formatNumber(data.customersCount)}
          />
          <StatCell
            icon={<ShieldCheck size={18} />}
            label="تم التنفيذ"
            value={formatNumber(data.completedOrders)}
          />
          <StatCell
            icon={<Clock size={18} />}
            label="متوسط الرد"
            value={
              data.avgResponseMinutes != null
                ? pluralizeAr(data.avgResponseMinutes, 'دقيقة', 'دقيقتين', 'دقائق')
                : '—'
            }
          />
        </Card>

        {/* ---- التبويبات ---- */}
        <ProfileTabs
          tabs={[
            { key: 'about', label: 'نبذة' },
            { key: 'services', label: 'الخدمات', count: data.servicesCount },
            { key: 'gallery', label: 'الصور', count: data.gallery.length },
            { key: 'reviews', label: 'التقييمات', count: reviewsTotal },
          ]}
          active={tab}
          onChange={setTab}
        />

        <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {tab === 'about' && (
            <div className="flex flex-col gap-3">
              <p className="text-body text-ink-700">{data.bio}</p>

              {data.highlights.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {data.highlights.map((highlight) => (
                    <Chip key={highlight}>{highlight}</Chip>
                  ))}
                </div>
              )}

              <div>
                <h2 className="mb-2 text-label font-bold text-ink-900">مناطق التغطية</h2>
                <div className="flex flex-wrap gap-2">
                  {data.coverageAreas.map((area) => (
                    <Chip key={area} icon={<MapPin size={14} />}>
                      {area}
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'services' &&
            (services.isPending ? (
              <Skeleton className="h-40 w-full rounded-card" />
            ) : serviceItems.length === 0 ? (
              <EmptyState message="لا توجد خدمات معروضة" compact />
            ) : (
              <div className="flex flex-col gap-3">
                {serviceItems.map((service) => (
                  <ServiceCard key={service.id} service={service} />
                ))}
              </div>
            ))}

          {tab === 'gallery' &&
            (data.gallery.length === 0 ? (
              <EmptyState message="لا توجد صور في المعرض" compact />
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {data.gallery.map((url) => (
                  <MediaThumb
                    key={url}
                    url={url}
                    alt={`صورة من أعمال ${data.displayName}`}
                    size={104}
                    rounded="field"
                    className="w-full"
                  />
                ))}
              </div>
            ))}

          {tab === 'reviews' &&
            (reviews.isPending ? (
              <Skeleton className="h-32 w-full rounded-card" />
            ) : reviews.isError ? (
              <ErrorState onRetry={() => void reviews.refetch()} />
            ) : reviewItems.length === 0 ? (
              <EmptyState message="لا توجد تقييمات بعد" compact />
            ) : (
              <ul className="flex flex-col gap-3">
                {reviewItems.map((review) => (
                  <li key={review.id}>
                    <Card>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-label font-bold text-ink-900">
                          {review.customerName}
                        </span>
                        <span className="text-meta text-ink-400">
                          {formatRelativeTime(review.createdAt)}
                        </span>
                      </div>
                      <Rating value={review.rating} compact={false} className="mt-1" />
                      {review.comment && (
                        <p className="mt-2 text-meta text-ink-600">{review.comment}</p>
                      )}
                    </Card>
                  </li>
                ))}
              </ul>
            ))}
        </div>
      </PageContainer>

      {/* ---- فوتر الإجراءات الثابت ---- */}
      <div className="sticky bottom-0 z-20 border-t border-border bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[520px] items-center gap-3 px-page py-3 pb-safe">
          <LinkButton href={`/orders/new?providerId=${data.id}`} className="flex-1">
            اطلب الخدمة
          </LinkButton>
          <Button
            variant="secondary"
            disabled
            title="يتاح التواصل المباشر بعد قبول مقدم الخدمة لطلبك"
            className="shrink-0 whitespace-nowrap px-3"
          >
            تواصل واتساب
          </Button>
        </div>
        <p className="mx-auto max-w-[520px] px-page pb-2 text-center text-badge text-ink-400">
          يتاح التواصل المباشر بعد قبول مقدم الخدمة لطلبك.
        </p>
      </div>
    </>
  );
}

/* ---- عناصر داخلية ---- */

function ProfileIconButton({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="flex size-9 items-center justify-center rounded-full bg-surface/90 text-ink-600 shadow-card transition-colors hover:text-brand-600"
    >
      {icon}
    </button>
  );
}

function StatCell({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-1 py-3 text-center">
      <span className="text-brand-600" aria-hidden="true">
        {icon}
      </span>
      <span className="num text-label font-extrabold text-ink-900">{value}</span>
      <span className="text-badge text-ink-400">{label}</span>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <>
      <BackHeader />
      <PageContainer className="flex flex-col gap-4 pt-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-[200px] w-full rounded-card" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-14 w-full rounded-card" />
        <Skeleton className="h-20 w-full rounded-card" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-24 w-full rounded-card" />
      </PageContainer>
    </>
  );
}
