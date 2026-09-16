'use client';

import { CheckCircle2, Gavel, Inbox } from 'lucide-react';
import { PageContainer } from '@/components/layout/page-container';
import { BrandMark } from '@/components/layout/brand-mark';
import { Card } from '@/components/ui/card';
import { LinkButton } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { VerificationBadge } from '@/components/common/status-badge';
import { InfoAlert } from '@/components/common/info-alert';
import { ErrorState } from '@/components/common/states';
import { formatDateTime } from '@/lib/format';
import { useMyProviderProfile } from '@/lib/queries/provider';

/**
 * تم التسجيل بنجاح — الصورة 23.
 *
 * لم تعد هذه شاشة انتظار: الحساب يُفعَّل تلقائيًا فور الإرسال، فالشاشة
 * تؤكّد التفعيل وتعرض رقم الطلب. تبقى قادرة على عرض حالات الرفض وطلب
 * التعديل لأن الإدارة تحتفظ برقابة **بعدية** تستطيع بها تغيير الحالة.
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
            ? 'تم التسجيل بنجاح'
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
            ? 'حسابك نشط الآن — ملفك ظاهر للعملاء ويمكنك استقبال الطلبات.'
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

      </Card>

      {verification.rejectionReason && (
        <InfoAlert tone={isRejected ? 'danger' : 'warning'} title="ملاحظة الإدارة">
          {verification.rejectionReason}
        </InfoAlert>
      )}

      {/* ---- معلومات هامة ---- */}
      <section aria-label="معلومات هامة">
        <h2 className="mb-3 flex items-center gap-2 text-section font-bold text-ink-900">
          <Gavel size={20} className="text-brand-600" aria-hidden="true" />
          معلومات هامة
        </h2>
        <Card>
          <ul className="flex list-inside list-disc flex-col gap-2 text-meta text-ink-600">
            <li>حسابك نشط وملفك ظاهر في نتائج البحث فور اكتمال التسجيل.</li>
            <li>للإدارة أن تراجع حسابك لاحقًا وتوقفه عند مخالفة الشروط.</li>
            <li>الدفع كاش مباشرة بينك وبين العميل خارج التطبيق.</li>
            <li>نحن غير مسؤولين عن جودة الخدمة. يتم الاتفاق مباشرة بينك وبين العميل.</li>
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
