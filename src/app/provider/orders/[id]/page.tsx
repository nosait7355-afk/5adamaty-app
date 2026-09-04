'use client';

import { use, useState } from 'react';
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  MessageSquare,
  Phone,
  Share2,
  Truck,
  User,
  Wallet,
  XCircle,
} from 'lucide-react';
import { BackHeader } from '@/components/layout/back-header';
import { PageContainer } from '@/components/layout/page-container';
import { Card } from '@/components/ui/card';
import { Button, LinkButton } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderStatusBadge } from '@/components/common/status-badge';
import { StatusStepperH } from '@/components/common/status-stepper-h';
import { InfoAlert } from '@/components/common/info-alert';
import { EmptyState, ErrorState } from '@/components/common/states';
import { MediaThumb } from '@/components/features/discovery/media-thumb';
import { ApiClientError } from '@/lib/api-client';
import { buildContactLinks } from '@/lib/queries/orders';
import {
  useCompleteOrder,
  useProviderOrder,
  useUpdateOrderStatus,
} from '@/lib/queries/provider-orders';
import {
  formatDate,
  formatDateTime,
  formatOrderNumber,
  formatPrice,
  formatTimeRange,
} from '@/lib/format';
import {
  PAYMENT_METHOD_LABEL_AR,
  PAYMENT_NOTICE_AR,
  type OrderStatus,
} from '@/shared/constants/order-status';
import { cn } from '@/lib/cn';
import type { ProviderStatusAction } from '@/shared/schemas/order.schema';

/**
 * تفاصيل الطلب — مقدم الخدمة (الصور 26 إلى 29).
 *
 * شاشة واحدة تتغيّر منطقة الإجراء فيها بحسب الحالة، تمامًا كما تتسلسل
 * الصور الأربع: «جديد» ← قبول/رفض (26) · قيد التنفيذ ← شبكة الحالات (27)
 * · جاهز للإكمال ← صندوق التأكيد الأخضر (28) وتأكيد استلام المبلغ (29).
 *
 * ⚠️ «في الطريق» تغيير حالة يدوي بحت — لا GPS ولا موقع ولا ETA ولا مسافة.
 */
export default function ProviderOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const order = useProviderOrder(id);
  const updateStatus = useUpdateOrderStatus();
  const complete = useCompleteOrder();

  const [selectedStatus, setSelectedStatus] = useState<ProviderStatusAction | null>(null);
  const [note, setNote] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [serviceDone, setServiceDone] = useState(false);
  const [cashReceived, setCashReceived] = useState(false);
  const [error, setError] = useState('');

  if (order.isPending) {
    return (
      <>
        <BackHeader />
        <PageContainer className="flex flex-col gap-4 pt-4">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-32 w-full rounded-card" />
          <Skeleton className="h-48 w-full rounded-card" />
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
          <LinkButton href="/provider/orders" variant="secondary" fullWidth className="mt-4">
            العودة إلى طلباتي
          </LinkButton>
        </PageContainer>
      </>
    );
  }

  const data = order.data;
  const contact = buildContactLinks(data.customer.phone);
  const canComplete = data.canComplete;
  const isNew = data.status === 'NEW';

  /* طوابع زمنية لكل مرحلة — من `statusHistory` لا من التخمين */
  const timestamps: Partial<Record<OrderStatus, string>> = {};
  for (const entry of data.timeline) {
    timestamps[entry.status] = formatDateTime(entry.at);
  }

  const runStatus = async (status: ProviderStatusAction) => {
    setError('');
    try {
      await updateStatus.mutateAsync({
        orderId: id,
        status,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setSelectedStatus(null);
      setRejecting(false);
      setNote('');
    } catch (mutationError) {
      setError(
        mutationError instanceof ApiClientError
          ? mutationError.message
          : 'تعذّر تحديث الحالة. حاول مرة أخرى.'
      );
    }
  };

  const runComplete = async () => {
    setError('');
    try {
      await complete.mutateAsync({ orderId: id, ...(note.trim() ? { note: note.trim() } : {}) });
      setNote('');
    } catch (mutationError) {
      setError(
        mutationError instanceof ApiClientError
          ? mutationError.message
          : 'تعذّر إكمال الطلب. حاول مرة أخرى.'
      );
    }
  };

  const busy = updateStatus.isPending || complete.isPending;

  return (
    <>
      <BackHeader />

      <PageContainer className="flex flex-col gap-4 pb-10 pt-4" withBottomNav={false}>
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="num text-section font-extrabold text-ink-900">
              {formatOrderNumber(data.orderNumber)}
            </h1>
            <p className="num text-meta text-ink-400">{formatDateTime(data.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <OrderStatusBadge status={data.status} />
            <button
              type="button"
              aria-label="مشاركة الطلب"
              onClick={() => void navigator.clipboard?.writeText(window.location.href)}
              className="flex size-9 items-center justify-center rounded-field border border-border text-ink-600 transition-colors hover:text-brand-600"
            >
              <Share2 size={16} />
            </button>
          </div>
        </header>

        <StatusStepperH status={data.status} timestamps={timestamps} className="py-2" />

        {/* ---- تنبيه الدفع — إلزامي في الصور 27 و28 و29 ---- */}
        <InfoAlert tone="warning" title="لا يوجد دفع أونلاين">
          {PAYMENT_NOTICE_AR}
        </InfoAlert>

        {/* ---- بطاقة العميل ---- */}
        <section aria-label="بيانات العميل">
          <h2 className="mb-2 text-section font-bold text-ink-900">العميل</h2>
          <Card className="flex flex-col gap-2">
            <Row icon={<User size={16} />} label="الاسم" value={data.customer.fullName} />
            {data.customer.phone && (
              <Row icon={<Phone size={16} />} label="الهاتف" value={data.customer.phone} numeric />
            )}
            <Row
              icon={<MapPin size={16} />}
              label="موقع الخدمة"
              value={`${data.address.governorate} - ${data.address.city} - ${data.address.area} - ${data.address.line}`}
            />
            {data.address.landmark && (
              <Row label="أقرب معلم" value={data.address.landmark} />
            )}

            {contact && (
              <div className="mt-1 flex gap-2">
                <a
                  href={contact.call}
                  className="flex flex-1 items-center justify-center gap-2 rounded-field border border-border py-2 text-meta font-semibold text-brand-600 transition-colors hover:bg-brand-50"
                >
                  <Phone size={16} />
                  اتصال
                </a>
                <a
                  href={contact.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-2 rounded-field border border-border py-2 text-meta font-semibold text-whatsapp transition-colors hover:bg-success-bg"
                >
                  <MessageSquare size={16} />
                  واتساب
                </a>
              </div>
            )}
          </Card>
        </section>

        {/* ---- تفاصيل الخدمة ---- */}
        <section aria-label="تفاصيل الخدمة">
          <h2 className="mb-2 text-section font-bold text-ink-900">تفاصيل الخدمة</h2>
          <Card className="flex flex-col gap-2">
            <Row label="نوع الخدمة" value={data.serviceType} />
            <Row label="الوصف" value={data.details} />
            <Row
              icon={<CalendarDays size={16} />}
              label="التاريخ"
              value={formatDate(data.scheduledDate)}
              numeric
            />
            {data.preferredTimeFrom && (
              <Row
                icon={<Clock size={16} />}
                label="الوقت المفضل"
                numeric
                value={formatTimeRange(
                  `${data.scheduledDate.slice(0, 10)}T${data.preferredTimeFrom}`,
                  data.preferredTimeTo
                    ? `${data.scheduledDate.slice(0, 10)}T${data.preferredTimeTo}`
                    : undefined
                )}
              />
            )}
            {data.agreedPrice != null && (
              <Row
                icon={<Wallet size={16} />}
                label="القيمة المتفق عليها"
                value={formatPrice(data.agreedPrice)}
                numeric
              />
            )}
            <Row label="طريقة الدفع" value={PAYMENT_METHOD_LABEL_AR} />
            {data.notes && <Row label="ملاحظات العميل" value={data.notes} />}
          </Card>
        </section>

        {/* ---- المرفقات ---- */}
        <section aria-label="المرفقات">
          <h2 className="mb-2 text-section font-bold text-ink-900">المرفقات</h2>
          {data.attachments.length === 0 ? (
            <Card>
              <EmptyState message="لا توجد مرفقات مع هذا الطلب" compact />
            </Card>
          ) : (
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
          )}
        </section>

        {error && (
          <InfoAlert tone="danger" title="تعذّر تنفيذ الإجراء">
            {error}
          </InfoAlert>
        )}

        {/* ================= منطقة الإجراء ================= */}

        {/* --- الصورة 26: طلب جديد --- */}
        {isNew && !rejecting && (
          <div className="flex flex-col gap-3">
            <InfoAlert tone="info" title="تعليمات هامة">
              راجع تفاصيل الطلب والعنوان قبل القبول. بعد القبول يمكن للعميل التواصل معك مباشرة.
            </InfoAlert>

            <Button
              fullWidth
              loading={updateStatus.isPending}
              onClick={() => void runStatus('ACCEPTED')}
              iconStart={<CheckCircle2 size={20} />}
            >
              قبول الطلب
            </Button>
            <Button
              variant="danger"
              fullWidth
              disabled={busy}
              onClick={() => setRejecting(true)}
              iconStart={<XCircle size={20} />}
            >
              رفض الطلب
            </Button>
          </div>
        )}

        {/* --- الرفض بسبب --- */}
        {rejecting && (
          <Card className="flex flex-col gap-3 border-danger/30">
            <Field label="سبب الرفض" required hint="يصل نصّه للعميل">
              <Textarea
                rows={3}
                maxLength={300}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="مثال: مرتبط بموعد آخر في نفس اليوم"
              />
            </Field>
            <div className="flex gap-3">
              <Button
                variant="neutral"
                className="flex-1"
                disabled={busy}
                onClick={() => {
                  setRejecting(false);
                  setNote('');
                }}
              >
                تراجع
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                loading={updateStatus.isPending}
                disabled={note.trim().length === 0}
                onClick={() => void runStatus('REJECTED')}
              >
                تأكيد الرفض
              </Button>
            </div>
          </Card>
        )}

        {/* --- الصورة 27: شبكة تحديث الحالة --- */}
        {!isNew && data.availableActions.length > 0 && !canComplete && (
          <section aria-label="تحديث حالة الطلب">
            <h2 className="mb-2 text-section font-bold text-ink-900">تحديث حالة الطلب</h2>
            <div className="grid grid-cols-2 gap-2">
              {data.availableActions.includes('IN_PROGRESS') && (
                <StatusTile
                  label="قيد التنفيذ"
                  icon={<Clock size={20} />}
                  selected={selectedStatus === 'IN_PROGRESS'}
                  onClick={() => setSelectedStatus('IN_PROGRESS')}
                />
              )}
              {data.availableActions.includes('ON_THE_WAY') && (
                <StatusTile
                  label="في الطريق"
                  icon={<Truck size={20} />}
                  selected={selectedStatus === 'ON_THE_WAY'}
                  onClick={() => setSelectedStatus('ON_THE_WAY')}
                />
              )}
            </div>

            <Button
              fullWidth
              variant="warning"
              className="mt-3"
              loading={updateStatus.isPending}
              disabled={!selectedStatus}
              onClick={() => selectedStatus && void runStatus(selectedStatus)}
            >
              حفظ تحديث حالة الطلب — سيتم إشعار العميل
            </Button>
          </section>
        )}

        {/* --- الصورتان 28 و29: الإكمال بتأكيد استلام المبلغ --- */}
        {canComplete && (
          <section aria-label="إكمال الطلب">
            <h2 className="mb-2 text-section font-bold text-ink-900">أنت على وشك إكمال الطلب</h2>

            <Card className="flex flex-col gap-3 border-success/30 bg-success-bg/40">
              <h3 className="flex items-center gap-2 text-card-title font-bold text-success">
                <BadgeCheck size={20} aria-hidden="true" />
                تأكيد إكمال الخدمة
              </h3>

              <Checkbox
                id="service-done"
                checked={serviceDone}
                onChange={(event) => setServiceDone(event.target.checked)}
                label="تمت الخدمة بالكامل كما اتفقنا مع العميل."
              />

              <Checkbox
                id="cash-received"
                checked={cashReceived}
                onChange={(event) => setCashReceived(event.target.checked)}
                label="أؤكد أنني استلمت المبلغ المتفق عليه من العميل مباشرة."
              />

              <p className="rounded-field bg-surface px-3 py-2 text-badge leading-5 text-ink-600">
                التطبيق لا يوفر أي خدمة دفع إلكترونية. هذا التأكيد **إفادة** بأن الدفع تمّ نقدًا
                خارج التطبيق، ولا يُنشئ أي معاملة مالية.
              </p>

              {data.availableActions.includes('ON_THE_WAY') && (
                <Button
                  variant="secondary"
                  size="md"
                  disabled={busy}
                  onClick={() => void runStatus('ON_THE_WAY')}
                >
                  تغيير الحالة إلى «في الطريق»
                </Button>
              )}

              <Button
                variant="success"
                fullWidth
                loading={complete.isPending}
                disabled={!serviceDone || !cashReceived}
                onClick={() => void runComplete()}
                iconStart={<CheckCircle2 size={20} />}
              >
                إكمال الطلب
              </Button>
            </Card>
          </section>
        )}

        {/* --- حالة نهائية --- */}
        {data.availableActions.length === 0 && (
          <InfoAlert
            tone={data.status === 'COMPLETED' ? 'success' : 'danger'}
            title={data.status === 'COMPLETED' ? 'الطلب مكتمل' : 'الطلب منتهٍ'}
          >
            {data.status === 'COMPLETED'
              ? 'تم إكمال الطلب وتأكيد استلام المبلغ. سيصل تقييم العميل قريبًا.'
              : (data.cancellationReason ?? 'لم يعد بالإمكان اتخاذ أي إجراء على هذا الطلب.')}
          </InfoAlert>
        )}
      </PageContainer>
    </>
  );
}

/* ---- عناصر داخلية ---- */

function Row({
  icon,
  label,
  value,
  numeric = false,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  numeric?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border pb-2 text-meta last:border-0 last:pb-0">
      <span className="inline-flex shrink-0 items-center gap-1.5 text-ink-400">
        {icon && <span className="text-brand-600">{icon}</span>}
        {label}
      </span>
      <span className={cn('text-end font-semibold text-ink-900', numeric && 'num')}>{value}</span>
    </div>
  );
}

function StatusTile({
  label,
  icon,
  selected,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'flex flex-col items-center gap-2 rounded-field border-2 p-4 transition-colors',
        selected
          ? 'border-brand-600 bg-brand-50 text-brand-600'
          : 'border-border bg-surface text-ink-600 hover:bg-bg'
      )}
    >
      {icon}
      <span className="text-label font-semibold">{label}</span>
    </button>
  );
}
