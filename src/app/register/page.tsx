'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, Mail, MapPin, User } from 'lucide-react';
import { AuthShell } from '@/components/features/auth/auth-shell';
import { GoogleSignInButton } from '@/components/features/auth/google-sign-in-button';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { InfoAlert } from '@/components/common/info-alert';
import {
  registerCustomerSchema,
  type RegisterCustomerFormValues,
  type RegisterCustomerInput,
} from '@/shared/schemas/auth.schema';
import { COVERAGE_AREAS, GOVERNORATE } from '@/shared/constants/fayoum-areas';
import { extractErrorMessage, resolveHomeRoute, useRegister } from '@/lib/queries/auth';
import { GOOGLE_SIGN_IN_ENABLED } from '@/shared/constants/feature-flags';

/**
 * إنشاء حساب جديد (عميل) — الصورة 05 مع تعديل لاحق بقرار صاحب المنتج:
 * لا حقل هاتف — البريد هو الإلزامي، وزر «إنشاء حساب عبر جوجل» أسفل النموذج
 * مباشرة (لا طيّ ولا رابط ثانوي، الاثنان ظاهران معًا دائمًا).
 */
export default function RegisterPage() {
  const router = useRouter();
  const registerMutation = useRegister();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterCustomerFormValues, unknown, RegisterCustomerInput>({
    resolver: zodResolver(registerCustomerSchema),
    defaultValues: {
      fullName: '',
      email: '',
      area: '',
      city: GOVERNORATE,
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const user = await registerMutation.mutateAsync(values);
      router.replace(resolveHomeRoute(user));
    } catch {
      // الخطأ يُعرض من حالة الـmutation أسفل النموذج
    }
  });

  return (
    <AuthShell
      title="إنشاء حساب جديد"
      subtitle="يرجى إدخال بياناتك للتسجيل"
      onBack={() => router.push('/role-select')}
      footer={
        <p className="text-center text-label text-ink-600">
          لديك حساب بالفعل؟{' '}
          <Link href="/login" className="font-bold text-brand-600">
            تسجيل الدخول
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label="الاسم الكامل" required htmlFor="fullName" error={errors.fullName?.message}>
          <Input
            id="fullName"
            autoComplete="name"
            placeholder="أدخل اسمك الكامل"
            icon={<User size={20} />}
            invalid={Boolean(errors.fullName)}
            {...register('fullName')}
          />
        </Field>

        <Field label="البريد الإلكتروني" required htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            dir="ltr"
            className="[&_input]:text-end"
            autoComplete="email"
            placeholder="example@email.com"
            icon={<Mail size={20} />}
            invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>

        <Field label="المركز" required htmlFor="area" error={errors.area?.message}>
          <Select
            id="area"
            placeholder="اختر المركز"
            icon={<MapPin size={20} />}
            invalid={Boolean(errors.area)}
            options={COVERAGE_AREAS.map((area) => ({ value: area, label: area }))}
            {...register('area')}
          />
        </Field>

        <Field
          label="كلمة المرور"
          required
          htmlFor="password"
          hint="8 أحرف على الأقل، وتحتوي حرفًا ورقمًا"
          error={errors.password?.message}
        >
          <Input
            id="password"
            type="password"
            togglePassword
            autoComplete="new-password"
            placeholder="أدخل كلمة المرور"
            icon={<Lock size={20} />}
            invalid={Boolean(errors.password)}
            {...register('password')}
          />
        </Field>

        <Field
          label="تأكيد كلمة المرور"
          required
          htmlFor="confirmPassword"
          error={errors.confirmPassword?.message}
        >
          <Input
            id="confirmPassword"
            type="password"
            togglePassword
            autoComplete="new-password"
            placeholder="أعد إدخال كلمة المرور"
            icon={<Lock size={20} />}
            invalid={Boolean(errors.confirmPassword)}
            {...register('confirmPassword')}
          />
        </Field>

        <Checkbox
          id="acceptTerms"
          invalid={Boolean(errors.acceptTerms)}
          label={
            <>
              أوافق على{' '}
              <Link href="/terms" className="font-semibold text-brand-600">
                الشروط والأحكام
              </Link>{' '}
              و
              <Link href="/privacy" className="font-semibold text-brand-600">
                سياسة الخصوصية
              </Link>
            </>
          }
          {...register('acceptTerms')}
        />
        {errors.acceptTerms && (
          <p className="-mt-2 text-badge text-danger" role="alert">
            {errors.acceptTerms.message}
          </p>
        )}

        {registerMutation.isError && (
          <InfoAlert tone="danger">{extractErrorMessage(registerMutation.error)}</InfoAlert>
        )}

        <Button type="submit" fullWidth loading={isSubmitting || registerMutation.isPending}>
          إنشاء حساب
        </Button>
      </form>

      {GOOGLE_SIGN_IN_ENABLED && (
        <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5">
          <p className="text-center text-badge text-ink-400">أو</p>
          <GoogleSignInButton
            intent="register"
            onSuccess={(user) => router.replace(resolveHomeRoute(user))}
          />
        </div>
      )}
    </AuthShell>
  );
}
