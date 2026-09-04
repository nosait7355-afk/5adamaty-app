'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Star } from 'lucide-react';
import { BackHeader } from '@/components/layout/back-header';
import { PageContainer, PageTitle } from '@/components/layout/page-container';
import { Card } from '@/components/ui/card';
import { Button, LinkButton } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { InfoAlert } from '@/components/common/info-alert';
import { ErrorState } from '@/components/common/states';
import { MediaThumb } from '@/components/features/discovery/media-thumb';
import { ApiClientError } from '@/lib/api-client';
import { formatOrderNumber } from '@/lib/format';
import { useOrder } from '@/lib/queries/orders';
import { useCreateReview } from '@/lib/queries/account';
import { cn } from '@/lib/cn';

/**
 * كتابة التقييم — شاشة مشتقّة مبرَّرة (`UI_ANALYSIS §0.1`): زر «تقييم
 * الخدمة» في الصورة 13 و«قيم الآن» في الصورة 15.
 *
 * التقييم مسموح مرة واحدة لطلب مكتمل. الشروط كلها على الخادم؛ الواجهة
 * تعرضها فقط.
 */

const RATING_LABELS = ['سيئة', 'مقبولة', 'جيدة', 'جيدة جدًا', 'ممتازة'];

export default function ReviewOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const order = useOrder(id);
  const createReview = useCreateReview();

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (rating < 1) {
      setError('اختر تقييمًا من نجمة إلى خمس.');
      return;
    }

    setError('');
    try {
      await createReview.mutateAsync({
        orderId: id,
        rating,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      });
      setDone(true);
    } catch (submitError) {
      setError(
        submitError instanceof ApiClientError
          ? submitError.message
          : 'تعذّر إرسال التقييم. حاول مرة أخرى.'
      );
    }
  };

  if (order.isPending) {
    return (
      <>
        <BackHeader />
        <PageContainer className="flex flex-col gap-4 pt-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-24 w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
        </PageContainer>
      </>
    );
  }

  if (order.isError || !order.data) {
    return (
      <>
        <BackHeader />
        <PageContainer className="pt-6">
          <ErrorState message="تعذّر عرض الطلب" onRetry={() => void order.refetch()} />
        </PageContainer>
      </>
    );
  }

  const data = order.data;

  /* الطلب غير مكتمل — الخادم سيرفض، فنشرح السبب بدل ترك المستخدم يحاول */
  if (!data.canReview && !done) {
    return (
      <>
        <BackHeader />
        <PageContainer className="flex flex-col gap-4 pt-6">
          <InfoAlert tone="warning" title="التقييم بعد إكمال الخدمة">
            يمكنك تقييم الطلب بعد أن يؤكد مقدم الخدمة إكماله.
          </InfoAlert>
          <LinkButton href={`/orders/${id}`} variant="secondary" fullWidth>
            العودة لتفاصيل الطلب
          </LinkButton>
        </PageContainer>
      </>
    );
  }

  if (done) {
    return (
      <>
        <BackHeader />
        <PageContainer className="flex flex-col items-center gap-4 pt-10 text-center">
          <span className="flex size-20 items-center justify-center rounded-full bg-success-bg text-success">
            <CheckCircle2 size={44} />
          </span>
          <h1 className="text-screen-title font-extrabold text-ink-900">شكرًا لتقييمك</h1>
          <p className="text-body text-ink-400">
            تقييمك يساعد غيرك على اختيار مقدم الخدمة المناسب.
          </p>

          <div className="mt-4 flex w-full gap-3">
            <LinkButton href="/orders" className="flex-1">
              طلباتي
            </LinkButton>
            <LinkButton href={`/providers/${data.provider.id}`} variant="secondary" className="flex-1">
              ملف مقدم الخدمة
            </LinkButton>
          </div>
        </PageContainer>
      </>
    );
  }

  return (
    <>
      <BackHeader />

      <PageContainer className="flex flex-col gap-4 pb-10">
        <PageTitle
          title="تقييم الخدمة"
          subtitle={`الطلب ${formatOrderNumber(data.orderNumber)}`}
        />

        {/* ---- بطاقة المزوّد ---- */}
        <Card className="flex items-center gap-3">
          <MediaThumb
            url={data.provider.avatar}
            alt={data.provider.displayName}
            size={52}
            rounded="full"
          />
          <div className="min-w-0">
            <h2 className="line-clamp-1 text-card-title font-bold text-ink-900">
              {data.provider.displayName}
            </h2>
            <p className="text-meta text-ink-400">{data.serviceType}</p>
          </div>
        </Card>

        {/* ---- النجوم ---- */}
        <Card className="flex flex-col items-center gap-3">
          <p className="text-label font-semibold text-ink-600">كيف كانت الخدمة؟</p>

          <div className="flex items-center gap-2" role="radiogroup" aria-label="التقييم">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={rating === value}
                aria-label={`${value} من 5`}
                onClick={() => setRating(value)}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star
                  size={36}
                  className={cn(
                    value <= rating ? 'fill-star text-star' : 'text-ink-300',
                    'transition-colors'
                  )}
                />
              </button>
            ))}
          </div>

          {rating > 0 && (
            <span className="text-label font-bold text-brand-600">{RATING_LABELS[rating - 1]}</span>
          )}
        </Card>

        <Field
          label="تعليقك"
          hint="اختياري"
          counter={{ current: comment.length, max: 500 }}
        >
          <Textarea
            rows={4}
            maxLength={500}
            placeholder="اكتب رأيك في الخدمة ليستفيد غيرك"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
        </Field>

        {error && (
          <InfoAlert tone="danger" title="تعذّر إرسال التقييم">
            {error}
          </InfoAlert>
        )}

        <div className="flex gap-3">
          <Button
            variant="neutral"
            className="flex-1"
            disabled={createReview.isPending}
            onClick={() => router.push(`/orders/${id}`)}
          >
            لاحقًا
          </Button>
          <Button
            className="flex-[2]"
            loading={createReview.isPending}
            disabled={rating < 1}
            onClick={() => void submit()}
          >
            إرسال التقييم
          </Button>
        </div>
      </PageContainer>
    </>
  );
}
