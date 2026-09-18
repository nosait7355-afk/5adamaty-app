'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Lock, Trash2, TriangleAlert } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { api, ApiClientError } from '@/lib/api-client';

/**
 * حذف الحساب نهائيًا — مطلب Google Play.
 *
 * زر أول يفتح البطاقة، ثم كلمة المرور وزر تأكيد أحمر: خطوتان مقصودتان كي
 * لا يُحذف حساب بلمسة خاطئة. حساب جوجل بلا كلمة مرور يكتب بريده بدلًا منها —
 * الخادم يحدّد أيّهما المطلوب ويعيد رسالة واضحة.
 */
export function DeleteAccountCard({ isProvider = false }: { isProvider?: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [useEmail, setUseEmail] = useState(false);
  const [secret, setSecret] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!secret.trim()) {
      setError(useEmail ? 'اكتب بريدك الإلكتروني.' : 'اكتب كلمة المرور.');
      return;
    }

    setPending(true);
    try {
      await api.delete('/me/account', {
        body: useEmail ? { confirmEmail: secret.trim() } : { password: secret },
      });
      // الجلسة انتهت على الخادم — نمسح أي بيانات مخبّأة للحساب المحذوف
      queryClient.clear();
      router.replace('/role-select');
    } catch (caught) {
      const message =
        caught instanceof ApiClientError ? caught.message : 'تعذّر حذف الحساب. حاول مرة أخرى.';
      setError(message);
      // حساب جوجل بلا كلمة مرور: الخادم يطلب البريد بدلًا منها
      if (message.includes('بريدك الإلكتروني المسجّل')) {
        setUseEmail(true);
        setSecret('');
      }
    } finally {
      setPending(false);
    }
  };

  if (!open) {
    return (
      <Button
        variant="ghost"
        fullWidth
        className="text-danger"
        onClick={() => setOpen(true)}
        iconStart={<Trash2 size={20} />}
      >
        حذف الحساب
      </Button>
    );
  }

  return (
    <Card className="flex flex-col gap-3 border-danger/40">
      <h2 className="flex items-center gap-2 text-card-title font-bold text-danger">
        <TriangleAlert size={20} aria-hidden="true" />
        حذف الحساب نهائيًا
      </h2>

      <ul className="flex list-inside list-disc flex-col gap-1 text-meta text-ink-600">
        <li>سيُحذف حسابك وكل بياناتك ولا يمكن استرجاعها.</li>
        {isProvider ? (
          <li>سيختفي ملفك وخدماتك وتقييماتك ومستنداتك من التطبيق.</li>
        ) : (
          <li>ستُحذف عناوينك ومفضّلتك وتقييماتك وإشعاراتك.</li>
        )}
      </ul>

      <Field
        htmlFor="delete-account-secret"
        label={useEmail ? 'اكتب بريدك الإلكتروني للتأكيد' : 'اكتب كلمة المرور للتأكيد'}
        required
        error={error || undefined}
      >
        <Input
          id="delete-account-secret"
          type={useEmail ? 'email' : 'password'}
          dir={useEmail ? 'ltr' : undefined}
          togglePassword={!useEmail}
          autoComplete={useEmail ? 'email' : 'current-password'}
          icon={<Lock size={20} />}
          value={secret}
          invalid={Boolean(error)}
          onChange={(event) => setSecret(event.target.value)}
        />
      </Field>

      <div className="flex gap-3">
        <Button
          variant="secondary"
          className="flex-1"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setSecret('');
            setError('');
          }}
        >
          إلغاء
        </Button>
        <Button
          variant="danger"
          className="flex-1"
          loading={pending}
          onClick={() => void submit()}
          iconStart={<Trash2 size={18} />}
        >
          احذف حسابي
        </Button>
      </div>
    </Card>
  );
}
