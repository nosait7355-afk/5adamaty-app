'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { AdminShell, AdminPageHeader } from '@/components/layout/admin-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { InfoAlert } from '@/components/common/info-alert';
import { useBroadcastNotification } from '@/lib/queries/admin';
import { ApiClientError } from '@/lib/api-client';
import { formatNumber } from '@/lib/format';

const AUDIENCE_OPTIONS = [
  { value: 'ALL', label: 'كل المستخدمين النشطين' },
  { value: 'CUSTOMERS', label: 'العملاء فقط' },
  { value: 'PROVIDERS', label: 'مقدمو الخدمة فقط' },
] as const;

const TYPE_OPTIONS = [
  { value: 'PROMOTION', label: 'عرض/تخفيض' },
  { value: 'SYSTEM', label: 'إشعار نظامي' },
] as const;

/**
 * بث إشعار عام — الصورة 15 (تبويب «العروض») من جهة الإصدار.
 * حد 5 عمليات بث في الساعة و5000 مستلم لكل عملية (ARCHITECTURE — أداء).
 */
export default function AdminNotificationsPage() {
  const [audience, setAudience] = useState<'ALL' | 'CUSTOMERS' | 'PROVIDERS'>('ALL');
  const [type, setType] = useState<'PROMOTION' | 'SYSTEM'>('PROMOTION');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [error, setError] = useState('');

  const broadcast = useBroadcastNotification();

  const submit = async () => {
    setError('');
    try {
      await broadcast.mutateAsync({
        audience,
        type,
        title,
        body,
        ...(actionUrl.trim() ? { actionUrl: actionUrl.trim() } : {}),
      });
      setTitle('');
      setBody('');
      setActionUrl('');
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'تعذّر إرسال الإشعار.');
    }
  };

  return (
    <AdminShell>
      <AdminPageHeader title="الإشعارات العامة" subtitle="بث إشعار لكل المستخدمين أو فئة منهم" />

      <Card className="flex flex-col gap-4">
        <Field label="الفئة المستهدفة" required htmlFor="bc-audience">
          <Select
            id="bc-audience"
            options={AUDIENCE_OPTIONS}
            value={audience}
            onChange={(e) => setAudience(e.target.value as typeof audience)}
          />
        </Field>

        <Field label="النوع" required htmlFor="bc-type">
          <Select
            id="bc-type"
            options={TYPE_OPTIONS}
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
          />
        </Field>

        <Field label="العنوان" required htmlFor="bc-title" counter={{ current: title.length, max: 120 }}>
          <Input id="bc-title" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>

        <Field label="النص" required htmlFor="bc-body" counter={{ current: body.length, max: 400 }}>
          <Textarea id="bc-body" rows={3} maxLength={400} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>

        <Field
          label="رابط الإجراء (اختياري)"
          htmlFor="bc-url"
          hint="مسار داخلي يبدأ بـ / — مثال: /categories"
        >
          <Input
            id="bc-url"
            dir="ltr"
            className="[&_input]:text-end"
            placeholder="/categories"
            value={actionUrl}
            onChange={(e) => setActionUrl(e.target.value)}
          />
        </Field>

        {error && <InfoAlert tone="danger">{error}</InfoAlert>}

        {broadcast.isSuccess && (
          <InfoAlert tone="success">
            أُرسل الإشعار إلى {formatNumber(broadcast.data.recipientsCount)} مستخدم.
          </InfoAlert>
        )}

        <Button
          fullWidth
          loading={broadcast.isPending}
          disabled={!title.trim() || !body.trim()}
          iconStart={<Send size={18} />}
          onClick={() => void submit()}
        >
          إرسال الإشعار
        </Button>
      </Card>
    </AdminShell>
  );
}
