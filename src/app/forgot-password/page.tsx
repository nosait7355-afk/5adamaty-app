'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Send } from 'lucide-react';
import { AuthShell } from '@/components/features/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InfoAlert } from '@/components/common/info-alert';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/shared/schemas/auth.schema';
import { extractErrorMessage, useForgotPassword } from '@/lib/queries/auth';

/**
 * نسيت كلمة المرور — شاشة مشتقّة، يبررها رابط «نسيت كلمة المرور؟»
 * في شاشة الدخول (الصورة 03).
 *
 * الاستعادة بالبريد فقط. لا كود تحقق ولا رسالة نصية (لا OTP).
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const mutation = useForgotPassword();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await mutation.mutateAsync(values);
    } catch {
      // يُعرض أسفل النموذج
    }
  });

  return (
    <AuthShell
      title="نسيت كلمة المرور"
      subtitle="أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين"
      onBack={() => router.push('/login')}
      footer={
        <p className="text-center text-label text-ink-600">
          تذكرت كلمة المرور؟{' '}
          <Link href="/login" className="font-bold text-brand-600">
            تسجيل الدخول
          </Link>
        </p>
      }
    >
      {mutation.isSuccess ? (
        <InfoAlert tone="success" title="تم إرسال الطلب">
          {mutation.data}
          <br />
          تحقق من بريدك، والرابط صالح لمدة 30 دقيقة.
        </InfoAlert>
      ) : (
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          <Field
            label="البريد الإلكتروني"
            required
            htmlFor="email"
            error={errors.email?.message}
          >
            <Input
              id="email"
              type="email"
              dir="ltr"
              autoComplete="email"
              placeholder="example@email.com"
              icon={<Mail size={20} />}
              invalid={Boolean(errors.email)}
              {...register('email')}
            />
          </Field>

          <InfoAlert tone="info">
            الاستعادة تتم عبر البريد الإلكتروني فقط. إذا سجّلت برقم هاتف بلا بريد، تواصل مع الدعم
            لاستعادة حسابك.
          </InfoAlert>

          {mutation.isError && (
            <InfoAlert tone="danger">{extractErrorMessage(mutation.error)}</InfoAlert>
          )}

          <Button
            type="submit"
            fullWidth
            loading={isSubmitting || mutation.isPending}
            iconStart={<Send size={20} />}
          >
            إرسال رابط إعادة التعيين
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
