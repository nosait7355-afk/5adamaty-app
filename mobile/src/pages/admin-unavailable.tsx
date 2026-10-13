import { ExternalLink, LayoutDashboard } from 'lucide-react';
import { EmptyState } from '@/components/common/states';
import { useLogout } from '@/lib/queries/auth';
import { API_ORIGIN } from '../config';

/**
 * أي مسار `/admin/*` في التطبيق.
 *
 * لوحة الإدارة مستبعدة من التطبيق عمدًا (أصغر حجمًا، وأدوات الإدارة لا
 * تُشحن لكل جهاز): تعمل من الموقع فقط. حساب الإدارة الذي يسجّل دخوله هنا
 * يُوجَّه لهذه الصفحة.
 */
export default function AdminUnavailablePage() {
  const logout = useLogout();

  return (
    <main className="flex min-h-dvh items-center justify-center p-page">
      <EmptyState
        icon={<LayoutDashboard size={48} strokeWidth={1.5} />}
        message="لوحة الإدارة على الموقع"
        description="إدارة المنصة متاحة من المتصفح فقط، لا من التطبيق."
        action={
          <div className="flex flex-col items-center gap-3">
            <a
              href={`${API_ORIGIN}/admin/dashboard`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-semibold text-brand-600"
            >
              <ExternalLink size={18} />
              فتح لوحة الإدارة
            </a>
            <button
              type="button"
              onClick={() => logout.mutate(undefined)}
              className="text-meta text-ink-600"
            >
              تسجيل الخروج
            </button>
          </div>
        }
      />
    </main>
  );
}
