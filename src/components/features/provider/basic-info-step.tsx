'use client';

import { useId } from 'react';
import { CalendarDays, Home, Lock, Mail, MapPin, Phone, User } from 'lucide-react';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { InfoAlert } from '@/components/common/info-alert';
import { FAYOUM_CITIES, GOVERNORATE } from '@/shared/constants/fayoum-areas';
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS_AR,
  GENDERS,
  GENDER_LABELS_AR,
} from '@/shared/schemas/provider.schema';

export interface BasicInfoValues {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  city: string;
  addressLine: string;
  accountType: string;
  gender: string;
  birthDate: string;
}

export const EMPTY_BASIC_INFO: BasicInfoValues = {
  fullName: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
  city: GOVERNORATE,
  addressLine: '',
  accountType: 'INDIVIDUAL',
  gender: '',
  birthDate: '',
};

export interface BasicInfoStepProps {
  values: BasicInfoValues;
  errors: Partial<Record<keyof BasicInfoValues, string>>;
  onChange: (patch: Partial<BasicInfoValues>) => void;
  /** في وضع التعديل بعد إنشاء الحساب لا تُعرض حقول كلمة المرور والهاتف. */
  mode?: 'create' | 'edit';
}

/**
 * الخطوة 1/4 — البيانات الأساسية (الصورة 19).
 *
 * الموقع نص بحت: المحافظة ثابتة، المركز من قائمة الفيوم، والعنوان التفصيلي
 * حقل حر بعدّاد 0/100. لا خريطة ولا تحديد موقع (ARCHITECTURE §0.2).
 */
export function BasicInfoStep({ values, errors, onChange, mode = 'create' }: BasicInfoStepProps) {
  const ids = {
    fullName: useId(),
    phone: useId(),
    email: useId(),
    password: useId(),
    confirmPassword: useId(),
    city: useId(),
    addressLine: useId(),
    accountType: useId(),
    gender: useId(),
    birthDate: useId(),
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

      {mode === 'create' && (
        <Field htmlFor={ids.phone} label="رقم الهاتف" required error={errors.phone}>
          <Input
            id={ids.phone}
            type="tel"
            inputMode="numeric"
            icon={<Phone size={20} />}
            placeholder="010 1234 5678"
            value={values.phone}
            invalid={Boolean(errors.phone)}
            onChange={(event) => onChange({ phone: event.target.value })}
          />
        </Field>
      )}

      <Field
        htmlFor={ids.email}
        label="البريد الإلكتروني"
        required
        hint="نُخطرك بقرار التوثيق عليه"
        error={errors.email}
      >
        <Input
          id={ids.email}
          type="email"
          dir="ltr"
          icon={<Mail size={20} />}
          placeholder="name@example.com"
          value={values.email}
          invalid={Boolean(errors.email)}
          onChange={(event) => onChange({ email: event.target.value })}
        />
      </Field>

      {mode === 'create' && (
        <>
          <Field
            htmlFor={ids.password}
            label="كلمة المرور"
            required
            hint="8 أحرف على الأقل، وتحتوي حرفًا ورقمًا"
            error={errors.password}
          >
            <Input
              id={ids.password}
              type="password"
              togglePassword
              icon={<Lock size={20} />}
              placeholder="أدخل كلمة المرور"
              value={values.password}
              invalid={Boolean(errors.password)}
              onChange={(event) => onChange({ password: event.target.value })}
            />
          </Field>

          <Field
            htmlFor={ids.confirmPassword}
            label="تأكيد كلمة المرور"
            required
            error={errors.confirmPassword}
          >
            <Input
              id={ids.confirmPassword}
              type="password"
              togglePassword
              icon={<Lock size={20} />}
              placeholder="أعد إدخال كلمة المرور"
              value={values.confirmPassword}
              invalid={Boolean(errors.confirmPassword)}
              onChange={(event) => onChange({ confirmPassword: event.target.value })}
            />
          </Field>
        </>
      )}

      {/* ---- الموقع ---- */}
      <h2 className="mt-2 text-label font-bold text-ink-900">موقعك</h2>

      <Field label="المحافظة" required>
        <Input icon={<MapPin size={20} />} value={GOVERNORATE} readOnly disabled />
      </Field>

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
        htmlFor={ids.addressLine}
        label="العنوان التفصيلي"
        required
        counter={{ current: values.addressLine.length, max: 100 }}
        error={errors.addressLine}
      >
        <Textarea
          id={ids.addressLine}
          rows={3}
          maxLength={100}
          placeholder="الشارع، رقم العقار، وأقرب معلم"
          value={values.addressLine}
          invalid={Boolean(errors.addressLine)}
          onChange={(event) => onChange({ addressLine: event.target.value })}
        />
      </Field>

      {/* ---- معلومات إضافية ---- */}
      <h2 className="mt-2 text-label font-bold text-ink-900">معلومات إضافية</h2>

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

        <Field htmlFor={ids.birthDate} label="تاريخ الميلاد" error={errors.birthDate}>
          <Input
            id={ids.birthDate}
            type="date"
            icon={<CalendarDays size={20} />}
            value={values.birthDate}
            invalid={Boolean(errors.birthDate)}
            onChange={(event) => onChange({ birthDate: event.target.value })}
          />
        </Field>
      </div>

      <InfoAlert tone="info" title="خصوصية بياناتك">
        بياناتك الشخصية ومستنداتك تُستخدم للتحقق من هويتك فقط، ولا تظهر للعملاء. رقم هاتفك لا
        يُعرض في ملفك العام.
      </InfoAlert>
    </div>
  );
}
