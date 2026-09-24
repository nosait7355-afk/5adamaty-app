'use client';

import { useState } from 'react';
import { Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { InfoAlert } from '@/components/common/info-alert';
import { cn } from '@/lib/cn';
import { extractErrorMessage } from '@/lib/queries/auth';
import { useReportProvider } from '@/lib/queries/discovery';
import {
  REPORT_REASON_LABELS_AR,
  REPORT_REASONS,
  type ReportReason,
} from '@/shared/constants/reports';

/**
 * «إبلاغ عن مقدم الخدمة» — سياسة Google Play للمحتوى الذي ينشئه
 * المستخدمون (UGC) تشترط وسيلة إبلاغ داخل التطبيق عن المحتوى المسيء.
 *
 * بطاقة تنفتح مكانها بدل نافذة منبثقة: أبسط وأوثق داخل WebView أندرويد.
 * البلاغ يصل للإدارة في `/admin/reports`.
 */
export function ReportProvider({ providerId }: { providerId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const report = useReportProvider(providerId);

  if (report.isSuccess) {
    return (
      <InfoAlert tone="success" title="تم استلام البلاغ">
        شكرًا لك. سيراجع فريق الإدارة البلاغ ويتخذ الإجراء المناسب.
      </InfoAlert>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-fit items-center gap-1.5 self-center rounded-field px-3 py-2 text-meta font-semibold text-ink-400 transition-colors hover:text-danger"
      >
        <Flag size={16} aria-hidden="true" />
        إبلاغ عن مقدم الخدمة
      </button>
    );
  }

  const submit = () => {
    if (!reason) return;
    const trimmed = details.trim();
    report.mutate({ reason, ...(trimmed ? { details: trimmed } : {}) });
  };

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-label font-bold text-ink-900">
        <Flag size={18} className="text-danger" aria-hidden="true" />
        إبلاغ عن مقدم الخدمة
      </h2>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-meta text-ink-600">سبب الإبلاغ</legend>
        {REPORT_REASONS.map((value) => (
          <label
            key={value}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-field border px-3 py-2.5 text-meta transition-colors',
              reason === value
                ? 'border-brand-600 bg-brand-50 text-ink-900'
                : 'border-border text-ink-700'
            )}
          >
            <input
              type="radio"
              name="report-reason"
              value={value}
              checked={reason === value}
              onChange={() => setReason(value)}
              className="accent-brand-600"
            />
            {REPORT_REASON_LABELS_AR[value]}
          </label>
        ))}
      </fieldset>

      <Textarea
        value={details}
        onChange={(event) => setDetails(event.target.value)}
        maxLength={500}
        rows={3}
        placeholder="تفاصيل إضافية (اختياري)"
        aria-label="تفاصيل إضافية"
      />

      {report.isError && <InfoAlert tone="danger">{extractErrorMessage(report.error)}</InfoAlert>}

      <div className="flex gap-2">
        <Button
          variant="danger"
          size="md"
          className="flex-1"
          disabled={!reason}
          loading={report.isPending}
          onClick={submit}
        >
          إرسال البلاغ
        </Button>
        <Button
          variant="neutral"
          size="md"
          className="flex-1"
          disabled={report.isPending}
          onClick={() => setOpen(false)}
        >
          إلغاء
        </Button>
      </div>
    </Card>
  );
}
