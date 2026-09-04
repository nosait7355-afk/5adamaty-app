'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { AdminShell, AdminPageHeader } from '@/components/layout/admin-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { Badge, Chip } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/states';
import { useAdminReviews, useSetReviewVisibility } from '@/lib/queries/admin';
import { formatDateShort } from '@/lib/format';

const PAGE_SIZE = 20;

/**
 * إشراف التقييمات — إخفاء/إظهار فقط، بلا حذف (حفاظًا على أثر التدقيق).
 * إخفاء تقييم يعيد حساب متوسط تقييم المزوّد فورًا من التقييمات الظاهرة.
 */
export default function AdminReviewsPage() {
  const [isVisible, setIsVisible] = useState<'' | 'true' | 'false'>('');
  const [page, setPage] = useState(1);
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});

  const reviews = useAdminReviews({ page, limit: PAGE_SIZE, ...(isVisible ? { isVisible } : {}) });
  const setVisibility = useSetReviewVisibility();

  const items = reviews.data?.data ?? [];
  const total = reviews.data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminShell>
      <AdminPageHeader title="التقييمات" subtitle="إشراف على تقييمات العملاء لمقدمي الخدمة" />

      <div className="flex gap-2">
        {(['', 'true', 'false'] as const).map((value) => (
          <Chip
            key={value}
            selected={isVisible === value}
            onClick={() => {
              setIsVisible(value);
              setPage(1);
            }}
          >
            {value === '' ? 'الكل' : value === 'true' ? 'ظاهرة' : 'مخفية'}
          </Chip>
        ))}
      </div>

      {reviews.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-card" />
          ))}
        </div>
      ) : reviews.isError ? (
        <ErrorState message="تعذّر تحميل التقييمات" onRetry={() => void reviews.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState message="لا توجد تقييمات مطابقة" />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((review) => (
            <li key={review.id}>
              <Card className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1 text-star">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        size={16}
                        fill={i < review.rating ? 'currentColor' : 'none'}
                        aria-hidden="true"
                      />
                    ))}
                    <span className="num ms-1 text-meta font-bold text-ink-900">{review.rating}</span>
                  </div>
                  <Badge tone={review.isVisible ? 'success' : 'danger'}>
                    {review.isVisible ? 'ظاهر' : 'مخفي'}
                  </Badge>
                </div>

                {review.comment && <p className="text-meta leading-6 text-ink-600">{review.comment}</p>}

                <p className="text-badge text-ink-400">{formatDateShort(review.createdAt)}</p>

                {review.adminNote && (
                  <p className="rounded-field bg-warning-bg p-2 text-badge text-warning">
                    ملاحظة الإدارة: {review.adminNote}
                  </p>
                )}

                <Field label="ملاحظة الإدارة (اختياري)" htmlFor={`note-${review.id}`}>
                  <Textarea
                    id={`note-${review.id}`}
                    rows={1}
                    maxLength={300}
                    value={noteDraft[review.id] ?? review.adminNote ?? ''}
                    onChange={(e) => setNoteDraft((prev) => ({ ...prev, [review.id]: e.target.value }))}
                  />
                </Field>

                <Button
                  size="sm"
                  variant={review.isVisible ? 'danger' : 'success'}
                  className="w-fit"
                  loading={setVisibility.isPending}
                  onClick={() =>
                    setVisibility.mutate({
                      reviewId: review.id,
                      isVisible: !review.isVisible,
                      adminNote: noteDraft[review.id] ?? review.adminNote,
                    })
                  }
                >
                  {review.isVisible ? 'إخفاء التقييم' : 'إظهار التقييم'}
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            السابق
          </Button>
          <span className="num text-meta text-ink-400">
            {page} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            التالي
          </Button>
        </div>
      )}
    </AdminShell>
  );
}
