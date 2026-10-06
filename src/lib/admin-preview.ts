'use client';

import { useSyncExternalStore } from 'react';

/**
 * «وضع معاينة العميل» — يتيح لحساب الإدارة تصفّح واجهة العميل
 * (`/home`, `/categories`, `/services`, `/account` …) كما يراها العميل،
 * ثم العودة للوحة التحكم بضغطة.
 *
 * ليس انتحالًا لهوية أحد: الجلسة والدور يبقيان `ADMIN` كما هما، ولا يُرسَل
 * أي شيء للخادم. العلامة مجرد تفضيل تنقّل في `sessionStorage` — فتنتهي
 * بإغلاق التبويب، ولا تتسرّب لمستخدم آخر على نفس الجهاز.
 *
 * لا يستورد هذا الملف `queries/auth` رغم حاجته لفحص الدور: العكس صحيح
 * (`useLogout` يمسح العلامة)، والاستيراد المتبادل يصنع دورة. فحص الدور
 * مسؤولية المستهلك — `AdminPreviewBar` — لا هذه الطبقة.
 */
const STORAGE_KEY = 'kf_admin_preview';

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/**
 * قراءة العلامة. `try/catch` لازم لا احتياطي: `sessionStorage` يرمي في
 * وضع التصفّح الخاص وحين تُمنع بيانات الموقع.
 */
export function isAdminPreviewStored(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function enterAdminPreview(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // تعذّر الحفظ: يتصفّح الأدمن الواجهة بلا شريط رجوع — لا يستحق تعطيل التنقّل
  }
  emit();
}

export function exitAdminPreview(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // لا شيء لنمسحه أصلًا إن كان التخزين ممنوعًا
  }
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * `false` على الخادم وفي أول تصيير على العميل: `sessionStorage` لا وجود
 * له وقت التصيير المسبق، و`useSyncExternalStore` يضمن ألا يختلف الترطيب
 * عن HTML الخادم ثم يصحّح القيمة فورًا بعده.
 */
export function useAdminPreviewFlag(): boolean {
  return useSyncExternalStore(subscribe, isAdminPreviewStored, () => false);
}
