import { useMemo } from 'react';
import {
  useLocation,
  useNavigate,
  useParams as useRouterParams,
  useSearchParams as useRouterSearchParams,
} from 'react-router';

/**
 * بديل `next/navigation` داخل التطبيق — نفس الواجهة التي تستخدمها صفحات
 * `src/app` ومكوّناتها، فوق react-router. يُربط بالاسم في `vite.config.ts`.
 *
 * يغطي ما يُستخدم فعلًا فقط. خيارات Next الخاصة (`scroll`،
 * `transitionTypes`) تُقبل وتُتجاهل.
 */

interface NavigateOptions {
  scroll?: boolean;
  transitionTypes?: string[];
}

export function useRouter() {
  const navigate = useNavigate();

  return useMemo(
    () => ({
      push: (href: string, _options?: NavigateOptions) => void navigate(href),
      replace: (href: string, _options?: NavigateOptions) => void navigate(href, { replace: true }),
      back: () => void navigate(-1),
      forward: () => void navigate(1),
      // في Next يعيد رسم مكوّنات الخادم. هنا لا مكوّنات خادم — البيانات
      // في React Query، وكل استدعاء يتبعه إبطال الاستعلامات المعنية أصلًا.
      refresh: () => undefined,
      // الصفحات مضمّنة في الحزمة المحلية — لا شيء يُجلب مسبقًا
      prefetch: (_href: string) => undefined,
    }),
    [navigate]
  );
}

export function usePathname(): string {
  return useLocation().pathname;
}

export function useSearchParams(): URLSearchParams {
  return useRouterSearchParams()[0];
}

export function useParams<T extends Record<string, string>>(): T {
  return useRouterParams() as T;
}

/** خارج التصيير لا يوجد ما يعادله هنا — المسارات المحوَّلة معرّفة في جدول المسارات. */
export function redirect(href: string): never {
  throw new Error(`redirect(${href}) غير مدعوم في التطبيق — عرّف التحويل في mobile/src/routes.tsx`);
}

export function notFound(): never {
  throw new Error('notFound() غير مدعوم في التطبيق');
}
