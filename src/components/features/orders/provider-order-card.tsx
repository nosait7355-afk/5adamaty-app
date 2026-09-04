'use client';

import { CalendarDays, MapPin, Phone, User } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { LinkButton } from '@/components/ui/button';
import { OrderStatusBadge } from '@/components/common/status-badge';
import { formatDateShort, formatOrderNumber, formatPrice } from '@/lib/format';
import { PAYMENT_METHOD_LABEL_AR } from '@/shared/constants/order-status';
import { cn } from '@/lib/cn';
import type { ProviderOrderDto } from '@/server/services/provider-orders.service';

export interface ProviderOrderCardProps {
  order: ProviderOrderDto;
  className?: string;
}

/**
 * بطاقة الطلب لمقدم الخدمة — الصورة 25.
 *
 * **زر الإجراء الأساسي يتغيّر بالحالة** كما هو مرسوم: قبول الطلب (أزرق) ←
 * تحديث الحالة (برتقالي) ← لقد وصلت (بنفسجي) ← طلب مكتمل (أخضر معطّل).
 * ما يظهر منها مشتق من `availableActions` القادمة من الـState Machine.
 */
export function ProviderOrderCard({ order, className }: ProviderOrderCardProps) {
  const action = primaryAction(order);

  return (
    <Card className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="num text-label font-extrabold text-ink-900">
          {formatOrderNumber(order.orderNumber)}
        </span>
        <OrderStatusBadge status={order.status} />
      </div>

      {/* ---- بيانات العميل ---- */}
      <div className="flex flex-col gap-1 border-b border-border pb-3 text-meta text-ink-600">
        <span className="inline-flex items-center gap-1.5">
          <User size={14} className="text-brand-600" aria-hidden="true" />
          <span className="font-semibold text-ink-900">{order.customer.fullName}</span>
        </span>

        {order.customer.phone && (
          <a
            href={`tel:${order.customer.phone}`}
            className="num inline-flex w-fit items-center gap-1.5 hover:text-brand-600"
          >
            <Phone size={14} aria-hidden="true" />
            {order.customer.phone}
          </a>
        )}

        <span className="inline-flex items-center gap-1.5 text-ink-400">
          <MapPin size={14} aria-hidden="true" />
          {order.address.area}
        </span>

        <span className="num inline-flex items-center gap-1.5 text-ink-400">
          <CalendarDays size={14} aria-hidden="true" />
          {formatDateShort(order.scheduledDate)}
        </span>
      </div>

      {/* ---- الخدمة والسعر ---- */}
      <div className="flex flex-col gap-1">
        <h3 className="line-clamp-1 text-card-title font-bold text-ink-900">{order.serviceType}</h3>
        <div className="flex items-center justify-between gap-2 text-meta">
          <span className="text-ink-400">طريقة الدفع: {PAYMENT_METHOD_LABEL_AR}</span>
          {order.agreedPrice != null && (
            <span className="num font-extrabold text-brand-600">
              {formatPrice(order.agreedPrice)}
            </span>
          )}
        </div>
      </div>

      <LinkButton href={`/provider/orders/${order.id}`} size="md" variant={action.variant} fullWidth>
        {action.label}
      </LinkButton>
    </Card>
  );
}

/** الزر الأساسي بحسب الحالة — ألوانه من الصورة 25. */
function primaryAction(order: ProviderOrderDto): {
  label: string;
  variant: 'primary' | 'warning' | 'success' | 'neutral';
} {
  switch (order.status) {
    case 'NEW':
      return { label: 'قبول الطلب', variant: 'primary' };
    case 'ACCEPTED':
    case 'IN_PROGRESS':
      return { label: 'تحديث الحالة', variant: 'warning' };
    case 'ON_THE_WAY':
      return { label: 'لقد وصلت', variant: 'warning' };
    case 'COMPLETED':
      return { label: 'طلب مكتمل', variant: 'success' };
    default:
      return { label: 'عرض التفاصيل', variant: 'neutral' };
  }
}
