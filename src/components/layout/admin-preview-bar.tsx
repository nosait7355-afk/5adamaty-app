'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { exitAdminPreview, useAdminPreviewFlag } from '@/lib/admin-preview';
import { useMe } from '@/lib/queries/auth';

/**
 * زر العودة للوحة التحكم — يظهر فقط لحساب `ADMIN` أثناء «وضع معاينة
 * العميل»، فوق كل شاشات العميل.
 *
 * زر عائم `fixed` لا شريط `sticky` أعلى الصفحة: شاشات العميل فيها
 * `AppHeader` لاصق بـ`top-0` بالفعل، وتكديس عنصرين لاصقين يتطلب رقمًا
 * ثابتًا يطابق ارتفاع الأول — هش وينكسر مع أي فرق في الارتفاع (نفس الدرس
 * المشروح في `admin-shell.tsx`). الزر العائم خارج تدفّق التخطيط تمامًا،
 * فلا يزيح محتوى أي صفحة ولا يتنازع على `top-0`.
 *
 * موضعه أعلى شريط التنقّل السفلي ويسار الشاشة — الجهة البعيدة عن إبهام
 * القارئ في واجهة RTL، فلا يحجب أزرار الإجراء الأساسية.
 */
export function AdminPreviewBar() {
  const router = useRouter();
  const pathname = usePathname();
  const previewFlag = useAdminPreviewFlag();
  const { data: user } = useMe();

  // فحص الدور هنا لا في التخزين: العلامة وحدها قيمة يكتبها أي أحد في
  // `sessionStorage`، فلا تُصدَّق دون جلسة إدارة فعلية.
  const active = previewFlag && user?.role === 'ADMIN';

  // داخل لوحة الإدارة نفسها لا معنى لزر «رجوع للوحة التحكم»
  if (!active || pathname?.startsWith('/admin')) return null;

  const handleExit = () => {
    exitAdminPreview();
    router.push('/admin/dashboard');
  };

  return (
    <button
      type="button"
      onClick={handleExit}
      className="fixed bottom-[calc(var(--spacing-nav)+1rem)] left-4 z-50 flex items-center gap-2 rounded-pill bg-brand-600 px-4 py-2.5 text-badge font-bold text-white shadow-brand transition-colors hover:bg-brand-700"
    >
      <ShieldCheck size={16} aria-hidden="true" />
      رجوع للوحة التحكم
    </button>
  );
}
