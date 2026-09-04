import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { EmptyState } from '@/components/common/states';

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-page">
      <EmptyState
        icon={<SearchX size={48} strokeWidth={1.5} />}
        message="الصفحة غير موجودة"
        description="الرابط الذي فتحته غير صحيح أو لم يعد متاحًا."
        action={
          <Link
            href="/"
            className="rounded-field bg-brand-600 px-6 py-3 text-label font-bold text-white shadow-brand"
          >
            العودة إلى الرئيسية
          </Link>
        }
      />
    </main>
  );
}
