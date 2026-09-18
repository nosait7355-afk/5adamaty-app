'use client';

import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  KeyRound,
  LogOut,
  MapPin,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { BackHeader } from '@/components/layout/back-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PageContainer, PageTitle } from '@/components/layout/page-container';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';

/**
 * الإعدادات — عميل (أداة «الإعدادات» في حسابي، الصورة 16).
 *
 * لا تصميم مرجعي مخصّص لهذه الشاشة — تجمع الإجراءات المتعلقة بالحساب
 * والأمان التي لا مكان آخر لها، بدون تكرار أدوات موجودة في «حسابي»
 * (المساعدة، الشروط، الخصوصية، عن التطبيق).
 */
export default function AccountSettingsPage() {
  const router = useRouter();

  const logout = async () => {
    await api.post('/auth/logout', {}).catch(() => undefined);
    router.push('/login');
  };

  return (
    <>
      <BackHeader />

      <PageContainer className="flex flex-col gap-5 pb-10">
        <PageTitle title="الإعدادات" subtitle="إدارة حسابك وبياناتك" />

        <Card className="flex flex-col p-0">
          <SettingsRow href="/account/profile" icon={<UserRound size={18} />} label="تعديل الملف الشخصي" />
          <SettingsRow href="/account/addresses" icon={<MapPin size={18} />} label="عناويني" />
          <SettingsRow
            href="/forgot-password"
            icon={<KeyRound size={18} />}
            label="تغيير كلمة المرور"
            last
          />
        </Card>

        <Card className="flex flex-col p-0">
          <SettingsRow href="/privacy" icon={<ShieldCheck size={18} />} label="سياسة الخصوصية" last />
        </Card>

        <Button variant="danger" fullWidth onClick={() => void logout()} iconStart={<LogOut size={20} />}>
          تسجيل الخروج
        </Button>
      </PageContainer>

      <BottomNav />
    </>
  );
}

function SettingsRow({
  href,
  icon,
  label,
  last = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  last?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-bg ${
        last ? '' : 'border-b border-border'
      }`}
    >
      <span className="text-brand-600" aria-hidden="true">
        {icon}
      </span>
      <span className="flex-1 text-label font-semibold text-ink-900">{label}</span>
      <ChevronLeft size={18} className="text-ink-300" aria-hidden="true" />
    </Link>
  );
}
