import { Star } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatNumber, formatRating } from '@/lib/format';

export interface RatingProps {
  value: number;
  count?: number;
  /** نجمة واحدة + الرقم (نمط البطاقات) بدل خمس نجوم. */
  compact?: boolean;
  size?: number;
  className?: string;
}

/**
 * التقييم — `⭐ 4.8 (128)` كما في الصور 06، 09، 10.
 * الأرقام لاتينية داخل نص عربي (UI_ANALYSIS §1.2).
 */
export function Rating({ value, count, compact = true, size = 16, className }: RatingProps) {
  const label = count != null ? `${formatRating(value)} من 5، ${count} تقييم` : `${formatRating(value)} من 5`;

  return (
    <span
      className={cn('inline-flex items-center gap-1 text-meta text-ink-600', className)}
      aria-label={label}
    >
      {compact ? (
        <Star size={size} className="fill-star text-star" aria-hidden="true" />
      ) : (
        <span className="flex items-center gap-0.5" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <Star
              key={index}
              size={size}
              className={index < Math.round(value) ? 'fill-star text-star' : 'text-ink-300'}
            />
          ))}
        </span>
      )}
      <span className="num font-semibold text-ink-900">{formatRating(value)}</span>
      {count != null && <span className="num text-ink-400">({formatNumber(count)})</span>}
    </span>
  );
}
