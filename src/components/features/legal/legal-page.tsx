import type { ReactNode } from 'react';
import Link from 'next/link';
import { BackHeader } from '@/components/layout/back-header';
import { PageContainer, PageTitle } from '@/components/layout/page-container';
import { Card } from '@/components/ui/card';
import { LEGAL_LAST_UPDATED, SUPPORT_EMAIL } from '@/shared/constants/legal';

/**
 * هيكل مشترك للصفحات القانونية الثابتة (`/terms` و`/privacy`).
 *
 * الصفحتان عامّتان بلا تسجيل دخول: متجر Google Play يشترط رابط سياسة
 * خصوصية يفتحه أي زائر.
 */
export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <>
      <BackHeader />
      <PageContainer withBottomNav={false} className="flex flex-col gap-4 pb-10">
        <PageTitle title={title} subtitle={`آخر تحديث: ${LEGAL_LAST_UPDATED}`} />
        {children}
        <Card className="text-meta text-ink-600">
          للاستفسارات:{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="num font-semibold text-brand-600">
            {SUPPORT_EMAIL}
          </a>
        </Card>
        <LegalLinks className="justify-center" />
      </PageContainer>
    </>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-section font-bold text-ink-900">{title}</h2>
      <div className="flex flex-col gap-2 text-body leading-7 text-ink-700">{children}</div>
    </section>
  );
}

/** روابط الشروط والخصوصية — «فوتر» الشاشات التي لا يظهر فيها شريط التنقل. */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav
      aria-label="روابط قانونية"
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-ink-400 ${className ?? ''}`}
    >
      <Link href="/terms" className="hover:text-brand-600">
        الشروط والأحكام
      </Link>
      <span aria-hidden="true">·</span>
      <Link href="/privacy" className="hover:text-brand-600">
        سياسة الخصوصية
      </Link>
    </nav>
  );
}
