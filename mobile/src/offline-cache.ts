import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import type { Query } from '@tanstack/react-query';

/**
 * ذاكرة البيانات بين مرات فتح التطبيق — يفتح بآخر ما رآه المستخدم حتى بلا
 * إنترنت، ثم يحدّثه فور عودة الاتصال.
 *
 * ما يُحفظ على الجهاز محدود عمدًا:
 * - الكتالوج العام (تصنيفات، بانرات، مهن، مقدمو خدمات، خدمات) — نفس ما
 *   يراه أي زائر.
 * - `account.me` (الاسم والدور) فقط — كي لا يُطرد المستخدم لشاشة الدخول
 *   لمجرد انقطاع الإنترنت.
 *
 * لا عناوين ولا مفضلة ولا إشعارات ولا بحث: بيانات شخصية تبقى على الخادم.
 * تسجيل الخروج يمسح الذاكرة كلها (`queryClient.clear()` في `useLogout`)،
 * فيُكتب فوق المحفوظ نسخة فارغة.
 */

const PERSISTED_ROOTS = new Set(['categories', 'banners', 'professions', 'providers', 'services']);

export function shouldPersistQuery(query: Query): boolean {
  if (query.state.status !== 'success') return false;
  const [root, second] = query.queryKey;
  if (root === 'account') return second === 'me';
  return typeof root === 'string' && PERSISTED_ROOTS.has(root);
}

export const offlinePersister = createAsyncStoragePersister({
  storage: {
    getItem: async (key) => safe(() => localStorage.getItem(key)),
    setItem: async (key, value) => void safe(() => localStorage.setItem(key, value)),
    removeItem: async (key) => void safe(() => localStorage.removeItem(key)),
  },
  key: 'khadamat_offline_cache',
  // لا داعي لكتابة كل تغيير فورًا
  throttleTime: 2000,
});

function safe<T>(read: () => T): T | null {
  try {
    return read();
  } catch {
    // تخزين ممتلئ أو غير متاح — التطبيق يعمل بلا ذاكرة دائمة
    return null;
  }
}

/** أسبوع: بعده البيانات أقدم من أن تُعرض حتى بلا إنترنت. */
export const OFFLINE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
