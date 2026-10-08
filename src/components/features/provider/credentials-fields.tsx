'use client';

import { useId } from 'react';
import { Lock, Mail } from 'lucide-react';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

export interface CredentialsValues {
  email: string;
  password: string;
  confirmPassword: string;
}

export interface CredentialsFieldsProps {
  values: CredentialsValues;
  errors: Partial<Record<keyof CredentialsValues, string>>;
  onChange: (patch: Partial<CredentialsValues>) => void;
  /** بعد إنشاء الحساب يبقى البريد قابلًا للتعديل، وكلمة المرور شأن شاشة أخرى. */
  withPassword?: boolean;
}

/**
 * بيانات الدخول في تسجيل مقدم الخدمة بالهاتف وكلمة المرور — الفرق الوحيد
 * عن مسار جوجل. البريد **إلزامي** لمقدم الخدمة: عليه يُخطَر بحالة حسابه.
 */
export function CredentialsFields({
  values,
  errors,
  onChange,
  withPassword = true,
}: CredentialsFieldsProps) {
  const ids = {
    email: useId(),
    password: useId(),
    confirmPassword: useId(),
  };

  return (
    <div className="flex flex-col gap-4">
      <Field
        htmlFor={ids.email}
        label="البريد الإلكتروني"
        required
        hint="نُخطرك بحالة حسابك عليه"
        error={errors.email}
      >
        <Input
          id={ids.email}
          type="email"
          dir="ltr"
          autoComplete="email"
          icon={<Mail size={20} />}
          placeholder="name@example.com"
          value={values.email}
          invalid={Boolean(errors.email)}
          onChange={(event) => onChange({ email: event.target.value })}
        />
      </Field>

      {withPassword && (
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
              autoComplete="new-password"
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
              autoComplete="new-password"
              icon={<Lock size={20} />}
              placeholder="أعد إدخال كلمة المرور"
              value={values.confirmPassword}
              invalid={Boolean(errors.confirmPassword)}
              onChange={(event) => onChange({ confirmPassword: event.target.value })}
            />
          </Field>
        </>
      )}
    </div>
  );
}
