'use client';

import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { AppHeader } from '@/components/layout/app-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PageContainer, PageTitle } from '@/components/layout/page-container';
import { Chip } from '@/components/ui/badge';
import { LinkButton } from '@/components/ui/button';
import { OrderCardSkeleton, SkeletonList } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/states';
import { OrderCard } from '@/components/features/orders/order-card';
import { SupportCta } from '@/components/features/discovery/support-cta';
import { useMyOrders } from '@/lib/queries/orders';
import { ORDER_TABS, ORDER_TAB_LABELS_AR, type OrderTab } from '@/shared/schemas/order.schema';

/**
 * طلباتي — الصورة 13.
 *
 * تبويبات بعدّادات + بطاقات بأزرار سياقية + بطاقة الدعم.
 * العدّادات تأتي محسوبة من الخادم في نفس الاستجابة، فلا تتغيّر بتغيّر التبويب.
 */
export default function MyOrdersPage() {
  const [tab, setTab] = useState<OrderTab>('ALL');
  const query = useMyOrders(tab);

  const orders = query.data?.data.items ?? [];
  const counts = query.data?.data.counts ?? {};

  return (
    <>
      <AppHeader />

      <PageContainer className="flex flex-col gap-4">
        <PageTitle title="طلباتي" subtitle="تابع حالة طلباتك" />

        <div className="scroll-x flex gap-2 pb-1">
          {ORDER_TABS.map((entry) => (
            <Chip
              key={entry}
              selected={tab === entry}
              onClick={() => setTab(entry)}
              count={counts[entry] ?? 0}
            >
              {ORDER_TAB_LABELS_AR[entry]}
            </Chip>
          ))}
        </div>

        {query.isPending ? (
          <SkeletonList count={3} Item={OrderCardSkeleton} />
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={44} strokeWidth={1.5} />}
            message="لا توجد طلبات هنا"
            description={
              tab === 'ALL'
                ? 'ابدأ بتصفّح الخدمات واطلب ما تحتاجه.'
                : 'لا توجد طلبات في هذا التبويب.'
            }
            action={
              <LinkButton href="/categories" size="sm" variant="secondary">
                تصفّح الخدمات
              </LinkButton>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}

        <SupportCta />
      </PageContainer>

      <BottomNav />
    </>
  );
}
