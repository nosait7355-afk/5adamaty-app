import { Suspense, useState } from 'react';
import { Outlet, RouterProvider, createBrowserRouter, useRouteError } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NativeBridge } from '@/components/common/native-bridge';
import { PullToRefresh } from '@/components/common/pull-to-refresh';
import { Toaster } from '@/components/ui/toaster';
import { NavigationTracker } from '@/lib/navigation-history';
import GlobalError from '@/app/error';
import Loading from '@/app/loading';
import { RouteGuard } from './route-guard';
import { routes } from './routes';

/**
 * هيكل التطبيق — يقابل `src/app/layout.tsx` و`src/app/providers.tsx`.
 *
 * الفرق عن الموقع: لا service worker (الصفحات في الحزمة أصلًا)، ولا شريط
 * «معاينة الإدارة» (لوحة الإدارة ليست في التطبيق).
 */
function Shell() {
  return (
    <>
      <NativeBridge />
      <NavigationTracker />
      <RouteGuard>
        <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
      </RouteGuard>
      <Toaster />
      <PullToRefresh />
    </>
  );
}

function RouteError() {
  const error = useRouteError();
  const failure = error instanceof Error ? error : new Error(String(error));
  return <GlobalError error={failure} reset={() => window.location.reload()} />;
}

const router = createBrowserRouter([
  { element: <Shell />, errorElement: <RouteError />, children: routes },
]);

export function App() {
  // نفس إعدادات الموقع (`src/app/providers.tsx`)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
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
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
