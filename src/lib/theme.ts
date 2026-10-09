import { useSyncExternalStore } from 'react';
import { THEME_STORAGE_KEY, type ThemeChoice } from '@/shared/theme';

/**
 * جانب React من المظهر: قراءة الاختيار وتغييره من «حسابي ← المظهر».
 *
 * التطبيق الأول قبل الرسم يقوم به سكربت `<head>` (shared/theme.ts)؛ هنا
 * نعيد نفس الحساب عند كل تغيير ونبلّغ المكوّنات المشتركة.
 */

const listeners = new Set<() => void>();

function readChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

/** يطبّق الاختيار على `<html>` — نفس قاعدة سكربت `<head>` بالضبط. */
function apply(choice: ThemeChoice) {
  const dark =
    choice === 'dark' ||
    (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

export function setThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // تخزين معطّل — يُطبَّق الآن ويعود للتلقائي عند الفتح التالي
  }
  apply(choice);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** الخادم لا يعرف الاختيار — «تلقائي» حتى يُقرأ التخزين بعد الترطيب. */
export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, readChoice, () => 'system');
}
