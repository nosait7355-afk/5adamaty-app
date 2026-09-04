'use client';

import { useParams } from 'next/navigation';
import { CircleDollarSign } from 'lucide-react';
import { AdminShell, AdminPageHeader } from '@/components/layout/admin-shell';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/states';
import { OrderStatusBadge } from '@/components/common/status-badge';
import { InfoAlert } from '@/components/common/info-alert';
import { useAdminOrder } from '@/lib/queries/admin';
import { formatAddress, formatDateTime, formatOrderNumber, formatPrice } from '@/lib/format';
import { ORDER_STATUS_LABELS_AR, type OrderStatus } from '@/shared/constants/order-status';

/** تفاصيل طلب لأغراض الدعم والتدقيق — قراءة فقط، بلا أي زر تعديل حالة. */
export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const order = useAdminOrder(params.id);

  return (
    <AdminShell>
      <AdminPageHeader title="تفاصيل الطلب" subtitle="عرض إشرافي — للدعم والتدقيق فقط" />

      {order.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-32 rounded-card" />
          <Skeleton className="h-48 rounded-card" />
        </div>
      ) : order.isError ? (
        <ErrorState message="تعذّر تحميل الطلب" onRetry={() => void order.refetch()} />
      ) : (
        <>
          <Card className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-card-title font-bold text-ink-900">{order.data.serviceType}</h2>
              <p className="num text-badge text-ink-400">
                {formatOrderNumber(order.data.orderNumber)} · {formatDateTime(order.data.createdAt)}
              </p>
            </div>
            <OrderStatusBadge status={order.data.status as OrderStatus} />
          </Card>

          <Card>
            <h3 className="mb-2 text-label font-bold text-ink-900">تفاصيل الخدمة</h3>
            <p className="text-meta leading-6 text-ink-600">{order.data.details}</p>
          </Card>

          <Card>
            <h3 className="mb-2 text-label font-bold text-ink-900">العنوان</h3>
            <p className="text-meta text-ink-600">{formatAddress(order.data.address)}</p>
          </Card>

          {order.data.agreedPrice != null && (
            <InfoAlert tone={order.data.cashReceivedConfirmed ? 'success' : 'warning'}>
              <span className="flex items-center gap-2">
                <CircleDollarSign size={16} aria-hidden="true" />
                القيمة المتفق عليها: <span className="num font-bold">{formatPrice(order.data.agreedPrice)}</span>
                {' — '}
                {order.data.cashReceivedConfirmed
                  ? 'أكّد مقدم الخدمة استلام المبلغ نقدًا خارج التطبيق.'
                  : 'لم يُؤكَّد الاستلام بعد.'}
              </span>
            </InfoAlert>
          )}

          <Card>
            <h3 className="mb-3 text-label font-bold text-ink-900">سجل الحالة</h3>
            <ol className="flex flex-col gap-3">
              {order.data.statusHistory.map((entry, index) => (
                <li key={index} className="flex items-start justify-between gap-2 border-s-2 border-brand-100 ps-3">
                  <div>
                    <p className="text-meta font-semibold text-ink-900">
                      {ORDER_STATUS_LABELS_AR[entry.to as OrderStatus] ?? entry.to}
                      {entry.note && <span className="text-ink-400"> — {entry.note}</span>}
                    </p>
                    <p className="text-badge text-ink-400">بواسطة {entry.byRole}</p>
                  </div>
                  <span className="num shrink-0 text-badge text-ink-400">
                    {formatDateTime(entry.at)}
                  </span>
                </li>
              ))}
            </ol>
          </Card>
        </>
      )}
    </AdminShell>
  );
}
