'use client';

import { useState } from 'react';
import { AdminShell, AdminPageHeader } from '@/components/layout/admin-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, Chip } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/states';
import { useAdminServices, useSetServiceActive } from '@/lib/queries/admin';
import { formatDateShort, formatRating } from '@/lib/format';

const PAGE_SIZE = 20;

/**
 * إشراف الخدمات — إظهار/إخفاء من الاكتشاف بلا حذف السجل ولا مسّ الطلبات
 * القائمة عليه.
 */
export default function AdminServicesPage() {
  const [q, setQ] = useState('');
  const [isActive, setIsActive] = useState<'' | 'true' | 'false'>('');
  const [page, setPage] = useState(1);

  const services = useAdminServices({
    page,
    limit: PAGE_SIZE,
    ...(q.trim() ? { q: q.trim() } : {}),
    ...(isActive ? { isActive } : {}),
  });
  const setActive = useSetServiceActive();

  const items = services.data?.data ?? [];
  const total = services.data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminShell>
      <AdminPageHeader title="الخدمات" subtitle="إشراف على الخدمات المنشورة من مقدمي الخدمة" />

      <Card className="flex flex-col gap-3">
        <Input
          placeholder="بحث بعنوان الخدمة"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <div className="flex gap-2">
          {(['', 'true', 'false'] as const).map((value) => (
            <Chip
              key={value}
              selected={isActive === value}
              onClick={() => {
                setIsActive(value);
                setPage(1);
              }}
            >
              {value === '' ? 'الكل' : value === 'true' ? 'ظاهرة' : 'مخفية'}
            </Chip>
          ))}
        </div>
      </Card>

      {services.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-card" />
          ))}
        </div>
      ) : services.isError ? (
        <ErrorState message="تعذّر تحميل الخدمات" onRetry={() => void services.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState message="لا توجد خدمات مطابقة" />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((service) => (
            <li key={service.id}>
              {/* الزر في سطر مستقل — بجوار العنوان على الموبايل كان يخفيه */}
              <Card className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="line-clamp-2 text-card-title font-bold text-ink-900">
                      {service.title}
                    </h3>
                    <p className="num text-badge text-ink-400">
                      ⭐ {formatRating(service.ratingAvg)} ({service.ratingCount}) ·{' '}
                      {formatDateShort(service.createdAt)}
                    </p>
                  </div>
                  <Badge tone={service.isActive ? 'success' : 'danger'} className="shrink-0">
                    {service.isActive ? 'ظاهرة' : 'مخفية'}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  variant={service.isActive ? 'danger' : 'success'}
                  className="w-fit"
                  loading={setActive.isPending && setActive.variables?.serviceId === service.id}
                  disabled={setActive.isPending}
                  onClick={() =>
                    setActive.mutate({ serviceId: service.id, isActive: !service.isActive })
                  }
                >
                  {service.isActive ? 'إخفاء' : 'إظهار'}
                </Button>
              </Card>
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
