'use client';

import { useId, useState } from 'react';
import { ArrowLeft, MapPin, Pencil, Plus, Save, Trash2, Wrench } from 'lucide-react';
import { BackHeader } from '@/components/layout/back-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PageContainer, PageTitle } from '@/components/layout/page-container';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge, Chip } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/states';
import { InfoAlert } from '@/components/common/info-alert';
import {
  useCreateMyService,
  useDeleteMyService,
  useMyServices,
  useUpdateMyService,
} from '@/lib/queries/provider-services';
import { ApiClientError } from '@/lib/api-client';
import { MAX_SERVICES_PER_PROVIDER } from '@/shared/schemas/provider.schema';
import { COVERAGE_AREAS } from '@/shared/constants/fayoum-areas';
import type { ServiceDto } from '@/server/services/provider-services.service';

interface FormValues {
  title: string;
  description: string;
  areas: string[];
  isActive: boolean;
}

const EMPTY_FORM: FormValues = {
  title: '',
  description: '',
  areas: [],
  isActive: true,
};

type Errors = Partial<Record<keyof FormValues, string>>;

/** خدماتي — القوائم التي تظهر للعملاء في صفحات الاكتشاف. */
export default function ProviderServicesPage() {
  const services = useMyServices();
  const createMutation = useCreateMyService();
  const updateMutation = useUpdateMyService();
  const deleteMutation = useDeleteMyService();

  const [mode, setMode] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState('');

  const startCreate = () => {
    setEditingId(null);
    setValues(EMPTY_FORM);
    setErrors({});
    setFormError('');
    setMode('form');
  };

  const startEdit = (service: ServiceDto) => {
    setEditingId(service.id);
    setValues({
      title: service.title,
      description: service.description,
      areas: service.areas,
      isActive: service.isActive,
    });
    setErrors({});
    setFormError('');
    setMode('form');
  };

  const toggleArea = (area: string) => {
    setValues((current) => ({
      ...current,
      areas: current.areas.includes(area)
        ? current.areas.filter((item) => item !== area)
        : [...current.areas, area],
    }));
  };

  const validate = (): boolean => {
    const next: Errors = {};
    if (values.title.trim().length < 3) next.title = 'عنوان الخدمة قصير جدًا.';
    if (values.description.trim().length < 10) next.description = 'وصف الخدمة قصير جدًا.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setFormError('');

    const payload = {
      title: values.title.trim(),
      description: values.description.trim(),
      areas: values.areas,
      isActive: values.isActive,
    };

    try {
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, patch: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
      setMode('list');
    } catch (error) {
      setFormError(
        error instanceof ApiClientError ? error.message : 'تعذّر حفظ الخدمة. حاول مرة أخرى.'
      );
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('حذف هذه الخدمة نهائيًا؟')) return;
    await deleteMutation.mutateAsync(id).catch(() => undefined);
  };

  const ids = {
    title: useId(),
    description: useId(),
  };

  const busy = createMutation.isPending || updateMutation.isPending;
  const items = services.data ?? [];

  return (
    <>
      <BackHeader onBack={mode === 'form' ? () => setMode('list') : undefined} />

      <PageContainer className="pb-10">
        {mode === 'list' ? (
          <>
            <PageTitle title="خدماتي" subtitle="القوائم التي تظهر للعملاء عند البحث" />

            {services.isPending ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-32 w-full rounded-card" />
                <Skeleton className="h-32 w-full rounded-card" />
              </div>
            ) : services.isError ? (
              <ErrorState message="تعذّر تحميل خدماتك" onRetry={() => void services.refetch()} />
            ) : items.length === 0 ? (
              <EmptyState
                icon={<Wrench size={48} strokeWidth={1.5} />}
                message="لا توجد خدمات بعد"
                description="أضف خدمتك الأولى ليجدها العملاء عند البحث."
              />
            ) : (
              <div className="flex flex-col gap-3">
                {items.map((service) => (
                  <ServiceCard
                    key={service.id}
                    service={service}
                    onEdit={() => startEdit(service)}
                    onDelete={() => void remove(service.id)}
                    deleting={deleteMutation.isPending && deleteMutation.variables === service.id}
                  />
                ))}
              </div>
            )}

            <Button
              fullWidth
              className="mt-5"
              disabled={items.length >= MAX_SERVICES_PER_PROVIDER}
              onClick={startCreate}
              iconStart={<Plus size={20} />}
            >
              أضف خدمة جديدة
            </Button>

            {items.length >= MAX_SERVICES_PER_PROVIDER && (
              <p className="mt-2 text-center text-badge text-ink-400">
                وصلت للحد الأقصى ({MAX_SERVICES_PER_PROVIDER} خدمة).
              </p>
            )}
          </>
        ) : (
          <>
            <PageTitle title={editingId ? 'تعديل الخدمة' : 'خدمة جديدة'} />

            <div className="flex flex-col gap-4">
              <Field htmlFor={ids.title} label="عنوان الخدمة" required error={errors.title}>
                <Input
                  id={ids.title}
                  maxLength={120}
                  placeholder="مثال: صيانة تكييفات منزلية"
                  value={values.title}
                  invalid={Boolean(errors.title)}
                  onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}
                />
              </Field>

              <Field
                htmlFor={ids.description}
                label="الوصف"
                required
                counter={{ current: values.description.length, max: 500 }}
                error={errors.description}
              >
                <Textarea
                  id={ids.description}
                  rows={4}
                  maxLength={500}
                  placeholder="اشرح للعميل ما تقدّمه بالضبط"
                  value={values.description}
                  invalid={Boolean(errors.description)}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, description: event.target.value }))
                  }
                />
              </Field>

              <Field label="مناطق التغطية" hint="اختياري — اتركها فاضية لتغطية كل مناطقك">
                <div className="flex flex-wrap gap-2 rounded-card border border-border p-3">
                  {COVERAGE_AREAS.map((area) => (
                    <Chip
                      key={area}
                      selected={values.areas.includes(area)}
                      onClick={() => toggleArea(area)}
                      icon={<MapPin size={14} />}
                    >
                      {area}
                    </Chip>
                  ))}
                </div>
              </Field>

              <Checkbox
                id="isActive"
                label="نشطة — تظهر للعملاء الآن"
                checked={values.isActive}
                onChange={(event) =>
                  setValues((current) => ({ ...current, isActive: event.target.checked }))
                }
              />

              {formError && (
                <InfoAlert tone="danger" title="تعذّر الحفظ">
                  {formError}
                </InfoAlert>
              )}

              <div className="mt-2 flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={busy}
                  onClick={() => setMode('list')}
                  iconStart={<ArrowLeft size={20} />}
                >
                  إلغاء
                </Button>
                <Button
                  className="flex-[2]"
                  loading={busy}
                  onClick={() => void save()}
                  iconStart={<Save size={20} />}
                >
                  حفظ
                </Button>
              </div>
            </div>
          </>
        )}
      </PageContainer>

      <BottomNav variant="provider" />
    </>
  );
}

/* ---- عناصر داخلية ---- */

function ServiceCard({
  service,
  onEdit,
  onDelete,
  deleting,
}: {
  service: ServiceDto;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-1 text-card-title font-bold text-ink-900">{service.title}</h3>
        <Badge tone={service.isActive ? 'success' : 'neutral'}>
          {service.isActive ? 'نشطة' : 'متوقفة'}
        </Badge>
      </div>

      <p className="line-clamp-2 text-meta text-ink-600">{service.description}</p>

      <div className="flex items-center justify-end gap-2 border-t border-border pt-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            aria-label="تعديل الخدمة"
            className="flex size-9 items-center justify-center rounded-field border border-border text-ink-600 transition-colors hover:bg-bg"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            aria-label="حذف الخدمة"
            className="flex size-9 items-center justify-center rounded-field border border-border text-danger transition-colors hover:bg-danger-bg disabled:opacity-50"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </Card>
  );
}
