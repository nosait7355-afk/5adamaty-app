'use client';

import { useId, useRef, useState } from 'react';
import { ImagePlus, Plus, RotateCcw, X } from 'lucide-react';
import { AdminShell, AdminPageHeader } from '@/components/layout/admin-shell';
import { Card } from '@/components/ui/card';
import { Button, buttonClassName } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { CategoryArt } from '@/components/common/category-art';
import { UploadError, uploadFile } from '@/lib/upload-client';
import { toast } from '@/lib/toast';
import { UPLOAD_RULES } from '@/shared/constants/uploads';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/states';
import { InfoAlert } from '@/components/common/info-alert';
import { CATALOG_ICON_NAMES } from '@/components/common/catalog-icon';
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
    // الأزرار في سطر مستقل تحت البيانات — بجوارها على الموبايل كانت تأخذ العرض
    // كله فيختفي اسم التصنيف ووصفه (نفس ترتيب بطاقة المهن)
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <CategoryArt category={category} size={44} />
          <div className="min-w-0">
            <h3 className="line-clamp-1 text-card-title font-bold text-ink-900">{category.name}</h3>
            <p className="line-clamp-2 text-badge text-ink-400">{category.description}</p>
            <p className="num text-badge text-ink-400">{formatServicesCount(category.servicesCount)}</p>
          </div>
        </div>
        <Badge tone={category.isActive ? 'success' : 'danger'} className="shrink-0">
          {category.isActive ? 'مفعّل' : 'معطّل'}
        </Badge>
      </div>

      <div className="flex gap-2">
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

      {existing && <CategoryImageField category={existing} />}

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

/**
 * صورة التصنيف — تُحفظ فور الرفع، مستقلة عن زر «حفظ» بقية الحقول.
 *
 * الملف يرتفع من المتصفح مباشرة إلى Cloudinary (غرض `CATEGORY_IMAGE`، للإدارة
 * فقط، صور نقطية حتى 2MB)، ثم يتحقق الخادم منه عند Cloudinary قبل ربطه.
 * «الرسمة الافتراضية» تزيل الصورة فتعود الرسمة المضمّنة (أو الأيقونة).
 */
function CategoryImageField({ category }: { category: AdminCategoryDto }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const update = useUpdateCategory();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const rule = UPLOAD_RULES.CATEGORY_IMAGE;

  const busy = uploading || update.isPending;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const asset = await uploadFile({ file, purpose: 'CATEGORY_IMAGE' });
      await update.mutateAsync({ categoryId: category.id, imagePublicId: asset.publicId });
      toast.success('حُفظت صورة التصنيف');
    } catch (caught) {
      setError(
        caught instanceof UploadError || caught instanceof ApiClientError
          ? caught.message
          : 'تعذّر رفع الصورة. حاول مرة أخرى.'
      );
    } finally {
      setUploading(false);
      // نفس الملف يمكن اختياره مرة أخرى بعد خطأ
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const reset = async () => {
    setError('');
    try {
      await update.mutateAsync({ categoryId: category.id, imagePublicId: null });
      toast.success('عادت الرسمة الافتراضية');
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'تعذّر الحفظ.');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-label font-semibold text-ink-900">صورة التصنيف</span>
      <div className="flex items-center gap-3">
        <CategoryArt category={category} size={64} />
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={rule.accept.join(',')}
            className="sr-only"
            disabled={busy}
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
          <label
            htmlFor={inputId}
            className={buttonClassName({
              variant: 'secondary',
              size: 'sm',
              className: busy ? 'pointer-events-none opacity-50' : 'cursor-pointer',
            })}
          >
            {uploading ? <Spinner size={14} /> : <ImagePlus size={16} aria-hidden="true" />}
            {category.image ? 'تغيير الصورة' : 'رفع صورة'}
          </label>
          {category.image && (
            <Button
              size="sm"
              variant="neutral"
              disabled={busy}
              onClick={() => void reset()}
              iconStart={<RotateCcw size={16} />}
            >
              الرسمة الافتراضية
            </Button>
          )}
        </div>
      </div>
      <p className="text-badge text-ink-400">
        JPG أو PNG أو WEBP حتى {rule.maxSizeMB}MB — مربعة ويفضّل 256×256 أو أكبر. تُعرض داخل
        دائرة.
      </p>
      {error && <InfoAlert tone="danger">{error}</InfoAlert>}
    </div>
  );
}
