'use client';

import { Heart, MapPin, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { MediaThumb } from './media-thumb';
import { Rating } from './rating-stars';
import { cn } from '@/lib/cn';
import { NAV_FORWARD } from '@/lib/view-transitions';
import { formatExperience } from '@/lib/format';
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
 * سطران · `⭐ 4.8 (128) · 🛡 +10 سنوات خبرة` · 📍 المنطقة. البطاقة كلها
 * تفتح ملف مقدم الخدمة — زر «عرض التفاصيل» في الصورة أُزيل لأنه صار مكرّرًا.
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
    <Card
      className={cn(
        /*
         * الضغط مربوط بالرابط لا بالبطاقة: `:active` يصعد للآباء، فلو
         * انكمشت البطاقة نفسها لانكمشت أيضًا مع لمس زر المفضلة.
         */
        'relative transition-[scale] duration-150 ease-out has-[a:active]:scale-[0.98]',
        'has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-brand-600',
        className
      )}
    >
      {onToggleFavorite && (
        <button
          type="button"
          onClick={() => onToggleFavorite(service.id)}
          aria-label={isFavorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
          aria-pressed={isFavorite}
          className="pressable absolute end-3 top-3 z-10 rounded-full p-1.5 text-ink-400 hover:bg-danger-bg hover:text-danger"
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
            {/*
             * البطاقة كلها قابلة للضغط عبر «رابط ممدود»: طبقة `after:` تغطي
             * البطاقة، فيبقى في الصفحة رابط واحد باسم الخدمة (لا رابطان
             * متكرران لقارئ الشاشة) ويظل زر المفضلة فوقها بـ`z-10`.
             */}
            <Link
              href={`/providers/${provider.id}?serviceId=${service.id}`}
              transitionTypes={NAV_FORWARD}
              className="outline-none after:absolute after:inset-0 after:rounded-card after:content-['']"
            >
              {service.title}
            </Link>
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
    </Card>
  );
}
