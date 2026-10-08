'use client';

import { useId } from 'react';
import { Home, MessageCircle, Phone, User } from 'lucide-react';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { FAYOUM_CITIES } from '@/shared/constants/fayoum-areas';
import type { BasicInfoValues } from './basic-info-step';

export type QuickInfoValues = Pick<BasicInfoValues, 'fullName' | 'phone' | 'whatsapp' | 'city'>;

export interface QuickInfoStepProps {
  values: QuickInfoValues;
  errors: Partial<Record<keyof QuickInfoValues, string>>;
  onChange: (patch: Partial<QuickInfoValues>) => void;
  /** الواتساب = رقم الهاتف — الحالة الغالبة، فتُعلَّم افتراضيًا ويُخفى حقله. */
  whatsappSame: boolean;
  onWhatsappSameChange: (same: boolean) => void;
}

/** أرقام الهاتف فقط بحد 11 — نفس تطبيع حقل الواتساب. */
export function toWhatsappDigits(phone: string): string {
  return phone.replace(/\D/g, '').slice(0, 11);
}

/**
 * الحد الأدنى من البيانات الشخصية للتسجيل السريع كمقدم خدمة: الاسم (من
 * جوجل غالبًا)، الهاتف، الواتساب، والمركز. العنوان التفصيلي والنوع وتاريخ
 * الميلاد ونوع الحساب كلها اختيارية وتُكمَل لاحقًا من الملف.
 */
export function QuickInfoStep({
  values,
  errors,
  onChange,
  whatsappSame,
  onWhatsappSameChange,
}: QuickInfoStepProps) {
  const ids = {
    fullName: useId(),
    phone: useId(),
    whatsappSame: useId(),
    whatsapp: useId(),
    city: useId(),
  };

  return (
    <div className="flex flex-col gap-4">
      <Field htmlFor={ids.fullName} label="الاسم بالكامل" required error={errors.fullName}>
        <Input
          id={ids.fullName}
          icon={<User size={20} />}
          placeholder="مثال: محمد أحمد علي"
          value={values.fullName}
          invalid={Boolean(errors.fullName)}
          onChange={(event) => onChange({ fullName: event.target.value })}
        />
      </Field>

      <Field htmlFor={ids.phone} label="رقم الهاتف" required error={errors.phone}>
        <Input
          id={ids.phone}
          type="tel"
          inputMode="numeric"
          icon={<Phone size={20} />}
          placeholder="010 1234 5678"
          value={values.phone}
          invalid={Boolean(errors.phone)}
          onChange={(event) =>
            onChange({
              phone: event.target.value,
              ...(whatsappSame ? { whatsapp: toWhatsappDigits(event.target.value) } : {}),
            })
          }
        />
      </Field>

      <Checkbox
        id={ids.whatsappSame}
        checked={whatsappSame}
        onChange={(event) => {
          onWhatsappSameChange(event.target.checked);
          onChange({ whatsapp: event.target.checked ? toWhatsappDigits(values.phone) : '' });
        }}
        label="رقم الواتساب هو نفس رقم الهاتف"
      />

      {/* خطأ الواتساب يظهر تحت الهاتف حين يكونان رقمًا واحدًا */}
      {whatsappSame ? (
        errors.whatsapp &&
        !errors.phone && (
          <p className="-mt-2 text-badge text-danger" role="alert">
            {errors.whatsapp}
          </p>
        )
      ) : (
        <Field
          htmlFor={ids.whatsapp}
          label="رقم الواتساب"
          required
          hint="11 رقمًا يبدأ بـ 01 — يتواصل عليه العملاء"
          error={errors.whatsapp}
        >
          <Input
            id={ids.whatsapp}
            type="tel"
            inputMode="numeric"
            maxLength={11}
            icon={<MessageCircle size={20} />}
            placeholder="01012345678"
            value={values.whatsapp}
            invalid={Boolean(errors.whatsapp)}
            onChange={(event) => onChange({ whatsapp: toWhatsappDigits(event.target.value) })}
          />
        </Field>
      )}

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
    </div>
  );
}
