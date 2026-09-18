'use client';

import { useId, useState } from 'react';
import { cn } from '@/lib/cn';

/** أسماء الشهور كما تُكتب في مصر. */
const MONTHS_AR = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
] as const;

/** قيمة تُرسَل حين تكون بعض الخانات فقط مملوءة — يرفضها المخطط برسالة واضحة. */
export const INCOMPLETE_DATE = 'incomplete';

interface Parts {
  day: string;
  month: string;
  year: string;
}

function splitIso(value: string): Parts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return { day: '', month: '', year: '' };
  return { year: match[1]!, month: String(Number(match[2])), day: String(Number(match[3])) };
}

/** يجمع الخانات إلى YYYY-MM-DD، أو '' إن كانت كلها فارغة. */
function joinParts({ day, month, year }: Parts): string {
  if (!day && !month && !year) return '';
  if (!day || !month || year.length !== 4) return INCOMPLETE_DATE;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export interface DatePartsInputProps {
  /** التاريخ بصيغة YYYY-MM-DD، أو '' إن لم يُكتب. */
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  /** يُربط بـ`htmlFor` في الحقل — يُعطى لخانة اليوم. */
  id?: string;
}

/**
 * إدخال تاريخ بثلاث خانات: اليوم · الشهر · السنة.
 *
 * بديل \`<input type="date">\`: منتقي التاريخ في أندرويد يبدأ من اليوم الحالي،
 * فيضطر المستخدم للرجوع عشرات السنين شهرًا بشهر لاختيار تاريخ ميلاده.
 * الخانات المنفصلة تُكتب مباشرة، وتُجمَع في قيمة واحدة YYYY-MM-DD تُخزَّن
 * كتاريخ كامل.
 */
export function DatePartsInput({ value, onChange, invalid = false, id }: DatePartsInputProps) {
  /*
   * حالة محلية للخانات: القيمة الخارجية لا تحمل كتابة جزئية (يوم بلا سنة)،
   * فلو اشتققنا الخانات منها مباشرة لمسحنا ما يكتبه المستخدم في منتصفه.
   */
  const [parts, setParts] = useState<Parts>(() => splitIso(value));

  /*
   * مزامنة القيمة الخارجية (استعادة مسودة، أو بيانات من الخادم) بنمط «تعديل
   * الحالة أثناء الرسم»: نعيد الاشتقاق فقط حين تتغيّر القيمة من الخارج إلى
   * شيء لا يطابق ما في الخانات، فلا نمسح كتابة المستخدم الجارية.
   */
  const [syncedValue, setSyncedValue] = useState(value);
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (value !== joinParts(parts)) setParts(splitIso(value));
  }

  const fallbackId = useId();
  const dayId = id ?? fallbackId;

  const update = (patch: Partial<Parts>) => {
    const next = { ...parts, ...patch };
    setParts(next);
    onChange(joinParts(next));
  };

  const box = cn(
    'h-control w-full rounded-field border bg-surface px-3 text-center text-body text-ink-900',
    'focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100',
    invalid ? 'border-danger' : 'border-border'
  );

  return (
    <div className="grid grid-cols-[1fr_1.6fr_1.3fr] gap-2" role="group" aria-label="تاريخ الميلاد">
      <input
        id={dayId}
        className={cn(box, 'num')}
        inputMode="numeric"
        maxLength={2}
        placeholder="اليوم"
        aria-label="اليوم"
        value={parts.day}
        onChange={(event) => update({ day: event.target.value.replace(/\D/g, '').slice(0, 2) })}
      />
      <select
        className={cn(box, !parts.month && 'text-ink-400')}
        aria-label="الشهر"
        value={parts.month}
        onChange={(event) => update({ month: event.target.value })}
      >
        <option value="">الشهر</option>
        {MONTHS_AR.map((name, index) => (
          <option key={name} value={String(index + 1)}>
            {name}
          </option>
        ))}
      </select>
      <input
        className={cn(box, 'num')}
        inputMode="numeric"
        maxLength={4}
        placeholder="السنة"
        aria-label="السنة"
        value={parts.year}
        onChange={(event) => update({ year: event.target.value.replace(/\D/g, '').slice(0, 4) })}
      />
    </div>
  );
}
