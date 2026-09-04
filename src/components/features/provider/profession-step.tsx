'use client';

import { useId } from 'react';
import { Briefcase, MapPin, Plus, Trash2 } from 'lucide-react';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/states';
import { CatalogIcon } from '@/components/common/catalog-icon';
import { useCategories, useProfessions } from '@/lib/queries/catalog';
import { FAYOUM_AREAS } from '@/shared/constants/fayoum-areas';
import { cn } from '@/lib/cn';

export interface ProfessionValues {
  categoryId: string;
  professionId: string;
  yearsOfExperience: string;
  bio: string;
  coverageAreas: string[];
  priceMode: string;
  priceMin: string;
  priceMax: string;
  highlights: string[];
}

export const EMPTY_PROFESSION: ProfessionValues = {
  categoryId: '',
  professionId: '',
  yearsOfExperience: '',
  bio: '',
  coverageAreas: [],
  priceMode: 'LATER',
  priceMin: '',
  priceMax: '',
  highlights: [],
};

export interface ProfessionStepProps {
  values: ProfessionValues;
  errors: Partial<Record<keyof ProfessionValues, string>>;
  onChange: (patch: Partial<ProfessionValues>) => void;
}

/**
 * الخطوة 2/4 — المهنة والخدمة (الصورة 20).
 *
 * «التخصص الدقيق» يعتمد على التصنيف: تغيير التصنيف يمسح التخصص المختار،
 * وإلا بقي تخصص لا ينتمي للتصنيف — وهو ما يرفضه الخادم بـ422.
 *
 * مناطق التغطية اختيار متعدد من قائمة الفيوم الثابتة. لا نطاق كيلومترات
 * ولا خريطة (ARCHITECTURE §0.2).
 */
export function ProfessionStep({ values, errors, onChange }: ProfessionStepProps) {
  const ids = {
    category: useId(),
    profession: useId(),
    years: useId(),
    bio: useId(),
    priceMode: useId(),
    priceMin: useId(),
    priceMax: useId(),
    highlight: useId(),
  };

  const categories = useCategories();
  const professions = useProfessions(values.categoryId || undefined);

  const toggleArea = (area: string) => {
    const selected = values.coverageAreas.includes(area);
    onChange({
      coverageAreas: selected
        ? values.coverageAreas.filter((item) => item !== area)
        : [...values.coverageAreas, area],
    });
  };

  const addHighlight = () => {
    if (values.highlights.length >= 6) return;
    onChange({ highlights: [...values.highlights, ''] });
  };

  const updateHighlight = (index: number, text: string) => {
    const next = [...values.highlights];
    next[index] = text;
    onChange({ highlights: next });
  };

  const removeHighlight = (index: number) => {
    onChange({ highlights: values.highlights.filter((_, position) => position !== index) });
  };

  return (
    <div className="flex flex-col gap-4">
      <Field htmlFor={ids.category} label="التصنيف الرئيسي" required error={errors.categoryId}>
        {categories.isPending ? (
          <Skeleton className="h-control w-full rounded-field" />
        ) : categories.isError ? (
          <ErrorState onRetry={() => void categories.refetch()} />
        ) : (
          <Select
            id={ids.category}
            icon={<Briefcase size={20} />}
            placeholder="اختر التصنيف"
            value={values.categoryId}
            invalid={Boolean(errors.categoryId)}
            onChange={(event) =>
              // تغيير التصنيف يُبطل التخصص السابق حتمًا
              onChange({ categoryId: event.target.value, professionId: '' })
            }
            options={categories.data.map((category) => ({
              value: category.id,
              label: category.name,
            }))}
          />
        )}
      </Field>

      <Field
        htmlFor={ids.profession}
        label="التخصص الدقيق"
        required
        hint={values.categoryId ? undefined : 'اختر التصنيف أولًا'}
        error={errors.professionId}
      >
        <Select
          id={ids.profession}
          icon={<CatalogIcon name={undefined} size={20} />}
          placeholder={values.categoryId ? 'اختر التخصص' : 'اختر التصنيف أولًا'}
          value={values.professionId}
          disabled={!values.categoryId || professions.isPending}
          invalid={Boolean(errors.professionId)}
          onChange={(event) => onChange({ professionId: event.target.value })}
          options={(professions.data ?? []).map((profession) => ({
            value: profession.id,
            label: profession.name,
          }))}
        />
      </Field>

      <Field
        htmlFor={ids.years}
        label="سنوات الخبرة"
        required
        error={errors.yearsOfExperience}
      >
        <Input
          id={ids.years}
          type="number"
          min={0}
          max={70}
          inputMode="numeric"
          placeholder="مثال: 8"
          value={values.yearsOfExperience}
          invalid={Boolean(errors.yearsOfExperience)}
          onChange={(event) => onChange({ yearsOfExperience: event.target.value })}
        />
      </Field>

      <Field
        htmlFor={ids.bio}
        label="وصف الخدمة"
        required
        counter={{ current: values.bio.length, max: 300 }}
        error={errors.bio}
      >
        <Textarea
          id={ids.bio}
          rows={4}
          maxLength={300}
          placeholder="اشرح للعميل ما تقدّمه بالضبط"
          value={values.bio}
          invalid={Boolean(errors.bio)}
          onChange={(event) => onChange({ bio: event.target.value })}
        />
      </Field>

      {/* ---- مناطق التغطية ---- */}
      <Field
        label="المناطق التي تغطيها"
        required
        hint="اختر منطقة واحدة على الأقل"
        error={errors.coverageAreas}
      >
        <div
          className={cn(
            'flex flex-col gap-3 rounded-card border p-3',
            errors.coverageAreas ? 'border-danger' : 'border-border'
          )}
        >
          {Object.entries(FAYOUM_AREAS).map(([city, areas]) => (
            <div key={city}>
              <p className="mb-2 text-meta font-bold text-ink-400">{city}</p>
              <div className="flex flex-wrap gap-2">
                {areas.map((area) => (
                  <Chip
                    key={area}
                    selected={values.coverageAreas.includes(area)}
                    onClick={() => toggleArea(area)}
                    icon={<MapPin size={14} />}
                  >
                    {area}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Field>

      {/* ---- السعر ---- */}
      <Field htmlFor={ids.priceMode} label="سعر الخدمة" hint="اختياري">
        <Select
          id={ids.priceMode}
          value={values.priceMode}
          onChange={(event) => onChange({ priceMode: event.target.value })}
          options={[
            { value: 'LATER', label: 'تحديد السعر لاحقًا' },
            { value: 'RANGE', label: 'سعر تقريبي من / إلى' },
          ]}
        />
      </Field>

      {values.priceMode === 'RANGE' && (
        <div className="grid grid-cols-2 gap-3">
          <Field htmlFor={ids.priceMin} label="من (ج.م)" required error={errors.priceMin}>
            <Input
              id={ids.priceMin}
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="150"
              value={values.priceMin}
              invalid={Boolean(errors.priceMin)}
              onChange={(event) => onChange({ priceMin: event.target.value })}
            />
          </Field>

          <Field htmlFor={ids.priceMax} label="إلى (ج.م)" required error={errors.priceMax}>
            <Input
              id={ids.priceMax}
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="500"
              value={values.priceMax}
              invalid={Boolean(errors.priceMax)}
              onChange={(event) => onChange({ priceMax: event.target.value })}
            />
          </Field>
        </div>
      )}

      {/* ---- ما يميّز خدمتك ---- */}
      <Field label="ما يميّز خدمتك" hint="اختياري — حتى 6 مزايا" error={errors.highlights}>
        <div className="flex flex-col gap-2">
          {values.highlights.map((highlight, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                id={`${ids.highlight}-${index}`}
                aria-label={`الميزة ${index + 1}`}
                maxLength={200}
                placeholder="مثال: ضمان 6 شهور على العمل"
                value={highlight}
                onChange={(event) => updateHighlight(index, event.target.value)}
              />
              <button
                type="button"
                onClick={() => removeHighlight(index)}
                aria-label={`حذف الميزة ${index + 1}`}
                className="flex size-11 shrink-0 items-center justify-center rounded-field border border-border text-danger transition-colors hover:bg-danger-bg"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}

          {values.highlights.length < 6 && (
            <Button
              variant="secondary"
              size="md"
              onClick={addHighlight}
              iconStart={<Plus size={18} />}
            >
              أضف ميزة
            </Button>
          )}
        </div>
      </Field>
    </div>
  );
}
