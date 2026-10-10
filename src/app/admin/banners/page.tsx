'use client';

import { useId, useRef, useState } from 'react';
import { ImagePlus, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { AdminShell, AdminPageHeader } from '@/components/layout/admin-shell';
import { Card } from '@/components/ui/card';
import { Button, buttonClassName } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { EmptyState, ErrorState } from '@/components/common/states';
import { InfoAlert } from '@/components/common/info-alert';
import { PromoBanner } from '@/components/features/discovery/promo-banner';
import {
  useAdminBanners,
  useCreateBanner,
  useDeleteBanner,
  useUpdateBanner,
} from '@/lib/queries/admin';
import { ApiClientError } from '@/lib/api-client';
import { UploadError, uploadFile } from '@/lib/upload-client';
import { toast } from '@/lib/toast';
import { UPLOAD_RULES } from '@/shared/constants/uploads';
import {
  BANNER_ARTS,
  BANNER_ART_LABELS_AR,
  BANNER_TONES,
  BANNER_TONE_LABELS_AR,
  MAX_BANNERS,
  type BannerArt,
  type BannerTone,
} from '@/shared/constants/banners';
import type { AdminBannerDto } from '@/server/services/banner.service';

const TONE_OPTIONS = BANNER_TONES.map((tone) => ({ value: tone, label: BANNER_TONE_LABELS_AR[tone] }));
const ART_OPTIONS = [
  { value: '', label: 'بدون رسمة' },
  ...BANNER_ARTS.map((art) => ({ value: art, label: BANNER_ART_LABELS_AR[art] })),
];

/**
 * بانرات الرئيسية — إضافة وتعديل وترتيب وتفعيل وحذف.
 *
 * كل بطاقة تعرض البانر كما سيظهر للعميل بالضبط (نفس المكوّن)، والنموذج
 * يعرض معاينة حيّة أثناء الكتابة.
 */
export default function AdminBannersPage() {
  const [isCreating, setIsCreating] = useState(false);
  const banners = useAdminBanners();
  const atLimit = (banners.data?.length ?? 0) >= MAX_BANNERS;

  return (
    <AdminShell>
      <AdminPageHeader
        title="البانرات"
        subtitle="الشرائح المتبدّلة أعلى الصفحة الرئيسية"
        action={
          <Button
            size="sm"
            iconStart={isCreating ? <X size={16} /> : <Plus size={16} />}
            disabled={!isCreating && atLimit}
            onClick={() => setIsCreating((v) => !v)}
          >
            {isCreating ? 'إلغاء' : 'بانر جديد'}
          </Button>
        }
      />

      {atLimit && !isCreating && (
        <InfoAlert tone="info" className="mb-3">
          وصلت للحد الأقصى ({MAX_BANNERS} بانرات). احذف بانرًا لإضافة غيره.
        </InfoAlert>
      )}

      {isCreating && (
        <div className="mb-3">
          <BannerForm onDone={() => setIsCreating(false)} />
        </div>
      )}

      {banners.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-56 rounded-card" />
          ))}
        </div>
      ) : banners.isError ? (
        <ErrorState message="تعذّر تحميل البانرات" onRetry={() => void banners.refetch()} />
      ) : banners.data.length === 0 ? (
        <EmptyState message="لا توجد بانرات — الرئيسية تُعرض بدونها" />
      ) : (
        <ul className="flex flex-col gap-3">
          {banners.data.map((banner) => (
            <li key={banner.id}>
              <BannerRow banner={banner} />
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}

function BannerRow({ banner }: { banner: AdminBannerDto }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const update = useUpdateBanner();
  const remove = useDeleteBanner();

  if (editing) {
    return <BannerForm existing={banner} onDone={() => setEditing(false)} />;
  }

  const deleteBanner = async () => {
    try {
      await remove.mutateAsync(banner.id);
      toast.success('حُذف البانر');
    } catch (caught) {
      toast.error(caught instanceof ApiClientError ? caught.message : 'تعذّر الحذف.');
    } finally {
      setConfirmDelete(false);
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className={banner.isActive ? undefined : 'opacity-60'}>
        <PromoBanner slides={[banner]} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={banner.isActive ? 'success' : 'danger'}>
          {banner.isActive ? 'ظاهر' : 'مخفي'}
        </Badge>
        <span className="num text-badge text-ink-400">الترتيب {banner.order}</span>
        <span dir="ltr" className="text-badge text-ink-400">
          {banner.href}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
          تعديل
        </Button>
        <Button
          size="sm"
          variant={banner.isActive ? 'neutral' : 'success'}
          loading={update.isPending}
          onClick={() => update.mutate({ bannerId: banner.id, isActive: !banner.isActive })}
        >
          {banner.isActive ? 'إخفاء' : 'إظهار'}
        </Button>
        <Button
          size="sm"
          variant="danger"
          iconStart={<Trash2 size={16} />}
          onClick={() => setConfirmDelete(true)}
        >
          حذف
        </Button>
      </div>

      <ConfirmSheet
        open={confirmDelete}
        title={`تحذف بانر «${banner.title}»؟`}
        description="سيختفي من الرئيسية نهائيًا مع صورته. لإخفائه مؤقتًا استخدم «إخفاء» بدلًا من ذلك."
        confirmLabel="حذف البانر"
        loading={remove.isPending}
        onConfirm={() => void deleteBanner()}
        onCancel={() => setConfirmDelete(false)}
      />
    </Card>
  );
}

function BannerForm({ existing, onDone }: { existing?: AdminBannerDto; onDone: () => void }) {
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [ctaLabel, setCtaLabel] = useState(existing?.ctaLabel ?? '');
  const [href, setHref] = useState(existing?.href ?? '/categories');
  const [tone, setTone] = useState<BannerTone>(existing?.tone ?? 'brand');
  const [art, setArt] = useState<BannerArt | ''>(existing?.art ?? '');
  const [order, setOrder] = useState(existing?.order ?? 0);
  const [error, setError] = useState('');

  const create = useCreateBanner();
  const update = useUpdateBanner();
  const pending = create.isPending || update.isPending;

  // الصورة المرفوعة تتقدّم على الرسمة — المعاينة تعكس ما سيظهر فعلًا
  const previewImage = existing?.uploadedImage ?? (art ? `/banners/${art}.svg` : undefined);

  const submit = async () => {
    setError('');
    const fields = { title, description, ctaLabel, href, tone, art: art || null, order };
    try {
      if (existing) {
        await update.mutateAsync({ bannerId: existing.id, ...fields });
      } else {
        await create.mutateAsync(fields);
      }
      toast.success('حُفظ البانر');
      onDone();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'تعذّر الحفظ.');
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-label font-bold text-ink-900">{existing ? 'تعديل البانر' : 'بانر جديد'}</h3>
        <button
          type="button"
          onClick={onDone}
          aria-label="إغلاق"
          className="text-ink-400 hover:text-ink-600"
        >
          <X size={18} />
        </button>
      </div>

      <div aria-label="معاينة">
        <span className="mb-1 block text-badge text-ink-400">معاينة</span>
        <PromoBanner
          slides={[
            {
              title: title || 'عنوان البانر',
              description,
              ctaLabel: ctaLabel || 'نص الزر',
              href: href.startsWith('/') ? href : '/',
              tone,
              ...(previewImage ? { image: previewImage } : {}),
            },
          ]}
        />
      </div>

      <Field label="العنوان" required htmlFor="banner-title" counter={{ current: title.length, max: 60 }}>
        <Input
          id="banner-title"
          maxLength={60}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>

      <Field label="الوصف" htmlFor="banner-desc" counter={{ current: description.length, max: 160 }}>
        <Textarea
          id="banner-desc"
          rows={2}
          maxLength={160}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>

      <Field label="نص الزر" required htmlFor="banner-cta" counter={{ current: ctaLabel.length, max: 24 }}>
        <Input
          id="banner-cta"
          maxLength={24}
          value={ctaLabel}
          onChange={(e) => setCtaLabel(e.target.value)}
        />
      </Field>

      <Field
        label="رابط الزر"
        required
        htmlFor="banner-href"
        hint="صفحة داخل التطبيق تبدأ بـ / — مثل /categories أو /help أو /search"
      >
        <Input
          id="banner-href"
          dir="ltr"
          className="[&_input]:text-end"
          value={href}
          onChange={(e) => setHref(e.target.value)}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="اللون" htmlFor="banner-tone">
          <Select
            id="banner-tone"
            options={TONE_OPTIONS}
            value={tone}
            onChange={(e) => setTone(e.target.value as BannerTone)}
          />
        </Field>
        <Field label="الترتيب" htmlFor="banner-order" hint="الأصغر أولًا">
          <Input
            id="banner-order"
            type="number"
            min={0}
            max={100}
            value={order}
            onChange={(e) => setOrder(Number(e.target.value))}
          />
        </Field>
      </div>

      <Field
        label="الرسمة"
        htmlFor="banner-art"
        hint={existing?.uploadedImage ? 'الصورة المرفوعة تظهر بدل الرسمة.' : undefined}
      >
        <Select
          id="banner-art"
          options={ART_OPTIONS}
          value={art}
          onChange={(e) => setArt(e.target.value as BannerArt | '')}
        />
      </Field>

      {existing ? (
        <BannerImageField banner={existing} />
      ) : (
        <p className="text-badge text-ink-400">تقدر ترفع صورة خاصة للبانر بعد حفظه من «تعديل».</p>
      )}

      {error && <InfoAlert tone="danger">{error}</InfoAlert>}

      <Button fullWidth loading={pending} onClick={() => void submit()}>
        حفظ
      </Button>
    </Card>
  );
}

/**
 * صورة البانر المرفوعة — تُحفظ فور الرفع، مستقلة عن زر «حفظ» (نفس سلوك
 * صورة التصنيف). «حذف الصورة» يعيد الرسمة المختارة.
 */
function BannerImageField({ banner }: { banner: AdminBannerDto }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const update = useUpdateBanner();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const rule = UPLOAD_RULES.BANNER_IMAGE;
  const busy = uploading || update.isPending;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const asset = await uploadFile({ file, purpose: 'BANNER_IMAGE' });
      await update.mutateAsync({ bannerId: banner.id, imagePublicId: asset.publicId });
      toast.success('حُفظت صورة البانر');
    } catch (caught) {
      setError(
        caught instanceof UploadError || caught instanceof ApiClientError
          ? caught.message
          : 'تعذّر رفع الصورة. حاول مرة أخرى.'
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const reset = async () => {
    setError('');
    try {
      await update.mutateAsync({ bannerId: banner.id, imagePublicId: null });
      toast.success('حُذفت الصورة');
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'تعذّر الحفظ.');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-label font-semibold text-ink-900">صورة خاصة (اختياري)</span>
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
          {banner.uploadedImage ? 'تغيير الصورة' : 'رفع صورة'}
        </label>
        {banner.uploadedImage && (
          <Button
            size="sm"
            variant="neutral"
            disabled={busy}
            onClick={() => void reset()}
            iconStart={<RotateCcw size={16} />}
          >
            حذف الصورة
          </Button>
        )}
      </div>
      <p className="text-badge text-ink-400">
        JPG أو PNG أو WEBP حتى {rule.maxSizeMB}MB — يفضّل خلفية شفافة (PNG) ومقاس قريب من 280×240.
      </p>
      {error && <InfoAlert tone="danger">{error}</InfoAlert>}
    </div>
  );
}
