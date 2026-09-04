'use client';

import Link from 'next/link';
import { CalendarDays, Clock, MapPin, MessageSquare, Phone, RotateCcw, Star } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { LinkButton } from '@/components/ui/button';
import { OrderStatusBadge } from '@/components/common/status-badge';
import { MediaThumb } from '@/components/features/discovery/media-thumb';
import { buildContactLinks } from '@/lib/queries/orders';
import { formatDateShort, formatOrderNumber, formatPrice, formatTimeRange } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { OrderDto } from '@/server/services/order.service';

export interface OrderCardProps {
  order: OrderDto;
  className?: string;
}

/**
 * بطاقة الطلب — الصورة 13.
 *
 * الأزرار **سياقية بحسب الحالة** كما هو مرسوم: قيد التنفيذ ← تفاصيل + محادثة،
 * مقبول ← تفاصيل + اتصال، مكتمل ← تقييم، ملغي ← طلب مرة أخرى.
 * ما يظهر منها تحكمه أعلام تأتي من الخادم (`canReview`, `isContactUnlocked`)
 * لا اجتهاد في الواجهة.
 */
export function OrderCard({ order, className }: OrderCardProps) {
  const contact = order.isContactUnlocked ? buildContactLinks(order.provider.phone) : null;

  /* لون بطاقة السعر يتبع حالة الطلب — كما في الصورة 13. */
  const priceTone =
    order.status === 'COMPLETED'
      ? 'bg-success-bg text-success'
      : order.status === 'CANCELLED' || order.status === 'REJECTED'
        ? 'bg-danger-bg text-danger'
        : 'bg-brand-50 text-brand-600';

  return (
    <Card className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="num text-label font-extrabold text-ink-900">
          {formatOrderNumber(order.orderNumber)}
        </span>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="flex gap-3">
        <MediaThumb
          url={order.attachments[0]}
          alt={order.serviceType}
          size={80}
          rounded="field"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="line-clamp-1 text-card-title font-bold text-ink-900">
            {order.serviceType}
          </h3>
          <p className="line-clamp-2 text-meta text-ink-600">{order.details}</p>

          <span className="inline-flex items-center gap-1 text-meta text-ink-400">
            <MapPin size={14} aria-hidden="true" />
            {order.address.area}
          </span>

          <span className="num inline-flex flex-wrap items-center gap-x-3 text-meta text-ink-400">
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={14} aria-hidden="true" />
              {formatDateShort(order.scheduledDate)}
            </span>
            {order.preferredTimeFrom && (
              <span className="inline-flex items-center gap-1">
                <Clock size={14} aria-hidden="true" />
                {formatTimeRange(
                  `${order.scheduledDate.slice(0, 10)}T${order.preferredTimeFrom}`,
                  order.preferredTimeTo
                    ? `${order.scheduledDate.slice(0, 10)}T${order.preferredTimeTo}`
                    : undefined
                )}
              </span>
            )}
          </span>
        </div>
      </div>

      {order.agreedPrice != null && (
        <div
          className={cn(
            'flex items-center justify-between rounded-field px-3 py-2 text-label font-semibold',
            priceTone
          )}
        >
          <span>قيمة الخدمة</span>
          <span className="num font-extrabold">{formatPrice(order.agreedPrice)}</span>
        </div>
      )}

      {/* ---- شريط المزوّد ---- */}
      <Link
        href={`/providers/${order.provider.id}`}
        className="flex items-center gap-2 border-t border-border pt-3 text-meta text-ink-600 transition-colors hover:text-brand-600"
      >
        <MediaThumb
          url={order.provider.avatar}
          alt={order.provider.displayName}
          size={32}
          rounded="full"
        />
        <span className="line-clamp-1 flex-1 font-semibold">{order.provider.displayName}</span>
      </Link>

      {/* ---- أزرار سياقية ---- */}
      <div className="flex items-center gap-2">
        <LinkButton href={`/orders/${order.id}`} size="sm" className="flex-1">
          عرض التفاصيل
        </LinkButton>

        {order.canReview && (
          <LinkButton
            href={`/orders/${order.id}/review`}
            size="sm"
            variant="secondary"
            iconStart={<Star size={16} />}
          >
            تقييم الخدمة
          </LinkButton>
        )}

        {(order.status === 'CANCELLED' || order.status === 'REJECTED') && (
          <LinkButton
            href={`/orders/new?providerId=${order.provider.id}`}
            size="sm"
            variant="secondary"
            iconStart={<RotateCcw size={16} />}
          >
            طلب مرة أخرى
          </LinkButton>
        )}

        {contact && (
          <>
            <a
              href={contact.call}
              aria-label={`اتصال بـ${order.provider.displayName}`}
              className="flex size-9 shrink-0 items-center justify-center rounded-field border border-border text-brand-600 transition-colors hover:bg-brand-50"
            >
              <Phone size={18} />
            </a>
            <a
              href={contact.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`واتساب ${order.provider.displayName}`}
              className="flex size-9 shrink-0 items-center justify-center rounded-field border border-border text-whatsapp transition-colors hover:bg-success-bg"
            >
              <MessageSquare size={18} />
            </a>
          </>
        )}
      </div>
    </Card>
  );
}
