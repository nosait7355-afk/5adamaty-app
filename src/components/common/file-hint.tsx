import { cn } from '@/lib/cn';

const MIME_LABELS: Record<string, string> = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
  'application/pdf': 'PDF',
};

export interface FileHintProps {
  accept: readonly string[];
  maxSizeMB: number;
  className?: string;
}

/**
 * سطر قيود الملف تحت زر الرفع — «JPG, PNG حتى 5MB» (الصورة 21).
 *
 * لماذا `<bdi>`؟ خلط مقاطع لاتينية داخل جملة عربية يجعل محرك BiDi يعيد
 * ترتيبها فتُعرض «JPG, PNG 5 حتىMB». عنصر `<bdi>` يعزل كل مقطع لاتيني
 * فيظل في موضعه الصحيح. لا تستبدله بـ`<span>` عادي.
 */
export function FileHint({ accept, maxSizeMB, className }: FileHintProps) {
  const formats = accept
    .map((mime) => MIME_LABELS[mime])
    .filter((label): label is string => Boolean(label));

  return (
    <p className={cn('text-badge text-ink-400', className)}>
      <bdi>{formats.join('، ')}</bdi> حتى <bdi>{maxSizeMB}MB</bdi>
    </p>
  );
}
