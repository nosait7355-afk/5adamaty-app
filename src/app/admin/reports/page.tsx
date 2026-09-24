'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AdminShell, AdminPageHeader } from '@/components/layout/admin-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, Chip } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/states';
import { useAdminReports, useResolveReport } from '@/lib/queries/admin';
import { formatDateShort } from '@/lib/format';
import {
  REPORT_REASON_LABELS_AR,
  REPORT_STATUS_LABELS_AR,
  type ReportStatus,
} from '@/shared/constants/reports';

const PAGE_SIZE = 20;

const STATUS_TONE = { OPEN: 'warning', RESOLVED: 'success', DISMISSED: 'neutral' } as const;

/**
 * بلاغات المستخدمين عن مقدمي الخدمات — سياسة Google Play للمحتوى الذي
 * ينشئه المستخدمون (UGC).
 *
 * الإدارة تراجع الملف المُبلَّغ عنه، وتوقف الحساب عند المخالفة من صفحة
 * «المستخدمون»، ثم تغلق البلاغ هنا بـ«تمت المعالجة» أو «رفض».
 */
export default function AdminReportsPage() {
  const [status, setStatus] = useState<ReportStatus | ''>('OPEN');
  const [page, setPage] = useState(1);

  const reports = useAdminReports({ page, limit: PAGE_SIZE, ...(status ? { status } : {}) });
  const resolve = useResolveReport();

  const items = reports.data?.data ?? [];
  const total = reports.data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminShell>
      <AdminPageHeader
        title="البلاغات"
        subtitle="بلاغات المستخدمين عن مقدمي الخدمات — لإيقاف حساب مخالف استخدم صفحة «المستخدمون»"
      />

      <div className="flex gap-2">
        {(['OPEN', 'RESOLVED', 'DISMISSED', ''] as const).map((value) => (
          <Chip
            key={value}
            selected={status === value}
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
          >
            {value === '' ? 'الكل' : REPORT_STATUS_LABELS_AR[value]}
          </Chip>
        ))}
      </div>

      {reports.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-card" />
          ))}
        </div>
      ) : reports.isError ? (
        <ErrorState message="تعذّر تحميل البلاغات" onRetry={() => void reports.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState message="لا توجد بلاغات مطابقة" />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((report) => (
            <li key={report.id}>
              <Card className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-label font-bold text-ink-900">
                    {REPORT_REASON_LABELS_AR[report.reason]}
                  </span>
                  <Badge tone={STATUS_TONE[report.status]}>
                    {REPORT_STATUS_LABELS_AR[report.status]}
                  </Badge>
                </div>

                <p className="text-meta text-ink-600">
                  مقدم الخدمة:{' '}
                  {report.provider ? (
                    <Link
                      href={`/providers/${report.provider.id}`}
                      className="font-semibold text-brand-600 underline"
                    >
                      {report.provider.displayName}
                    </Link>
                  ) : (
                    <span className="text-ink-400">محذوف</span>
                  )}
                  {report.provider && !report.provider.isActive && (
                    <span className="ms-2 text-badge text-danger">(موقوف)</span>
                  )}
                </p>

                <p className="text-meta text-ink-600">
                  المُبلِّغ: {report.reporter?.fullName ?? <span className="text-ink-400">محذوف</span>}
                </p>

                {report.details && (
                  <p className="rounded-field bg-bg p-2 text-meta leading-6 text-ink-700">
                    {report.details}
                  </p>
                )}

                <p className="text-badge text-ink-400">{formatDateShort(report.createdAt)}</p>

                {report.status === 'OPEN' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="success"
                      loading={resolve.isPending && resolve.variables?.reportId === report.id}
                      disabled={resolve.isPending}
                      onClick={() => resolve.mutate({ reportId: report.id, status: 'RESOLVED' })}
                    >
                      تمت المعالجة
                    </Button>
                    <Button
                      size="sm"
                      variant="neutral"
                      disabled={resolve.isPending}
                      onClick={() => resolve.mutate({ reportId: report.id, status: 'DISMISSED' })}
                    >
                      رفض البلاغ
                    </Button>
                  </div>
                )}
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
