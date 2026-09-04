'use client';

import { useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Check,
  CircleAlert,
  CloudUpload,
  FileText,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { FileHint } from './file-hint';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { UploadError, uploadFile } from '@/lib/upload-client';
import type { UploadPurpose } from '@/shared/constants/uploads';

export type UploadState = 'idle' | 'uploading' | 'done' | 'error';

export interface UploadedFileInfo {
  publicId: string;
  format: string;
  bytes: number;
  previewUrl?: string;
}

export interface UploadCardProps {
  /** أيقونة نوع المستند على يمين البطاقة. */
  icon?: ReactNode;
  label: string;
  description: string;
  required?: boolean;
  accept: readonly string[];
  maxSizeMB: number;
  purpose: UploadPurpose;
  /** الملف المرفوع سابقًا — يجعل البطاقة تبدأ بحالة «تم». */
  existing?: UploadedFileInfo & { status?: string; rejectionReason?: string };
  onUploaded: (asset: UploadedFileInfo) => void | Promise<void>;
  onRemove?: () => void | Promise<void>;
  className?: string;
}

/**
 * بطاقة رفع مستند — الصورة 21.
 *
 * التخطيط من التصميم: أيقونة + العنوان + `*` الحمراء + الوصف على اليمين،
 * وزر رفع منقّط مع قيود الملف على اليسار.
 *
 * الحالات: idle → uploading (بشريط تقدّم) → done (بإمكانية الحذف)
 * أو error (بإعادة محاولة).
 */
export function UploadCard({
  icon,
  label,
  description,
  required = false,
  accept,
  maxSizeMB,
  purpose,
  existing,
  onUploaded,
  onRemove,
  className,
}: UploadCardProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [state, setState] = useState<UploadState>(existing ? 'done' : 'idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<UploadedFileInfo | null>(existing ?? null);

  const handleSelect = async (selected: File | undefined) => {
    if (!selected) return;

    setState('uploading');
    setProgress(0);
    setError(null);
    abortRef.current = new AbortController();

    try {
      const asset = await uploadFile({
        file: selected,
        purpose,
        onProgress: setProgress,
        signal: abortRef.current.signal,
      });

      await onUploaded(asset);
      setFile(asset);
      setState('done');
    } catch (caught) {
      setError(caught instanceof UploadError ? caught.message : 'فشل رفع الملف.');
      setState('error');
    } finally {
      abortRef.current = null;
      // نصفّر قيمة الحقل حتى يمكن إعادة اختيار نفس الملف
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (state === 'uploading') {
      abortRef.current?.abort();
      setState('idle');
      return;
    }
    await onRemove?.();
    setFile(null);
    setState('idle');
    setError(null);
  };

  const isRejected = existing?.status === 'REJECTED';

  return (
    <div
      className={cn(
        'rounded-card border bg-surface p-4 shadow-card transition-colors',
        isRejected ? 'border-danger/40' : 'border-border',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* الوصف — يمين */}
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="mt-0.5 shrink-0 text-ink-400" aria-hidden="true">
            {icon ?? <FileText size={22} />}
          </span>
          <div className="min-w-0">
            <p className="text-card-title font-bold text-ink-900">
              {label}
              {required && (
                <span className="ms-1 text-danger" aria-hidden="true">
                  *
                </span>
              )}
              {required && <span className="sr-only"> (مطلوب)</span>}
            </p>
            <p className="mt-0.5 text-meta leading-6 text-ink-400">{description}</p>
          </div>
        </div>

        {/* منطقة الرفع — يسار. قيود الملف داخلها كما في الصورة 21 */}
        <div className="w-[118px] shrink-0 min-[400px]:w-[150px]">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={accept.join(',')}
            className="sr-only"
            onChange={(event) => void handleSelect(event.target.files?.[0])}
          />

          {state === 'idle' && (
            <label
              htmlFor={inputId}
              className="flex cursor-pointer flex-col items-center gap-1 rounded-field border-2 border-dashed border-brand-200 bg-brand-50/50 px-2 py-3 text-center transition-colors hover:bg-brand-50"
            >
              <CloudUpload size={24} className="text-brand-600" aria-hidden="true" />
              <span className="text-badge font-bold text-brand-600">رفع الصورة</span>
              <FileHint accept={accept} maxSizeMB={maxSizeMB} className="text-[10px] leading-4" />
            </label>
          )}

          {state === 'uploading' && (
            <div className="flex flex-col items-center gap-2 rounded-field border border-border px-3 py-4">
              <Spinner size={22} className="text-brand-600" />
              <span className="num text-badge text-brand-600">{formatNumber(progress)}%</span>
              <div
                className="h-1 w-full overflow-hidden rounded-pill bg-border"
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`تقدّم رفع ${label}`}
              >
                <div
                  className="h-full bg-brand-600 transition-[width] duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <button
                type="button"
                onClick={() => void handleRemove()}
                className="flex items-center gap-1 text-badge text-ink-400 hover:text-danger"
              >
                <X size={14} />
                إلغاء
              </button>
            </div>
          )}

          {state === 'done' && file && (
            <div className="flex flex-col items-center gap-2 rounded-field border border-success/30 bg-success-bg px-3 py-3">
              <span className="flex size-8 items-center justify-center rounded-full bg-success text-white">
                <Check size={18} strokeWidth={3} />
              </span>
              <span className="text-badge font-bold text-success">تم الرفع</span>
              <span className="num text-[10px] text-ink-400">
                {file.format.toUpperCase()} · {formatNumber(Math.round(file.bytes / 1024))}KB
              </span>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => void handleRemove()}
                  className="flex items-center gap-1 text-badge text-ink-400 transition-colors hover:text-danger"
                >
                  <Trash2 size={14} />
                  حذف
                </button>
              )}
            </div>
          )}

          {state === 'error' && (
            <label
              htmlFor={inputId}
              className="flex cursor-pointer flex-col items-center gap-1 rounded-field border-2 border-dashed border-danger/40 bg-danger-bg px-3 py-4 text-center"
            >
              <RefreshCw size={22} className="text-danger" aria-hidden="true" />
              <span className="text-badge font-bold text-danger">إعادة المحاولة</span>
            </label>
          )}
        </div>
      </div>

      {/* رسالة الخطأ */}
      {error && (
        <p className="mt-3 flex items-start gap-2 text-badge text-danger" role="alert">
          <CircleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      {/* سبب رفض الإدارة للمستند */}
      {isRejected && existing?.rejectionReason && (
        <p className="mt-3 flex items-start gap-2 rounded-field bg-danger-bg p-2 text-badge text-danger">
          <CircleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-bold">تم رفض المستند: </span>
            {existing.rejectionReason}
          </span>
        </p>
      )}
    </div>
  );
}
