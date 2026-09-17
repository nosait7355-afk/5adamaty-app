'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  CircleHelp,
  FileText,
  Heart,
  Info,
  LogOut,
  MapPin,
  MessageSquare,
  Settings,
  Share2,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { AppHeader } from '@/components/layout/app-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { PageContainer } from '@/components/layout/page-container';
import { Card } from '@/components/ui/card';
import { Button, LinkButton } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { InfoAlert } from '@/components/common/info-alert';
import { ErrorState } from '@/components/common/states';
import { MediaThumb } from '@/components/features/discovery/media-thumb';
import { api } from '@/lib/api-client';
import { formatNumber, formatPhone } from '@/lib/format';
import { useAccountSummary } from '@/lib/queries/account';

/**
 * حسابي — الصورة 16.
 *
 * ⚠️ «وسائل الدفع» عنصر **معلوماتي**: قيمته في التصميم نفسه `—`، فيُعرض
 * كسطر يشرح أن الدفع كاش مباشرة — بلا أي بوابة أو بطاقة (ARCHITECTURE §0.1).
 */
export default function AccountPage() {
  const router = useRouter();
  const account = useAccountSummary();

  const logout = async () => {
    await api.post('/auth/logout', {}).catch(() => undefined);
    router.push('/login');
  };

  if (account.isPending) {
    return (
      <>
        <AppHeader />
        <PageContainer className="flex flex-col gap-4 pt-4">
          <Skeleton className="h-28 w-full rounded-card" />
          <Skeleton className="h-20 w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
        </PageContainer>
        <BottomNav />
      </>
    );
  }

  if (account.isError || !account.data) {
    return (
      <>
        <AppHeader />
        <PageContainer className="pt-6">
          <ErrorState message="تعذّر تحميل حسابك" onRetry={() => void account.refetch()} />
        </PageContainer>
        <BottomNav />
      </>
    );
  }

  const { user, stats } = account.data;

  return (
    <>
      <AppHeader notificationCount={stats.unreadNotifications} />

      <PageContainer className="flex flex-col gap-5 pt-4">
        {/* ---- بطاقة الهوية ---- */}
        <Card className="flex items-center gap-4">
          <MediaThumb url={user.avatarUrl} alt={user.fullName} size={64} rounded="full" />

          <div className="min-w-0 flex-1">
            <h1 className="line-clamp-1 text-card-title font-extrabold text-ink-900">
              {user.fullName}
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

        <LinkButton href="/account/profile" variant="secondary" fullWidth>
          تعديل الملف الشخصي
        </LinkButton>

        {/* ---- صف الإحصاءات ---- */}
        <Card className="grid grid-cols-4 divide-x divide-x-reverse divide-border p-0">
          <StatCell
            href="/account/favorites"
            icon={<Heart size={18} />}
            label="المفضلة"
            value={formatNumber(stats.favorites)}
          />
          <StatCell
            href="/account/addresses"
            icon={<MapPin size={18} />}
            label="عناويني"
            value={formatNumber(stats.addresses)}
          />
          {/* «وسائل الدفع» — عنصر معلوماتي غير قابل للنقر، قيمته «—» في التصميم نفسه */}
          <StatCellStatic icon={<Wallet size={18} />} label="وسائل الدفع" value="—" />
          <StatCell
            href="/notifications"
            icon={<MessageSquare size={18} />}
            label="الإشعارات"
            value={formatNumber(stats.unreadNotifications)}
          />
        </Card>

        <InfoAlert tone="info" title="وسائل الدفع">
          {stats.paymentMethodsNote}
        </InfoAlert>

        {/* ---- قائمة الأدوات ---- */}
        <Card className="flex flex-col p-0">
          <ToolRow href="/account/settings" icon={<Settings size={18} />} label="الإعدادات" />
          <ToolRow href="/help" icon={<CircleHelp size={18} />} label="مركز المساعدة" />
          <ToolRow href="/help#contact" icon={<MessageSquare size={18} />} label="تواصل معنا" />
          <ToolRow href="/terms" icon={<FileText size={18} />} label="الشروط والأحكام" />
          <ToolRow href="/privacy" icon={<ShieldCheck size={18} />} label="سياسة الخصوصية" />
          <ToolRow href="/about" icon={<Info size={18} />} label="عن التطبيق" last />
        </Card>

        {/* ---- ادع أصدقاءك ---- */}
        <Card className="flex items-center gap-3 bg-brand-50">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface text-brand-600">
            <Share2 size={24} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-card-title font-bold text-ink-900">ادعُ أصدقاءك</h3>
            <p className="text-meta text-ink-600">شارك التطبيق مع من يحتاج خدمة في الفيوم.</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void navigator.clipboard?.writeText(window.location.origin)}
          >
            مشاركة
          </Button>
        </Card>

        <Button variant="danger" fullWidth onClick={() => void logout()} iconStart={<LogOut size={20} />}>
          تسجيل الخروج
        </Button>
      </PageContainer>

      <BottomNav badges={{ notifications: stats.unreadNotifications }} />
    </>
  );
}

/* ---- عناصر داخلية ---- */

function StatCell({
  href,
  icon,
  label,
  value,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-1 px-1 py-3 text-center transition-colors hover:bg-bg"
    >
      <span className="text-brand-600" aria-hidden="true">
        {icon}
      </span>
      <span className="num text-label font-extrabold text-ink-900">{value}</span>
      <span className="text-badge text-ink-400">{label}</span>
    </Link>
  );
}

/** نسخة غير قابلة للنقر من `StatCell` — لعنصر «وسائل الدفع» المعلوماتي فقط. */
function StatCellStatic({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-1 py-3 text-center">
      <span className="text-brand-600" aria-hidden="true">
        {icon}
      </span>
      <span className="num text-label font-extrabold text-ink-900">{value}</span>
      <span className="text-badge text-ink-400">{label}</span>
    </div>
  );
}

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
