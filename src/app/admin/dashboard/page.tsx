'use client';

import Link from 'next/link';
import {
  BadgeCheck,
  ClipboardList,
  Grid2x2,
  Star,
  UserCheck,
  Users,
  Wrench,
} from 'lucide-react';
import { AdminShell, AdminPageHeader } from '@/components/layout/admin-shell';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/states';
import { OrderStatusBadge } from '@/components/common/status-badge';
import { useAdminDashboard } from '@/lib/queries/admin';
import { formatNumber, formatRating } from '@/lib/format';
import type { OrderStatus } from '@/shared/constants/order-status';

/**
 * لوحة القيادة — نظرة شاملة على المنصة.
 *
 * لا بطاقة لقيمة الطلبات: التسعير أُزيل من المنصة، فلا قيمة تُجمع.
 */
export default function AdminDashboardPage() {
  const dashboard = useAdminDashboard();

  return (
    <AdminShell>
      <AdminPageHeader title="لوحة القيادة" subtitle="نظرة عامة على المنصة" />

      {dashboard.isPending ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-card" />
          ))}
        </div>
      ) : dashboard.isError ? (
        <ErrorState message="تعذّر تحميل الإحصاءات" onRetry={() => void dashboard.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard icon={<Users size={18} />} label="العملاء" value={dashboard.data.totalCustomers} />
            <StatCard
              icon={<Wrench size={18} />}
              label="مقدمو الخدمة"
              value={dashboard.data.totalProviders}
            />
            <StatCard
              icon={<UserCheck size={18} />}
              label="مزوّدون نشطون"
              value={dashboard.data.activeProviders}
            />
            <Link href="/admin/providers">
              <StatCard
                icon={<BadgeCheck size={18} />}
                label="توثيق معلّق"
                value={dashboard.data.pendingVerifications}
                tone={dashboard.data.pendingVerifications > 0 ? 'warning' : 'default'}
              />
            </Link>
            <StatCard
              icon={<Grid2x2 size={18} />}
              label="التصنيفات"
              value={dashboard.data.categoriesCount}
            />
            <StatCard
              icon={<Wrench size={18} />}
              label="المهن"
              value={dashboard.data.professionsCount}
            />
            <StatCard
              icon={<Star size={18} />}
              label="متوسط التقييم"
              value={formatRating(dashboard.data.avgPlatformRating)}
              raw
            />
            <StatCard
              icon={<ClipboardList size={18} />}
              label="التقييمات الظاهرة"
              value={dashboard.data.reviewsCount}
            />
          </div>

          <Card>
            <h2 className="mb-3 text-label font-bold text-ink-900">الطلبات حسب الحالة</h2>
            <ul className="flex flex-col gap-2">
              {dashboard.data.ordersByStatusLabeled.map((row) => (
                <li key={row.status} className="flex items-center justify-between gap-2">
                  <OrderStatusBadge status={row.status as OrderStatus} />
                  <span className="num text-label font-bold text-ink-900">
                    {formatNumber(row.count)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

        </>
      )}
    </AdminShell>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone = 'default',
  raw = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone?: 'default' | 'warning';
  raw?: boolean;
}) {
  return (
    <Card
      className={
        tone === 'warning' && Number(value) > 0
          ? 'border-warning/40 bg-warning-bg'
          : undefined
      }
    >
      <div className="flex items-center gap-2 text-ink-400">
        {icon}
        <span className="text-badge">{label}</span>
      </div>
      <p className="num mt-2 text-[1.5rem] font-extrabold text-ink-900">
        {raw ? value : formatNumber(Number(value))}
      </p>
    </Card>
  );
}
