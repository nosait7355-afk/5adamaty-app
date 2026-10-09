'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ServiceWorkerRegister } from '@/components/common/sw-register';
import { NativeBridge } from '@/components/common/native-bridge';
import { NavigationTracker } from '@/lib/navigation-history';
import { AdminPreviewBar } from '@/components/layout/admin-preview-bar';
import { Toaster } from '@/components/ui/toaster';
import { PullToRefresh } from '@/components/common/pull-to-refresh';

/**
 * مزوّدو الحالة على مستوى التطبيق.
 * TanStack Query لحالة السيرفر · Zustand لا يحتاج Provider.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // البيانات تبقى طازجة دقيقة — يقلل الطلبات غير الضرورية (Performance §14)
            staleTime: 60_000,
            gcTime: 5 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: { retry: 0 },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ServiceWorkerRegister />
      <NativeBridge />
      <NavigationTracker />
      {children}
      <Toaster />
      <PullToRefresh />
      {/* زر عائم يظهر لحساب الإدارة وحده أثناء تصفّح واجهة العميل */}
      <AdminPreviewBar />
    </QueryClientProvider>
  );
}
