'use client';

import { useState } from 'react';
import { Mail, Phone, ShieldOff, ShieldCheck as ShieldCheckIcon } from 'lucide-react';
import { AdminShell, AdminPageHeader } from '@/components/layout/admin-shell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Chip } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/states';
import { InfoAlert } from '@/components/common/info-alert';
import { useAdminUsers, useSetUserStatus } from '@/lib/queries/admin';
import { formatDateShort } from '@/lib/format';
import { ROLE_LABELS_AR, USER_ROLES, USER_STATUSES, type UserRole, type UserStatus } from '@/shared/constants/roles';

const STATUS_LABELS_AR: Record<UserStatus, string> = {
  ACTIVE: 'نشط',
  SUSPENDED: 'موقوف',
  PENDING_REVIEW: 'قيد المراجعة',
  REJECTED: 'مرفوض',
};

const PAGE_SIZE = 20;

/** إدارة المستخدمين — عملاء ومقدمو خدمة، مع إيقاف/تفعيل الحساب. */
export default function AdminUsersPage() {
  const [role, setRole] = useState<UserRole | ''>('');
  const [status, setStatus] = useState<UserStatus | ''>('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);

  const users = useAdminUsers({
    page,
    limit: PAGE_SIZE,
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
    ...(q.trim() ? { q: q.trim() } : {}),
  });
  const setStatusMutation = useSetUserStatus();

  const items = users.data?.data ?? [];
  const total = users.data?.meta?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminShell>
      <AdminPageHeader title="المستخدمون" subtitle="العملاء ومقدمو الخدمة" />

      <Card className="flex flex-col gap-3">
        <Input
          placeholder="بحث بالاسم أو الهاتف أو البريد"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <div className="scroll-x flex gap-2">
          <Chip
            selected={role === ''}
            onClick={() => {
              setRole('');
              setPage(1);
            }}
          >
            كل الأدوار
          </Chip>
          {USER_ROLES.map((r) => (
            <Chip
              key={r}
              selected={role === r}
              onClick={() => {
                setRole(r);
                setPage(1);
              }}
            >
              {ROLE_LABELS_AR[r]}
            </Chip>
          ))}
        </div>
        <div className="scroll-x flex gap-2">
          <Chip
            selected={status === ''}
            onClick={() => {
              setStatus('');
              setPage(1);
            }}
          >
            كل الحالات
          </Chip>
          {USER_STATUSES.map((s) => (
            <Chip
              key={s}
              selected={status === s}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
            >
              {STATUS_LABELS_AR[s]}
            </Chip>
          ))}
        </div>
      </Card>

      {users.isPending ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-20 rounded-card" />
          ))}
        </div>
      ) : users.isError ? (
        <ErrorState message="تعذّر تحميل المستخدمين" onRetry={() => void users.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState message="لا يوجد مستخدمون مطابقون" />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((user) => (
            <li key={user.id}>
              <Card className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="line-clamp-1 text-card-title font-bold text-ink-900">
                      {user.fullName}
                    </h3>
                    <p className="text-badge text-ink-400">
                      {ROLE_LABELS_AR[user.role as UserRole]} · {STATUS_LABELS_AR[user.status as UserStatus]}
                    </p>
                  </div>
                  {user.status === 'ACTIVE' ? (
                    <Button
                      size="sm"
                      variant="danger"
                      loading={setStatusMutation.isPending}
                      iconStart={<ShieldOff size={14} />}
                      onClick={() =>
                        void setStatusMutation.mutate({ userId: user.id, status: 'SUSPENDED' })
                      }
                    >
                      إيقاف
                    </Button>
                  ) : user.status === 'SUSPENDED' ? (
                    <Button
                      size="sm"
                      variant="success"
                      loading={setStatusMutation.isPending}
                      iconStart={<ShieldCheckIcon size={14} />}
                      onClick={() =>
                        void setStatusMutation.mutate({ userId: user.id, status: 'ACTIVE' })
                      }
                    >
                      تفعيل
                    </Button>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-meta text-ink-400">
                  {user.phone && (
                    <a href={`tel:${user.phone}`} className="num inline-flex items-center gap-1 hover:text-brand-600">
                      <Phone size={13} aria-hidden="true" />
                      {user.phone}
                    </a>
                  )}
                  {user.email && (
                    <a href={`mailto:${user.email}`} className="inline-flex items-center gap-1 hover:text-brand-600">
                      <Mail size={13} aria-hidden="true" />
                      {user.email}
                    </a>
                  )}
                  <span className="num">انضم {formatDateShort(user.createdAt)}</span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {setStatusMutation.isError && (
        <InfoAlert tone="danger">تعذّر تنفيذ الإجراء. حاول مرة أخرى.</InfoAlert>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            size="sm"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            السابق
          </Button>
          <span className="num text-meta text-ink-400">
            {page} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            التالي
          </Button>
        </div>
      )}
    </AdminShell>
  );
}
