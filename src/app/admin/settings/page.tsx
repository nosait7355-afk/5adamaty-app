'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { AdminShell, AdminPageHeader } from '@/components/layout/admin-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/states';
import { InfoAlert } from '@/components/common/info-alert';
import { useAdminSettings, useUpsertSetting } from '@/lib/queries/admin';
import { ApiClientError } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import type { AdminSettingDto } from '@/lib/queries/admin';

/**
 * الإعدادات العامة — أزواج مفتاح/قيمة حرة (نص أو رقم أو بوليان) يقرؤها
 * التطبيق عند الحاجة (مثل رقم الدعم أو مدة مراجعة الطلبات).
 */
export default function AdminSettingsPage() {
  const settings = useAdminSettings();
  const [isCreating, setIsCreating] = useState(false);

  return (
    <AdminShell>
      <AdminPageHeader
        title="الإعدادات العامة"
        subtitle="قيم يقرؤها التطبيق — مثل رقم الدعم ومدة مراجعة الطلبات"
        action={
          <Button size="sm" iconStart={<Plus size={16} />} onClick={() => setIsCreating((v) => !v)}>
            {isCreating ? 'إلغاء' : 'إعداد جديد'}
          </Button>
        }
      />

      {isCreating && <SettingForm onDone={() => setIsCreating(false)} />}

      {settings.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-card" />
          ))}
        </div>
      ) : settings.isError ? (
        <ErrorState message="تعذّر تحميل الإعدادات" onRetry={() => void settings.refetch()} />
      ) : settings.data.length === 0 ? (
        <EmptyState message="لا توجد إعدادات بعد" />
      ) : (
        <ul className="flex flex-col gap-3">
          {settings.data.map((setting) => (
            <li key={setting.id}>
              <SettingRow setting={setting} />
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}

function SettingRow({ setting }: { setting: AdminSettingDto }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return <SettingForm existing={setting} onDone={() => setEditing(false)} />;
  }

  return (
    <Card className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="num text-label font-bold text-brand-600">{setting.key}</p>
        <p className="line-clamp-2 text-meta text-ink-900">{String(setting.value)}</p>
        {setting.description && <p className="text-badge text-ink-400">{setting.description}</p>}
        <p className="num text-badge text-ink-400">آخر تحديث {formatDateTime(setting.updatedAt)}</p>
      </div>
      <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
        تعديل
      </Button>
    </Card>
  );
}

function SettingForm({ existing, onDone }: { existing?: AdminSettingDto; onDone: () => void }) {
  const [key, setKey] = useState(existing?.key ?? '');
  const [value, setValue] = useState(existing ? String(existing.value) : '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [error, setError] = useState('');

  const upsert = useUpsertSetting();

  const submit = async () => {
    setError('');
    try {
      // نحافظ على النوع الأصلي إن أمكن: رقم إن كانت القيمة رقمية، وإلا نص
      const parsedValue = value.trim() !== '' && !Number.isNaN(Number(value)) ? Number(value) : value;
      await upsert.mutateAsync({ key, value: parsedValue, description: description || undefined });
      onDone();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'تعذّر الحفظ.');
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      <h3 className="text-label font-bold text-ink-900">
        {existing ? 'تعديل إعداد' : 'إعداد جديد'}
      </h3>

      <Field label="المفتاح" required htmlFor="set-key">
        <Input
          id="set-key"
          dir="ltr"
          className="[&_input]:text-end"
          disabled={Boolean(existing)}
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
      </Field>

      <Field label="القيمة" required htmlFor="set-value">
        <Input id="set-value" value={value} onChange={(e) => setValue(e.target.value)} />
      </Field>

      <Field label="الوصف (اختياري)" htmlFor="set-desc">
        <Input id="set-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      {error && <InfoAlert tone="danger">{error}</InfoAlert>}

      <div className="flex gap-2">
        <Button variant="secondary" onClick={onDone}>
          إلغاء
        </Button>
        <Button className="flex-1" loading={upsert.isPending} onClick={() => void submit()}>
          حفظ
        </Button>
      </div>
    </Card>
  );
}
