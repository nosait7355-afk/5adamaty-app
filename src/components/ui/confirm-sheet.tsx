'use client';

import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { BottomSheet } from './bottom-sheet';
import { Button } from './button';
import { haptic } from '@/lib/native';

export interface ConfirmSheetProps {
  open: boolean;
  /** سؤال يسمّي ما سيحدث: «تحذف «تسليك مواسير»؟» لا «هل أنت متأكد؟». */
  title: string;
  /** النتيجة بوضوح: ماذا سيختفي، وهل يمكن التراجع. */
  description?: ReactNode;
  /** فعل الزر نفسه: «حذف الخدمة» لا «موافق». */
  confirmLabel: string;
  cancelLabel?: string;
  icon?: ReactNode;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * تأكيد إجراء لا رجعة فيه — بديل `window.confirm`.
 *
 * `window.confirm` داخل WebView أندرويد يعرض عنوان الموقع بالإنجليزية وزرّي
 * OK/CANCEL، ولا يمكن تنسيقه. هنا الزر يسمّي الفعل، والإلغاء بنفس الحجم
 * وفي متناول الإبهام.
 */
export function ConfirmSheet({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'إلغاء',
  icon,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={() => {
        if (!loading) onCancel();
      }}
      title={title}
      hideTitle
    >
      <div className="flex flex-col items-center gap-2 pt-1 text-center">
        <span
          className="mb-1 flex size-14 items-center justify-center rounded-full bg-danger-bg text-danger"
          aria-hidden="true"
        >
          {icon ?? <AlertTriangle size={26} />}
        </span>
        <p className="text-section font-extrabold text-ink-900" aria-hidden="true">
          {title}
        </p>
        {description && <p className="max-w-xs text-body text-ink-600">{description}</p>}

        <div className="mt-4 flex w-full flex-col gap-2">
          <Button
            variant="destructive"
            fullWidth
            loading={loading}
            onClick={() => {
              // اهتزاز «تحذير» مع الإجراء الذي لا رجعة فيه — كتنبيهات الحذف في iOS
              void haptic('warning');
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
          <Button variant="neutral" fullWidth disabled={loading} onClick={onCancel}>
            {cancelLabel}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
