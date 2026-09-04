import { Badge } from '@/components/ui/badge';
import {
  ORDER_STATUS_LABELS_AR,
  ORDER_STATUS_TONE,
  type OrderStatus,
} from '@/shared/constants/order-status';
import {
  VERIFICATION_LABELS_AR,
  type VerificationStatus,
} from '@/shared/constants/roles';
import type { StatusTone } from '@/shared/constants/order-status';

export interface OrderStatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

/** شارة حالة الطلب — التسمية واللون يأتيان من ثوابت واحدة لضمان الاتساق. */
export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  return (
    <Badge tone={ORDER_STATUS_TONE[status]} className={className}>
      {ORDER_STATUS_LABELS_AR[status]}
    </Badge>
  );
}

const VERIFICATION_TONE: Record<VerificationStatus, StatusTone> = {
  // مسودة لم تُرسَل — محايدة: ليست إنجازًا ولا تنبيهًا
  DRAFT: 'neutral',
  PENDING_REVIEW: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  RESUBMISSION_REQUIRED: 'warning',
};

export interface VerificationBadgeProps {
  status: VerificationStatus;
  className?: string;
}

/** شارة حالة توثيق مقدم الخدمة (الصورة 23). */
export function VerificationBadge({ status, className }: VerificationBadgeProps) {
  return (
    <Badge tone={VERIFICATION_TONE[status]} className={className}>
      {VERIFICATION_LABELS_AR[status]}
    </Badge>
  );
}
