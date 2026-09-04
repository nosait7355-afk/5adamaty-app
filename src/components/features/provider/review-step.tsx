'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, FileText, MapPin, Pencil, TriangleAlert } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { InfoAlert } from '@/components/common/info-alert';
import { formatPriceRange } from '@/lib/format';
import { ACCOUNT_TYPE_LABELS_AR, type AccountType } from '@/shared/schemas/provider.schema';
import type { BasicInfoValues } from './basic-info-step';
import type { ProfessionValues } from './profession-step';

export interface ReviewStepProps {
  basic: BasicInfoValues;
  profession: ProfessionValues;
  categoryName?: string;
  professionName?: string;
  documents: { uploaded: number; requiredTotal: number; missingRequired: string[] };
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  onEdit: (step: 1 | 2 | 3) => void;
  error?: string;
}

/**
 * الخطوة 4/4 — مراجعة الطلب (الصورة 22).
 *
 * أربع بطاقات ملخّص، كل واحدة بزر «تعديل» يعيد المستخدم لخطوتها بدل إجباره
 * على المرور بالخطوات كلها من جديد.
 */
export function ReviewStep({
  basic,
  profession,
  categoryName,
  professionName,
  documents,
  accepted,
  onAcceptedChange,
  onEdit,
  error,
}: ReviewStepProps) {
  const documentsComplete = documents.missingRequired.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <SummaryCard title="البيانات الأساسية" onEdit={() => onEdit(1)}>
        <SummaryRow label="الاسم" value={basic.fullName} />
        <SummaryRow label="رقم الهاتف" value={basic.phone} numeric />
        <SummaryRow label="البريد الإلكتروني" value={basic.email} numeric />
        <SummaryRow label="المركز" value={basic.city} />
        <SummaryRow label="العنوان" value={basic.addressLine} />
        <SummaryRow
          label="نوع الحساب"
          value={ACCOUNT_TYPE_LABELS_AR[basic.accountType as AccountType] ?? basic.accountType}
        />
      </SummaryCard>

      <SummaryCard title="المهنة والخدمة" onEdit={() => onEdit(2)}>
        <SummaryRow label="التصنيف" value={categoryName ?? '—'} />
        <SummaryRow label="التخصص" value={professionName ?? '—'} />
        <SummaryRow label="سنوات الخبرة" value={profession.yearsOfExperience} numeric />
        <SummaryRow label="وصف الخدمة" value={profession.bio} />
        <SummaryRow
          label="السعر المبدئي"
          numeric
          value={
            profession.priceMode === 'RANGE' && profession.priceMin
              ? formatPriceRange(Number(profession.priceMin), Number(profession.priceMax))
              : 'يُحدَّد لاحقًا'
          }
        />
        <div className="pt-2">
          <p className="mb-2 text-meta text-ink-400">مناطق التغطية</p>
          <div className="flex flex-wrap gap-1.5">
            {profession.coverageAreas.map((area) => (
              <span
                key={area}
                className="inline-flex items-center gap-1 rounded-pill bg-brand-50 px-2.5 py-1 text-badge font-semibold text-brand-600"
              >
                <MapPin size={12} aria-hidden="true" />
                {area}
              </span>
            ))}
          </div>
        </div>
      </SummaryCard>

      <SummaryCard
        title="المستندات"
        onEdit={() => onEdit(3)}
        badge={
          documentsComplete ? (
            <span className="inline-flex items-center gap-1 text-meta font-semibold text-success">
              <CheckCircle2 size={16} aria-hidden="true" />
              مكتملة
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-meta font-semibold text-warning">
              <TriangleAlert size={16} aria-hidden="true" />
              ناقصة
            </span>
          )
        }
      >
        <SummaryRow
          label="المرفوع"
          numeric
          value={`${documents.uploaded} من ${documents.requiredTotal} مستند إلزامي`}
        />
        {!documentsComplete && (
          <ul className="mt-1 list-inside list-disc text-meta text-danger">
            {documents.missingRequired.map((label) => (
              <li key={label}>{label}</li>
            ))}
          </ul>
        )}
      </SummaryCard>

      <SummaryCard title="ملاحظات هامة" icon={<FileText size={18} />}>
        <ul className="flex list-inside list-disc flex-col gap-1 text-meta text-ink-600">
          <li>تُراجع الإدارة طلبك خلال 24–48 ساعة عمل.</li>
          <li>لن يظهر ملفك للعملاء ولن تستقبل طلبات قبل الاعتماد.</li>
          <li>الدفع يتم كاش مباشرة بينك وبين العميل خارج التطبيق.</li>
          <li>بياناتك ومستنداتك لا تظهر للعملاء ولا لمقدمي خدمة آخرين.</li>
        </ul>
      </SummaryCard>

      <Checkbox
        id="provider-pledge"
        checked={accepted}
        onChange={(event) => onAcceptedChange(event.target.checked)}
        invalid={Boolean(error)}
        label={
          <>
            أُقرّ بأن جميع البيانات والمستندات المرفقة صحيحة وتخصّني، وأوافق على{' '}
            <span className="font-semibold text-brand-600">الشروط والأحكام</span> و
            <span className="font-semibold text-brand-600">سياسة الخصوصية</span>.
          </>
        }
      />

      {error && (
        <InfoAlert tone="danger" title="تعذّر إرسال الطلب">
          {error}
        </InfoAlert>
      )}
    </div>
  );
}

/* ---- عناصر داخلية ---- */

function SummaryCard({
  title,
  onEdit,
  badge,
  icon,
  children,
}: {
  title: string;
  onEdit?: () => void;
  badge?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-border pb-2">
        <h3 className="flex items-center gap-2 text-card-title font-bold text-ink-900">
          {icon && <span className="text-brand-600">{icon}</span>}
          {title}
        </h3>

        <div className="flex items-center gap-3">
          {badge}
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1 text-meta font-semibold text-brand-600 transition-colors hover:text-brand-700"
            >
              <Pencil size={14} aria-hidden="true" />
              تعديل
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">{children}</div>
    </Card>
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
    <div className="flex items-start justify-between gap-3 text-meta">
      <span className="shrink-0 text-ink-400">{label}</span>
      <span className={`text-end font-semibold text-ink-900 ${numeric ? 'num' : ''}`}>
        {value || '—'}
      </span>
    </div>
  );
}
