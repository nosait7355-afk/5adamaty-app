import Link from 'next/link';
import { BadgeCheck, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { MediaThumb } from './media-thumb';
import { Rating } from './rating-stars';
import { cn } from '@/lib/cn';
import { NAV_FORWARD } from '@/lib/view-transitions';
import type { ProviderCardDto } from '@/server/services/discovery.service';

export interface ProviderMiniCardProps {
  provider: ProviderCardDto;
  className?: string;
}

/**
 * بطاقة مقدم خدمة مصغّرة — carousel «مقدمو خدمات مميزون» في الصورة 06.
 *
 * صورة دائرية + شارة توثيق ✔ + الاسم + المهنة + ⭐(العدد) + 📍 + Chip التصنيف.
 */
export function ProviderMiniCard({ provider, className }: ProviderMiniCardProps) {
  return (
    <Link
      href={`/providers/${provider.id}`}
      transitionTypes={NAV_FORWARD}
      className={cn(
        'flex w-[172px] shrink-0 flex-col items-center gap-2 rounded-card border border-border',
        'pressable bg-surface p-4 text-center shadow-card hover:shadow-card-hover',
        className
      )}
    >
      <span className="relative">
        <MediaThumb
          url={provider.avatar}
          alt={provider.displayName}
          size={72}
          iconName={provider.professionIcon}
          rounded="full"
        />
      </span>

      <span className="flex w-full items-center justify-center gap-1 text-label font-bold text-ink-900">
        <span className="line-clamp-1">{provider.displayName}</span>
        {provider.isVerifiedBadge && (
          <BadgeCheck
            size={16}
            className="shrink-0 fill-brand-600 text-white"
            aria-label="موثّق"
            role="img"
          />
        )}
      </span>

      {provider.professionName && (
        <span className="line-clamp-1 w-full text-meta text-ink-400">{provider.professionName}</span>
      )}

      <Rating value={provider.ratingAvg} count={provider.ratingCount} />

      {provider.area && (
        <span className="inline-flex items-center gap-1 text-meta text-ink-400">
          <MapPin size={14} aria-hidden="true" />
          <span className="line-clamp-1">{provider.area}</span>
        </span>
      )}

      {provider.categoryName && (
        <Badge tone="brand" className="mt-1">
          {provider.categoryName}
        </Badge>
      )}
    </Link>
  );
}
