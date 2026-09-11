'use client';

import { Star } from 'lucide-react';
import { AppHeader } from '@/components/layout/app-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PageContainer, PageTitle } from '@/components/layout/page-container';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/states';
import { Rating } from '@/components/features/discovery/rating-stars';
import { formatNumber, formatRelativeTime } from '@/lib/format';
import { useMyProviderProfile } from '@/lib/queries/provider';
import { useProviderReviews } from '@/lib/queries/discovery';

/**
 * التقييمات — مقدم الخدمة.
 *
 * نفس مصدر بيانات تبويب «التقييمات» في ملف المزوّد العام
 * (`GET /providers/:id/reviews`)، لكن بمعرّفه هو نفسه؛ فالتقييمات المخفية
 * إداريًا لا تظهر له أيضًا — يرى ما يراه العميل بالضبط.
 */
export default function ProviderReviewsPage() {
  const profile = useMyProviderProfile();
  const reviews = useProviderReviews(profile.data?.id, Boolean(profile.data));

  const items = reviews.data?.data.items ?? [];
  const breakdown = reviews.data?.data.breakdown ?? {};
  const total = reviews.data?.meta?.total ?? 0;

  return (
    <>
      <AppHeader notificationsHref="/provider/notifications" />

      <PageContainer className="flex flex-col gap-5 pt-4">
        <PageTitle title="التقييمات" subtitle="كل ما قيّمه عملاؤك عن خدماتك" />

        {profile.isPending || (reviews.isPending && Boolean(profile.data)) ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-28 w-full rounded-card" />
            <Skeleton className="h-24 w-full rounded-card" />
            <Skeleton className="h-24 w-full rounded-card" />
          </div>
        ) : profile.isError || !profile.data ? (
          <ErrorState message="تعذّر تحميل ملفك" onRetry={() => void profile.refetch()} />
        ) : reviews.isError ? (
          <ErrorState message="تعذّر تحميل التقييمات" onRetry={() => void reviews.refetch()} />
        ) : (
          <>
            {/* ---- ملخّص التقييم ---- */}
            <Card>
              <RatingSummary ratingAvg={reviewsAvg(breakdown)} total={total} />
            </Card>

            {/* ---- توزيع النجوم ---- */}
            {total > 0 && (
              <Card className="flex flex-col gap-2">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = breakdown[String(star)] ?? 0;
                  const percent = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={star} className="flex items-center gap-3">
                      <span className="flex w-10 items-center gap-1 text-meta text-ink-600">
                        <span className="num">{star}</span>
                        <Star size={14} className="fill-star text-star" aria-hidden="true" />
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-pill bg-bg">
                        <div
                          className="h-full rounded-pill bg-star"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="num w-8 text-end text-badge text-ink-400">
                        {formatNumber(count)}
                      </span>
                    </div>
                  );
                })}
              </Card>
            )}

            {/* ---- قائمة التقييمات ---- */}
            {items.length === 0 ? (
              <EmptyState
                icon={<Star size={44} strokeWidth={1.5} />}
                message="لا توجد تقييمات بعد"
                description="تقييمات عملائك بعد إكمال الطلبات تظهر هنا."
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {items.map((review) => (
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
            )}
          </>
        )}
      </PageContainer>

      <BottomNav variant="provider" />
    </>
  );
}

/* ---- عناصر داخلية ---- */

function reviewsAvg(breakdown: Record<string, number>): number {
  const total = Object.values(breakdown).reduce((sum, count) => sum + count, 0);
  if (total === 0) return 0;

  const sum = Object.entries(breakdown).reduce(
    (acc, [star, count]) => acc + Number(star) * count,
    0
  );
  return sum / total;
}

function RatingSummary({ ratingAvg, total }: { ratingAvg: number; total: number }) {
  return (
    <div className="flex flex-col gap-1">
      <Rating value={ratingAvg} count={total} compact={false} size={20} />
      <p className="text-meta text-ink-400">
        بناءً على {formatNumber(total)} {total === 1 ? 'تقييم' : 'تقييمًا'}
      </p>
    </div>
  );
}
