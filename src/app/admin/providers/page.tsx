'use client';

import { useState } from 'react';
import {
  BadgeCheck,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { AdminShell, AdminPageHeader } from '@/components/layout/admin-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { VerificationBadge } from '@/components/common/status-badge';
import { InfoAlert } from '@/components/common/info-alert';
import { EmptyState, ErrorState } from '@/components/common/states';
import { ApiClientError } from '@/lib/api-client';
import { formatDateTime, formatNumber } from '@/lib/format';
import {
  fetchDocumentUrl,
  useAdminProvider,
  useDecideVerification,
  useVerificationQueue,
} from '@/lib/queries/provider';
import {
  VERIFICATION_LABELS_AR,
  VERIFICATION_STATUSES,
  type VerificationStatus,
} from '@/shared/constants/roles';
import type { AdminDecision } from '@/shared/schemas/provider.schema';

/**
 * لوحة الإدارة — مراجعة توثيق مقدمي الخدمة.
 *
 * شاشة مشتقّة مبرَّرة (`UI_ANALYSIS §0.1`): حالة «قيد المراجعة» في الصورة 23
 * تستلزم جهة تراجع وتقرّر.
 *
 * المستندات تُفتح عبر **رابط موقّت** يُطلب لحظة الضغط وينتهي خلال دقائق؛
 * لا يُخزَّن الرابط في الصفحة ولا في الـcache (ARCHITECTURE §8).
 */
export default function AdminProvidersPage() {
  const [status, setStatus] = useState<VerificationStatus>('PENDING_REVIEW');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const queue = useVerificationQueue(status);
  const items = queue.data?.data ?? [];

  return (
    <AdminShell>
      <AdminPageHeader title="مراجعة التوثيق" subtitle="طلبات تسجيل مقدمي الخدمة" />

        <div className="scroll-x flex gap-2">
          {VERIFICATION_STATUSES.map((entry) => (
            <Chip key={entry} selected={status === entry} onClick={() => setStatus(entry)}>
              {VERIFICATION_LABELS_AR[entry]}
            </Chip>
          ))}
        </div>

        {queue.isPending ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-28 w-full rounded-card" />
            ))}
          </div>
        ) : queue.isError ? (
          <ErrorState
            message="تعذّر تحميل الطلبات"
            description={
              queue.error instanceof ApiClientError && queue.error.httpStatus === 403
                ? 'هذه الصفحة للإدارة فقط.'
                : undefined
            }
            onRetry={() => void queue.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState message={`لا توجد طلبات بحالة «${VERIFICATION_LABELS_AR[status]}»`} />
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li key={item.id}>
                <Card className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="line-clamp-1 text-card-title font-bold text-ink-900">
                        {item.displayName}
                      </h3>
                      <p className="num text-meta text-brand-600">{item.requestNumber}</p>
                    </div>
                    <VerificationBadge status={item.status} />
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-meta text-ink-600">
                    <span className="inline-flex items-center gap-1">
                      <FileText size={14} aria-hidden="true" />
                      <span className="num">{formatNumber(item.documentsCount)} مستند</span>
                    </span>
                    <span className="num">اكتمال {item.profileCompletion}%</span>
                    {item.submittedAt && (
                      <span className="num text-ink-400">{formatDateTime(item.submittedAt)}</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-meta text-ink-400">
                    {item.contact.phone && (
                      <a
                        href={`tel:${item.contact.phone}`}
                        className="num inline-flex items-center gap-1 hover:text-brand-600"
                      >
                        <Phone size={14} aria-hidden="true" />
                        {item.contact.phone}
                      </a>
                    )}
                    {item.contact.email && (
                      <a
                        href={`mailto:${item.contact.email}`}
                        className="num inline-flex items-center gap-1 hover:text-brand-600"
                      >
                        <Mail size={14} aria-hidden="true" />
                        {item.contact.email}
                      </a>
                    )}
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-1 w-fit"
                    onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}
                  >
                    {selectedId === item.id ? 'إخفاء التفاصيل' : 'مراجعة الطلب'}
                  </Button>

                  {selectedId === item.id && <ProviderReviewPanel providerId={item.id} />}
                </Card>
              </li>
            ))}
          </ul>
        )}
    </AdminShell>
  );
}

/* ================================================================== */

function ProviderReviewPanel({ providerId }: { providerId: string }) {
  const detail = useAdminProvider(providerId);
  const decide = useDecideVerification();

  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [openingId, setOpeningId] = useState<string | null>(null);

  const submitDecision = async (status: AdminDecision) => {
    if (status !== 'APPROVED' && reason.trim().length === 0) {
      setError('اكتب سبب الرفض أو التعديل — يصل نصّه لمقدم الخدمة.');
      return;
    }

    setError('');
    try {
      await decide.mutateAsync({
        providerId,
        status,
        ...(status === 'APPROVED' ? {} : { reason: reason.trim() }),
      });
    } catch (mutationError) {
      setError(
        mutationError instanceof ApiClientError
          ? mutationError.message
          : 'تعذّر حفظ القرار. حاول مرة أخرى.'
      );
    }
  };

  /** يطلب رابطًا موقّتًا ثم يفتحه — لا يُخزَّن الرابط في الحالة. */
  const openDocument = async (documentId: string) => {
    setOpeningId(documentId);
    try {
      const url = await fetchDocumentUrl(documentId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setError('تعذّر فتح المستند. قد تكون صلاحية الرابط انتهت — حاول مجددًا.');
    } finally {
      setOpeningId(null);
    }
  };

  if (detail.isPending) return <Skeleton className="mt-3 h-40 w-full rounded-card" />;
  if (detail.isError || !detail.data) {
    return <ErrorState onRetry={() => void detail.refetch()} className="mt-3" />;
  }

  const data = detail.data;

  return (
    <div className="mt-3 flex flex-col gap-4 border-t border-border pt-4">
      <section>
        <h4 className="mb-2 text-label font-bold text-ink-900">بيانات المهنة</h4>
        <dl className="flex flex-col gap-1 text-meta">
          <Row label="التخصص" value={data.professionName} />
          <Row label="سنوات الخبرة" value={String(data.yearsOfExperience)} numeric />
          <Row label="الوصف" value={data.bio} />
          <Row label="المركز" value={data.contact.city ?? '—'} />
          <Row label="العنوان" value={data.contact.addressLine ?? '—'} />
        </dl>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {data.coverageAreas.map((area) => (
            <span
              key={area}
              className="inline-flex items-center gap-1 rounded-pill bg-brand-50 px-2.5 py-1 text-badge font-semibold text-brand-600"
            >
              <MapPin size={12} aria-hidden="true" />
              {area}
            </span>
          ))}
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-label font-bold text-ink-900">المستندات</h4>

        {data.documents.length === 0 ? (
          <EmptyState message="لا توجد مستندات مرفوعة" compact />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.documents.map((document) => (
              <li
                key={document.id}
                className="flex items-center justify-between gap-2 rounded-field border border-border p-2"
              >
                <span className="min-w-0">
                  <span className="line-clamp-1 text-meta font-semibold text-ink-900">
                    {document.label}
                  </span>
                  <span className="num text-badge text-ink-400">
                    {document.format.toUpperCase()} · {Math.round(document.bytes / 1024)} KB
                  </span>
                </span>

                <Button
                  variant="secondary"
                  size="sm"
                  loading={openingId === document.id}
                  onClick={() => void openDocument(document.id)}
                  iconEnd={<ExternalLink size={14} />}
                >
                  فتح
                </Button>
              </li>
            ))}
          </ul>
        )}

        {!data.documentsState.isComplete && (
          <InfoAlert tone="warning" title="مستندات ناقصة" className="mt-2">
            {data.documentsState.missingRequired.join('، ')}
          </InfoAlert>
        )}
      </section>

      <section>
        <h4 className="mb-2 text-label font-bold text-ink-900">القرار</h4>

        <Field
          label="سبب الرفض أو التعديل"
          hint="مطلوب عند الرفض أو طلب إعادة الإرسال — يظهر لمقدم الخدمة"
          counter={{ current: reason.length, max: 500 }}
        >
          <Textarea
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="مثال: صورة بطاقة الرقم القومي غير واضحة، أعد رفعها بجودة أعلى."
          />
        </Field>

        {error && (
          <InfoAlert tone="danger" title="تعذّر تنفيذ القرار" className="mt-2">
            {error}
          </InfoAlert>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="success"
            loading={decide.isPending}
            onClick={() => void submitDecision('APPROVED')}
            iconStart={<BadgeCheck size={16} />}
          >
            اعتماد
          </Button>
          <Button
            size="sm"
            variant="warning"
            loading={decide.isPending}
            onClick={() => void submitDecision('RESUBMISSION_REQUIRED')}
            iconStart={<RotateCcw size={16} />}
          >
            طلب تعديل
          </Button>
          <Button
            size="sm"
            variant="danger"
            loading={decide.isPending}
            onClick={() => void submitDecision('REJECTED')}
            iconStart={<XCircle size={16} />}
          >
            رفض
          </Button>
        </div>

        {decide.isSuccess && (
          <InfoAlert tone="success" title="تم حفظ القرار" className="mt-2">
            أُخطر مقدم الخدمة، وسُجّل القرار في سجل التدقيق.
          </InfoAlert>
        )}
      </section>
    </div>
  );
}

function Row({ label, value, numeric = false }: { label: string; value: string; numeric?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-ink-400">{label}</dt>
      <dd className={`text-end font-semibold text-ink-900 ${numeric ? 'num' : ''}`}>{value}</dd>
    </div>
  );
}
