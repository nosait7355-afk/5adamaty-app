'use client';

import { useId } from 'react';
import { Home } from 'lucide-react';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DatePartsInput } from '@/components/ui/date-parts-input';
import { SectionHeader } from '@/components/ui/card';
import { FAYOUM_CITIES } from '@/shared/constants/fayoum-areas';
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS_AR,
  GENDERS,
  GENDER_LABELS_AR,
} from '@/shared/schemas/provider.schema';

export interface ProviderDetailsValues {
  city: string;
  addressLine: string;
  accountType: string;
  gender: string;
  birthDate: string;
}

export const EMPTY_PROVIDER_DETAILS: ProviderDetailsValues = {
  city: '',
  addressLine: '',
  accountType: 'INDIVIDUAL',
  gender: '',
  birthDate: '',
};

/**
 * عنوان المزوّد وبياناته الاختيارية في «ملفي» — ما أجّله التسجيل السريع.
 * لا شيء منها يظهر للعملاء (انظر تنبيه الخصوصية في `BasicInfoStep`).
 */
export function ProviderDetailsSection({
  values,
  errors,
  onChange,
  addressId,
}: {
  values: ProviderDetailsValues;
  errors: Partial<Record<keyof ProviderDetailsValues, string>>;
  onChange: (patch: Partial<ProviderDetailsValues>) => void;
  /** معرّف ثابت لحقل العنوان — تقفز إليه قائمة «كمّل ملفك». */
  addressId: string;
}) {
  const ids = {
    city: useId(),
    accountType: useId(),
    gender: useId(),
    birthDate: useId(),
  };

  return (
    <section aria-label="عنوانك وبياناتك" className="flex flex-col gap-4">
      <SectionHeader title="عنوانك وبياناتك" />

      <Field htmlFor={ids.city} label="المدينة / المركز" required error={errors.city}>
        <Select
          id={ids.city}
          icon={<Home size={20} />}
          placeholder="اختر المركز"
          value={values.city}
          invalid={Boolean(errors.city)}
          onChange={(event) => onChange({ city: event.target.value })}
          options={FAYOUM_CITIES.map((city) => ({ value: city, label: city }))}
        />
      </Field>

      <Field
        htmlFor={addressId}
        label="العنوان التفصيلي"
        counter={{ current: values.addressLine.length, max: 100 }}
        error={errors.addressLine}
      >
        <Textarea
          id={addressId}
          rows={3}
          maxLength={100}
          placeholder="الشارع، رقم العقار، وأقرب معلم"
          value={values.addressLine}
          invalid={Boolean(errors.addressLine)}
          onChange={(event) => onChange({ addressLine: event.target.value })}
        />
      </Field>

      <Field htmlFor={ids.accountType} label="نوع الحساب" error={errors.accountType}>
        <Select
          id={ids.accountType}
          value={values.accountType}
          onChange={(event) => onChange({ accountType: event.target.value })}
          options={ACCOUNT_TYPES.map((type) => ({
            value: type,
            label: ACCOUNT_TYPE_LABELS_AR[type],
          }))}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field htmlFor={ids.gender} label="النوع" error={errors.gender}>
          <Select
            id={ids.gender}
            placeholder="اختياري"
            value={values.gender}
            onChange={(event) => onChange({ gender: event.target.value })}
            options={GENDERS.map((gender) => ({ value: gender, label: GENDER_LABELS_AR[gender] }))}
          />
        </Field>

        <Field htmlFor={ids.birthDate} label="تاريخ الميلاد" hint="اختياري" error={errors.birthDate}>
          <DatePartsInput
            id={ids.birthDate}
            value={values.birthDate}
            invalid={Boolean(errors.birthDate)}
            onChange={(birthDate) => onChange({ birthDate })}
          />
        </Field>
      </div>
    </section>
  );
}
