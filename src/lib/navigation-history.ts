'use client';

import { useCallback, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { meQueryOptions, resolveHomeRoute } from '@/lib/queries/auth';

/**
 * سجل تنقّل داخلي للتطبيق — يجيب على سؤال واحد: «هل توجد صفحة سابقة
 * **داخل التطبيق** يرجع إليها زر الرجوع؟».
 *
 * `router.back()` وحده لا يفعل شيئًا حين تكون الصفحة أول ما فُتح في
 * الجلسة (رابط مباشر، إقلاع تطبيق أندرويد)، فيبدو زر الرجوع معطّلًا.
 * هنا نحتفظ بمكدّس المسارات في `sessionStorage`: الانتقال لمسار جديد
 * يُضاف، والعودة للمسار السابق مباشرة تُحذف آخر عنصر.
 */
const STORAGE_KEY = 'kf_nav_stack';
const MAX_DEPTH = 50;

/** الشاشات الجذرية — لا زر رجوع فيها، ورجوع أندرويد منها يُغلق التطبيق. */
export const ROOT_PATHS = ['/', '/home', '/login', '/provider/pending-review', '/admin/dashboard'];

export function isRootPath(pathname: string): boolean {
  return ROOT_PATHS.includes(pathname);
}

function readStack(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function writeStack(stack: string[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stack.slice(-MAX_DEPTH)));
  } catch {
    // تخزين غير متاح (وضع خاص) — زر الرجوع يعود للوجهة الافتراضية فقط
  }
}

/** يُسجّل المسار الحالي. يُستدعى من مكوّن `NavigationTracker` عند كل انتقال. */
export function recordNavigation(pathname: string): void {
  const stack = readStack();
  const last = stack.at(-1);
  if (last === pathname) return;

  if (stack.at(-2) === pathname) stack.pop();
  else stack.push(pathname);
  writeStack(stack);
}

export function hasInAppHistory(): boolean {
  return readStack().length > 1;
}

/** يُركَّب مرة واحدة في `AppProviders`. */
export function NavigationTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) recordNavigation(pathname);
  }, [pathname]);

  return null;
}

/**
 * زر رجوع يعمل دائمًا: يرجع للصفحة السابقة إن وُجدت داخل التطبيق، وإلا
 * ينتقل لـ`fallback` أو للصفحة الرئيسية المناسبة لدور المستخدم.
 */
export function useSafeBack(fallback?: string): () => void {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useCallback(() => {
    if (hasInAppHistory()) {
      router.back();
      return;
    }
    if (fallback) {
      router.replace(fallback);
      return;
    }
    void queryClient
      .fetchQuery(meQueryOptions)
      .catch(() => null)
      .then((user) => router.replace(resolveHomeRoute(user ?? null)));
  }, [fallback, queryClient, router]);
}
