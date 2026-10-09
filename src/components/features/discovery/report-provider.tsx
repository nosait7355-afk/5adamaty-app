'use client';

import { useState } from 'react';
import { Check, Flag } from 'lucide-react';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { InfoAlert } from '@/components/common/info-alert';
import { cn } from '@/lib/cn';
import { toast } from '@/lib/toast';
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
 * يفتح Bottom Sheet فوق الصفحة بدل بطاقة تتمدّد داخلها: الإبلاغ مهمة
 * جانبية، فلا يدفع محتوى الملف لأسفل ولا يضيع موضع المستخدم فيه. البلاغ
 * يصل للإدارة في `/admin/reports`.
 */
export function ReportProvider({ providerId }: { providerId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const report = useReportProvider(providerId);

  const submit = () => {
    if (!reason) return;
    const trimmed = details.trim();
    report.mutate(
      { reason, ...(trimmed ? { details: trimmed } : {}) },
      {
        onSuccess: () => {
          setOpen(false);
          toast.success('وصل البلاغ، وسيراجعه فريق الإدارة');
        },
      }
    );
  };

  if (report.isSuccess) {
    return (
      <p className="inline-flex items-center gap-1.5 self-center px-3 py-2 text-meta font-semibold text-ink-400">
        <Check size={16} className="text-success" aria-hidden="true" />
        تم إرسال بلاغك
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="pressable inline-flex w-fit items-center gap-1.5 self-center rounded-field px-3 py-2 text-meta font-semibold text-ink-400 hover:text-danger"
      >
        <Flag size={16} aria-hidden="true" />
        إبلاغ عن مقدم الخدمة
      </button>

      <BottomSheet
        open={open}
        onClose={() => {
          if (!report.isPending) setOpen(false);
        }}
        title="إبلاغ عن مقدم الخدمة"
        footer={
          <Button
            variant="destructive"
            fullWidth
            disabled={!reason}
            loading={report.isPending}
            onClick={submit}
          >
            إرسال البلاغ
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-label text-ink-600">ما المشكلة؟</legend>
            {REPORT_REASONS.map((value) => (
              <label
                key={value}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-field border px-4 py-3 text-body transition-colors',
                  reason === value
                    ? 'border-brand-600 bg-brand-50 font-semibold text-ink-900'
                    : 'border-border text-ink-700'
                )}
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={value}
                  checked={reason === value}
                  onChange={() => setReason(value)}
                  className="size-4 accent-brand-600"
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

          {report.isError && (
            <InfoAlert tone="danger">{extractErrorMessage(report.error)}</InfoAlert>
          )}
        </div>
      </BottomSheet>
    </>
  );
}
