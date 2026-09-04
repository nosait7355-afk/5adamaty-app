'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, Check, ShieldCheck, User } from 'lucide-react';
import { BrandIcon } from '@/components/layout/brand-icon';
import { Button } from '@/components/ui/button';
import { BrandWave, CitySkyline } from '@/components/features/auth/city-skyline';
import { cn } from '@/lib/cn';

type AccountKind = 'CUSTOMER' | 'PROVIDER';

/**
 * اختيار نوع الحساب — الصورة 02.
 *
 * موجة زرقاء علوية · اللوجو فوق رسم المعالم · العنوان والوصف ·
 * بطاقتان متجاورتان (المنتقاة: حد أزرق + زاوية سفلية زرقاء مائلة + ✓) ·
 * بطاقة الثقة «آمن وموثوق» · موجة سفلية.
 */
export default function RoleSelectPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<AccountKind>('CUSTOMER');

  const handleContinue = () => {
    router.push(selected === 'CUSTOMER' ? '/register' : '/register/provider');
  };

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-bg">
      <BrandWave position="top" className="absolute inset-x-0 top-0 h-20" />

      <div className="relative z-10 mx-auto flex w-full max-w-[520px] flex-1 flex-col px-page pb-8 pt-safe">
        {/* العلامة فوق رسم المعالم */}
        <div className="relative pt-12">
          <div
            className="pointer-events-none absolute inset-x-0 top-6 select-none opacity-50"
            aria-hidden="true"
          >
            <CitySkyline className="h-28" />
          </div>

          <div className="relative flex flex-col items-center">
            <BrandIcon size={104} priority />
            <p className="mt-1 text-[1.75rem] font-extrabold text-brand-600">خدماتي الفيوم</p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <h1 className="text-screen-title font-extrabold text-ink-900">اختر نوع الحساب</h1>
          <p className="mt-2 text-body text-ink-400">اختر نوع الحساب المناسب لك للمتابعة</p>
        </div>

        {/* البطاقتان */}
        <div className="mt-8 grid grid-cols-2 gap-3">
          <RoleCard
            kind="CUSTOMER"
            selected={selected === 'CUSTOMER'}
            onSelect={setSelected}
            icon={<User size={52} strokeWidth={1.5} />}
            title="مستخدم"
            description={'أبحث عن خدمات\nوأطلب ما أحتاجه بسهولة'}
          />
          <RoleCard
            kind="PROVIDER"
            selected={selected === 'PROVIDER'}
            onSelect={setSelected}
            icon={<Briefcase size={52} strokeWidth={1.5} />}
            title="مقدم خدمة"
            description={'أقدم خدماتي\nوأصل إلى المزيد من العملاء'}
          />
        </div>

        {/* بطاقة الثقة */}
        <div className="mt-6 flex items-center gap-3 rounded-card bg-brand-50/70 p-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">
            <ShieldCheck size={26} />
          </span>
          <div>
            <p className="text-label font-bold text-brand-600">آمن وموثوق</p>
            <p className="text-meta leading-6 text-ink-600">
              بياناتك محمية معنا ولن يتم مشاركتها مع أي طرف آخر
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <Button fullWidth onClick={handleContinue}>
            متابعة
          </Button>
          <Button variant="ghost" fullWidth size="md" onClick={() => router.push('/login')}>
            لديك حساب بالفعل؟ تسجيل الدخول
          </Button>
        </div>

        <div className="flex-1" />
      </div>

      <BrandWave className="absolute inset-x-0 bottom-0 h-24" />
    </main>
  );
}

function RoleCard({
  kind,
  selected,
  onSelect,
  icon,
  title,
  description,
}: {
  kind: AccountKind;
  selected: boolean;
  onSelect: (kind: AccountKind) => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(kind)}
      className={cn(
        'relative flex flex-col items-center gap-3 overflow-hidden rounded-card border-2 bg-surface p-5',
        'text-center transition-colors',
        selected ? 'border-brand-600 shadow-card' : 'border-transparent shadow-card'
      )}
    >
      {/* الزاوية السفلية الزرقاء المائلة — تظهر على البطاقة المنتقاة فقط */}
      {selected && (
        <span
          aria-hidden="true"
          className="absolute -bottom-6 -start-6 size-16 rotate-45 bg-brand-600"
        />
      )}

      <span className="flex size-24 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        {icon}
      </span>

      <span className="text-[1.25rem] font-extrabold text-brand-600">{title}</span>

      <span className="whitespace-pre-line text-meta leading-6 text-ink-400">{description}</span>

      <span
        className={cn(
          'relative z-10 flex size-8 items-center justify-center rounded-full border-2',
          selected ? 'border-brand-600 bg-brand-600 text-white' : 'border-brand-600 bg-surface'
        )}
        aria-hidden="true"
      >
        {selected && <Check size={18} strokeWidth={3} />}
      </span>
    </button>
  );
}
