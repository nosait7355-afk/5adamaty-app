import { useSyncExternalStore } from 'react';

/**
 * عمليات البحث السابقة — على الجهاز فقط (`localStorage`)، لا على الخادم:
 * راحة شخصية لا بيانات يحتاجها أحد غير صاحب الهاتف.
 *
 * مخزن خارجي يُقرأ بـ`useSyncExternalStore`: الخادم يرى قائمة فارغة (لا
 * `window` عنده) والعميل يقرأ التخزين بعد الترطيب، فلا يحدث تعارض.
 * كل قراءة وكتابة داخل try/catch: التخزين قد يكون معطّلًا (تصفّح خاص،
 * مساحة ممتلئة)، والبحث يعمل بدونه.
 */

const KEY = 'khadamaty:recent-searches';
const MAX = 8;
const EMPTY: string[] = [];

let cache: string[] | null = null;
const listeners = new Set<() => void>();

function read(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string').slice(0, MAX)
      : EMPTY;
  } catch {
    return EMPTY;
  }
}

function write(next: string[]) {
  cache = next;
  try {
    if (next.length) window.localStorage.setItem(KEY, JSON.stringify(next));
    else window.localStorage.removeItem(KEY);
  } catch {
    // تخزين معطّل — القائمة تعيش في الذاكرة لهذه الجلسة فقط
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): string[] {
  cache ??= read();
  return cache;
}

export function useRecentSearches(): string[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

/** يضيف البحث في الأعلى ويزيل تكراره — الأحدث أولًا. */
export function addRecentSearch(term: string): void {
  const clean = term.trim();
  if (!clean) return;
  write([clean, ...getSnapshot().filter((item) => item !== clean)].slice(0, MAX));
}

export function clearRecentSearches(): void {
  write(EMPTY);
}
