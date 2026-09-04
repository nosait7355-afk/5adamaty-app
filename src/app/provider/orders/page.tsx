'use client';

import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { AppHeader } from '@/components/layout/app-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PageContainer, PageTitle } from '@/components/layout/page-container';
import { Chip } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { OrderCardSkeleton, SkeletonList } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/common/states';
import { ProviderOrderCard } from '@/components/features/orders/provider-order-card';
import { SearchBox } from '@/components/features/discovery/search-box';
import { useDebouncedValue } from '@/lib/queries/discovery';
import { useProviderOrders } from '@/lib/queries/provider-orders';
import {
  PROVIDER_ORDER_SORTS,
  PROVIDER_ORDER_SORT_LABELS_AR,
  PROVIDER_ORDER_TABS,
  PROVIDER_ORDER_TAB_LABELS_AR,
  type ProviderOrderSort,
  type ProviderOrderTab,
} from '@/shared/schemas/order.schema';

/**
 * طلباتي — مقدم الخدمة (الصورة 25).
 * ستة تبويبات بعدّادات + بحث برقم الطلب أو اسم العميل + ترتيب.
 */
export default function ProviderOrdersPage() {
  const [tab, setTab] = useState<ProviderOrderTab>('ALL');
  const [term, setTerm] = useState('');
  const [sort, setSort] = useState<ProviderOrderSort>('newest');

  // البحث يمسّ ضمًّا بين مجموعتين — نؤخّره حتى يتوقف المستخدم عن الكتابة
  const debounced = useDebouncedValue(term.trim());

  const query = useProviderOrders({ tab, sort, ...(debounced ? { q: debounced } : {}) });
  const orders = query.data?.data.items ?? [];
  const counts = query.data?.data.counts ?? {};

  return (
    <>
      <AppHeader notificationsHref="/provider/notifications" />

      <PageContainer className="flex flex-col gap-4">
        <PageTitle title="طلباتي" subtitle="تابع طلبات عملائك ونفّذها" />

        <SearchBox
          value={term}
          onValueChange={setTerm}
          placeholder="ابحث برقم الطلب أو اسم العميل…"
        />

        <div className="scroll-x flex gap-2 pb-1">
          {PROVIDER_ORDER_TABS.map((entry) => (
            <Chip
              key={entry}
              selected={tab === entry}
              onClick={() => setTab(entry)}
              count={counts[entry] ?? 0}
            >
              {PROVIDER_ORDER_TAB_LABELS_AR[entry]}
            </Chip>
          ))}
        </div>

        <Select
          aria-label="ترتيب الطلبات"
          value={sort}
          onChange={(event) => setSort(event.target.value as ProviderOrderSort)}
          options={PROVIDER_ORDER_SORTS.map((entry) => ({
            value: entry,
            label: PROVIDER_ORDER_SORT_LABELS_AR[entry],
          }))}
        />

        {query.isPending ? (
          <SkeletonList count={3} Item={OrderCardSkeleton} />
        ) : query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={44} strokeWidth={1.5} />}
            message="لا توجد المزيد من الطلبات"
            description={
              debounced ? `لم نجد ما يطابق «${debounced}».` : 'ستظهر طلبات عملائك هنا فور وصولها.'
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {orders.map((order) => (
              <ProviderOrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </PageContainer>

      <BottomNav variant="provider" />
    </>
  );
}
