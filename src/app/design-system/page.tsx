'use client';

import { useState } from 'react';
import {
  Calendar,
  Lock,
  Mail,
  MapPin,
  Phone,
  Star,
  User,
} from 'lucide-react';
import { AppHeader } from '@/components/layout/app-header';
import { BackHeader } from '@/components/layout/back-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PageContainer, PageTitle } from '@/components/layout/page-container';
import { Button, type ButtonVariant } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Checkbox, Radio } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Card, SectionHeader } from '@/components/ui/card';
import { Badge, Chip } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { OrderCardSkeleton, ServiceCardSkeleton, Skeleton } from '@/components/ui/skeleton';
import { InfoAlert } from '@/components/common/info-alert';
import { EmptyState, ErrorState } from '@/components/common/states';
import { OrderStatusBadge, VerificationBadge } from '@/components/common/status-badge';
import { Stepper } from '@/components/common/stepper';
import { OrderTimeline } from '@/components/common/order-timeline';
import { ORDER_STATUSES } from '@/shared/constants/order-status';
import { VERIFICATION_STATUSES } from '@/shared/constants/roles';
import { ALL_FAYOUM_AREAS } from '@/shared/constants/fayoum-areas';
import {
  formatAddress,
  formatDate,
  formatExperience,
  formatOrderNumber,
  formatPhone,
  formatPriceFrom,
  formatRating,
  formatRelativeTime,
  formatServicesCount,
  formatTimeRange,
} from '@/lib/format';

const BUTTON_VARIANTS: ButtonVariant[] = [
  'primary',
  'secondary',
  'success',
  'danger',
  'warning',
  'neutral',
  'ghost',
];

const TOKENS = [
  ['brand-600', 'bg-brand-600'],
  ['brand-500', 'bg-brand-500'],
  ['brand-700', 'bg-brand-700'],
  ['brand-50', 'bg-brand-50'],
  ['ink-900', 'bg-ink-900'],
  ['ink-600', 'bg-ink-600'],
  ['ink-400', 'bg-ink-400'],
  ['bg', 'bg-bg'],
  ['border', 'bg-border'],
  ['success', 'bg-success'],
  ['warning', 'bg-warning'],
  ['danger', 'bg-danger'],
  ['purple', 'bg-purple'],
  ['star', 'bg-star'],
  ['whatsapp', 'bg-whatsapp'],
] as const;

/**
 * صفحة معاينة نظام التصميم (Phase 1).
 * تعرض كل مكوّن في حالاته للمراجعة البصرية مقابل الصور المرجعية.
 * تُحذف أو تُقيَّد بالإدارة قبل الإطلاق في Phase 10.
 */
export default function DesignSystemPage() {
  const [chip, setChip] = useState('all');
  const [notes, setNotes] = useState('');

  return (
    <>
      <AppHeader notificationCount={3} />

      <PageContainer>
        <PageTitle title="نظام التصميم" subtitle="معاينة مكوّنات Phase 1 مقابل الصور المرجعية" />

        {/* ---------- Colors ---------- */}
        <Section title="الألوان">
          <div className="grid grid-cols-4 gap-3">
            {TOKENS.map(([name, cls]) => (
              <div key={name} className="flex flex-col items-center gap-1">
                <div className={`size-14 rounded-field border border-border ${cls}`} />
                <span className="text-[10px] text-ink-400">{name}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ---------- Typography ---------- */}
        <Section title="الخطوط">
          <Card className="flex flex-col gap-3">
            <p className="text-screen-title font-extrabold text-ink-900">عنوان الشاشة 28/800</p>
            <p className="text-section font-bold text-ink-900">عنوان قسم 18/700</p>
            <p className="text-card-title font-bold text-ink-900">عنوان بطاقة 17/700</p>
            <p className="text-body text-ink-600">نص أساسي 15/400 — كل الخدمات في مكان واحد</p>
            <p className="text-label font-semibold text-ink-900">تسمية حقل 14/600</p>
            <p className="text-meta text-ink-400">نص ثانوي 13/400</p>
            <p className="text-badge font-semibold text-ink-400">شارة 12/600</p>
          </Card>
        </Section>

        {/* ---------- Formatting ---------- */}
        <Section title="التنسيق (أرقام لاتينية داخل نص عربي)">
          <Card className="flex flex-col gap-2 text-label text-ink-600">
            <Row label="السعر" value={formatPriceFrom(150)} />
            <Row label="التقييم" value={`${formatRating(4.83)} ⭐`} />
            <Row label="رقم الطلب" value={formatOrderNumber(10245)} />
            <Row label="الهاتف" value={formatPhone('01012345678')} />
            <Row label="التاريخ" value={formatDate('2024-05-23T09:15:00')} />
            <Row
              label="الوقت"
              value={formatTimeRange('2024-05-23T10:00:00', '2024-05-23T12:00:00')}
            />
            {/* تاريخان ثابتان — استدعاء Date.now() أثناء الرسم غير نقي */}
            <Row
              label="وقت نسبي"
              value={formatRelativeTime('2025-05-02T11:15:00', new Date('2025-05-02T12:00:00'))}
            />
            <Row label="الخبرة" value={formatExperience(10)} />
            <Row label="عدد الخدمات" value={formatServicesCount(124)} />
            <Row
              label="العنوان"
              value={formatAddress({
                governorate: 'الفيوم',
                area: 'حي الجامعة',
                line: 'شارع أحمد شوقي',
                landmark: 'بجوار مدرسة النور',
              })}
            />
          </Card>
        </Section>

        {/* ---------- Buttons ---------- */}
        <Section title="الأزرار">
          <div className="flex flex-col gap-3">
            {BUTTON_VARIANTS.map((variant) => (
              <div key={variant} className="flex flex-wrap items-center gap-2">
                <Button variant={variant} size="sm">
                  {variant}
                </Button>
                <Button variant={variant} size="md">
                  عادي
                </Button>
                <Button variant={variant} size="lg" disabled>
                  معطّل
                </Button>
                <Button variant={variant} size="lg" loading>
                  تحميل
                </Button>
              </div>
            ))}
            <Button fullWidth iconStart={<User size={20} />}>
              زر بعرض كامل مع أيقونة
            </Button>
          </div>
        </Section>

        {/* ---------- Form controls ---------- */}
        <Section title="الحقول">
          <Card className="flex flex-col gap-4">
            <Field label="رقم الهاتف أو البريد الإلكتروني" required htmlFor="d-login">
              <Input id="d-login" icon={<Mail size={20} />} placeholder="أدخل رقم الهاتف أو البريد" />
            </Field>

            <Field label="كلمة المرور" required htmlFor="d-pass">
              <Input
                id="d-pass"
                type="password"
                togglePassword
                icon={<Lock size={20} />}
                placeholder="أدخل كلمة المرور"
              />
            </Field>

            <Field label="حقل بحالة خطأ" required htmlFor="d-err" error="هذا الحقل مطلوب">
              <Input id="d-err" invalid icon={<Phone size={20} />} placeholder="010 1234 5678" />
            </Field>

            <Field label="المنطقة / الحي" required htmlFor="d-area">
              <Select
                id="d-area"
                icon={<MapPin size={20} />}
                placeholder="اختر منطقتك أو الحي"
                defaultValue=""
                options={ALL_FAYOUM_AREAS.map((a) => ({ value: a, label: a }))}
              />
            </Field>

            <Field
              label="تفاصيل الطلب"
              required
              htmlFor="d-notes"
              counter={{ current: notes.length, max: 500 }}
            >
              <Textarea
                id="d-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="اكتب تفاصيل الطلب…"
                rows={4}
              />
            </Field>

            <Field label="حقل معطّل" htmlFor="d-dis">
              <Input id="d-dis" disabled icon={<Calendar size={20} />} placeholder="غير متاح" />
            </Field>

            <div className="flex flex-col gap-3">
              <Checkbox id="d-remember" label="تذكرني" />
              <Checkbox
                id="d-terms"
                defaultChecked
                label="أوافق على الشروط والأحكام وسياسة الخصوصية"
              />
              <div className="flex gap-6">
                <Radio id="d-m" name="d-gender" label="ذكر" defaultChecked />
                <Radio id="d-f" name="d-gender" label="أنثى" />
              </div>
            </div>
          </Card>
        </Section>

        {/* ---------- Badges & chips ---------- */}
        <Section title="الشارات والأقراص">
          <Card className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {ORDER_STATUSES.map((s) => (
                <OrderStatusBadge key={s} status={s} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {VERIFICATION_STATUSES.map((s) => (
                <VerificationBadge key={s} status={s} />
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="brand" icon={<Star size={12} />}>
                موثّق
              </Badge>
              <Badge tone="neutral">تنظيف</Badge>
            </div>
            <div className="scroll-x flex gap-2">
              {[
                ['all', 'الكل', 6],
                ['progress', 'قيد التنفيذ', 3],
                ['done', 'مكتملة', 2],
                ['cancelled', 'ملغاة', 1],
              ].map(([key, label, count]) => (
                <Chip
                  key={key as string}
                  selected={chip === key}
                  onClick={() => setChip(key as string)}
                  count={count as number}
                >
                  {label as string}
                </Chip>
              ))}
            </div>
          </Card>
        </Section>

        {/* ---------- Alerts ---------- */}
        <Section title="التنبيهات">
          <div className="flex flex-col gap-3">
            <InfoAlert tone="warning" title="ملاحظة هامة">
              لا يوجد دفع أونلاين في تطبيق خدماتي الفيوم. يتم الدفع مباشرة بينك وبين العميل خارج
              التطبيق.
            </InfoAlert>
            <InfoAlert tone="success" title="تأكيد إكمال الخدمة">
              تأكد من أن الخدمة تمت بالكامل وفقًا للاتفاق.
            </InfoAlert>
            <InfoAlert tone="brand" title="معلوماتك آمنة معنا">
              نحن نحافظ على خصوصية بياناتك ولا نشاركها مع أي جهة أخرى.
            </InfoAlert>
            <InfoAlert tone="info">
              سيتم مراجعة مستنداتك خلال 24 ساعة عمل، وستصلك إشعارة بنتيجة المراجعة.
            </InfoAlert>
            <InfoAlert tone="danger" title="تم رفض الطلب">
              برجاء مراجعة المستندات وإعادة الإرسال.
            </InfoAlert>
          </div>
        </Section>

        {/* ---------- Stepper ---------- */}
        <Section title="مؤشر الخطوات">
          <Card className="flex flex-col gap-8">
            <Stepper
              current={1}
              steps={[
                { label: 'تفاصيل الطلب' },
                { label: 'تأكيد الطلب' },
                { label: 'اختيار الوقت' },
                { label: 'تم الإرسال' },
              ]}
            />
            <Stepper
              current={3}
              steps={[
                { label: 'البيانات الأساسية' },
                { label: 'بيانات المهنة والخدمة' },
                { label: 'المستندات' },
                { label: 'مراجعة الطلب' },
              ]}
            />
            <Stepper
              current={4}
              steps={[
                { label: 'تم إنشاء الطلب', hint: '04:15 م' },
                { label: 'قيد التنفيذ', hint: '04:30 م' },
                { label: 'في الطريق', hint: '05:00 م' },
                { label: 'مكتمل', hint: 'فقط الآن' },
              ]}
            />
          </Card>
        </Section>

        {/* ---------- Timeline ---------- */}
        <Section title="الخط الزمني للطلب">
          <Card>
            <OrderTimeline
              items={[
                {
                  title: 'تم إرسال الطلب',
                  description: 'تم استلام طلبك وجارٍ مراجعته',
                  timestamp: '09:15 ص',
                  state: 'done',
                },
                {
                  title: 'تم قبول الطلب',
                  description: 'تم قبول طلبك من قبل مقدم الخدمة',
                  timestamp: '09:25 ص',
                  state: 'done',
                },
                {
                  title: 'جاري تنفيذ الخدمة',
                  description: 'مقدم الخدمة يعمل حاليًا على الطلب',
                  timestamp: '10:05 ص',
                  state: 'current',
                },
                {
                  title: 'تم إنجاز الطلب',
                  description: 'سيتم إشعارك عند الانتهاء',
                  state: 'pending',
                },
              ]}
            />
          </Card>
        </Section>

        {/* ---------- States ---------- */}
        <Section title="الحالات">
          <div className="flex flex-col gap-4">
            <SectionHeader
              title="التحميل"
              action={<span className="text-label text-brand-600">عرض الكل</span>}
            />
            <ServiceCardSkeleton />
            <OrderCardSkeleton />
            <div className="flex items-center gap-3">
              <Spinner size={20} className="text-brand-600" />
              <span className="text-meta text-brand-600">جاري التحميل…</span>
              <Skeleton className="h-4 flex-1" />
            </div>

            <Card flush>
              <EmptyState
                message="لا توجد المزيد من الطلبات"
                description="ستظهر هنا كل الطلبات التي تقوم بها."
              />
            </Card>

            <Card flush className="p-4">
              <EmptyState compact message="لا توجد مرفقات مع هذا الطلب" />
            </Card>

            <ErrorState onRetry={() => undefined} />
          </div>
        </Section>

        {/* ---------- Headers ---------- */}
        <Section title="ترويسة الصفحات الداخلية">
          <div className="overflow-hidden rounded-card border border-border">
            <BackHeader onBack={() => undefined} />
          </div>
          <p className="mt-2 text-badge text-ink-400">
            زر الرجوع في اليسار كما هو مرسوم في الصور المرجعية.
          </p>
        </Section>

        <div className="h-8" />
      </PageContainer>

      <BottomNav badges={{ notifications: 3, orders: 2 }} />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-section font-bold text-ink-900">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border pb-2 last:border-0">
      <span className="text-ink-400">{label}</span>
      <span className="num text-end font-semibold text-ink-900">{value}</span>
    </div>
  );
}
