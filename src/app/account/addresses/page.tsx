'use client';

import { useState } from 'react';
import { Briefcase, Home, MapPin, Plus, Star, Trash2, Users } from 'lucide-react';
import { BackHeader } from '@/components/layout/back-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PageContainer, PageTitle } from '@/components/layout/page-container';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { InfoAlert } from '@/components/common/info-alert';
import { EmptyState, ErrorState } from '@/components/common/states';
import { ApiClientError } from '@/lib/api-client';
import { formatPhone } from '@/lib/format';
import {
  useAddresses,
  useCreateAddress,
  useDeleteAddress,
  useSetDefaultAddress,
} from '@/lib/queries/account';
import {
  ADDRESS_TYPES,
  ADDRESS_TYPE_LABELS_AR,
  FAYOUM_CITIES,
  GOVERNORATE,
} from '@/shared/constants/fayoum-areas';
import { cn } from '@/lib/cn';

/**
 * عناويني — الصورة 17.
 *
 * NON-NEGOTIABLE (ARCHITECTURE §0.2): عناوين **نصية بحتة**. لا خريطة ولا
 * «حدّد موقعك» ولا إحداثيات — المركز والمنطقة من قائمة الفيوم الثابتة،
 * والباقي نص حر.
 */

const TYPE_ICONS: Record<string, React.ReactNode> = {
  HOME: <Home size={20} />,
  WORK: <Briefcase size={20} />,
  FAMILY: <Users size={20} />,
  OTHER: <MapPin size={20} />,
};

interface FormValues {
  label: string;
  type: string;
  city: string;
  line: string;
  landmark: string;
  postalCode: string;
  contactName: string;
  contactPhone: string;
}

const EMPTY: FormValues = {
  label: '',
  type: 'HOME',
  city: GOVERNORATE,
  line: '',
  landmark: '',
  postalCode: '',
  contactName: '',
  contactPhone: '',
};

export default function AddressesPage() {
  const addresses = useAddresses();
  const create = useCreateAddress();
  const setDefault = useSetDefaultAddress();
  const remove = useDeleteAddress();

  const [showForm, setShowForm] = useState(false);
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [error, setError] = useState('');

  const patch = (next: Partial<FormValues>) => setValues((current) => ({ ...current, ...next }));

  const submit = async () => {
    setError('');
    try {
      await create.mutateAsync({
        label: values.label,
        type: values.type,
        governorate: GOVERNORATE,
        city: values.city,
        // المنطقة = المركز نفسه بعد إزالة الأحياء
        area: values.city,
        line: values.line,
        ...(values.landmark ? { landmark: values.landmark } : {}),
        ...(values.postalCode ? { postalCode: values.postalCode } : {}),
        contactName: values.contactName,
        contactPhone: values.contactPhone,
      });
      setValues(EMPTY);
      setShowForm(false);
    } catch (createError) {
      setError(
        createError instanceof ApiClientError
          ? createError.message
          : 'تعذّر حفظ العنوان. حاول مرة أخرى.'
      );
    }
  };

  return (
    <>
      <BackHeader />

      <PageContainer className="flex flex-col gap-4">
        <PageTitle title="عناويني" subtitle="عناوينك المحفوظة لطلب الخدمات" />

        {!showForm && (
          <Button fullWidth onClick={() => setShowForm(true)} iconStart={<Plus size={20} />}>
            إضافة عنوان جديد
          </Button>
        )}

        {showForm && (
          <Card className="flex flex-col gap-4">
            <h2 className="text-card-title font-bold text-ink-900">عنوان جديد</h2>

            <Field label="اسم العنوان" required>
              <Input
                placeholder="مثال: المنزل"
                value={values.label}
                onChange={(event) => patch({ label: event.target.value })}
              />
            </Field>

            <Field label="النوع">
              <Select
                value={values.type}
                onChange={(event) => patch({ type: event.target.value })}
                options={ADDRESS_TYPES.map((type) => ({
                  value: type,
                  label: ADDRESS_TYPE_LABELS_AR[type],
                }))}
              />
            </Field>

            <Field label="المحافظة">
              <Input value={GOVERNORATE} readOnly disabled icon={<MapPin size={20} />} />
            </Field>

            <Field label="المركز" required>
              <Select
                value={values.city}
                onChange={(event) => patch({ city: event.target.value })}
                options={FAYOUM_CITIES.map((city) => ({ value: city, label: city }))}
              />
            </Field>

            <Field label="العنوان التفصيلي" required>
              <Textarea
                rows={2}
                maxLength={200}
                placeholder="الشارع، رقم العقار، الدور، الشقة"
                value={values.line}
                onChange={(event) => patch({ line: event.target.value })}
              />
            </Field>

            <Field label="أقرب معلم" hint="اختياري">
              <Input
                placeholder="بجوار مدرسة النور"
                value={values.landmark}
                onChange={(event) => patch({ landmark: event.target.value })}
              />
            </Field>

            <Field label="الرمز البريدي" hint="اختياري — 5 أرقام">
              <Input
                inputMode="numeric"
                maxLength={5}
                value={values.postalCode}
                onChange={(event) => patch({ postalCode: event.target.value })}
              />
            </Field>

            <Field label="اسم جهة الاتصال" required>
              <Input
                value={values.contactName}
                onChange={(event) => patch({ contactName: event.target.value })}
              />
            </Field>

            <Field label="هاتف جهة الاتصال" required>
              <Input
                type="tel"
                inputMode="numeric"
                placeholder="010 1234 5678"
                value={values.contactPhone}
                onChange={(event) => patch({ contactPhone: event.target.value })}
              />
            </Field>

            {error && (
              <InfoAlert tone="danger" title="تعذّر حفظ العنوان">
                {error}
              </InfoAlert>
            )}

            <div className="flex gap-3">
              <Button
                variant="neutral"
                className="flex-1"
                disabled={create.isPending}
                onClick={() => {
                  setShowForm(false);
                  setError('');
                }}
              >
                إلغاء
              </Button>
              <Button className="flex-1" loading={create.isPending} onClick={() => void submit()}>
                حفظ العنوان
              </Button>
            </div>
          </Card>
        )}

        {addresses.isPending ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 2 }, (_, index) => (
              <Skeleton key={index} className="h-36 w-full rounded-card" />
            ))}
          </div>
        ) : addresses.isError ? (
          <ErrorState onRetry={() => void addresses.refetch()} />
        ) : addresses.data.length === 0 ? (
          <EmptyState
            icon={<MapPin size={44} strokeWidth={1.5} />}
            message="لا توجد عناوين محفوظة"
            description="أضف عنوانك ليظهر تلقائيًا عند طلب أي خدمة."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {addresses.data.map((address) => (
              <li key={address.id}>
                <Card className="flex flex-col gap-2">
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        'flex size-11 shrink-0 items-center justify-center rounded-field',
                        address.isDefault ? 'bg-brand-600 text-white' : 'bg-brand-50 text-brand-600'
                      )}
                      aria-hidden="true"
                    >
                      {TYPE_ICONS[address.type] ?? <MapPin size={20} />}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-card-title font-bold text-ink-900">{address.label}</h3>
                        {address.isDefault && <Badge tone="brand">محدَّد</Badge>}
                      </div>
                      <p className="text-meta text-ink-600">{address.line}</p>
                      <p className="text-meta text-ink-400">
                        {address.governorate} - {address.city} - {address.area}
                      </p>
                      {address.postalCode && (
                        <p className="num text-badge text-ink-400">
                          الرمز البريدي: {address.postalCode}
                        </p>
                      )}
                      <p className="num text-badge text-ink-400">
                        {address.contactName} · {formatPhone(address.contactPhone)}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2 border-t border-border pt-2">
                    {!address.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={setDefault.isPending}
                        onClick={() => void setDefault.mutateAsync(address.id)}
                        iconStart={<Star size={16} />}
                      >
                        تعيين افتراضي
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger hover:bg-danger-bg"
                      loading={remove.isPending}
                      onClick={() => void remove.mutateAsync(address.id)}
                      iconStart={<Trash2 size={16} />}
                    >
                      حذف
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}

        <InfoAlert tone="info" title="عناوينك نصية فقط">
          نحفظ العنوان نصًّا لتسهيل وصول مقدم الخدمة. لا يستخدم التطبيق خرائط ولا يتتبّع موقعك.
        </InfoAlert>
      </PageContainer>

      <BottomNav />
    </>
  );
}
