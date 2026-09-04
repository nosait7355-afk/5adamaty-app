'use client';

import { useState } from 'react';
import { ChevronDown, MapPin, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatPrice } from '@/lib/format';
import { FAYOUM_AREAS } from '@/shared/constants/fayoum-areas';
import { SORT_LABELS_AR, SORT_OPTIONS, type SortOption } from '@/shared/schemas/catalog.schema';
import type { DiscoveryFilterState } from '@/lib/queries/discovery';

/**
 * شريط الفلاتر — الصورة 09.
 *
 * `📍 كل المناطق` · `السعر ⌄` · `التقييم ⌄` · `الترتيب ⌄` + زر `تصفية`.
 *
 * كل قرص يفتح لوحة خيارات **تحت** الشريط بدل قائمة منسدلة عائمة: على شاشة
 * 375px تخرج القائمة العائمة عن حدود الشاشة في RTL، واللوحة السفلية تتصرّف
 * بشكل متطابق على كل المقاسات.
 *
 * لا فلترة بالمسافة ولا بنصف القطر — المنطقة اختيار نصي من قائمة الفيوم
 * الثابتة (ARCHITECTURE §0.2).
 */

type PanelKey = 'area' | 'price' | 'rating' | 'sort' | null;

interface PriceBand {
  label: string;
  min?: number;
  max?: number;
}

const PRICE_BANDS: PriceBand[] = [
  { label: 'كل الأسعار' },
  { label: `أقل من ${formatPrice(200)}`, max: 200 },
  { label: `${formatPrice(200)} - ${formatPrice(500)}`, min: 200, max: 500 },
  { label: `${formatPrice(500)} - ${formatPrice(1000)}`, min: 500, max: 1000 },
  { label: `أكثر من ${formatPrice(1000)}`, min: 1000 },
];

const RATING_BANDS: { label: string; value?: number }[] = [
  { label: 'كل التقييمات' },
  { label: '4.5 فأعلى', value: 4.5 },
  { label: '4 فأعلى', value: 4 },
  { label: '3 فأعلى', value: 3 },
];

export interface FilterBarProps {
  value: DiscoveryFilterState;
  onChange: (next: DiscoveryFilterState) => void;
  className?: string;
}

export function FilterBar({ value, onChange, className }: FilterBarProps) {
  const [panel, setPanel] = useState<PanelKey>(null);

  const togglePanel = (key: Exclude<PanelKey, null>) =>
    setPanel((current) => (current === key ? null : key));

  const patch = (next: Partial<DiscoveryFilterState>) => {
    onChange({ ...value, ...next });
    setPanel(null);
  };

  /*
   * القرص غير المنتقى يقرأ «السعر» كما في الصورة 09. البحث عن النطاق
   * المطابق مشروط بوجود فلتر فعلي — وإلا طابق النطاق الأول («كل الأسعار»)
   * لأن حدّيه `undefined` مثل الحالة الفارغة تمامًا.
   */
  const hasPriceFilter = value.priceMin != null || value.priceMax != null;
  const activePriceLabel = hasPriceFilter
    ? (PRICE_BANDS.find((band) => band.min === value.priceMin && band.max === value.priceMax)
        ?.label ?? 'السعر')
    : 'السعر';

  const activeRatingLabel =
    value.minRating != null ? `${value.minRating} فأعلى` : 'التقييم';

  const activeCount = [
    value.area,
    value.priceMin ?? value.priceMax,
    value.minRating,
  ].filter((entry) => entry != null).length;

  const reset = () =>
    patch({
      area: undefined,
      priceMin: undefined,
      priceMax: undefined,
      minRating: undefined,
      sort: 'rating',
    });

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="scroll-x flex items-center gap-2 pb-1">
        <FilterChip
          label={value.area ?? 'كل المناطق'}
          icon={<MapPin size={16} />}
          selected={Boolean(value.area)}
          expanded={panel === 'area'}
          onClick={() => togglePanel('area')}
        />
        <FilterChip
          label={activePriceLabel}
          selected={hasPriceFilter}
          expanded={panel === 'price'}
          onClick={() => togglePanel('price')}
        />
        <FilterChip
          label={activeRatingLabel}
          selected={value.minRating != null}
          expanded={panel === 'rating'}
          onClick={() => togglePanel('rating')}
        />
        <FilterChip
          label={SORT_LABELS_AR[value.sort ?? 'rating']}
          selected={Boolean(value.sort) && value.sort !== 'rating'}
          expanded={panel === 'sort'}
          onClick={() => togglePanel('sort')}
        />

        <button
          type="button"
          onClick={reset}
          disabled={activeCount === 0}
          className={cn(
            'inline-flex shrink-0 items-center gap-1.5 rounded-pill border border-brand-600 px-4 py-2',
            'text-label font-semibold text-brand-600 transition-colors hover:bg-brand-50',
            'disabled:cursor-not-allowed disabled:border-border disabled:text-ink-400 disabled:hover:bg-transparent'
          )}
        >
          {activeCount > 0 ? <RotateCcw size={16} /> : <SlidersHorizontal size={16} />}
          تصفية
          {activeCount > 0 && <span className="num">({activeCount})</span>}
        </button>
      </div>

      {panel === 'area' && (
        <OptionPanel title="المنطقة">
          <OptionButton
            label="كل المناطق"
            selected={!value.area}
            onClick={() => patch({ area: undefined })}
          />
          {Object.entries(FAYOUM_AREAS).map(([city, areas]) => (
            <div key={city} className="col-span-full">
              <p className="mb-1.5 mt-2 text-meta font-bold text-ink-400">{city}</p>
              <div className="grid grid-cols-2 gap-2">
                {areas.map((area) => (
                  <OptionButton
                    key={area}
                    label={area}
                    selected={value.area === area}
                    onClick={() => patch({ area })}
                  />
                ))}
              </div>
            </div>
          ))}
        </OptionPanel>
      )}

      {panel === 'price' && (
        <OptionPanel title="السعر المبدئي">
          {PRICE_BANDS.map((band) => (
            <OptionButton
              key={band.label}
              label={band.label}
              selected={band.min === value.priceMin && band.max === value.priceMax}
              onClick={() => patch({ priceMin: band.min, priceMax: band.max })}
            />
          ))}
        </OptionPanel>
      )}

      {panel === 'rating' && (
        <OptionPanel title="التقييم">
          {RATING_BANDS.map((band) => (
            <OptionButton
              key={band.label}
              label={band.label}
              selected={band.value === value.minRating}
              onClick={() => patch({ minRating: band.value })}
            />
          ))}
        </OptionPanel>
      )}

      {panel === 'sort' && (
        <OptionPanel title="الترتيب">
          {SORT_OPTIONS.map((option: SortOption) => (
            <OptionButton
              key={option}
              label={SORT_LABELS_AR[option]}
              selected={(value.sort ?? 'rating') === option}
              onClick={() => patch({ sort: option })}
            />
          ))}
        </OptionPanel>
      )}
    </div>
  );
}

/* ---- عناصر داخلية ---- */

function FilterChip({
  label,
  icon,
  selected,
  expanded,
  onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  selected: boolean;
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-pill px-4 py-2 text-label font-semibold',
        'transition-colors',
        selected
          ? 'bg-brand-600 text-white'
          : 'border border-border bg-surface text-ink-600 hover:bg-brand-50'
      )}
    >
      {icon}
      <span className="line-clamp-1">{label}</span>
      <ChevronDown
        size={16}
        className={cn('transition-transform', expanded && 'rotate-180')}
        aria-hidden="true"
      />
    </button>
  );
}

function OptionPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-border bg-surface p-3 shadow-card">
      <p className="mb-2 text-label font-bold text-ink-900">{title}</p>
      <div className="grid grid-cols-2 gap-2">{children}</div>
    </div>
  );
}

function OptionButton({
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
        'rounded-field border px-3 py-2 text-start text-meta font-semibold transition-colors',
        selected
          ? 'border-brand-600 bg-brand-50 text-brand-600'
          : 'border-border bg-surface text-ink-600 hover:bg-bg'
      )}
    >
      {label}
    </button>
  );
}
