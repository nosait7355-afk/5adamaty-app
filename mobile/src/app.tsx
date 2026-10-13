import { Suspense, useState } from 'react';
import { Outlet, RouterProvider, createBrowserRouter, useRouteError } from 'react-router';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { NativeBridge } from '@/components/common/native-bridge';
import { PullToRefresh } from '@/components/common/pull-to-refresh';
import { Toaster } from '@/components/ui/toaster';
import { NavigationTracker } from '@/lib/navigation-history';
import GlobalError from '@/app/error';
import Loading from '@/app/loading';
import { DeepLinks } from './deep-links';
import { PushRegistration } from './push';
import { RouteGuard } from './route-guard';
import { routes } from './routes';
import { OFFLINE_MAX_AGE_MS, offlinePersister, shouldPersistQuery } from './offline-cache';

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
      <DeepLinks />
      <PushRegistration />
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
  // إعدادات الموقع (`src/app/providers.tsx`)، عدا مدة البقاء في الذاكرة:
  // ما يُحفظ للعمل بلا إنترنت (`offline-cache.ts`) يجب أن يبقى ليُحفظ
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            gcTime: OFFLINE_MAX_AGE_MS,
            retry: 1,
            refetchOnWindowFocus: false,
          },
          mutations: { retry: 0 },
        },
      })
  );

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: offlinePersister,
        maxAge: OFFLINE_MAX_AGE_MS,
        dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
      }}
    >
      <RouterProvider router={router} />
    </PersistQueryClientProvider>
  );
}
