'use client';

import { useState } from 'react';
import { Check, ChevronDown, MapPin, SlidersHorizontal } from 'lucide-react';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { COVERAGE_AREAS } from '@/shared/constants/fayoum-areas';
import { SORT_LABELS_AR, SORT_OPTIONS, type SortOption } from '@/shared/schemas/catalog.schema';
import type { DiscoveryFilterState } from '@/lib/queries/discovery';

/**
 * شريط الفلاتر — الصورة 09.
 *
 * `⚙ تصفية` · `📍 المنطقة ⌄` · `التقييم ⌄` · `الترتيب ⌄`. كل قرص يعرض قيمته
 * الحالية، وأيّها يُضغط يفتح **Bottom Sheet واحدًا** بكل الفلاتر.
 *
 * الاختيارات داخل الشيت مسودة لا تُطبَّق إلا بزر «عرض النتائج»: المستخدم
 * يضبط المنطقة والتقييم معًا ثم يرى النتيجة مرة واحدة، بدل إعادة تحميل
 * القائمة مع كل لمسة. الإغلاق بالسحب أو الرجوع يتجاهل المسودة.
 *
 * قرص السعر أُزيل مع إزالة التسعير من المنصة. لا فلترة بالمسافة ولا بنصف
 * القطر — المنطقة اختيار نصي من قائمة الفيوم الثابتة (ARCHITECTURE §0.2).
 */

const RATING_BANDS: { label: string; short: string; value?: number }[] = [
  { label: 'كل التقييمات', short: 'الكل' },
  { label: '3 فأعلى', short: '+3', value: 3 },
  { label: '4 فأعلى', short: '+4', value: 4 },
  { label: '4.5 فأعلى', short: '+4.5', value: 4.5 },
];

const DEFAULT_SORT: SortOption = 'rating';

type Draft = Pick<DiscoveryFilterState, 'area' | 'minRating' | 'sort'>;

export interface FilterBarProps {
  value: DiscoveryFilterState;
  onChange: (next: DiscoveryFilterState) => void;
  className?: string;
}

export function FilterBar({ value, onChange, className }: FilterBarProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({});

  const activeCount = [value.area, value.minRating].filter((entry) => entry != null).length;
  const sort = value.sort ?? DEFAULT_SORT;

  /** يفتح الشيت بنسخة من القيم الحالية — التعديل عليها لا يمسّ القائمة بعد. */
  const openSheet = () => {
    setDraft({ area: value.area, minRating: value.minRating, sort });
    setOpen(true);
  };

  const apply = () => {
    onChange({ ...value, ...draft });
    setOpen(false);
  };

  const draftIsDefault =
    !draft.area && draft.minRating == null && (draft.sort ?? DEFAULT_SORT) === DEFAULT_SORT;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="scroll-x flex items-center gap-2 pb-1">
        <button
          type="button"
          onClick={openSheet}
          aria-haspopup="dialog"
          className={cn(
            'pressable inline-flex shrink-0 items-center gap-1.5 rounded-pill px-4 py-2 text-label font-semibold',
            activeCount > 0
              ? 'bg-brand-600 text-white'
              : 'border border-brand-600 text-brand-600 hover:bg-brand-50'
          )}
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          تصفية
          {activeCount > 0 && <span className="num">· {activeCount}</span>}
        </button>

        <FilterChip
          label={value.area ?? 'كل المناطق'}
          icon={<MapPin size={16} />}
          selected={Boolean(value.area)}
          onClick={openSheet}
        />
        <FilterChip
          label={value.minRating != null ? `${value.minRating} فأعلى` : 'التقييم'}
          selected={value.minRating != null}
          onClick={openSheet}
        />
        <FilterChip
          label={SORT_LABELS_AR[sort]}
          selected={sort !== DEFAULT_SORT}
          onClick={openSheet}
        />
      </div>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="تصفية النتائج"
        headerAction={
          <button
            type="button"
            onClick={() => setDraft({ area: undefined, minRating: undefined, sort: DEFAULT_SORT })}
            disabled={draftIsDefault}
            className="pressable rounded-field px-2 py-1 text-label font-bold text-brand-600 disabled:text-ink-300"
          >
            إعادة ضبط
          </button>
        }
        footer={
          <Button fullWidth onClick={apply}>
            عرض النتائج
          </Button>
        }
      >
        <div className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2.5 text-label font-bold text-ink-600">المنطقة</legend>
            <div className="flex flex-wrap gap-2">
              <OptionPill
                label="كل المناطق"
                selected={!draft.area}
                onClick={() => setDraft((current) => ({ ...current, area: undefined }))}
              />
              {COVERAGE_AREAS.map((area) => (
                <OptionPill
                  key={area}
                  label={area}
                  selected={draft.area === area}
                  onClick={() => setDraft((current) => ({ ...current, area }))}
                />
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2.5 text-label font-bold text-ink-600">التقييم</legend>
            {/* أزرار مجزّأة: اختيار واحد من أربعة بلمسة، كمفتاح iOS */}
            <div className="grid grid-cols-4 gap-1 rounded-field bg-bg p-1">
              {RATING_BANDS.map((band) => {
                const selected = band.value === draft.minRating;
                return (
                  <button
                    key={band.label}
                    type="button"
                    aria-pressed={selected}
                    aria-label={band.label}
                    onClick={() => setDraft((current) => ({ ...current, minRating: band.value }))}
                    className={cn(
                      'pressable num rounded-[0.6rem] py-2 text-label font-semibold',
                      selected ? 'bg-surface font-extrabold text-ink-900 shadow-card' : 'text-ink-600'
                    )}
                  >
                    {band.short}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1 text-label font-bold text-ink-600">الترتيب</legend>
            <div className="flex flex-col">
              {SORT_OPTIONS.map((option) => {
                const selected = (draft.sort ?? DEFAULT_SORT) === option;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setDraft((current) => ({ ...current, sort: option }))}
                    className={cn(
                      'flex items-center justify-between border-b border-border py-3 text-start text-body last:border-b-0',
                      selected ? 'font-bold text-ink-900' : 'text-ink-600'
                    )}
                  >
                    {SORT_LABELS_AR[option]}
                    {selected && <Check size={20} className="text-brand-600" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>
      </BottomSheet>
    </div>
  );
}

/* ---- عناصر داخلية ---- */

function FilterChip({
  label,
  icon,
  selected,
  onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className={cn(
        'pressable inline-flex shrink-0 items-center gap-1.5 rounded-pill px-4 py-2 text-label font-semibold',
        selected
          ? 'border border-brand-600 bg-brand-50 text-brand-600'
          : 'border border-border bg-surface text-ink-600 hover:bg-brand-50'
      )}
    >
      {icon}
      <span className="line-clamp-1">{label}</span>
      <ChevronDown size={16} aria-hidden="true" />
    </button>
  );
}

function OptionPill({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'pressable rounded-pill px-4 py-2 text-label font-semibold',
        selected ? 'bg-brand-600 text-white' : 'bg-bg text-ink-700 hover:bg-brand-50'
      )}
    >
      {label}
    </button>
  );
}
