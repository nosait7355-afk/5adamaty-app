'use client';

import { CheckCircle2, Clock, FileSearch, Gavel, Inbox } from 'lucide-react';
import { PageContainer } from '@/components/layout/page-container';
import { BrandMark } from '@/components/layout/brand-mark';
import { Card } from '@/components/ui/card';
import { LinkButton } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { VerificationBadge } from '@/components/common/status-badge';
import { InfoAlert } from '@/components/common/info-alert';
import { ErrorState } from '@/components/common/states';
import { OrderTimeline } from '@/components/common/order-timeline';
import { formatDateTime } from '@/lib/format';
import { useMyProviderProfile } from '@/lib/queries/provider';

/**
 * تم إرسال طلب التسجيل / قيد المراجعة — الصورة 23.
 *
 * التصميم يذكر إخطارًا برسالة نصية؛ القرار المعتمد في `UI_ANALYSIS §2` هو
 * إشعار داخل التطبيق + بريد إلكتروني، بلا أي SMS أو OTP.
 */
export default function PendingReviewPage() {
  const profile = useMyProviderProfile();

  if (profile.isPending) {
    return (
      <PageContainer withBottomNav={false} className="flex flex-col gap-4 pt-8">
        <Skeleton className="mx-auto size-20 rounded-full" />
        <Skeleton className="mx-auto h-8 w-56" />
        <Skeleton className="h-32 w-full rounded-card" />
        <Skeleton className="h-48 w-full rounded-card" />
      </PageContainer>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <PageContainer withBottomNav={false} className="pt-8">
        <ErrorState
          message="تعذّر عرض حالة طلبك"
          description="تحقق من اتصالك ثم حاول مرة أخرى."
          onRetry={() => void profile.refetch()}
        />
      </PageContainer>
    );
  }

  const { verification, profileCompletion } = profile.data;
  const isApproved = verification.status === 'APPROVED';
  const isRejected = verification.status === 'REJECTED';
  const needsResubmission = verification.status === 'RESUBMISSION_REQUIRED';
  const isDraft = verification.status === 'DRAFT';

  /* خطوات المراجعة الأربع — الصورة 23. */
  const decided = isApproved || isRejected;

  const reviewSteps = [
    {
      title: 'استلام الطلب',
      description: 'وصل طلبك بنجاح إلى فريق المراجعة.',
      state: 'done' as const,
      ...(verification.submittedAt ? { timestamp: formatDateTime(verification.submittedAt) } : {}),
    },
    {
      title: 'مراجعة البيانات',
      description: 'التحقق من بيانات حسابك ومهنتك ومناطق تغطيتك.',
      state: (decided ? 'done' : 'current') as 'done' | 'current' | 'pending',
    },
    {
      title: 'التحقق من المستندات',
      description: 'مطابقة المستندات المرفوعة بمتطلبات مهنتك.',
      state: (decided ? 'done' : 'pending') as 'done' | 'current' | 'pending',
    },
    {
      title: 'اتخاذ القرار',
      description: isApproved
        ? 'تم اعتماد حسابك وأصبح ظاهرًا للعملاء.'
        : 'سنخطرك بالنتيجة عبر إشعار داخل التطبيق وبريدك الإلكتروني.',
      state: (decided ? 'done' : 'pending') as 'done' | 'current' | 'pending',
      ...(verification.reviewedAt ? { timestamp: formatDateTime(verification.reviewedAt) } : {}),
    },
  ];

  return (
    <PageContainer withBottomNav={false} className="flex flex-col gap-5 pb-10 pt-6">
      <header className="flex flex-col items-center gap-3 text-center">
        <BrandMark />
        <span
          className={`flex size-20 items-center justify-center rounded-full ${
            isApproved ? 'bg-success-bg text-success' : 'bg-brand-50 text-brand-600'
          }`}
        >
          {isApproved ? <CheckCircle2 size={44} /> : <Inbox size={44} strokeWidth={1.5} />}
        </span>

        <h1 className="text-screen-title font-extrabold text-ink-900">
          {isApproved
            ? 'تم اعتماد حسابك'
            : isRejected
              ? 'تم رفض طلب التسجيل'
              : needsResubmission
                ? 'مطلوب تعديل طلبك'
                : isDraft
                  ? 'طلبك لم يُرسل بعد'
                  : 'تم إرسال طلب التسجيل'}
        </h1>

        <p className="text-body text-ink-400">
          {isApproved
            ? 'أصبح ملفك ظاهرًا للعملاء ويمكنك استقبال الطلبات.'
            : isRejected
              ? 'يمكنك التواصل مع الدعم لمعرفة التفاصيل.'
              : needsResubmission
                ? 'عدّل ما طلبته الإدارة ثم أعد الإرسال.'
                : isDraft
                  ? 'أكمل خطوات التسجيل وأرسل طلبك لتبدأ المراجعة.'
                  : 'سنراجع طلبك ونخطرك بالنتيجة.'}
        </p>
      </header>

      {/* ---- بطاقة الحالة ---- */}
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-label font-semibold text-ink-600">حالة الطلب</span>
          <VerificationBadge status={verification.status} />
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <span className="text-label font-semibold text-ink-600">رقم الطلب</span>
          <span className="num text-card-title font-extrabold text-brand-600">
            {verification.requestNumber}
          </span>
        </div>

        {verification.submittedAt && !isDraft && (
          <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
            <span className="text-label font-semibold text-ink-600">تاريخ الإرسال</span>
            <span className="num text-meta text-ink-900">
              {formatDateTime(verification.submittedAt)}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <span className="text-label font-semibold text-ink-600">اكتمال الملف</span>
          <span className="num text-meta font-bold text-ink-900">{profileCompletion}%</span>
        </div>

        {!isApproved && !isRejected && !isDraft && (
          <p className="flex items-center gap-2 rounded-field bg-warning-bg px-3 py-2 text-meta text-warning">
            <Clock size={16} aria-hidden="true" />
            المراجعة تستغرق عادةً 24–48 ساعة عمل.
          </p>
        )}
      </Card>

      {verification.rejectionReason && (
        <InfoAlert tone={isRejected ? 'danger' : 'warning'} title="ملاحظة الإدارة">
          {verification.rejectionReason}
        </InfoAlert>
      )}

      {/* ---- خطوات المراجعة ---- */}
      {!isDraft && (
        <section aria-label="خطوات المراجعة">
          <h2 className="mb-3 flex items-center gap-2 text-section font-bold text-ink-900">
            <FileSearch size={20} className="text-brand-600" aria-hidden="true" />
            خطوات المراجعة
          </h2>
          <Card>
            <OrderTimeline items={reviewSteps} />
          </Card>
        </section>
      )}

      {/* ---- معلومات هامة ---- */}
      <section aria-label="معلومات هامة">
        <h2 className="mb-3 flex items-center gap-2 text-section font-bold text-ink-900">
          <Gavel size={20} className="text-brand-600" aria-hidden="true" />
          معلومات هامة
        </h2>
        <Card>
          <ul className="flex list-inside list-disc flex-col gap-2 text-meta text-ink-600">
            <li>لن يظهر ملفك في نتائج البحث ولن تستقبل طلبات قبل الاعتماد.</li>
            <li>سنخطرك بالقرار عبر إشعار داخل التطبيق وبريدك الإلكتروني.</li>
            <li>الدفع كاش مباشرة بينك وبين العميل خارج التطبيق.</li>
            <li>مستنداتك محفوظة بشكل مقيّد ولا تظهر للعملاء ولا لمقدمي خدمة آخرين.</li>
          </ul>
        </Card>
      </section>

      {/* ---- الإجراءات ---- */}
      <div className="flex flex-col gap-3">
        {isApproved ? (
          <LinkButton href="/provider/dashboard" fullWidth>
            الذهاب إلى لوحة التحكم
          </LinkButton>
        ) : needsResubmission || isDraft ? (
          <LinkButton href="/register/provider" fullWidth>
            {isDraft ? 'إكمال التسجيل' : 'تعديل الطلب وإعادة الإرسال'}
          </LinkButton>
        ) : null}

        <LinkButton href="/help" variant="secondary" fullWidth>
          مركز المساعدة
        </LinkButton>
      </div>
    </PageContainer>
  );
}
