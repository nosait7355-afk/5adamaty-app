'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  Send,
} from 'lucide-react';
import { BackHeader } from '@/components/layout/back-header';
import { PageContainer, PageTitle } from '@/components/layout/page-container';
import { Button, LinkButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/badge';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Stepper } from '@/components/common/stepper';
import { InfoAlert } from '@/components/common/info-alert';
import { ErrorState } from '@/components/common/states';
import { MediaThumb } from '@/components/features/discovery/media-thumb';
import { ApiClientError } from '@/lib/api-client';
import { useProvider } from '@/lib/queries/discovery';
import { useCreateOrder } from '@/lib/queries/orders';
import {
  formatDate,
  formatOrderNumber,
  formatPrice,
  formatPriceRange,
  formatTimeRange,
} from '@/lib/format';
import { createOrderSchema } from '@/shared/schemas/order.schema';
import { FAYOUM_AREAS, FAYOUM_CITIES, GOVERNORATE } from '@/shared/constants/fayoum-areas';
import { PAYMENT_NOTICE_AR } from '@/shared/constants/order-status';

/**
 * طلب الخدمة — الصورتان 11 و12.
 *
 * الـStepper المرسوم أربع خطوات: تفاصيل ← تأكيد ← اختيار الوقت ← تم الإرسال.
 * الصورتان 11 و12 تغطيان الخطوتين 1 و4، والخطوتان 2 و3 تُبنيان من نفس
 * الـDesign System بلا عناصر جديدة (PROJECT_PLAN — Phase 7).
 *
 * التاريخ إلزامي والوقت اختياري: التاريخ يُدخَل في الخطوة 1 كما هو مرسوم،
 * والخطوة 3 تخصّص لضبط نافذة الوقت المفضّلة أو تخطّيها.
 */

const STEPS = [
  { label: 'تفاصيل الطلب' },
  { label: 'تأكيد الطلب' },
  { label: 'اختيار الوقت' },
  { label: 'تم الإرسال' },
];

/** نوافذ زمنية جاهزة — تختصر على المستخدم كتابة الوقت يدويًا. */
const TIME_SLOTS = [
  { label: 'صباحًا (9 – 12)', from: '09:00', to: '12:00' },
  { label: 'ظهرًا (12 – 3)', from: '12:00', to: '15:00' },
  { label: 'عصرًا (3 – 6)', from: '15:00', to: '18:00' },
  { label: 'مساءً (6 – 9)', from: '18:00', to: '21:00' },
];

interface FormValues {
  serviceType: string;
  details: string;
  notes: string;
  city: string;
  area: string;
  line: string;
  landmark: string;
  scheduledDate: string;
  preferredTimeFrom: string;
  preferredTimeTo: string;
}

const EMPTY: FormValues = {
  serviceType: '',
  details: '',
  notes: '',
  city: GOVERNORATE,
  area: '',
  line: '',
  landmark: '',
  scheduledDate: '',
  preferredTimeFrom: '',
  preferredTimeTo: '',
};

export default function NewOrderPage() {
  return (
    <Suspense fallback={<WizardFallback />}>
      <NewOrderWizard />
    </Suspense>
  );
}

function NewOrderWizard() {
  const searchParams = useSearchParams();
  const providerId = searchParams.get('providerId') ?? '';

  const [step, setStep] = useState(1);
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [createdNumber, setCreatedNumber] = useState<number | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const provider = useProvider(providerId || undefined);
  const createOrder = useCreateOrder();

  const areas = useMemo(() => FAYOUM_AREAS[values.city] ?? [], [values.city]);

  const patch = (next: Partial<FormValues>) => setValues((current) => ({ ...current, ...next }));

  /** التحقق من الخطوة 1 بنفس مخطط الخادم — رسالة واحدة لا رسالتان. */
  const validateDetails = (): boolean => {
    const result = createOrderSchema.safeParse(buildPayload());

    if (result.success) {
      setErrors({});
      return true;
    }

    const next: Record<string, string> = {};
    for (const issue of result.error.issues) {
      // مسارات العنوان مركّبة: address.area → area
      const key = String(issue.path.at(-1) ?? '_');
      next[key] ??= issue.message;
    }
    setErrors(next);

    // أخطاء الوقت تخصّ الخطوة 3 — لا تمنع مغادرة الخطوة 1
    const blocking = Object.keys(next).filter(
      (key) => !['preferredTimeFrom', 'preferredTimeTo'].includes(key)
    );
    return blocking.length === 0;
  };

  function buildPayload() {
    return {
      providerId,
      serviceType: values.serviceType,
      details: values.details,
      ...(values.notes ? { notes: values.notes } : {}),
      address: {
        governorate: GOVERNORATE,
        city: values.city,
        area: values.area,
        line: values.line,
        ...(values.landmark ? { landmark: values.landmark } : {}),
      },
      scheduledDate: values.scheduledDate,
      ...(values.preferredTimeFrom ? { preferredTimeFrom: values.preferredTimeFrom } : {}),
      ...(values.preferredTimeTo ? { preferredTimeTo: values.preferredTimeTo } : {}),
      attachmentPublicIds: [],
    };
  }

  const submit = async () => {
    setSubmitError('');
    try {
      const order = await createOrder.mutateAsync(buildPayload() as never);
      setCreatedNumber(order.orderNumber);
      setCreatedId(order.id);
      setStep(4);
    } catch (error) {
      setSubmitError(
        error instanceof ApiClientError ? error.message : 'تعذّر إرسال الطلب. حاول مرة أخرى.'
      );
    }
  };

  if (!providerId) {
    return (
      <>
        <BackHeader />
        <PageContainer className="pt-6">
          <ErrorState
            message="لم يُحدَّد مقدم الخدمة"
            description="ادخل إلى ملف مقدم الخدمة ثم اضغط «اطلب الخدمة»."
          />
          <LinkButton href="/categories" variant="secondary" fullWidth className="mt-4">
            تصفّح الخدمات
          </LinkButton>
        </PageContainer>
      </>
    );
  }

  const priceLabel =
    provider.data?.priceMode === 'RANGE' && provider.data.priceMin != null
      ? formatPriceRange(provider.data.priceMin, provider.data.priceMax)
      : 'يُحدَّد بعد الاتفاق';

  return (
    <>
      <BackHeader />

      <PageContainer withBottomNav={false} className="pb-10">
        <PageTitle
          title={step === 4 ? 'تم إرسال الطلب' : 'طلب الخدمة'}
          subtitle={`الخطوة ${step} من 4 — ${STEPS[step - 1]?.label ?? ''}`}
        />

        <Stepper steps={STEPS} current={step} className="mb-6" />

        {/* ---- بطاقة المزوّد — ثابتة في كل الخطوات كما في الصورتين ---- */}
        {provider.isPending ? (
          <Skeleton className="mb-4 h-20 w-full rounded-card" />
        ) : provider.data ? (
          <Card className="mb-4 flex items-center gap-3">
            <MediaThumb
              url={provider.data.gallery[0]}
              alt={provider.data.displayName}
              size={52}
              iconName={provider.data.professionIcon}
              rounded="full"
            />
            <div className="min-w-0 flex-1">
              <h2 className="line-clamp-1 text-card-title font-bold text-ink-900">
                {provider.data.displayName}
              </h2>
              <p className="text-meta text-ink-400">{provider.data.professionName}</p>
            </div>
            <div className="text-end">
              <p className="text-badge text-ink-400">السعر المبدئي</p>
              <p className="num text-label font-extrabold text-brand-600">{priceLabel}</p>
            </div>
          </Card>
        ) : null}

        {/* ================= الخطوة 1 — تفاصيل الطلب ================= */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <Field label="نوع الخدمة" required error={errors.serviceType}>
              <Input
                placeholder="مثال: إصلاح تسريب مياه"
                value={values.serviceType}
                invalid={Boolean(errors.serviceType)}
                onChange={(event) => patch({ serviceType: event.target.value })}
              />
            </Field>

            <Field
              label="تفاصيل الطلب"
              required
              counter={{ current: values.details.length, max: 500 }}
              error={errors.details}
            >
              <Textarea
                rows={4}
                maxLength={500}
                placeholder="اشرح المشكلة أو الخدمة المطلوبة بالتفصيل"
                value={values.details}
                invalid={Boolean(errors.details)}
                onChange={(event) => patch({ details: event.target.value })}
              />
            </Field>

            <Field label="المركز" required error={errors.city}>
              <Select
                icon={<MapPin size={20} />}
                value={values.city}
                onChange={(event) => patch({ city: event.target.value, area: '' })}
                options={FAYOUM_CITIES.map((city) => ({ value: city, label: city }))}
              />
            </Field>

            <Field label="المنطقة" required error={errors.area}>
              <Select
                placeholder="اختر المنطقة"
                value={values.area}
                invalid={Boolean(errors.area)}
                onChange={(event) => patch({ area: event.target.value })}
                options={areas.map((area) => ({ value: area, label: area }))}
              />
            </Field>

            <Field label="العنوان بالتفصيل" required error={errors.line}>
              <Textarea
                rows={2}
                maxLength={200}
                placeholder="الشارع، رقم العقار، الدور، الشقة"
                value={values.line}
                invalid={Boolean(errors.line)}
                onChange={(event) => patch({ line: event.target.value })}
              />
            </Field>

            <Field label="أقرب معلم" hint="اختياري">
              <Input
                placeholder="مثال: بجوار مسجد النور"
                value={values.landmark}
                onChange={(event) => patch({ landmark: event.target.value })}
              />
            </Field>

            <Field label="تاريخ الخدمة" required error={errors.scheduledDate}>
              <Input
                type="date"
                icon={<CalendarDays size={20} />}
                value={values.scheduledDate}
                invalid={Boolean(errors.scheduledDate)}
                onChange={(event) => patch({ scheduledDate: event.target.value })}
              />
            </Field>

            <Field label="ملاحظات إضافية" hint="اختياري">
              <Textarea
                rows={2}
                maxLength={500}
                placeholder="أي شيء يساعد مقدم الخدمة"
                value={values.notes}
                onChange={(event) => patch({ notes: event.target.value })}
              />
            </Field>

            <InfoAlert tone="warning" title="الدفع عند تنفيذ الخدمة">
              {PAYMENT_NOTICE_AR}
            </InfoAlert>
          </div>
        )}

        {/* ================= الخطوة 2 — تأكيد الطلب ================= */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <Card className="flex flex-col gap-2">
              <SummaryRow label="نوع الخدمة" value={values.serviceType} />
              <SummaryRow label="التفاصيل" value={values.details} />
              <SummaryRow
                label="العنوان"
                value={`${values.city} - ${values.area} - ${values.line}`}
              />
              {values.landmark && <SummaryRow label="أقرب معلم" value={values.landmark} />}
              <SummaryRow label="التاريخ" value={formatDate(values.scheduledDate)} numeric />
              {values.notes && <SummaryRow label="ملاحظات" value={values.notes} />}
              <SummaryRow label="قيمة الخدمة المبدئية" value={priceLabel} numeric />
            </Card>

            <Button variant="ghost" size="sm" className="w-fit" onClick={() => setStep(1)}>
              تعديل التفاصيل
            </Button>

            <InfoAlert tone="info" title="راجع بياناتك">
              تأكد من صحة العنوان والتاريخ قبل المتابعة — مقدم الخدمة سيعتمد عليهما.
            </InfoAlert>
          </div>
        )}

        {/* ================= الخطوة 3 — اختيار الوقت ================= */}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            <InfoAlert tone="info" title="الوقت اختياري">
              التاريخ محجوز بالفعل ({formatDate(values.scheduledDate)}). يمكنك اختيار نافذة زمنية
              مفضّلة أو تخطّي هذه الخطوة.
            </InfoAlert>

            <div className="flex flex-wrap gap-2">
              {TIME_SLOTS.map((slot) => (
                <Chip
                  key={slot.label}
                  icon={<Clock size={14} />}
                  selected={
                    values.preferredTimeFrom === slot.from && values.preferredTimeTo === slot.to
                  }
                  onClick={() =>
                    patch({ preferredTimeFrom: slot.from, preferredTimeTo: slot.to })
                  }
                >
                  {slot.label}
                </Chip>
              ))}
              <Chip
                selected={!values.preferredTimeFrom}
                onClick={() => patch({ preferredTimeFrom: '', preferredTimeTo: '' })}
              >
                أي وقت
              </Chip>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="من" error={errors.preferredTimeFrom}>
                <Input
                  type="time"
                  value={values.preferredTimeFrom}
                  invalid={Boolean(errors.preferredTimeFrom)}
                  onChange={(event) => patch({ preferredTimeFrom: event.target.value })}
                />
              </Field>
              <Field label="إلى" error={errors.preferredTimeTo}>
                <Input
                  type="time"
                  value={values.preferredTimeTo}
                  invalid={Boolean(errors.preferredTimeTo)}
                  onChange={(event) => patch({ preferredTimeTo: event.target.value })}
                />
              </Field>
            </div>

            {values.preferredTimeFrom && (
              <p className="num text-meta text-ink-600">
                الوقت المفضل:{' '}
                {formatTimeRange(
                  `${values.scheduledDate}T${values.preferredTimeFrom}`,
                  values.preferredTimeTo
                    ? `${values.scheduledDate}T${values.preferredTimeTo}`
                    : undefined
                )}
              </p>
            )}

            {submitError && (
              <InfoAlert tone="danger" title="تعذّر إرسال الطلب">
                {submitError}
              </InfoAlert>
            )}

            <InfoAlert tone="warning" title="الدفع عند تنفيذ الخدمة">
              {PAYMENT_NOTICE_AR}
            </InfoAlert>
          </div>
        )}

        {/* ================= الخطوة 4 — تم الإرسال (الصورة 12) ================= */}
        {step === 4 && createdNumber != null && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-center gap-3 text-center">
              <span className="flex size-20 items-center justify-center rounded-full bg-success-bg text-success">
                <CheckCircle2 size={44} />
              </span>
              <h2 className="text-screen-title font-extrabold text-ink-900">
                تم إرسال طلبك بنجاح!
              </h2>
              <p className="num text-body text-ink-400">
                رقم الطلب {formatOrderNumber(createdNumber)}
              </p>
            </div>

            <Card className="flex flex-col gap-2">
              <SummaryRow label="مقدم الخدمة" value={provider.data?.displayName ?? '—'} />
              <SummaryRow label="نوع الخدمة" value={values.serviceType} />
              <SummaryRow
                label="العنوان"
                value={`${values.city} - ${values.area} - ${values.line}`}
              />
              <SummaryRow label="التاريخ" value={formatDate(values.scheduledDate)} numeric />
              <SummaryRow
                label="الوقت المفضل"
                numeric
                value={
                  values.preferredTimeFrom
                    ? formatTimeRange(
                        `${values.scheduledDate}T${values.preferredTimeFrom}`,
                        values.preferredTimeTo
                          ? `${values.scheduledDate}T${values.preferredTimeTo}`
                          : undefined
                      )
                    : 'أي وقت'
                }
              />
              <SummaryRow
                label="قيمة الخدمة"
                numeric
                value={
                  provider.data?.priceMin != null ? formatPrice(provider.data.priceMin) : priceLabel
                }
              />
              <SummaryRow label="طريقة الدفع" value="كاش عند تنفيذ الخدمة" />
            </Card>

            <InfoAlert tone="warning" title="الدفع بعد تنفيذ الخدمة مباشرة">
              {PAYMENT_NOTICE_AR}
            </InfoAlert>

            <section>
              <h3 className="mb-2 text-section font-bold text-ink-900">ماذا يحدث الآن؟</h3>
              <Card>
                <ol className="flex list-inside list-decimal flex-col gap-2 text-meta text-ink-600">
                  <li>يستلم مقدم الخدمة طلبك ويراجعه.</li>
                  <li>يقبل الطلب أو يعتذر، ويصلك إشعار بالقرار.</li>
                  <li>بعد القبول يمكنك التواصل معه مباشرة لتأكيد التفاصيل.</li>
                </ol>
              </Card>
            </section>

            <div className="flex gap-3">
              <LinkButton href={createdId ? `/orders/${createdId}` : '/orders'} className="flex-1">
                عرض طلباتي
              </LinkButton>
              <LinkButton href="/home" variant="secondary" className="flex-1">
                العودة إلى الرئيسية
              </LinkButton>
            </div>
          </div>
        )}

        {/* ---- أزرار التنقّل ---- */}
        {step < 4 && (
          <div className="mt-6 flex gap-3">
            {step > 1 && (
              <Button
                variant="secondary"
                className="flex-1"
                disabled={createOrder.isPending}
                onClick={() => setStep((current) => current - 1)}
                iconStart={<ArrowRight size={20} />}
              >
                السابق
              </Button>
            )}

            {step === 1 && (
              <Button
                fullWidth
                onClick={() => {
                  if (validateDetails()) setStep(2);
                }}
                iconEnd={<ArrowLeft size={20} />}
              >
                التالي: تأكيد الطلب
              </Button>
            )}

            {step === 2 && (
              <Button
                className="flex-[2]"
                onClick={() => setStep(3)}
                iconEnd={<ArrowLeft size={20} />}
              >
                التالي: اختيار الوقت
              </Button>
            )}

            {step === 3 && (
              <Button
                className="flex-[2]"
                loading={createOrder.isPending}
                onClick={() => void submit()}
                iconEnd={<Send size={20} />}
              >
                إرسال الطلب
              </Button>
            )}
          </div>
        )}
      </PageContainer>
    </>
  );
}

function SummaryRow({
  label,
  value,
  numeric = false,
}: {
  label: string;
  value: string;
  numeric?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border pb-2 text-meta last:border-0 last:pb-0">
      <span className="shrink-0 text-ink-400">{label}</span>
      <span className={`text-end font-semibold text-ink-900 ${numeric ? 'num' : ''}`}>
        {value || '—'}
      </span>
    </div>
  );
}

function WizardFallback() {
  return (
    <>
      <BackHeader />
      <PageContainer withBottomNav={false} className="flex flex-col gap-4 pt-4">
        <Skeleton className="mx-auto h-8 w-48" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-20 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </PageContainer>
    </>
  );
}
