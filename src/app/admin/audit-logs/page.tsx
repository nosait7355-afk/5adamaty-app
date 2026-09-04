'use client';

import { useState } from 'react';
import { AdminShell, AdminPageHeader } from '@/components/layout/admin-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/states';
import { useAdminAuditLogs } from '@/lib/queries/admin';
import { formatDateTime } from '@/lib/format';

const PAGE_SIZE = 30;

/** سجل التدقيق — قراءة فقط لكل إجراء حسّاس (توثيق، تعديل مهنة، إيقاف حساب...). */
export default function AdminAuditLogsPage() {
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);

  const logs = useAdminAuditLogs({
    page,
    limit: PAGE_SIZE,
    ...(entityType.trim() ? { entityType: entityType.trim() } : {}),
  });

  const items = logs.data?.data ?? [];
  const total = logs.data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminShell>
      <AdminPageHeader title="سجل التدقيق" subtitle="كل إجراء حسّاس في المنصة، للقراءة فقط" />

      <Card>
        <Input
          placeholder="فلترة حسب نوع الكيان (مثال: Profession)"
          dir="ltr"
          className="[&_input]:text-end"
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
        />
      </Card>

      {logs.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-card" />
          ))}
        </div>
      ) : logs.isError ? (
        <ErrorState message="تعذّر تحميل سجل التدقيق" onRetry={() => void logs.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState message="لا توجد سجلات مطابقة" />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((log) => (
            <li key={log.id}>
              <Card className="flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="brand">{log.action}</Badge>
                  <span className="num text-badge text-ink-400">{formatDateTime(log.createdAt)}</span>
                </div>
                <p className="text-meta text-ink-600">
                  {log.entityType}
                  {log.entityId ? ` #${log.entityId.slice(-6)}` : ''}
                </p>
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
