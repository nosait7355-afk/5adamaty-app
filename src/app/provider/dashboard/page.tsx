'use client';

import Link from 'next/link';
import {
  BadgeCheck,
  ChevronLeft,
  ClipboardList,
  Clock,
  MapPin,
  Settings,
  Star,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
  Wrench,
} from 'lucide-react';
import { AppHeader } from '@/components/layout/app-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PageContainer } from '@/components/layout/page-container';
import { Card, SectionHeader } from '@/components/ui/card';
import { LinkButton } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { InfoAlert } from '@/components/common/info-alert';
import { EmptyState, ErrorState } from '@/components/common/states';
import { ProviderOrderCard } from '@/components/features/orders/provider-order-card';
import { formatNumber, formatPrice, formatRating } from '@/lib/format';
import { useProviderDashboard } from '@/lib/queries/provider-orders';
import { cn } from '@/lib/cn';

/**
 * لوحة تحكم مقدم الخدمة — الصورة 24.
 *
 * ⚠️ «أرباحك» تقرير إحصائي بحت: مجموع قيم الطلبات المكتملة التي حُصّلت
 * **كاش خارج التطبيق**. لا رصيد ولا محفظة ولا سحب ولا أي سجل مالي
 * (ARCHITECTURE §0.1).
 */
export default function ProviderDashboardPage() {
  const dashboard = useProviderDashboard();

  if (dashboard.isPending) {
    return (
      <>
        <AppHeader notificationsHref="/provider/notifications" />
        <PageContainer className="flex flex-col gap-4 pt-4">
          <Skeleton className="h-16 w-full rounded-card" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-24 w-full rounded-card" />
            ))}
          </div>
          <Skeleton className="h-32 w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
        </PageContainer>
        <BottomNav variant="provider" />
      </>
    );
  }

  if (dashboard.isError || !dashboard.data) {
    return (
      <>
        <AppHeader notificationsHref="/provider/notifications" />
        <PageContainer className="pt-6">
          <ErrorState
            message="تعذّر تحميل لوحة التحكم"
            onRetry={() => void dashboard.refetch()}
          />
        </PageContainer>
        <BottomNav variant="provider" />
      </>
    );
  }

  const { provider, kpis, earnings, recentOrders } = dashboard.data;
  const earningsUp = earnings.changePercent >= 0;

  return (
    <>
      <AppHeader notificationsHref="/provider/notifications" />

      <PageContainer className="flex flex-col gap-5 pt-4">
        {/* ---- بانر حالة الحساب ---- */}
        {provider.isActive ? (
          <InfoAlert tone="success" title="حسابك مفعّل">
            ملفك ظاهر للعملاء ويمكنك استقبال الطلبات.
          </InfoAlert>
        ) : (
          <InfoAlert tone="warning" title="حسابك غير مفعّل بعد">
            لن تستقبل طلبات حتى تعتمد الإدارة حسابك.
          </InfoAlert>
        )}

        {/* ---- المؤشرات الأربعة ---- */}
        <div className="grid grid-cols-2 gap-3">
          <KpiCard
            icon={<ClipboardList size={20} />}
            label="طلبات جديدة"
            value={formatNumber(kpis.newOrders)}
            tone="brand"
          />
          <KpiCard
            icon={<Clock size={20} />}
            label="قيد التنفيذ"
            value={formatNumber(kpis.inProgress)}
            tone="warning"
          />
          <KpiCard
            icon={<BadgeCheck size={20} />}
            label="مكتملة هذا الشهر"
            value={formatNumber(kpis.completedThisMonth)}
            tone="success"
          />
          <KpiCard
            icon={<Star size={20} />}
            label="التقييم"
            value={formatRating(kpis.rating)}
            tone="star"
          />
        </div>

        {/* ---- بطاقة الأرباح ---- */}
        <section
          className="rounded-card bg-linear-to-l from-brand-500 to-brand-700 p-4 text-white shadow-brand"
          aria-label="أرباحك"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-label font-semibold opacity-90">أرباحك</p>
              <p className="num mt-1 text-screen-title font-extrabold">
                {formatPrice(earnings.total)}
              </p>
            </div>

            <span
              className={cn(
                'num inline-flex items-center gap-1 rounded-pill bg-white/20 px-2.5 py-1 text-badge font-bold'
              )}
            >
              {earningsUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {formatNumber(Math.abs(earnings.changePercent))}%
            </span>
          </div>

          <p className="num mt-2 text-meta opacity-90">
            هذا الشهر: {formatPrice(earnings.thisMonth)}
          </p>

          <p className="mt-3 rounded-field bg-white/15 px-3 py-2 text-badge leading-5">
            تقرير إحصائي للطلبات المكتملة المحصّلة كاش خارج التطبيق — لا يوجد دفع أونلاين ولا
            رصيد داخل التطبيق.
          </p>
        </section>

        {/* ---- اكتمال الملف ---- */}
        <Card className="flex items-center gap-4">
          <CompletionRing value={provider.profileCompletion} />
          <div className="min-w-0 flex-1">
            <h3 className="text-card-title font-bold text-ink-900">اكتمال الملف</h3>
            <p className="text-meta text-ink-400">
              {provider.profileCompletion >= 100
                ? 'ملفك مكتمل — أحسنت.'
                : 'أكمل ملفك لتظهر أعلى في نتائج البحث.'}
            </p>
          </div>
          <Link
            href="/provider/profile"
            className="shrink-0 text-meta font-semibold text-brand-600"
          >
            تحديث
          </Link>
        </Card>

        {/* ---- أحدث الطلبات ---- */}
        <section aria-label="أحدث الطلبات">
          <SectionHeader
            title="أحدث الطلبات"
            action={
              <Link
                href="/provider/orders"
                className="inline-flex items-center gap-1 text-meta font-semibold text-brand-600"
              >
                عرض الكل
                <ChevronLeft size={16} aria-hidden="true" />
              </Link>
            }
            className="mb-3"
          />

          {recentOrders.length === 0 ? (
            <EmptyState message="لا توجد طلبات بعد" compact />
          ) : (
            <div className="flex flex-col gap-3">
              {recentOrders.map((order) => (
                <ProviderOrderCard key={order.id} order={order} />
              ))}
            </div>
          )}
        </section>

        {/* ---- أدوات مقدم الخدمة ---- */}
        <section aria-label="أدوات مقدم الخدمة">
          <SectionHeader title="أدوات مقدم الخدمة" className="mb-3" />
          <div className="grid grid-cols-3 gap-2">
            <ToolTile href="/provider/profile" icon={<UserRound size={22} />} label="الملف" />
            <ToolTile href="/provider/services" icon={<Wrench size={22} />} label="خدماتي" />
            <ToolTile href="/provider/profile" icon={<MapPin size={22} />} label="مناطق التغطية" />
            <ToolTile href="/provider/reviews" icon={<Star size={22} />} label="التقييمات" />
            <ToolTile href="/provider/orders" icon={<Users size={22} />} label="العملاء" />
            <ToolTile href="/provider/account" icon={<Settings size={22} />} label="الإعدادات" />
          </div>
        </section>

        {/* ---- بانر التوثيق ---- */}
        {!provider.isVerifiedBadge && (
          <Card className="flex items-center gap-3 bg-brand-50">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface text-brand-600">
              <BadgeCheck size={26} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-card-title font-bold text-ink-900">احصل على شارة التوثيق</h3>
              <p className="text-meta text-ink-600">
                أكمل مستنداتك لتحصل على الشارة وتزيد ثقة العملاء.
              </p>
            </div>
            <LinkButton href="/register/provider" size="sm" variant="secondary">
              أكمل
            </LinkButton>
          </Card>
        )}
      </PageContainer>

      <BottomNav variant="provider" />
    </>
  );
}

/* ---- عناصر داخلية ---- */

const KPI_TONES = {
  brand: 'bg-brand-50 text-brand-600',
  warning: 'bg-warning-bg text-warning',
  success: 'bg-success-bg text-success',
  star: 'bg-warning-bg text-star',
} as const;

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: keyof typeof KPI_TONES;
}) {
  return (
    <Card className="flex flex-col gap-2">
      <span
        className={cn('flex size-10 items-center justify-center rounded-full', KPI_TONES[tone])}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="num text-[28px] font-extrabold leading-none text-ink-900">{value}</span>
      <span className="text-meta text-ink-400">{label}</span>
    </Card>
  );
}

/** حلقة نسبة الاكتمال — الصورة 24. */
function CompletionRing({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div
      className="relative flex size-16 shrink-0 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(var(--color-brand-600) ${clamped * 3.6}deg, var(--color-border) 0deg)`,
      }}
      role="img"
      aria-label={`اكتمال الملف ${clamped}%`}
    >
      <span className="num flex size-12 items-center justify-center rounded-full bg-surface text-label font-extrabold text-brand-600">
        {clamped}%
      </span>
    </div>
  );
}

function ToolTile({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-field border border-border bg-surface p-3 text-center transition-colors hover:bg-brand-50"
    >
      <span className="text-brand-600">{icon}</span>
      <span className="text-[11px] font-semibold leading-tight text-ink-700">{label}</span>
    </Link>
  );
}
