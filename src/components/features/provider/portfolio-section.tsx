'use client';

import { useId, useRef, useState } from 'react';
import { CircleAlert, ImagePlus, Trash2, Video } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { InfoAlert } from '@/components/common/info-alert';
import { cn } from '@/lib/cn';
import { formatNumber, pluralizeAr } from '@/lib/format';
import { ApiClientError } from '@/lib/api-client';
import { UploadError, uploadFile } from '@/lib/upload-client';
import { useAddPortfolioItem, useRemovePortfolioItem } from '@/lib/queries/provider';
import { UPLOAD_RULES } from '@/shared/constants/uploads';
import type { PortfolioItemDto } from '@/server/services/provider.service';

/**
 * «سابقة أعمالي» — معرض صور وفيديوهات في ملف مقدم الخدمة.
 *
 * الصور والفيديوهات يشتركان في نفس المعرض المخزَّن (`gallery`) لكنهما
 * غرضا رفع منفصلان: Cloudinary يرفع الفيديو على نقطة `/video/upload` بحدّ
 * حجم مختلف كليًا، ولكلٍّ سقف عدد خاص به.
 */

const IMAGE_RULE = UPLOAD_RULES.PROVIDER_GALLERY;
const VIDEO_RULE = UPLOAD_RULES.PROVIDER_PORTFOLIO_VIDEO;

export interface PortfolioSectionProps {
  items: PortfolioItemDto[];
  /** التعديل ممنوع في حالات معيّنة — مثل عرض ملف للقراءة فقط. */
  readOnly?: boolean;
  className?: string;
}

export function PortfolioSection({ items, readOnly = false, className }: PortfolioSectionProps) {
  const imageInputId = useId();
  const videoInputId = useId();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const addMutation = useAddPortfolioItem();
  const removeMutation = useRemovePortfolioItem();

  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);

  const images = items.filter((item) => item.kind === 'IMAGE');
  const videos = items.filter((item) => item.kind === 'VIDEO');

  const isBusy = progress !== null || addMutation.isPending;

  const handleSelect = async (kind: 'IMAGE' | 'VIDEO', selected: File | undefined) => {
    const input = kind === 'IMAGE' ? imageInputRef.current : videoInputRef.current;
    if (!selected) return;

    setError('');
    setProgress(0);

    try {
      const asset = await uploadFile({
        file: selected,
        purpose: kind === 'IMAGE' ? 'PROVIDER_GALLERY' : 'PROVIDER_PORTFOLIO_VIDEO',
        onProgress: setProgress,
      });

      await addMutation.mutateAsync({ publicId: asset.publicId, kind });
    } catch (caught) {
      setError(
        caught instanceof UploadError || caught instanceof ApiClientError
          ? caught.message
          : 'تعذّر إضافة العنصر. حاول مرة أخرى.'
      );
    } finally {
      setProgress(null);
      // تصفير القيمة حتى يمكن إعادة اختيار نفس الملف بعد فشل
      if (input) input.value = '';
    }
  };

  const handleRemove = async (publicId: string) => {
    setError('');
    setRemoving(publicId);
    try {
      await removeMutation.mutateAsync(publicId);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'تعذّر حذف العنصر.');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <section className={cn('flex flex-col gap-3', className)}>
      <div>
        <h3 className="text-section font-bold text-ink-900">سابقة أعمالي</h3>
        <p className="text-meta text-ink-400">
          صور وفيديوهات من أعمالك السابقة — تظهر للعملاء في ملفك وتزيد فرص اختيارك.
        </p>
      </div>

      {/* أزرار الإضافة */}
      {!readOnly && (
        <div className="flex gap-2">
          <input
            ref={imageInputRef}
            id={imageInputId}
            type="file"
            accept={IMAGE_RULE.accept.join(',')}
            className="sr-only"
            disabled={isBusy}
            onChange={(event) => void handleSelect('IMAGE', event.target.files?.[0])}
          />
          <input
            ref={videoInputRef}
            id={videoInputId}
            type="file"
            accept={VIDEO_RULE.accept.join(',')}
            className="sr-only"
            disabled={isBusy}
            onChange={(event) => void handleSelect('VIDEO', event.target.files?.[0])}
          />

          <AddButton
            htmlFor={imageInputId}
            icon={<ImagePlus size={18} />}
            label="إضافة صورة"
            hint={`${formatNumber(images.length)}/${formatNumber(IMAGE_RULE.maxFiles)}`}
            disabled={isBusy || images.length >= IMAGE_RULE.maxFiles}
          />
          <AddButton
            htmlFor={videoInputId}
            icon={<Video size={18} />}
            label="إضافة فيديو"
            hint={`${formatNumber(videos.length)}/${formatNumber(VIDEO_RULE.maxFiles)}`}
            disabled={isBusy || videos.length >= VIDEO_RULE.maxFiles}
          />
        </div>
      )}

      {progress !== null && (
        <div className="flex items-center gap-2 rounded-field border border-border bg-surface px-3 py-2">
          <Spinner size={18} className="text-brand-600" />
          <span className="num text-badge text-brand-600">{formatNumber(progress)}%</span>
          <div
            className="h-1 flex-1 overflow-hidden rounded-pill bg-border"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="تقدّم الرفع"
          >
            <div
              className="h-full bg-brand-600 transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <p className="flex items-start gap-2 text-badge text-danger" role="alert">
          <CircleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <InfoAlert tone="info">
          لم تضف أي أعمال بعد. ارفع حتى {pluralizeAr(IMAGE_RULE.maxFiles, 'صورة', 'صورتين', 'صور')}{' '}
          و{pluralizeAr(VIDEO_RULE.maxFiles, 'فيديو', 'فيديوهين', 'فيديوهات')} (حتى{' '}
          {formatNumber(VIDEO_RULE.maxSizeMB)}MB للفيديو).
        </InfoAlert>
      ) : (
        <ul className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-3">
          {items.map((item) => (
            <li
              key={item.publicId}
              className="relative aspect-square overflow-hidden rounded-card border border-border bg-ink-50"
            >
              {item.kind === 'VIDEO' ? (
                <video
                  src={item.url}
                  className="size-full object-cover"
                  controls
                  preload="metadata"
                  playsInline
                />
              ) : (
                // صور Cloudinary عامة بأبعاد متغيرة — `img` أبسط من `next/image` هنا
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt="من سابقة أعمالي"
                  loading="lazy"
                  className="size-full object-cover"
                />
              )}

              {!readOnly && (
                <button
                  type="button"
                  onClick={() => void handleRemove(item.publicId)}
                  disabled={removing !== null}
                  aria-label="حذف من سابقة الأعمال"
                  className="absolute end-1.5 top-1.5 flex size-8 items-center justify-center rounded-full bg-ink-900/60 text-white transition-colors hover:bg-danger disabled:opacity-50"
                >
                  {removing === item.publicId ? <Spinner size={14} /> : <Trash2 size={14} />}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AddButton(props: {
  htmlFor: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
  disabled: boolean;
}) {
  const { htmlFor, icon, label, hint, disabled } = props;

  return (
    <label
      htmlFor={disabled ? undefined : htmlFor}
      aria-disabled={disabled}
      className={cn(
        'flex flex-1 flex-col items-center gap-1 rounded-field border-2 border-dashed px-2 py-3 text-center transition-colors',
        disabled
          ? 'cursor-not-allowed border-border bg-ink-50 text-ink-400'
          : 'cursor-pointer border-brand-200 bg-brand-50/50 text-brand-600 hover:bg-brand-50'
      )}
    >
      {icon}
      <span className="text-badge font-bold">{label}</span>
      <span className="num text-[10px] text-ink-400">{hint}</span>
    </label>
  );
}
