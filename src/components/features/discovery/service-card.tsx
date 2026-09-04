'use client';

import { Heart, MapPin, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LinkButton } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MediaThumb } from './media-thumb';
import { Rating } from './rating-stars';
import { cn } from '@/lib/cn';
import { formatExperience, formatPriceFrom } from '@/lib/format';
import type { ServiceCardDto } from '@/server/services/discovery.service';

export interface ServiceCardProps {
  service: ServiceCardDto;
  /** ♡ في أعلى البطاقة — يُربط بنظام المفضلة في Phase 9. */
  onToggleFavorite?: (serviceId: string) => void;
  isFavorite?: boolean;
  className?: string;
}

/**
 * بطاقة الخدمة — الصورة 09.
 *
 * التخطيط: صورة 120×120 في بداية السطر · Chip التصنيف · العنوان · وصف
 * سطران · `⭐ 4.8 (128) · 🛡 +10 سنوات خبرة` · 📍 المنطقة · فوتر بالسعر
 * المبدئي وزر «عرض التفاصيل».
 *
 * السعر للعرض فقط — لا تحصيل داخل التطبيق (PROJECT_PLAN — قواعد الدفع).
 */
export function ServiceCard({
  service,
  onToggleFavorite,
  isFavorite = false,
  className,
}: ServiceCardProps) {
  const provider = service.provider;

  return (
    <Card className={cn('relative', className)}>
      {onToggleFavorite && (
        <button
          type="button"
          onClick={() => onToggleFavorite(service.id)}
          aria-label={isFavorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
          aria-pressed={isFavorite}
          className="absolute end-3 top-3 rounded-full p-1.5 text-ink-400 transition-colors hover:bg-danger-bg hover:text-danger"
        >
          <Heart size={20} className={isFavorite ? 'fill-danger text-danger' : ''} />
        </button>
      )}

      <div className="flex gap-3">
        <MediaThumb
          url={service.image}
          alt={service.title}
          size={120}
          iconName={service.professionIcon}
          rounded="field"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {service.categoryName && (
            <Badge tone="brand" className="w-fit">
              {service.categoryName}
            </Badge>
          )}

          <h3
            className={cn(
              'line-clamp-2 text-card-title font-bold text-ink-900',
              // الحشو يفرغ مكان زر ♡ — يُضاف فقط عند عرضه فعلًا
              onToggleFavorite && 'pe-7'
            )}
          >
            {service.title}
          </h3>

          <p className="line-clamp-2 text-meta text-ink-600">{service.description}</p>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta text-ink-600">
            <Rating value={service.ratingAvg} count={service.ratingCount} />
            {provider.yearsOfExperience != null && (
              <>
                <span className="text-ink-300" aria-hidden="true">
                  ·
                </span>
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck size={15} className="text-success" aria-hidden="true" />
                  <span className="num">{formatExperience(provider.yearsOfExperience)}</span>
                </span>
              </>
            )}
          </div>

          {service.area && (
            <span className="inline-flex items-center gap-1 text-meta text-ink-400">
              <MapPin size={15} aria-hidden="true" />
              {service.area}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
        <span className="num text-card-title font-bold text-brand-600">
          {formatPriceFrom(service.priceFrom)}
        </span>

        <LinkButton
          href={`/providers/${provider.id}?serviceId=${service.id}`}
          size="sm"
          variant="primary"
        >
          عرض التفاصيل
        </LinkButton>
      </div>
    </Card>
  );
}
