'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { AdminShell, AdminPageHeader } from '@/components/layout/admin-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/states';
import { InfoAlert } from '@/components/common/info-alert';
import { CatalogIcon, CATALOG_ICON_NAMES } from '@/components/common/catalog-icon';
import {
  useAdminCategories,
  useCreateCategory,
  useUpdateCategory,
} from '@/lib/queries/admin';
import { ApiClientError } from '@/lib/api-client';
import { formatServicesCount } from '@/lib/format';
import type { AdminCategoryDto } from '@/server/services/admin.service';

const ICON_OPTIONS = CATALOG_ICON_NAMES.map((name) => ({ value: name, label: name }));

/** إدارة التصنيفات الرئيسية — إنشاء وتعديل، بلا حذف (فقط تفعيل/تعطيل). */
export default function AdminCategoriesPage() {
  const [isCreating, setIsCreating] = useState(false);
  const categories = useAdminCategories();

  return (
    <AdminShell>
      <AdminPageHeader
        title="التصنيفات"
        subtitle="التصنيفات الرئيسية الظاهرة في الرئيسية وشاشة التصنيفات"
        action={
          <Button size="sm" iconStart={<Plus size={16} />} onClick={() => setIsCreating((v) => !v)}>
            {isCreating ? 'إلغاء' : 'تصنيف جديد'}
          </Button>
        }
      />

      {isCreating && <CategoryForm onDone={() => setIsCreating(false)} />}

      {categories.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-card" />
          ))}
        </div>
      ) : categories.isError ? (
        <ErrorState message="تعذّر تحميل التصنيفات" onRetry={() => void categories.refetch()} />
      ) : categories.data.length === 0 ? (
        <EmptyState message="لا توجد تصنيفات بعد" />
      ) : (
        <ul className="flex flex-col gap-3">
          {categories.data.map((category) => (
            <li key={category.id}>
              <CategoryRow category={category} />
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}

function CategoryRow({ category }: { category: AdminCategoryDto }) {
  const [editing, setEditing] = useState(false);
  const update = useUpdateCategory();

  if (editing) {
    return <CategoryForm existing={category} onDone={() => setEditing(false)} />;
  }

  return (
    <Card className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <CatalogIcon name={category.icon} size={20} />
        </span>
        <div className="min-w-0">
          <h3 className="line-clamp-1 text-card-title font-bold text-ink-900">{category.name}</h3>
          <p className="line-clamp-1 text-badge text-ink-400">{category.description}</p>
          <p className="num text-badge text-ink-400">{formatServicesCount(category.servicesCount)}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Badge tone={category.isActive ? 'success' : 'danger'}>
          {category.isActive ? 'مفعّل' : 'معطّل'}
        </Badge>
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
          تعديل
        </Button>
        <Button
          size="sm"
          variant={category.isActive ? 'danger' : 'success'}
          loading={update.isPending}
          onClick={() =>
            update.mutate({ categoryId: category.id, isActive: !category.isActive })
          }
        >
          {category.isActive ? 'تعطيل' : 'تفعيل'}
        </Button>
      </div>
    </Card>
  );
}

function CategoryForm({
  existing,
  onDone,
}: {
  existing?: AdminCategoryDto;
  onDone: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [slug, setSlug] = useState(existing?.slug ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? ICON_OPTIONS[0]?.value ?? '');
  const [order, setOrder] = useState(existing?.order ?? 0);
  const [error, setError] = useState('');

  const create = useCreateCategory();
  const update = useUpdateCategory();
  const pending = create.isPending || update.isPending;

  const submit = async () => {
    setError('');
    try {
      if (existing) {
        await update.mutateAsync({ categoryId: existing.id, name, slug, description, icon, order });
      } else {
        await create.mutateAsync({ name, slug, description, icon, order });
      }
      onDone();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'تعذّر الحفظ.');
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-label font-bold text-ink-900">
          {existing ? 'تعديل التصنيف' : 'تصنيف جديد'}
        </h3>
        <button type="button" onClick={onDone} className="text-ink-400 hover:text-ink-600">
          <X size={18} />
        </button>
      </div>

      <Field label="الاسم" required htmlFor="cat-name">
        <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>

      <Field label="الـslug" required htmlFor="cat-slug" hint="حروف لاتينية صغيرة وأرقام وشرطات">
        <Input
          id="cat-slug"
          dir="ltr"
          className="[&_input]:text-end"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
      </Field>

      <Field label="الوصف" required htmlFor="cat-desc" counter={{ current: description.length, max: 200 }}>
        <Textarea
          id="cat-desc"
          rows={2}
          maxLength={200}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      <Field label="الأيقونة" required htmlFor="cat-icon">
        <Select id="cat-icon" options={ICON_OPTIONS} value={icon} onChange={(e) => setIcon(e.target.value)} />
      </Field>

      <Field label="الترتيب" htmlFor="cat-order">
        <Input
          id="cat-order"
          type="number"
          min={0}
          value={order}
          onChange={(e) => setOrder(Number(e.target.value))}
        />
      </Field>

      {error && <InfoAlert tone="danger">{error}</InfoAlert>}

      <Button fullWidth loading={pending} onClick={() => void submit()}>
        حفظ
      </Button>
    </Card>
  );
}
