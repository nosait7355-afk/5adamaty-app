import { lazy, type ComponentType } from 'react';
import { Navigate, useParams, type RouteObject } from 'react-router';

/**
 * جدول صفحات التطبيق — نفس صفحات `src/app` بنفس مساراتها، عدا لوحة
 * الإدارة (الموقع فقط) وصفحات نظام التصميم.
 *
 * كل صفحة حزمة مستقلة (`lazy`) فلا يتأخر الفتح الأول بصفحات لم تُطلب.
 */

const page = (load: () => Promise<{ default: ComponentType }>) => {
  const Page = lazy(load);
  return <Page />;
};

/*
 * صفحات Next الديناميكية تستلم `params` كـPromise وتفكّه بـ`use()`.
 * `use()` يعلّق التصيير على أي Promise لم يره من قبل، فنعطيه Promise
 * محلولًا ومعلَّمًا (`status: 'fulfilled'`) ومحفوظًا لكل قيمة — يقرؤه React
 * فورًا بلا تعليق ولا حلقة.
 */
const paramsCache = new Map<string, Promise<Record<string, string>>>();

function resolvedParams(params: Record<string, string>): Promise<Record<string, string>> {
  const key = JSON.stringify(params);
  let promise = paramsCache.get(key);
  if (!promise) {
    const settled = Object.assign(Promise.resolve(params), { status: 'fulfilled', value: params });
    promise = settled;
    paramsCache.set(key, promise);
  }
  return promise;
}

function pageWithParams<P extends Record<string, string>>(
  load: () => Promise<{ default: ComponentType<{ params: Promise<P> }> }>
) {
  const Page = lazy(load);
  function Routed() {
    const params = useParams() as P;
    return <Page params={resolvedParams(params) as Promise<P>} />;
  }
  return <Routed />;
}

export const routes: RouteObject[] = [
  { path: '/', element: page(() => import('@/app/page')) },

  /* ---- المصادقة ---- */
  { path: '/login', element: page(() => import('@/app/login/page')) },
  { path: '/register', element: page(() => import('@/app/register/page')) },
  { path: '/register/provider', element: page(() => import('@/app/register/provider/page')) },
  { path: '/role-select', element: page(() => import('@/app/role-select/page')) },
  { path: '/forgot-password', element: page(() => import('@/app/forgot-password/page')) },
  { path: '/reset-password', element: page(() => import('@/app/reset-password/page')) },

  /* ---- التصفّح ---- */
  { path: '/home', element: page(() => import('@/app/home/page')) },
  { path: '/categories', element: page(() => import('@/app/categories/page')) },
  {
    path: '/categories/:slug',
    element: pageWithParams<{ slug: string }>(() => import('@/app/categories/[slug]/page')),
  },
  { path: '/services', element: page(() => import('@/app/services/page')) },
  { path: '/search', element: page(() => import('@/app/search/page')) },
  {
    path: '/providers/:id',
    element: pageWithParams<{ id: string }>(() => import('@/app/providers/[id]/page')),
  },
  { path: '/notifications', element: page(() => import('@/app/notifications/page')) },

  /* ---- حساب العميل ---- */
  { path: '/account', element: page(() => import('@/app/account/page')) },
  { path: '/account/addresses', element: page(() => import('@/app/account/addresses/page')) },
  {
    path: '/account/become-provider',
    element: page(() => import('@/app/account/become-provider/page')),
  },
  { path: '/account/favorites', element: page(() => import('@/app/account/favorites/page')) },
  { path: '/account/profile', element: page(() => import('@/app/account/profile/page')) },
  { path: '/account/settings', element: page(() => import('@/app/account/settings/page')) },

  /* ---- مساحة مقدم الخدمة ---- */
  { path: '/provider/account', element: page(() => import('@/app/provider/account/page')) },
  // الصفحة القديمة تحويل فقط (انظر `src/app/provider/dashboard/page.tsx`)
  { path: '/provider/dashboard', element: <Navigate to="/provider/profile" replace /> },
  {
    path: '/provider/notifications',
    element: page(() => import('@/app/provider/notifications/page')),
  },
  {
    path: '/provider/pending-review',
    element: page(() => import('@/app/provider/pending-review/page')),
  },
  { path: '/provider/profile', element: page(() => import('@/app/provider/profile/page')) },
  { path: '/provider/reviews', element: page(() => import('@/app/provider/reviews/page')) },
  { path: '/provider/services', element: page(() => import('@/app/provider/services/page')) },

  /* ---- عامة ---- */
  { path: '/help', element: page(() => import('@/app/help/page')) },
  { path: '/privacy', element: page(() => import('@/app/privacy/page')) },
  { path: '/terms', element: page(() => import('@/app/terms/page')) },
  { path: '/delete-account', element: page(() => import('@/app/delete-account/page')) },

  /* ---- خارج التطبيق ---- */
  { path: '/admin/*', element: page(() => import('./pages/admin-unavailable')) },
  { path: '*', element: page(() => import('@/app/not-found')) },
];
