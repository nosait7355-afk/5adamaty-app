'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AdminShell, AdminPageHeader } from '@/components/layout/admin-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Chip } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/states';
import { OrderStatusBadge } from '@/components/common/status-badge';
import { useAdminOrders } from '@/lib/queries/admin';
import { formatDateTime, formatOrderNumber, formatPrice } from '@/lib/format';
import { ORDER_STATUSES, ORDER_STATUS_LABELS_AR, type OrderStatus } from '@/shared/constants/order-status';

const PAGE_SIZE = 20;

/** قراءة إشرافية على الطلبات — بلا أي تعديل لحالتها (ذلك من اختصاص طرفي الطلب فقط). */
export default function AdminOrdersPage() {
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const orders = useAdminOrders({
    page,
    limit: PAGE_SIZE,
    ...(status ? { status } : {}),
    ...(q.trim() ? { q: q.trim() } : {}),
  });

  const items = orders.data?.data ?? [];
  const total = orders.data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminShell>
      <AdminPageHeader title="الطلبات" subtitle="قراءة إشرافية لأغراض الدعم والتدقيق" />

      <Card className="flex flex-col gap-3">
        <Input
          placeholder="بحث برقم الطلب"
          inputMode="numeric"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <div className="scroll-x flex gap-2">
          <Chip selected={status === ''} onClick={() => { setStatus(''); setPage(1); }}>
            الكل
          </Chip>
          {ORDER_STATUSES.map((s) => (
            <Chip key={s} selected={status === s} onClick={() => { setStatus(s); setPage(1); }}>
              {ORDER_STATUS_LABELS_AR[s]}
            </Chip>
          ))}
        </div>
      </Card>

      {orders.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-card" />
          ))}
        </div>
      ) : orders.isError ? (
        <ErrorState message="تعذّر تحميل الطلبات" onRetry={() => void orders.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState message="لا توجد طلبات مطابقة" />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((order) => (
            <li key={order.id}>
              <Link href={`/admin/orders/${order.id}`}>
                <Card interactive className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="line-clamp-1 text-card-title font-bold text-ink-900">
                      {order.serviceType}
                    </h3>
                    <p className="num text-badge text-ink-400">
                      {formatOrderNumber(order.orderNumber)} · {formatDateTime(order.createdAt)}
                      {order.agreedPrice ? ` · ${formatPrice(order.agreedPrice)}` : ''}
                    </p>
                  </div>
                  <OrderStatusBadge status={order.status as OrderStatus} />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            السابق
          </Button>
          <span className="num text-meta text-ink-400">
            {page} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            التالي
          </Button>
        </div>
      )}
    </AdminShell>
  );
}
