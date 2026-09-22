'use client';

import Link from 'next/link';
import {
  ChevronLeft,
  CircleHelp,
  FileText,
  LogOut,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Star,
  UserRound,
  Wrench,
} from 'lucide-react';
import { AppHeader } from '@/components/layout/app-header';
import { DeleteAccountCard } from '@/components/features/account/delete-account-card';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PageContainer } from '@/components/layout/page-container';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/common/states';
import { VerificationBadge } from '@/components/common/status-badge';
import { MediaThumb } from '@/components/features/discovery/media-thumb';
import { formatPhone } from '@/lib/format';
import { useMyProviderProfile } from '@/lib/queries/provider';
import { useLogout } from '@/lib/queries/auth';

/** حسابي — مقدم الخدمة. نسخة ما بعد الاعتماد من صفحة الملف/الإعدادات. */
export default function ProviderAccountPage() {
  const profile = useMyProviderProfile();
  const logout = useLogout();

  if (profile.isPending) {
    return (
      <>
        <AppHeader notificationsHref="/provider/notifications" />
        <PageContainer className="flex flex-col gap-4 pt-4">
          <Skeleton className="h-28 w-full rounded-card" />
          <Skeleton className="h-20 w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
        </PageContainer>
        <BottomNav variant="provider" />
      </>
    );
  }

  if (profile.isError || !profile.data) {
    return (
      <>
        <AppHeader notificationsHref="/provider/notifications" />
        <PageContainer className="pt-6">
          <ErrorState message="تعذّر تحميل حسابك" onRetry={() => void profile.refetch()} />
        </PageContainer>
        <BottomNav variant="provider" />
      </>
    );
  }

  const { user, displayName, verification } = profile.data;

  return (
    <>
      <AppHeader notificationsHref="/provider/notifications" />

      <PageContainer className="flex flex-col gap-5 pt-4">
        {/* ---- بطاقة الهوية ---- */}
        <Card className="flex items-center gap-4">
          <MediaThumb url={user.avatarUrl} alt={displayName} size={64} rounded="full" />

          <div className="min-w-0 flex-1">
            <h1 className="line-clamp-1 text-card-title font-extrabold text-ink-900">
              {displayName}
            </h1>
            {user.phone && (
              <p className="num inline-flex items-center gap-1 text-meta text-ink-600">
                {formatPhone(user.phone)}
                <ShieldCheck size={14} className="text-success" aria-label="رقم مؤكَّد" />
              </p>
            )}
            {user.email && <p className="num text-meta text-ink-400">{user.email}</p>}
          </div>

        </Card>

        {/* ---- حالة التوثيق ---- */}
        <Card className="flex items-center justify-between gap-2">
          <span className="text-label font-semibold text-ink-600">حالة الحساب</span>
          <VerificationBadge status={verification.status} />
        </Card>

        {/* ---- قائمة الأدوات ---- */}
        <Card className="flex flex-col p-0">
          <ToolRow href="/provider/profile" icon={<UserRound size={18} />} label="الملف الشخصي" />
          <ToolRow href="/provider/services" icon={<Wrench size={18} />} label="خدماتي" />
          <ToolRow href="/provider/profile" icon={<MapPin size={18} />} label="مناطق التغطية" />
          <ToolRow href="/provider/reviews" icon={<Star size={18} />} label="التقييمات" />
          <ToolRow href="/help" icon={<CircleHelp size={18} />} label="مركز المساعدة" />
          <ToolRow href="/help#contact" icon={<MessageSquare size={18} />} label="تواصل معنا" />
          <ToolRow href="/terms" icon={<FileText size={18} />} label="الشروط والأحكام" />
          <ToolRow href="/privacy" icon={<ShieldCheck size={18} />} label="سياسة الخصوصية" last />
        </Card>

        <Button
          variant="danger"
          fullWidth
          onClick={() => logout.mutate(undefined)}
          disabled={logout.isPending}
          iconStart={<LogOut size={20} />}
        >
          تسجيل الخروج
        </Button>

        <DeleteAccountCard isProvider />
      </PageContainer>

      <BottomNav variant="provider" />
    </>
  );
}

/* ---- عناصر داخلية ---- */

function ToolRow({
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
