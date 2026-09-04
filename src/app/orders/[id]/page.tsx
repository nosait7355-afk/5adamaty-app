'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  Clock,
  MapPin,
  MessageSquare,
  Phone,
  RotateCcw,
  Share2,
  Wallet,
  XCircle,
} from 'lucide-react';
import { BackHeader } from '@/components/layout/back-header';
import { PageContainer } from '@/components/layout/page-container';
import { Card } from '@/components/ui/card';
import { Button, LinkButton } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/ui/field';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderStatusBadge } from '@/components/common/status-badge';
import { OrderTimeline } from '@/components/common/order-timeline';
import { InfoAlert } from '@/components/common/info-alert';
import { ErrorState } from '@/components/common/states';
import { MediaThumb } from '@/components/features/discovery/media-thumb';
import { ApiClientError } from '@/lib/api-client';
import { buildContactLinks, useCancelOrder, useOrder } from '@/lib/queries/orders';
import {
  formatDate,
  formatDateTime,
  formatOrderNumber,
  formatPrice,
  formatTimeRange,
} from '@/lib/format';
import { PAYMENT_METHOD_LABEL_AR } from '@/shared/constants/order-status';

/**
 * تفاصيل الطلب — الصورة 14.
 *
 * الخط الزمني مبنيّ من `statusHistory` القادم من الخادم حرفيًا — لا يُستنتج
 * ولا يُخمَّن في الواجهة، فما يُعرض هو ما حدث فعلًا.
 */
export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const order = useOrder(id);
  const cancel = useCancelOrder();

  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  if (order.isPending) {
    return (
      <>
        <BackHeader />
        <PageContainer className="flex flex-col gap-4 pt-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-24 w-full rounded-card" />
          <Skeleton className="h-56 w-full rounded-card" />
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
          <ErrorState
            message="تعذّر عرض الطلب"
            description="ربما لم يعد متاحًا أو لا يخصّ حسابك."
            onRetry={() => void order.refetch()}
          />
          <LinkButton href="/orders" variant="secondary" fullWidth className="mt-4">
            العودة إلى طلباتي
          </LinkButton>
        </PageContainer>
      </>
    );
  }

  const data = order.data;
  const contact = data.isContactUnlocked ? buildContactLinks(data.provider.phone) : null;

  const submitCancel = async () => {
    setError('');
    try {
      await cancel.mutateAsync({ orderId: id, ...(reason.trim() ? { reason: reason.trim() } : {}) });
      setShowCancel(false);
    } catch (cancelError) {
      setError(
        cancelError instanceof ApiClientError
          ? cancelError.message
          : 'تعذّر إلغاء الطلب. حاول مرة أخرى.'
      );
    }
  };

  const share = async () => {
    const text = `طلب ${formatOrderNumber(data.orderNumber)} — ${data.serviceType}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'خدماتي الفيوم', text, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(`${text}\n${window.location.href}`);
      }
    } catch {
      // إلغاء المشاركة من المستخدم ليس خطأ
    }
  };

  return (
    <>
      <BackHeader />

      <PageContainer className="flex flex-col gap-4 pb-10 pt-4">
        {/* ---- الترويسة ---- */}
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="num text-section font-extrabold text-ink-900">
              {formatOrderNumber(data.orderNumber)}
            </h1>
            <p className="num text-meta text-ink-400">{formatDateTime(data.createdAt)}</p>
          </div>
          <OrderStatusBadge status={data.status} />
        </header>

        {/* ---- بطاقة المزوّد ---- */}
        <Card className="flex items-center gap-3">
          <MediaThumb
            url={data.provider.avatar}
            alt={data.provider.displayName}
            size={56}
            rounded="full"
          />
          <div className="min-w-0 flex-1">
            <h2 className="line-clamp-1 text-card-title font-bold text-ink-900">
              {data.provider.displayName}
            </h2>
            <Link
              href={`/providers/${data.provider.id}`}
              className="text-meta font-semibold text-brand-600"
            >
              عرض الملف
            </Link>
          </div>

          {contact ? (
            <div className="flex gap-2">
              <a
                href={contact.call}
                aria-label="اتصال مباشر"
                className="flex size-11 items-center justify-center rounded-field border border-border text-brand-600 transition-colors hover:bg-brand-50"
              >
                <Phone size={20} />
              </a>
              <a
                href={contact.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="تواصل واتساب"
                className="flex size-11 items-center justify-center rounded-field border border-border text-whatsapp transition-colors hover:bg-success-bg"
              >
                <MessageSquare size={20} />
              </a>
            </div>
          ) : (
            <span className="max-w-[110px] text-badge text-ink-400">
              يتاح التواصل بعد قبول مقدم الخدمة
            </span>
          )}
        </Card>

        {/* ---- تفاصيل الخدمة ---- */}
        <section aria-label="تفاصيل الخدمة">
          <h2 className="mb-2 text-section font-bold text-ink-900">تفاصيل الخدمة</h2>
          <Card className="flex flex-col gap-2">
            <DetailRow label="نوع الخدمة" value={data.serviceType} />
            <DetailRow label="التفاصيل" value={data.details} />
            {data.notes && <DetailRow label="ملاحظات" value={data.notes} />}
            <DetailRow
              label="العنوان"
              value={`${data.address.city} - ${data.address.area} - ${data.address.line}`}
              icon={<MapPin size={16} />}
            />
            <DetailRow
              label="التاريخ"
              value={formatDate(data.scheduledDate)}
              icon={<CalendarDays size={16} />}
              numeric
            />
            {data.preferredTimeFrom && (
              <DetailRow
                label="الوقت المفضل"
                value={formatTimeRange(
                  `${data.scheduledDate.slice(0, 10)}T${data.preferredTimeFrom}`,
                  data.preferredTimeTo
                    ? `${data.scheduledDate.slice(0, 10)}T${data.preferredTimeTo}`
                    : undefined
                )}
                icon={<Clock size={16} />}
                numeric
              />
            )}
            {data.agreedPrice != null && (
              <DetailRow
                label="قيمة الخدمة"
                value={formatPrice(data.agreedPrice)}
                icon={<Wallet size={16} />}
                numeric
              />
            )}
            <DetailRow label="طريقة الدفع" value={PAYMENT_METHOD_LABEL_AR} />
          </Card>
        </section>

        {/* ---- المرفقات ---- */}
        {data.attachments.length > 0 && (
          <section aria-label="المرفقات">
            <h2 className="mb-2 text-section font-bold text-ink-900">المرفقات</h2>
            <div className="grid grid-cols-3 gap-2">
              {data.attachments.map((url) => (
                <MediaThumb
                  key={url}
                  url={url}
                  alt="مرفق الطلب"
                  size={104}
                  rounded="field"
                  className="w-full"
                />
              ))}
            </div>
          </section>
        )}

        {/* ---- الخط الزمني ---- */}
        <section aria-label="مسار الطلب">
          <h2 className="mb-2 text-section font-bold text-ink-900">مسار الطلب</h2>
          <Card>
            <OrderTimeline
              items={data.timeline.map((entry, index) => ({
                title: entry.label,
                ...(entry.note ? { description: entry.note } : {}),
                timestamp: formatDateTime(entry.at),
                state: index === data.timeline.length - 1 ? 'current' : 'done',
              }))}
            />
          </Card>
        </section>

        {/* ---- تنبيه الدفع الأصفر — إلزامي في الصورة 14 ---- */}
        <InfoAlert tone="warning" title="الدفع بعد تنفيذ الخدمة">
          لا يوجد دفع داخل التطبيق. تدفع قيمة الخدمة كاش مباشرة لمقدم الخدمة بعد إتمام العمل.
        </InfoAlert>

        {/* ---- الإجراءات ---- */}
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <LinkButton
              href={`/orders/new?providerId=${data.provider.id}`}
              variant="secondary"
              className="flex-1"
              iconStart={<RotateCcw size={18} />}
            >
              طلب مرة أخرى
            </LinkButton>
            <Button
              variant="neutral"
              className="flex-1"
              onClick={() => void share()}
              iconStart={<Share2 size={18} />}
            >
              مشاركة الطلب
            </Button>
          </div>

          {data.canCancel && !showCancel && (
            <Button
              variant="danger"
              fullWidth
              onClick={() => setShowCancel(true)}
              iconStart={<XCircle size={18} />}
            >
              إلغاء الطلب
            </Button>
          )}

          {showCancel && (
            <Card className="flex flex-col gap-3 border-danger/30">
              <Field label="سبب الإلغاء" hint="اختياري — يساعد مقدم الخدمة على التحسين">
                <Textarea
                  rows={3}
                  maxLength={300}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="مثال: تغيّر موعدي"
                />
              </Field>

              {error && (
                <InfoAlert tone="danger" title="تعذّر الإلغاء">
                  {error}
                </InfoAlert>
              )}

              <div className="flex gap-3">
                <Button
                  variant="neutral"
                  className="flex-1"
                  onClick={() => setShowCancel(false)}
                  disabled={cancel.isPending}
                >
                  تراجع
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  loading={cancel.isPending}
                  onClick={() => void submitCancel()}
                >
                  تأكيد الإلغاء
                </Button>
              </div>
            </Card>
          )}

          {data.cancellationReason && (
            <InfoAlert tone="danger" title="سبب الإلغاء">
              {data.cancellationReason}
            </InfoAlert>
          )}
        </div>
      </PageContainer>
    </>
  );
}

function DetailRow({
  label,
  value,
  icon,
  numeric = false,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  numeric?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border pb-2 last:border-0 last:pb-0">
      <span className="inline-flex shrink-0 items-center gap-1.5 text-meta text-ink-400">
        {icon && <span className="text-brand-600">{icon}</span>}
        {label}
      </span>
      <span className={`text-end text-meta font-semibold text-ink-900 ${numeric ? 'num' : ''}`}>
        {value}
      </span>
    </div>
  );
}
