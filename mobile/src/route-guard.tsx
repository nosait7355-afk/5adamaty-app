import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useMe } from '@/lib/queries/auth';
import { isProtectedPath, matchesPrefix, resolveRouteRedirect } from '@/shared/route-access';
import Loading from '@/app/loading';

/**
 * حارس الصفحات في التطبيق — يقوم بدور `src/proxy.ts` في الموقع وبنفس
 * القواعد (`shared/route-access.ts`): الصفحات هنا محمَّلة من الجهاز فلا
 * خادم يوجّه قبل عرضها.
 *
 * الجلسة من `/auth/me` (نفس استعلام شاشة البداية، مخزَّن في React Query)،
 * فلا يكلّف التنقّل بين الصفحات طلبًا جديدًا.
 */
export function RouteGuard({ children }: { children: ReactNode }) {
  const { pathname, search } = useLocation();
  const { data: user, isPending } = useMe();

  // صفحات الضيوف تظهر فورًا؛ المحمية تنتظر معرفة الجلسة
  if (isPending) return isProtectedPath(pathname) ? <Loading /> : children;

  const target = resolveRouteRedirect(
    pathname,
    user ? { role: user.role, status: user.status } : null
  );
  if (!target || target === `${pathname}${search}`) return children;

  // لوحة الإدارة ليست في التطبيق — على الموقع فقط
  const destination = matchesPrefix(target, '/admin') ? '/admin' : target;
  return <Navigate to={destination} replace />;
}
