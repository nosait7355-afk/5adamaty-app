'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { AdminShell, AdminPageHeader } from '@/components/layout/admin-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge, Chip } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/states';
import { InfoAlert } from '@/components/common/info-alert';
import { CatalogIcon, CATALOG_ICON_NAMES } from '@/components/common/catalog-icon';
import {
  useAdminCategories,
  useAdminProfessions,
  useCreateProfession,
  useUpdateProfession,
} from '@/lib/queries/admin';
import { ApiClientError } from '@/lib/api-client';
import type { CreateProfessionInput } from '@/shared/schemas/admin.schema';
import {
  buildDocumentRequirements,
  DOCUMENT_ACCEPTED_MIME,
  DOCUMENT_DEFAULT_MAX_SIZE_MB,
  PROFESSION_KINDS,
  validateRequirementsConsistency,
  type DocumentKey,
  type DocumentRequirement,
} from '@/shared/constants/documents';
import type { AdminProfessionDto } from '@/server/services/admin.service';

const ICON_OPTIONS = CATALOG_ICON_NAMES.map((name) => ({ value: name, label: name }));

const KIND_LABELS_AR: Record<string, string> = { CRAFT: 'حرفية', REGULATED: 'منظَّمة' };

const DOC_KEY_LABELS_AR: Record<DocumentKey, string> = {
  NATIONAL_ID: 'بطاقة الرقم القومي',
  PERSONAL_PHOTO: 'صورة شخصية',
  PROFESSIONAL_CERT: 'مؤهل / شهادة مهنية',
  PRACTICE_LICENSE: 'رخصة مزاولة المهنة',
  ADDRESS_PROOF: 'إثبات العنوان',
  CUSTOM: 'مستند مخصّص',
};

/**
 * إدارة المهن ومحرّك المستندات الديناميكي — القلب التشغيلي للوحة الإدارة.
 *
 * كل تغيير هنا في `documentRequirements` أو `requiresQualification` أو
 * `requiresLicense` ينعكس **فورًا** على شاشة تسجيل مقدمي الخدمة الجدد
 * (الصورة 21) بلا نشر كود — هذا ما يجعل محرّك المستندات ديناميكيًا فعليًا
 * (PROJECT_PLAN — قواعد المستندات الديناميكية).
 */
export default function AdminProfessionsPage() {
  const [categoryFilter, setCategoryFilter] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const categories = useAdminCategories();
  const professions = useAdminProfessions({
    ...(categoryFilter ? { categoryId: categoryFilter } : {}),
  });

  const categoryOptions = (categories.data ?? []).map((c) => ({ value: c.id, label: c.name }));

  return (
    <AdminShell>
      <AdminPageHeader
        title="المهن ومتطلبات المستندات"
        subtitle="كل مهنة تحدّد مستنداتها المطلوبة — وتُبنى شاشة التسجيل منها مباشرة"
        action={
          <Button size="sm" iconStart={<Plus size={16} />} onClick={() => setIsCreating((v) => !v)}>
            {isCreating ? 'إلغاء' : 'مهنة جديدة'}
          </Button>
        }
      />

      <div className="scroll-x flex gap-2">
        <Chip selected={categoryFilter === ''} onClick={() => setCategoryFilter('')}>
          كل التصنيفات
        </Chip>
        {categoryOptions.map((option) => (
          <Chip
            key={option.value}
            selected={categoryFilter === option.value}
            onClick={() => setCategoryFilter(option.value)}
          >
            {option.label}
          </Chip>
        ))}
      </div>

      {isCreating && (
        <ProfessionForm categoryOptions={categoryOptions} onDone={() => setIsCreating(false)} />
      )}

      {professions.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-card" />
          ))}
        </div>
      ) : professions.isError ? (
        <ErrorState message="تعذّر تحميل المهن" onRetry={() => void professions.refetch()} />
      ) : professions.data.length === 0 ? (
        <EmptyState message="لا توجد مهن في هذا التصنيف" />
      ) : (
        <ul className="flex flex-col gap-3">
          {professions.data.map((profession) => (
            <li key={profession.id}>
              <ProfessionRow profession={profession} categoryOptions={categoryOptions} />
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}

function ProfessionRow({
  profession,
  categoryOptions,
}: {
  profession: AdminProfessionDto;
  categoryOptions: { value: string; label: string }[];
}) {
  const [editing, setEditing] = useState(false);
  const update = useUpdateProfession();

  if (editing) {
    return (
      <ProfessionForm
        existing={profession}
        categoryOptions={categoryOptions}
        onDone={() => setEditing(false)}
      />
    );
  }

  const requiredCount = profession.documentRequirements.filter((r) => r.required).length;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <CatalogIcon name={profession.icon} size={20} />
          </span>
          <div className="min-w-0">
            <h3 className="line-clamp-1 text-card-title font-bold text-ink-900">
              {profession.name}
            </h3>
            <p className="text-badge text-ink-400">
              {KIND_LABELS_AR[profession.professionKind]} ·{' '}
              {profession.requiresQualification ? 'يتطلب مؤهلًا' : 'بلا مؤهل'} ·{' '}
              {profession.requiresLicense ? 'يتطلب ترخيصًا' : 'بلا ترخيص'}
            </p>
          </div>
        </div>
        <Badge tone={profession.isActive ? 'success' : 'danger'}>
          {profession.isActive ? 'مفعّلة' : 'معطّلة'}
        </Badge>
      </div>

      <div>
        <p className="mb-1 text-badge font-bold text-ink-600">
          المستندات ({profession.documentRequirements.length} — {requiredCount} إلزامي)
        </p>
        <div className="flex flex-wrap gap-1.5">
          {profession.documentRequirements.map((req) => (
            <span
              key={`${req.key}-${req.customKey ?? ''}`}
              className={`rounded-pill px-2 py-0.5 text-[10px] font-semibold ${
                req.required ? 'bg-danger-bg text-danger' : 'bg-bg text-ink-400'
              }`}
            >
              {req.label}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
          تعديل
        </Button>
        <Button
          size="sm"
          variant={profession.isActive ? 'danger' : 'success'}
          loading={update.isPending}
          onClick={() =>
            update.mutate({ professionId: profession.id, isActive: !profession.isActive })
          }
        >
          {profession.isActive ? 'تعطيل' : 'تفعيل'}
        </Button>
      </div>
    </Card>
  );
}

/* ================================================================== */
/* نموذج الإنشاء/التعديل — محرّر متطلبات المستندات                      */
/* ================================================================== */

function ProfessionForm({
  existing,
  categoryOptions,
  onDone,
}: {
  existing?: AdminProfessionDto;
  categoryOptions: { value: string; label: string }[];
  onDone: () => void;
}) {
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? categoryOptions[0]?.value ?? '');
  const [name, setName] = useState(existing?.name ?? '');
  const [slug, setSlug] = useState(existing?.slug ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? ICON_OPTIONS[0]?.value ?? '');
  const [order, setOrder] = useState(existing?.order ?? 0);
  const [professionKind, setProfessionKind] = useState(existing?.professionKind ?? 'CRAFT');
  const [requiresQualification, setRequiresQualification] = useState(
    existing?.requiresQualification ?? false
  );
  const [requiresLicense, setRequiresLicense] = useState(existing?.requiresLicense ?? false);
  const [requirements, setRequirements] = useState<DocumentRequirement[]>(
    (existing?.documentRequirements as DocumentRequirement[] | undefined) ??
      buildDocumentRequirements({ requiresQualification: false, requiresLicense: false })
  );
  const [error, setError] = useState('');

  const create = useCreateProfession();
  const update = useUpdateProfession();
  const pending = create.isPending || update.isPending;

  /** يعيد بناء القائمة الافتراضية حسب المفتاحين — لا يمسّ تعديلات يدوية على النصوص. */
  const resetToDefaults = () => {
    setRequirements(buildDocumentRequirements({ requiresQualification, requiresLicense }));
  };

  const violations = useMemo(
    () => validateRequirementsConsistency(requirements, { requiresQualification, requiresLicense }),
    [requirements, requiresQualification, requiresLicense]
  );

  const updateRequirement = (index: number, patch: Partial<DocumentRequirement>) => {
    setRequirements((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const removeRequirement = (index: number) => {
    setRequirements((prev) => prev.filter((_, i) => i !== index));
  };

  const addCustomRequirement = () => {
    setRequirements((prev) => [
      ...prev,
      {
        key: 'CUSTOM',
        customKey: `custom_${prev.length + 1}`,
        label: 'مستند إضافي',
        description: 'وصف المستند',
        required: false,
        order: prev.length + 1,
        accept: [...DOCUMENT_ACCEPTED_MIME],
        maxSizeMB: DOCUMENT_DEFAULT_MAX_SIZE_MB,
        isActive: true,
      },
    ]);
  };

  const submit = async () => {
    setError('');

    if (violations.length > 0) {
      setError(`تعارض في إعداد المستندات: ${violations.map((v) => v.message).join(' ')}`);
      return;
    }

    const payload = {
      categoryId,
      name,
      slug,
      icon,
      order,
      professionKind: professionKind as 'CRAFT' | 'REGULATED',
      requiresQualification,
      requiresLicense,
      /*
       * `DocumentRequirement.accept` من الثابت المشترك مطابق فعليًا لتعداد
       * `DOCUMENT_ACCEPTED_MIME` بالبناء (buildDocumentRequirements ومسار
       * المستند المخصّص كلاهما يستخدمانه)، لكن نوعه المُعلَن أعمّ (`string[]`)
       * ليبقى الملف المشترك مستقلًا عن مخطط Zod الخاص بلوحة الإدارة.
       */
      documentRequirements: requirements as CreateProfessionInput['documentRequirements'],
    };

    try {
      if (existing) {
        await update.mutateAsync({ professionId: existing.id, ...payload });
      } else {
        await create.mutateAsync(payload);
      }
      onDone();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'تعذّر الحفظ.');
    }
  };

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-label font-bold text-ink-900">
          {existing ? 'تعديل المهنة' : 'مهنة جديدة'}
        </h3>
        <button type="button" onClick={onDone} className="text-ink-400 hover:text-ink-600">
          <X size={18} />
        </button>
      </div>

      <Field label="التصنيف" required htmlFor="prof-category">
        <Select
          id="prof-category"
          options={categoryOptions}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="الاسم" required htmlFor="prof-name">
          <Input id="prof-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="الـslug" required htmlFor="prof-slug">
          <Input
            id="prof-slug"
            dir="ltr"
            className="[&_input]:text-end"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="الأيقونة" required htmlFor="prof-icon">
          <Select
            id="prof-icon"
            options={ICON_OPTIONS}
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
          />
        </Field>
        <Field label="الترتيب" htmlFor="prof-order">
          <Input
            id="prof-order"
            type="number"
            min={0}
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
          />
        </Field>
      </div>

      <Field label="تصنيف المهنة" required htmlFor="prof-kind">
        <Select
          id="prof-kind"
          options={PROFESSION_KINDS.map((k) => ({ value: k, label: KIND_LABELS_AR[k] ?? k }))}
          value={professionKind}
          onChange={(e) => setProfessionKind(e.target.value as 'CRAFT' | 'REGULATED')}
        />
      </Field>

      <div className="flex flex-col gap-2 rounded-field border border-border p-3">
        <Checkbox
          id="prof-qualification"
          checked={requiresQualification}
          onChange={(e) => setRequiresQualification(e.target.checked)}
          label="تتطلب مؤهلًا أو شهادة مهنية"
        />
        <Checkbox
          id="prof-license"
          checked={requiresLicense}
          onChange={(e) => setRequiresLicense(e.target.checked)}
          label="تتطلب رخصة مزاولة مهنة"
        />
        <Button size="sm" variant="ghost" className="w-fit" onClick={resetToDefaults}>
          إعادة بناء المستندات من هذين الخيارين
        </Button>
      </div>

      {/* محرّر متطلبات المستندات */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-label font-bold text-ink-900">متطلبات المستندات</h4>
          <Button size="sm" variant="secondary" iconStart={<Plus size={14} />} onClick={addCustomRequirement}>
            مستند مخصّص
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          {requirements.map((req, index) => (
            <RequirementEditor
              key={`${req.key}-${req.customKey ?? index}`}
              requirement={req}
              onChange={(patch) => updateRequirement(index, patch)}
              onRemove={() => removeRequirement(index)}
            />
          ))}
        </div>

        {violations.length > 0 && (
          <InfoAlert tone="warning" title="تعارض في الإعداد" className="mt-3">
            {violations.map((v) => v.message).join(' ')}
          </InfoAlert>
        )}
      </div>

      {error && <InfoAlert tone="danger">{error}</InfoAlert>}

      <Button fullWidth loading={pending} onClick={() => void submit()}>
        حفظ
      </Button>
    </Card>
  );
}

function RequirementEditor({
  requirement,
  onChange,
  onRemove,
}: {
  requirement: DocumentRequirement;
  onChange: (patch: Partial<DocumentRequirement>) => void;
  onRemove: () => void;
}) {
  const isCustom = requirement.key === 'CUSTOM';

  return (
    <div className="rounded-field border border-border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-label font-bold text-ink-900">
          {isCustom ? requirement.label || 'مستند مخصّص' : DOC_KEY_LABELS_AR[requirement.key]}
        </span>
        {isCustom && (
          <button type="button" onClick={onRemove} className="text-danger hover:text-danger/70">
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {isCustom && (
        <div className="mb-2 grid grid-cols-2 gap-2">
          <Input
            placeholder="مفتاح فريد (لاتيني)"
            dir="ltr"
            value={requirement.customKey ?? ''}
            onChange={(e) => onChange({ customKey: e.target.value })}
          />
          <Input
            placeholder="اسم المستند"
            value={requirement.label}
            onChange={(e) => onChange({ label: e.target.value })}
          />
        </div>
      )}

      {isCustom && (
        <Textarea
          rows={2}
          className="mb-2"
          placeholder="وصف المستند"
          value={requirement.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      )}

      <div className="flex flex-wrap items-center gap-4">
        <Checkbox
          checked={requirement.required}
          onChange={(e) => onChange({ required: e.target.checked })}
          label={requirement.required ? 'إلزامي' : 'اختياري'}
        />
        <Checkbox
          checked={requirement.isActive}
          onChange={(e) => onChange({ isActive: e.target.checked })}
          label="مفعّل"
        />
        <label className="flex items-center gap-1 text-badge text-ink-600">
          الحد الأقصى (MB)
          <input
            type="number"
            min={1}
            max={5}
            className="num w-14 rounded-field border border-border px-2 py-1"
            value={requirement.maxSizeMB}
            onChange={(e) => onChange({ maxSizeMB: Number(e.target.value) })}
          />
        </label>
      </div>
    </div>
  );
}
